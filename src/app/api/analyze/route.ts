import { z } from "zod";
import type { Analysis, AnalyzeError, AnalyzeErrorCode } from "@/lib/types";

export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// GPT-4o's vision is much better at judging portions than the nano models.
// Set OPENROUTER_MODEL=openai/gpt-4.1-nano for a cheaper, rougher estimate.
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o";

// ~8 MB of base64. The client downsizes photos to well under 1 MB.
const MAX_IMAGE_CHARS = 8_000_000;

const RequestSchema = z
  .object({
    image: z
      .object({
        data: z.string().min(1).max(MAX_IMAGE_CHARS),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .optional(),
    description: z.string().trim().max(1000).optional(),
    correction: z.string().trim().max(500).optional(),
    previous: z
      .object({
        name: z.string(),
        items: z.array(
          z.object({
            name: z.string(),
            portion: z.string(),
            calories: z.number(),
            protein: z.number(),
            carbs: z.number(),
            fat: z.number(),
          }),
        ),
        confidence: z.string(),
        notes: z.string(),
      })
      .optional(),
  })
  .refine((body) => body.image || body.description, {
    message: "Provide a photo or a description of the meal.",
  });

const OutputSchema = z.object({
  is_food: z
    .boolean()
    .describe("False if the input shows or describes no food or drink."),
  meal_name: z
    .string()
    .describe('Short, natural title for the meal, e.g. "Salmon poke bowl".'),
  items: z.array(
    z.object({
      name: z.string().describe('Food name, e.g. "Grilled chicken breast".'),
      portion: z
        .string()
        .describe('Estimated amount with grams, e.g. "1 fillet (150 g)".'),
      calories: z.number().describe("kcal for this portion."),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    }),
  ),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z
    .string()
    .describe(
      "One short sentence on the main source of uncertainty, or an empty string.",
    ),
});

const SYSTEM_PROMPT = `You are a registered dietitian estimating the nutrition of a meal for a calorie-tracking app.

How to estimate:
- Identify each distinct food and drink. Split composite dishes into their meaningful components (e.g. rice, chicken, sauce) when that improves accuracy; keep simple foods as one item.
- Judge portion sizes from visual cues: plate and bowl size (a dinner plate is ~26 cm), utensils, hands, packaging, and food thickness. State the portion in everyday units plus grams.
- Account for hidden calories that are typical for the dish: cooking oil, butter, dressings, sauces, sugar in drinks.
- Base values on standard references (USDA FoodData Central). Calories should be consistent with macros (4 kcal/g protein and carbs, 9 kcal/g fat).
- If the user gives a description or correction, treat it as authoritative over what you see.
- Prefer realistic, typical estimates over extreme ones. Do not pad or under-count.

Set is_food to false only when there is clearly no food or drink at all; in that case return an empty items list.
Keep meal_name under 40 characters, in sentence case.`;

function errorResponse(
  code: AnalyzeErrorCode,
  message: string,
  status: number,
) {
  return Response.json({ error: { code, message } } satisfies AnalyzeError, {
    status,
  });
}

// Zod emits additionalProperties: false and full `required` lists, which is
// what OpenAI's strict structured outputs expect. Drop the $schema marker.
const OUTPUT_JSON_SCHEMA: Record<string, unknown> = z.toJSONSchema(
  OutputSchema,
  { target: "draft-7" },
);
delete OUTPUT_JSON_SCHEMA.$schema;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

interface ChatCompletion {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
  error?: { code?: number; message?: string };
}

class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function complete(content: ContentPart[]): Promise<ChatCompletion> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Calapp",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meal_analysis",
          strict: true,
          schema: OUTPUT_JSON_SCHEMA,
        },
      },
      // Only route to providers that honor the JSON schema.
      provider: { require_parameters: true },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as ChatCompletion;
  // OpenRouter can also report upstream failures inside a 200 response.
  if (!res.ok || data.error) {
    throw new UpstreamError(
      data.error?.code ?? res.status,
      data.error?.message ?? res.statusText,
    );
  }
  return data;
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(
        "bad_request",
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
      );
    }
    body = parsed.data;
  } catch {
    return errorResponse("bad_request", "Invalid request body.", 400);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return errorResponse(
      "not_configured",
      "The server is missing OPENROUTER_API_KEY. Add it to .env.local and restart.",
      500,
    );
  }

  const content: ContentPart[] = [];
  if (body.image) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${body.image.mediaType};base64,${body.image.data}`,
        detail: "high",
      },
    });
  }

  const instructions: string[] = [];
  if (body.description) {
    instructions.push(`The user describes the meal as: "${body.description}"`);
  }
  if (body.previous && body.correction) {
    instructions.push(
      `Your previous estimate was:\n${JSON.stringify(body.previous)}\n\nThe user corrected it: "${body.correction}"\nRevise the estimate to reflect the correction. Keep items that are unaffected.`,
    );
  } else if (body.correction) {
    instructions.push(`Additional context from the user: "${body.correction}"`);
  }
  instructions.push(
    body.image
      ? "Estimate the nutrition of the meal in this photo."
      : "Estimate the nutrition of this meal.",
  );
  content.push({ type: "text", text: instructions.join("\n\n") });

  try {
    const choice = (await complete(content)).choices?.[0];

    if (
      choice?.message?.refusal ||
      choice?.finish_reason === "content_filter"
    ) {
      return errorResponse(
        "refused",
        "This image couldn't be analyzed. Try a different photo or describe the meal instead.",
        422,
      );
    }

    let output: z.infer<typeof OutputSchema> | undefined;
    try {
      const parsed = OutputSchema.safeParse(
        JSON.parse(choice?.message?.content ?? ""),
      );
      if (parsed.success) output = parsed.data;
    } catch {
      /* not JSON, e.g. cut off at max_tokens */
    }
    if (!output) {
      return errorResponse(
        "upstream",
        "The analysis came back incomplete. Please try again.",
        502,
      );
    }

    if (!output.is_food || output.items.length === 0) {
      return errorResponse(
        "not_food",
        body.image
          ? "We couldn't spot any food in this photo."
          : "We couldn't recognize any food in that description.",
        422,
      );
    }

    const round = (n: number) => Math.max(0, Math.round(n));
    const result: Analysis = {
      name: output.meal_name.trim() || "Meal",
      items: output.items.map((item) => ({
        name: item.name.trim(),
        portion: item.portion.trim(),
        calories: round(item.calories),
        protein: round(item.protein_g),
        carbs: round(item.carbs_g),
        fat: round(item.fat_g),
      })),
      confidence: output.confidence,
      notes: output.notes.trim(),
    };
    return Response.json(result);
  } catch (err) {
    if (err instanceof UpstreamError) {
      console.error("[analyze] OpenRouter error:", err.status, err.message);
      if (err.status === 401 || err.status === 403) {
        return errorResponse(
          "not_configured",
          "The server's OPENROUTER_API_KEY is invalid. Check .env.local and restart.",
          500,
        );
      }
      if (err.status === 402) {
        return errorResponse(
          "not_configured",
          "The OpenRouter account is out of credits.",
          502,
        );
      }
      if (err.status === 429) {
        return errorResponse(
          "rate_limited",
          "Too many requests right now. Wait a moment and try again.",
          429,
        );
      }
      if (err.status === 400) {
        return errorResponse(
          "bad_request",
          "This image couldn't be processed. Try a different photo.",
          400,
        );
      }
      return errorResponse(
        "upstream",
        "The analysis service is having trouble. Please try again.",
        502,
      );
    }
    console.error("[analyze] connection error:", err);
    return errorResponse(
      "upstream",
      "Couldn't reach the analysis service. Check your connection and try again.",
      503,
    );
  }
}
