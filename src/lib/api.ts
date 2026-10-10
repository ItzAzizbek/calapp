import type {
  Analysis,
  AnalyzeError,
  AnalyzeErrorCode,
  AnalyzeRequest,
} from "./types";

export class AnalyzeFailure extends Error {
  constructor(
    public code: AnalyzeErrorCode | "offline" | "network",
    message: string,
  ) {
    super(message);
  }
}

export async function analyzeMeal(
  req: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<Analysis> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AnalyzeFailure(
      "offline",
      "You're offline. Connect to the internet to analyze meals.",
    );
  }

  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new AnalyzeFailure(
      "network",
      "Couldn't reach the server. Check your connection and try again.",
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as AnalyzeError | null;
    throw new AnalyzeFailure(
      body?.error.code ?? "upstream",
      body?.error.message ?? "Something went wrong. Please try again.",
    );
  }
  return (await res.json()) as Analysis;
}
