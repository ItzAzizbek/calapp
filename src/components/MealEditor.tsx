"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Camera,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Trash2,
  TriangleAlert,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyzeFailure, analyzeMeal } from "@/lib/api";
import { dataUrlToBase64, ImageError, prepareImage } from "@/lib/image";
import {
  MEAL_TYPES,
  type Analysis,
  type AnalyzeRequest,
  type Confidence,
  type Entry,
  type FoodItem,
  type MealType,
} from "@/lib/types";
import {
  cn,
  dayKey,
  fmt,
  mealTypeForTime,
  sumItems,
  timestampOn,
  uid,
} from "@/lib/utils";
import { NumberField } from "./NumberField";
import { Sheet } from "./Sheet";

export type EditorMode =
  | { kind: "photo"; file: Blob }
  | { kind: "describe" }
  | { kind: "edit"; entry: Entry };

interface MealEditorProps {
  open: boolean;
  mode: EditorMode;
  /** Day new entries are logged to. */
  day: string;
  onClose: () => void;
  onSave: (entry: Entry, isNew: boolean) => void;
  onDelete: (entry: Entry) => void;
  /** Close the editor and open the photo picker. */
  onPickPhoto: () => void;
}

type Phase = "describe" | "analyzing" | "review" | "error";

interface Draft {
  name: string;
  items: FoodItem[];
  servings: number;
  mealType: MealType;
  confidence?: Confidence;
  notes?: string;
}

interface ImageState {
  /** Base64 JPEG for the API. */
  analysis: string;
  /** Data URL for display and storage. */
  thumbnail: string;
}

const HINTS = [
  "Identifying foods",
  "Estimating portions",
  "Counting hidden oils and sauces",
  "Calculating macros",
];

function draftFromAnalysis(a: Analysis, prev?: Draft): Draft {
  return {
    name: a.name,
    items: a.items.map((item) => ({ ...item, id: uid() })),
    servings: prev?.servings ?? 1,
    mealType: prev?.mealType ?? mealTypeForTime(),
    confidence: a.confidence,
    notes: a.notes,
  };
}

function analysisFromDraft(d: Draft): Analysis {
  return {
    name: d.name,
    items: d.items.map(({ name, portion, calories, protein, carbs, fat }) => ({
      name,
      portion,
      calories,
      protein,
      carbs,
      fat,
    })),
    confidence: d.confidence ?? "medium",
    notes: d.notes ?? "",
  };
}

export function MealEditor({
  open,
  mode,
  day,
  onClose,
  onSave,
  onDelete,
  onPickPhoto,
}: MealEditorProps) {
  const editing = mode.kind === "edit" ? mode.entry : null;

  const [phase, setPhase] = useState<Phase>(() =>
    mode.kind === "photo"
      ? "analyzing"
      : mode.kind === "describe"
        ? "describe"
        : "review",
  );
  const [image, setImage] = useState<ImageState | null>(() =>
    editing?.image
      ? { analysis: dataUrlToBase64(editing.image), thumbnail: editing.image }
      : null,
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [draft, setDraft] = useState<Draft | null>(() =>
    editing
      ? {
          name: editing.name,
          items: editing.items,
          servings: editing.servings,
          mealType: editing.mealType,
          confidence: editing.confidence,
          notes: editing.notes,
        }
      : null,
  );
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [correction, setCorrection] = useState("");
  const [refining, setRefining] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  });

  const run = useCallback(
    async (req: AnalyzeRequest, opts: { refine?: boolean } = {}) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      if (opts.refine) setRefining(true);
      else setPhase("analyzing");
      try {
        const result = await analyzeMeal(req, controller.signal);
        if (controller.signal.aborted) return;
        setDraft(draftFromAnalysis(result, draftRef.current ?? undefined));
        setExpandedId(null);
        setCorrection("");
        setPhase("review");
      } catch (err) {
        if (controller.signal.aborted) return;
        const failure =
          err instanceof AnalyzeFailure
            ? err
            : new AnalyzeFailure("upstream", "Something went wrong.");
        setError({ code: failure.code, message: failure.message });
        if (!opts.refine) setPhase("error");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setRefining(false);
        }
      }
    },
    [],
  );

  // Photo mode: prepare and analyze immediately.
  const file = mode.kind === "photo" ? mode.file : null;
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      try {
        const prepared = await prepareImage(file);
        if (cancelled) return;
        setImage(prepared);
        await run({
          image: { data: prepared.analysis, mediaType: "image/jpeg" },
        });
      } catch (err) {
        if (cancelled) return;
        setError({
          code: "image",
          message:
            err instanceof ImageError
              ? err.message
              : "We couldn't open this image.",
        });
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [file, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  const baseRequest = (): AnalyzeRequest => ({
    image: image
      ? { data: image.analysis, mediaType: "image/jpeg" }
      : undefined,
    description: description.trim() || undefined,
  });

  const submitDescription = () => {
    if (!description.trim() && !image) return;
    void run(baseRequest());
  };

  const submitCorrection = () => {
    const text = correction.trim();
    if (!text || !draft || refining) return;
    if (!image && !description.trim()) {
      // Manually-built entry with nothing to look at: treat as description.
      void run({ description: text }, { refine: true });
      return;
    }
    void run(
      {
        ...baseRequest(),
        correction: text,
        previous: analysisFromDraft(draft),
      },
      { refine: true },
    );
  };

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const updateItem = (id: string, patch: Partial<FoodItem>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            items: d.items.map((it) =>
              it.id === id ? { ...it, ...patch } : it,
            ),
          }
        : d,
    );

  const removeItem = (id: string) =>
    setDraft((d) =>
      d ? { ...d, items: d.items.filter((it) => it.id !== id) } : d,
    );

  const addItem = () => {
    const item: FoodItem = {
      id: uid(),
      name: "",
      portion: "",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    setDraft((d) => (d ? { ...d, items: [...d.items, item] } : d));
    setExpandedId(item.id);
  };

  const save = () => {
    if (!draft) return;
    const items = draft.items
      .filter((it) => it.name.trim() || it.calories > 0)
      .map((it) => ({
        ...it,
        name: it.name.trim() || "Food",
        portion: it.portion.trim(),
      }));
    if (items.length === 0) return;
    const name = draft.name.trim() || items[0].name;
    const entry: Entry = {
      id: editing?.id ?? uid(),
      day: editing?.day ?? day,
      eatenAt:
        editing?.eatenAt ?? (day === dayKey() ? Date.now() : timestampOn(day)),
      mealType: draft.mealType,
      name,
      items,
      servings: draft.servings,
      image: image?.thumbnail,
      description: description.trim() || undefined,
      confidence: draft.confidence,
      notes: draft.notes,
    };
    onSave(entry, !editing);
  };

  const totals = draft ? sumItems(draft.items, draft.servings) : null;
  const canSave =
    !!draft &&
    !refining &&
    draft.items.some((it) => it.name.trim() || it.calories > 0);

  const title =
    phase === "describe"
      ? "Describe your meal"
      : editing
        ? "Edit meal"
        : "New meal";

  /* ---------- Footer ---------- */

  let footer: React.ReactNode = null;
  if (phase === "describe") {
    footer = (
      <PrimaryButton
        onClick={submitDescription}
        disabled={!description.trim() && !image}
      >
        <Sparkles className="size-4" />
        Analyze
      </PrimaryButton>
    );
  } else if (phase === "analyzing") {
    footer = (
      <SecondaryButton onClick={close} className="w-full">
        Cancel
      </SecondaryButton>
    );
  } else if (phase === "review" && totals) {
    footer = (
      <div className="flex gap-2">
        {editing && (
          <button
            type="button"
            onClick={() =>
              confirmDelete ? onDelete(editing) : setConfirmDelete(true)
            }
            onBlur={() => setConfirmDelete(false)}
            aria-label={confirmDelete ? "Confirm delete" : "Delete meal"}
            className={cn(
              "flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-medium transition-all",
              confirmDelete
                ? "bg-danger text-white"
                : "bg-surface-2 text-danger hover:bg-surface-3",
            )}
          >
            <Trash2 className="size-[18px]" />
            {confirmDelete && <span>Delete</span>}
          </button>
        )}
        <PrimaryButton onClick={save} disabled={!canSave}>
          {editing ? "Save changes" : `Log ${fmt(totals.calories)} kcal`}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={title} footer={footer}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {phase === "describe" && (
            <DescribeStep
              value={description}
              onChange={setDescription}
              onSubmit={submitDescription}
              image={image?.thumbnail}
            />
          )}

          {phase === "analyzing" && (
            <AnalyzingStep image={image?.thumbnail} description={description} />
          )}

          {phase === "error" && error && (
            <ErrorStep
              image={image?.thumbnail}
              error={error}
              onRetry={() => void run(baseRequest())}
              onPickPhoto={onPickPhoto}
              onDescribe={() => {
                setError(null);
                setPhase("describe");
              }}
            />
          )}

          {phase === "review" && draft && totals && (
            <div
              className={cn(
                "flex flex-col gap-6 pt-1 transition-opacity",
                refining && "opacity-60",
              )}
              aria-busy={refining}
            >
              {image ? (
                <div className="overflow-hidden rounded-[20px] bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.thumbnail}
                    alt="Your meal"
                    className="aspect-[4/3] max-h-64 w-full object-cover"
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="meal-name" className="sr-only">
                  Meal name
                </label>
                <input
                  id="meal-name"
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  placeholder="Meal name"
                  className="-mx-2 w-[calc(100%+1rem)] rounded-xl bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight outline-none placeholder:text-faint hover:bg-surface-2/60 focus:bg-surface-2"
                />
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div
                    className="text-[44px] leading-none font-semibold tracking-[-0.045em] tabular-nums"
                    aria-live="polite"
                  >
                    {fmt(totals.calories)}
                    <span className="ml-1.5 text-base font-medium tracking-normal text-muted">
                      kcal
                    </span>
                  </div>
                  {draft.confidence && (
                    <ConfidenceBadge confidence={draft.confidence} />
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MacroChip
                    label="Protein"
                    value={totals.protein}
                    color="bg-protein"
                  />
                  <MacroChip
                    label="Carbs"
                    value={totals.carbs}
                    color="bg-carbs"
                  />
                  <MacroChip label="Fat" value={totals.fat} color="bg-fat" />
                </div>
                {draft.notes && (
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">
                    {draft.notes}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-[auto_1fr]">
                <Field label="Portion">
                  <ServingsStepper
                    value={draft.servings}
                    onChange={(servings) => updateDraft({ servings })}
                  />
                </Field>
                <Field label="Meal">
                  <MealTypePicker
                    value={draft.mealType}
                    onChange={(mealType) => updateDraft({ mealType })}
                  />
                </Field>
              </div>

              <section aria-labelledby="items-heading">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3
                    id="items-heading"
                    className="text-[13px] font-medium text-muted"
                  >
                    Items
                  </h3>
                  {draft.servings !== 1 && (
                    <span className="text-xs text-faint">
                      values per 1× portion
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2/60">
                  <AnimatePresence initial={false}>
                    {draft.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        expanded={expandedId === item.id}
                        onToggle={() =>
                          setExpandedId((id) =>
                            id === item.id ? null : item.id,
                          )
                        }
                        onChange={(patch) => updateItem(item.id, patch)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                  </AnimatePresence>
                  <li>
                    <button
                      type="button"
                      onClick={addItem}
                      className="flex w-full items-center gap-2 px-4 py-3.5 text-[15px] font-medium text-muted transition-colors hover:text-fg"
                    >
                      <Plus className="size-4" />
                      Add item
                    </button>
                  </li>
                </ul>
              </section>

              <section aria-labelledby="refine-heading">
                <h3
                  id="refine-heading"
                  className="mb-2 text-[13px] font-medium text-muted"
                >
                  Something off?
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitCorrection();
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-surface-2 p-1.5 pl-4 focus-within:ring-2 focus-within:ring-fg/80"
                >
                  <input
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder="e.g. no cheese, it was a large bowl"
                    aria-label="Correction for the estimate"
                    disabled={refining}
                    maxLength={500}
                    className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!correction.trim() || refining}
                    aria-label="Update estimate"
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-fg text-inverse transition-opacity disabled:opacity-25"
                  >
                    {refining ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4" strokeWidth={2.5} />
                    )}
                  </button>
                </form>
                <AnimatePresence>
                  {error && phase === "review" && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      role="alert"
                      className="mt-2 text-[13px] text-danger"
                    >
                      {error.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}

/* ---------- Steps ---------- */

function DescribeStep({
  value,
  onChange,
  onSubmit,
  image,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  image?: string;
}) {
  return (
    <div className="flex flex-col gap-4 pt-1">
      {image && (
        <div className="overflow-hidden rounded-[20px] bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Your meal"
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      )}
      <p className="text-[15px] text-muted">
        {image
          ? "Tell us what's in the photo and we'll take it from there."
          : "List what you ate. Amounts help, but rough is fine."}
      </p>
      <textarea
        data-autofocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={4}
        maxLength={1000}
        aria-label="Meal description"
        placeholder="Two scrambled eggs, a slice of sourdough with butter, and an oat flat white"
        className="w-full resize-none rounded-2xl bg-surface-2 p-4 text-[15px] leading-relaxed outline-none placeholder:text-faint focus:ring-2 focus:ring-fg/80"
      />
    </div>
  );
}

function AnalyzingStep({
  image,
  description,
}: {
  image?: string;
  description: string;
}) {
  const [hint, setHint] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-6 pt-1" aria-busy="true">
      <div className="relative overflow-hidden rounded-[20px] bg-surface-2">
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="Your meal"
              className="aspect-[4/3] max-h-72 w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/15" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-scan absolute inset-x-0 h-full bg-gradient-to-b from-transparent via-white/25 to-transparent" />
            </div>
          </>
        ) : description ? (
          <div className="flex min-h-36 items-center p-5 text-[15px] leading-relaxed text-muted">
            “{description}”
          </div>
        ) : (
          <div className="skeleton aspect-[4/3] max-h-72 w-full" />
        )}
      </div>

      <div className="flex items-center gap-3" role="status">
        <span className="relative grid size-9 place-items-center rounded-full bg-surface-2">
          <ScanSearch className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">Analyzing your meal</div>
          <div className="relative h-5 overflow-hidden text-[13px] text-muted">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={hint}
                className="absolute inset-0"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {HINTS[hint]}…
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3" aria-hidden>
        <div className="skeleton h-7 w-2/3 rounded-lg" />
        <div className="skeleton h-11 w-1/3 rounded-lg" />
        <div className="grid grid-cols-3 gap-2">
          <div className="skeleton h-14 rounded-2xl" />
          <div className="skeleton h-14 rounded-2xl" />
          <div className="skeleton h-14 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function ErrorStep({
  image,
  error,
  onRetry,
  onPickPhoto,
  onDescribe,
}: {
  image?: string;
  error: { code: string; message: string };
  onRetry: () => void;
  onPickPhoto: () => void;
  onDescribe: () => void;
}) {
  const notFood = error.code === "not_food";
  const badImage = error.code === "image";
  const configError = error.code === "not_configured";
  return (
    <div className="flex flex-col items-center gap-5 pt-2 text-center">
      {image ? (
        <div className="size-24 overflow-hidden rounded-3xl bg-surface-2 opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="size-full object-cover" />
        </div>
      ) : (
        <span className="grid size-14 place-items-center rounded-full bg-surface-2">
          <TriangleAlert className="size-6 text-muted" />
        </span>
      )}
      <div>
        <p className="text-[17px] font-semibold">
          {notFood
            ? "No food found"
            : error.code === "not_configured"
              ? "Setup needed"
              : error.code === "offline"
                ? "You're offline"
                : "Couldn't analyze"}
        </p>
        <p
          className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted"
          role="alert"
        >
          {error.message}
        </p>
      </div>
      {!configError && (
        <div className="flex w-full flex-col gap-2">
          {badImage || (notFood && image) ? (
            <SecondaryButton onClick={onPickPhoto} className="w-full">
              <Camera className="size-4" />
              Choose another photo
            </SecondaryButton>
          ) : (
            !notFood && (
              <SecondaryButton onClick={onRetry} className="w-full">
                <RotateCcw className="size-4" />
                Try again
              </SecondaryButton>
            )
          )}
          {!badImage && (
            <SecondaryButton onClick={onDescribe} className="w-full">
              <Type className="size-4" />
              {image ? "Describe it instead" : "Edit description"}
            </SecondaryButton>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Pieces ---------- */

function ItemRow({
  item,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  item: FoodItem;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<FoodItem>) => void;
  onRemove: () => void;
}) {
  const panelId = `item-${item.id}`;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-[15px] font-medium",
              !item.name && "text-faint",
            )}
          >
            {item.name || "New item"}
          </div>
          {item.portion && (
            <div className="truncate text-[13px] text-muted">
              {item.portion}
            </div>
          )}
        </div>
        <div className="text-[15px] font-medium tabular-nums">
          {fmt(item.calories)}
          <span className="ml-0.5 text-xs font-normal text-muted">kcal</span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <TextField
                  label="Name"
                  value={item.name}
                  onChange={(name) => onChange({ name })}
                  autoFocus={!item.name}
                  placeholder="e.g. Brown rice"
                />
                <TextField
                  label="Amount"
                  value={item.portion}
                  onChange={(portion) => onChange({ portion })}
                  placeholder="e.g. 1 cup (180 g)"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <NumberField
                  label="kcal"
                  value={item.calories}
                  onChange={(calories) =>
                    onChange({ calories: Math.round(calories) })
                  }
                />
                <NumberField
                  label="Protein"
                  value={item.protein}
                  suffix="g"
                  onChange={(protein) => onChange({ protein })}
                />
                <NumberField
                  label="Carbs"
                  value={item.carbs}
                  suffix="g"
                  onChange={(carbs) => onChange({ carbs })}
                />
                <NumberField
                  label="Fat"
                  value={item.fat}
                  suffix="g"
                  onChange={(fat) => onChange({ fat })}
                />
              </div>
              <button
                type="button"
                onClick={onRemove}
                className="flex items-center gap-1.5 self-start rounded-lg py-1 text-[13px] font-medium text-danger hover:opacity-80"
              >
                <Trash2 className="size-3.5" />
                Remove item
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={80}
        className="h-10 rounded-xl bg-surface px-3 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-fg/80"
      />
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-muted" aria-hidden>
        {label}
      </span>
      {children}
    </div>
  );
}

function ServingsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const step = (delta: number) =>
    onChange(Math.min(10, Math.max(0.25, Math.round((value + delta) * 4) / 4)));
  const label = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <div className="flex h-11 w-fit items-center rounded-2xl bg-surface-2 p-1">
      <button
        type="button"
        onClick={() => step(value <= 1 ? -0.25 : -0.5)}
        disabled={value <= 0.25}
        aria-label="Smaller portion"
        className="grid size-9 place-items-center rounded-xl transition-colors enabled:hover:bg-surface disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <span
        className="min-w-14 text-center text-[15px] font-semibold tabular-nums"
        aria-live="polite"
        aria-label={`${label} portions`}
      >
        {label}×
      </span>
      <button
        type="button"
        onClick={() => step(value < 1 ? 0.25 : 0.5)}
        disabled={value >= 10}
        aria-label="Larger portion"
        className="grid size-9 place-items-center rounded-xl transition-colors enabled:hover:bg-surface disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function MealTypePicker({
  value,
  onChange,
}: {
  value: MealType;
  onChange: (v: MealType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Meal"
      className="grid h-11 grid-cols-4 rounded-2xl bg-surface-2 p-1"
    >
      {MEAL_TYPES.map((type) => {
        const active = type.id === value;
        return (
          <button
            key={type.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(type.id)}
            className={cn(
              "relative rounded-xl text-[13px] font-medium transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId="meal-type-pill"
                className="absolute inset-0 rounded-xl bg-surface shadow-sm"
                transition={{ type: "spring", damping: 30, stiffness: 420 }}
              />
            )}
            <span className="relative">{type.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MacroChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span className={cn("size-1.5 rounded-full", color)} aria-hidden />
        {label}
      </div>
      <div className="mt-0.5 text-[17px] font-semibold tabular-nums">
        {fmt(value)}
        <span className="ml-0.5 text-xs font-normal text-muted">g</span>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const label =
    confidence === "high"
      ? "High confidence"
      : confidence === "medium"
        ? "Good estimate"
        : "Rough estimate";
  return (
    <span className="mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-1 rounded-full",
              i < (confidence === "high" ? 3 : confidence === "medium" ? 2 : 1)
                ? "bg-fg"
                : "bg-surface-3",
            )}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full flex-1 items-center justify-center gap-2 rounded-2xl bg-fg px-5 text-[15px] font-semibold text-inverse transition-[opacity,transform] active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-surface-2 px-5 text-[15px] font-semibold transition-[background-color,transform] hover:bg-surface-3 active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </button>
  );
}
