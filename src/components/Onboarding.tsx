"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  Apple,
  Armchair,
  ArrowLeft,
  Beef,
  Bike,
  Camera,
  Carrot,
  Check,
  Coffee,
  Croissant,
  Dumbbell,
  Egg,
  Fish,
  Footprints,
  Minus,
  Pizza,
  Plus,
  Salad,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ACTIVITIES,
  GOALS,
  MAX_CALORIES,
  MIN_CALORIES,
  DEFAULT_STATS,
  calorieTarget,
  clampCalories,
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  maintenance,
} from "@/lib/plan";
import type {
  Activity,
  GoalKind,
  Goals,
  Profile,
  Sex,
  Units,
} from "@/lib/types";
import { autoMacros, cn, fmt } from "@/lib/utils";
import { Logo } from "./Logo";
import { NumberField } from "./NumberField";
import { AnimatedNumber } from "./Summary";

type StepId =
  "welcome" | "how" | "name" | "goal" | "body" | "activity" | "plan";
const STEPS: StepId[] = [
  "welcome",
  "how",
  "name",
  "goal",
  "body",
  "activity",
  "plan",
];

interface Draft {
  name: string;
  goal: GoalKind | null;
  activity: Activity | null;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  units: Units;
}

const EASE = [0.32, 0.72, 0, 1] as const;

const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -56, opacity: 0 }),
};

interface OnboardingProps {
  /** Existing profile when re-running setup from settings. */
  initial: Profile | null;
  onDone: (profile: Omit<Profile, "onboardedAt">, goals: Goals) => void;
  /** Present when re-running setup: shows a close button. */
  onCancel?: () => void;
}

export function Onboarding({ initial, onDone, onCancel }: OnboardingProps) {
  const [index, setIndex] = useState(initial ? STEPS.indexOf("name") : 0);
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...DEFAULT_STATS,
    name: "",
    goal: null,
    activity: null,
    units: guessUnits(),
    ...initial,
  }));
  const [adjust, setAdjust] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const step = STEPS[index];
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index]);
  const firstIndex = initial ? STEPS.indexOf("name") : 0;

  const go = (delta: number) => {
    clearTimeout(advanceTimer.current);
    setDir(delta);
    setIndex((i) =>
      Math.min(STEPS.length - 1, Math.max(firstIndex, i + delta)),
    );
  };
  const update = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  /** Select an option, then move on once the selection has registered. */
  const pick = (patch: Partial<Draft>) => {
    update(patch);
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => go(1), 280);
  };

  const stats = {
    ...draft,
    goal: draft.goal ?? "maintain",
    activity: draft.activity ?? "light",
  };
  const base = calorieTarget(stats);
  const calories = clampCalories(base + adjust);

  const toProfile = (): Omit<Profile, "onboardedAt"> => ({
    name: draft.name.trim(),
    goal: stats.goal,
    activity: stats.activity,
    sex: draft.sex,
    age: draft.age,
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    units: draft.units,
  });

  const finish = () =>
    onDone(toProfile(), {
      calories,
      ...autoMacros(calories),
      autoMacros: true,
    });

  const cta: { label: string; disabled?: boolean; onClick: () => void } = {
    welcome: { label: "Get started", onClick: () => go(1) },
    how: { label: "Continue", onClick: () => go(1) },
    name: {
      label: draft.name.trim() ? "Continue" : "Skip for now",
      onClick: () => go(1),
    },
    goal: { label: "Continue", disabled: !draft.goal, onClick: () => go(1) },
    body: { label: "Continue", onClick: () => go(1) },
    activity: {
      label: "See my plan",
      disabled: !draft.activity,
      onClick: () => go(1),
    },
    plan: { label: "Start logging", onClick: finish },
  }[step];

  const progressSteps = STEPS.length - 1;

  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col overflow-x-clip">
      <Backdrop step={step} />

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-8">
        <div className="flex h-11 items-center gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Back"
            className={cn(
              "-ml-1 grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-fg",
              index === firstIndex && "pointer-events-none opacity-0",
            )}
            tabIndex={index === firstIndex ? -1 : 0}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div
            className={cn(
              "flex flex-1 gap-1.5 transition-opacity duration-300",
              step === "welcome" && "opacity-0",
            )}
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={progressSteps}
            aria-valuenow={Math.max(1, index)}
          >
            {Array.from({ length: progressSteps }, (_, i) => (
              <div
                key={i}
                className="h-1 flex-1 overflow-hidden rounded-full bg-fg/10"
              >
                <motion.div
                  className="h-full rounded-full bg-fg"
                  initial={false}
                  animate={{ width: i < index ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
              </div>
            ))}
          </div>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close setup"
              className="-mr-1 grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-fg"
            >
              <X className="size-5" />
            </button>
          ) : (
            // Keeps the progress bar centered opposite the back button.
            <span aria-hidden className="size-10 shrink-0" />
          )}
        </div>

        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cta.disabled) cta.onClick();
          }}
        >
          <div className="relative flex flex-1 flex-col">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.section
                key={step}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: EASE }}
                className="flex flex-1 flex-col pt-6 pb-4"
              >
                {step === "welcome" && <WelcomeStep />}
                {step === "how" && <HowStep />}
                {step === "name" && (
                  <NameStep
                    value={draft.name}
                    onChange={(name) => update({ name })}
                  />
                )}
                {step === "goal" && (
                  <GoalStep
                    value={draft.goal}
                    onPick={(goal) => {
                      pick({ goal });
                      setAdjust(0);
                    }}
                  />
                )}
                {step === "body" && <BodyStep draft={draft} update={update} />}
                {step === "activity" && (
                  <ActivityStep
                    value={draft.activity}
                    onPick={(activity) => {
                      pick({ activity });
                      setAdjust(0);
                    }}
                  />
                )}
                {step === "plan" && (
                  <PlanStep
                    name={draft.name.trim()}
                    calories={calories}
                    maintenance={maintenance(stats)}
                    units={draft.units}
                    adjusted={adjust !== 0}
                    onAdjust={(delta) =>
                      setAdjust(clampCalories(calories + delta) - base)
                    }
                  />
                )}
              </motion.section>
            </AnimatePresence>
          </div>

          {/* Full-width blurred fade so scrolled content softens under the
              button without painting a box over the backdrop. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 h-32 backdrop-blur-md [mask-image:linear-gradient(to_top,black_45%,transparent)]"
          />
          <div className="sticky bottom-0 z-10 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-10">
            <button
              type="submit"
              disabled={cta.disabled}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-fg text-base font-semibold text-inverse shadow-float transition enabled:hover:scale-[1.01] enabled:active:scale-[0.98] disabled:opacity-30 disabled:shadow-none"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={cta.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {cta.label}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function guessUnits(): Units {
  if (typeof navigator === "undefined") return "metric";
  return /^en-(US|LR)|^my\b/i.test(navigator.language) ? "imperial" : "metric";
}

/* ---------- Shared bits ---------- */

function Heading({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="px-1">
      <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[36px]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 max-w-[420px] text-[16px] leading-relaxed text-pretty text-muted">
          {subtitle}
        </p>
      )}
    </header>
  );
}

/** Soft color fields that drift behind the content. */
function Backdrop({ step }: { step: StepId }) {
  const hero = step === "welcome" || step === "plan";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-clip"
    >
      <motion.div
        className="absolute -top-32 -left-24 size-[420px] rounded-full bg-protein blur-[110px]"
        animate={{ opacity: hero ? 0.22 : 0.1, x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{
          opacity: { duration: 0.8 },
          default: { duration: 16, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 size-[380px] rounded-full bg-carbs blur-[110px]"
        animate={{ opacity: hero ? 0.18 : 0.08, x: [0, -30, 0], y: [0, 50, 0] }}
        transition={{
          opacity: { duration: 0.8 },
          default: { duration: 19, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/4 size-[400px] rounded-full bg-fat blur-[120px]"
        animate={{ opacity: hero ? 0.18 : 0.07, x: [0, 30, 0], y: [0, -30, 0] }}
        transition={{
          opacity: { duration: 0.8 },
          default: { duration: 22, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  icon: Icon,
  tint,
  title,
  hint,
  index,
}: {
  selected: boolean;
  onClick: () => void;
  icon: LucideIcon;
  tint: string;
  title: string;
  hint: string;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index + 0.08, duration: 0.35, ease: EASE }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex w-full items-center gap-4 rounded-[22px] bg-surface p-4 text-left shadow-card transition-shadow",
        selected ? "ring-2 ring-fg" : "hover:ring-1 hover:ring-fg/15",
      )}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl",
          tint,
        )}
      >
        <Icon className="size-[22px]" strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[14px] text-muted">{hint}</span>
      </span>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full transition-colors",
          selected ? "bg-fg text-inverse" : "bg-surface-2 text-transparent",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </motion.button>
  );
}

/* ---------- Steps ---------- */

const ORBIT: { icon: LucideIcon; color: string }[] = [
  { icon: Apple, color: "text-danger" },
  { icon: Croissant, color: "text-fat" },
  { icon: Fish, color: "text-protein" },
  { icon: Salad, color: "text-carbs" },
  { icon: Coffee, color: "text-muted" },
  { icon: Egg, color: "text-fat" },
  { icon: Beef, color: "text-danger" },
  { icon: Carrot, color: "text-fat" },
  { icon: Pizza, color: "text-carbs" },
];

function WelcomeStep() {
  const radius = 140;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
      <div className="relative grid size-[324px] place-items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute size-32 rounded-full border border-fg/15"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 2.3], opacity: [0.6, 0] }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              delay: i * 1.2,
              ease: "easeOut",
            }}
          />
        ))}

        <motion.div
          aria-hidden
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
        >
          {ORBIT.map(({ icon: Icon, color }, i) => {
            const angle = (i / ORBIT.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2"
                style={{
                  x: Math.cos(angle) * radius - 22,
                  y: Math.sin(angle) * radius - 22,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.25 + i * 0.06,
                  type: "spring",
                  stiffness: 320,
                  damping: 18,
                }}
              >
                <motion.span
                  className="grid size-11 place-items-center rounded-2xl bg-surface shadow-card"
                  animate={{ rotate: -360 }}
                  transition={{
                    duration: 48,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Icon className={cn("size-5", color)} strokeWidth={2} />
                </motion.span>
              </motion.span>
            );
          })}
        </motion.div>

        <CameraLogo />
      </div>

      <div className="flex flex-col items-center">
        <h1 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-[48px]">
          {["Calories", "from", "a", "photo."].map((word, i) => (
            <motion.span
              key={word}
              className="inline-block whitespace-pre"
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.35 + i * 0.08, duration: 0.5, ease: EASE }}
            >
              {word}
              {i < 3 ? " " : ""}
            </motion.span>
          ))}
        </h1>
        <motion.p
          className="mt-4 max-w-[340px] text-[17px] leading-relaxed text-muted"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.5, ease: EASE }}
        >
          Snap your plate. Get calories and macros in seconds. No barcode
          scanning, no endless searching.
        </motion.p>
        <motion.p
          className="mt-6 flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1.5 text-[13px] font-medium text-muted shadow-card backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05, duration: 0.5 }}
        >
          <ShieldCheck className="size-4 text-carbs" />
          Your data stays on this device
        </motion.p>
      </div>
    </div>
  );
}

/** A little camera whose lens frames the logo; it "takes a shot" on mount. */
function CameraLogo() {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="relative pt-3"
    >
      {/* Viewfinder hump and shutter button */}
      <span className="absolute top-0 left-1/2 h-5 w-16 -translate-x-1/2 rounded-t-[14px] bg-fg" />
      <motion.span
        className="absolute top-1 right-5 h-3 w-7 rounded-t-md bg-fg"
        initial={{ y: 0 }}
        animate={{ y: [0, 3, 0] }}
        transition={{ delay: 0.75, duration: 0.25, ease: "easeInOut" }}
      />

      <div className="relative grid h-[128px] w-[176px] place-items-center overflow-hidden rounded-[32px] bg-fg shadow-float">
        <span className="absolute top-3.5 left-4 h-2 w-6 rounded-full bg-white/20" />
        <span className="absolute top-3.5 right-4 size-2 rounded-full bg-carbs" />

        {/* Lens */}
        <motion.div
          className="grid size-[100px] place-items-center rounded-full bg-[#1d1d1d] shadow-[inset_0_0_0_3px_rgb(255_255_255/0.08)]"
          initial={{ rotate: -90 }}
          animate={{ rotate: 0 }}
          transition={{ delay: 0.15, duration: 0.9, ease: EASE }}
        >
          <div className="relative grid size-[80px] place-items-center overflow-hidden rounded-full bg-gradient-to-br from-white to-[#e9e9e9]">
            <Logo className="size-[60px] text-fg" />
            {/* Glass glare */}
            <span className="absolute -top-3 -left-3 size-8 rounded-full bg-white blur-md" />
          </div>
        </motion.div>

        {/* Shutter flash */}
        <motion.span
          className="pointer-events-none absolute inset-0 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ delay: 0.85, duration: 0.5, times: [0, 0.15, 1] }}
        />
      </div>
    </motion.div>
  );
}

const DEMO_ITEMS = [
  { name: "Grilled salmon", portion: "150 g", kcal: 310, icon: Fish },
  { name: "Brown rice", portion: "1 cup", kcal: 215, icon: Salad },
  { name: "Roasted carrots", portion: "½ cup", kcal: 70, icon: Carrot },
];
const DEMO_TOTAL = DEMO_ITEMS.reduce((s, i) => s + i.kcal, 0);

/** Loops: scan the plate → reveal items one by one → total → restart. */
function HowStep() {
  const [phase, setPhase] = useState(0); // 0 scanning, 1..3 items, 4 total
  useEffect(() => {
    const delays = [1700, 450, 450, 600, 2600];
    const t = setTimeout(
      () => setPhase((p) => (p + 1) % delays.length),
      delays[phase],
    );
    return () => clearTimeout(t);
  }, [phase]);

  const steps = [
    {
      icon: Camera,
      title: "Snap",
      text: "Take a photo of your plate, or just describe it.",
    },
    {
      icon: Sparkles,
      title: "Review",
      text: "AI breaks it down by item. Tweak anything in plain words.",
    },
    {
      icon: Check,
      title: "Log",
      text: "Watch your day fill up against your goal.",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Heading title="Snap. Review. Log." />

      <div className="rounded-[28px] bg-surface p-4 shadow-card">
        <div className="relative h-36 overflow-hidden rounded-[20px] bg-gradient-to-br from-surface-2 to-surface-3">
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative grid size-32 place-items-center rounded-full bg-surface shadow-[inset_0_0_0_10px_var(--surface-2)]">
              <Fish
                className="absolute top-8 left-7 size-9 text-protein"
                strokeWidth={1.8}
              />
              <Salad
                className="absolute top-7 right-7 size-8 text-carbs"
                strokeWidth={1.8}
              />
              <Carrot
                className="absolute bottom-7 left-1/2 size-8 -translate-x-1/2 text-fat"
                strokeWidth={1.8}
              />
            </div>
          </div>
          <AnimatePresence>
            {phase === 0 && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="animate-scan absolute inset-x-0 h-full bg-gradient-to-b from-transparent via-carbs/25 to-transparent">
                  <div className="absolute inset-x-0 bottom-1/2 h-0.5 bg-carbs/80 shadow-[0_0_16px_var(--carbs)]" />
                </div>
                <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[12px] font-medium backdrop-blur">
                  <Sparkles className="size-3.5 text-carbs" />
                  Analyzing…
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ul className="mt-2 flex min-h-[132px] flex-col">
          <AnimatePresence>
            {DEMO_ITEMS.slice(0, Math.max(0, phase)).map((item) => (
              <motion.li
                key={item.name}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="flex items-center gap-3 px-1 py-1.5"
              >
                <span className="grid size-8 place-items-center rounded-full bg-surface-2">
                  <item.icon className="size-4 text-muted" />
                </span>
                <span className="flex-1 text-[15px] font-medium">
                  {item.name}
                  <span className="ml-1.5 text-[13px] font-normal text-muted">
                    {item.portion}
                  </span>
                </span>
                <span className="text-[15px] font-medium tabular-nums">
                  {item.kcal}
                  <span className="ml-0.5 text-[13px] font-normal text-muted">
                    kcal
                  </span>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-line px-1 pt-3">
          <span className="text-[13px] text-muted">Total</span>
          <span className="text-[20px] font-semibold tracking-tight tabular-nums">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={phase === 4 ? "total" : "pending"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="inline-block"
              >
                {phase === 4 ? `${DEMO_TOTAL} kcal` : "—"}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      </div>

      <ol className="flex flex-col gap-3.5 px-1">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <motion.li
            key={title}
            className="flex items-start gap-3.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.35, ease: EASE }}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-fg text-inverse">
              <Icon className="size-4" strokeWidth={2.3} />
            </span>
            <span className="pt-0.5">
              <span className="block text-[15px] font-semibold">{title}</span>
              <span className="block text-[14px] leading-snug text-muted">
                {text}
              </span>
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function NameStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-10">
      <Heading
        title="First things first — what should we call you?"
        subtitle="Optional. It's just for a friendlier hello."
      />
      <label className="px-1">
        <span className="sr-only">Your name</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 40))}
          placeholder="Your name"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          className="w-full border-b-2 border-fg/15 bg-transparent pb-3 text-[30px] font-semibold tracking-tight outline-none placeholder:text-faint focus:border-fg"
        />
      </label>
      <AnimatePresence>
        {value.trim() && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-1 text-[17px] text-muted"
          >
            Nice to meet you,{" "}
            <span className="font-semibold text-fg">{value.trim()}</span> 👋
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const GOAL_STYLE: Record<GoalKind, { icon: LucideIcon; tint: string }> = {
  lose: { icon: TrendingDown, tint: "bg-carbs/15 text-carbs" },
  maintain: { icon: Scale, tint: "bg-protein/15 text-protein" },
  gain: { icon: Dumbbell, tint: "bg-fat/15 text-fat" },
};

function GoalStep({
  value,
  onPick,
}: {
  value: GoalKind | null;
  onPick: (g: GoalKind) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <Heading
        title="What's your goal?"
        subtitle="We'll shape your daily target around it. You can change this anytime."
      />
      <div className="flex flex-col gap-3">
        {GOALS.map((g, i) => (
          <OptionCard
            key={g.id}
            index={i}
            selected={value === g.id}
            onClick={() => onPick(g.id)}
            icon={GOAL_STYLE[g.id].icon}
            tint={GOAL_STYLE[g.id].tint}
            title={g.label}
            hint={g.hint}
          />
        ))}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative flex rounded-full bg-surface-2 p-1",
        size === "sm" && "text-[13px]",
      )}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "relative flex-1 rounded-full font-medium transition-colors",
            size === "sm" ? "h-8 px-3" : "h-10 px-4 text-[15px]",
            value === o.id ? "text-fg" : "text-muted hover:text-fg",
          )}
        >
          {value === o.id && (
            <motion.span
              layoutId={`seg-${label}`}
              className="absolute inset-0 rounded-full bg-surface shadow-card"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function BodyStep({
  draft,
  update,
}: {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
}) {
  const imperial = draft.units === "imperial";
  const { ft, inches } = cmToFtIn(draft.heightCm);
  const field = "rounded-[22px] bg-surface p-4 shadow-card";
  const input = "h-12 text-lg";

  return (
    <div className="flex flex-1 flex-col gap-7">
      <Heading
        title="A little about you"
        subtitle="Used only to estimate how much energy you burn. It never leaves this device."
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] font-medium text-muted">Units</span>
          <div className="w-44">
            <Segmented
              label="Units"
              size="sm"
              value={draft.units}
              onChange={(units) => update({ units })}
              options={[
                { id: "metric", label: "Metric" },
                { id: "imperial", label: "Imperial" },
              ]}
            />
          </div>
        </div>

        <div className={field}>
          <span className="mb-2 block text-xs text-muted">Sex</span>
          <Segmented
            label="Sex"
            value={draft.sex}
            onChange={(sex) => update({ sex })}
            options={[
              { id: "female", label: "Female" },
              { id: "male", label: "Male" },
            ]}
          />
        </div>

        <div className={cn(field, "grid grid-cols-2 gap-3")}>
          <NumberField
            label="Age"
            value={draft.age}
            min={13}
            max={100}
            suffix="yrs"
            inputClassName={input}
            onChange={(age) => update({ age: Math.round(age) })}
          />
          {imperial ? (
            <NumberField
              label="Weight"
              value={kgToLb(draft.weightKg)}
              min={70}
              max={660}
              suffix="lb"
              inputClassName={input}
              onChange={(lb) => update({ weightKg: lbToKg(lb) })}
            />
          ) : (
            <NumberField
              label="Weight"
              value={draft.weightKg}
              min={30}
              max={300}
              suffix="kg"
              inputClassName={input}
              onChange={(weightKg) => update({ weightKg })}
            />
          )}
          {imperial ? (
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <NumberField
                label="Height"
                value={ft}
                min={3}
                max={7}
                suffix="ft"
                inputClassName={input}
                onChange={(f) =>
                  update({ heightCm: ftInToCm(Math.round(f), inches) })
                }
              />
              <NumberField
                label="Inches"
                value={inches}
                min={0}
                max={11}
                suffix="in"
                inputClassName={input}
                onChange={(i) =>
                  update({ heightCm: ftInToCm(ft, Math.round(i)) })
                }
              />
            </div>
          ) : (
            <NumberField
              label="Height"
              value={draft.heightCm}
              min={100}
              max={250}
              suffix="cm"
              className="col-span-2"
              inputClassName={input}
              onChange={(heightCm) =>
                update({ heightCm: Math.round(heightCm) })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_STYLE: Record<Activity, { icon: LucideIcon; tint: string }> = {
  sedentary: { icon: Armchair, tint: "bg-surface-2 text-muted" },
  light: { icon: Footprints, tint: "bg-carbs/15 text-carbs" },
  moderate: { icon: Bike, tint: "bg-protein/15 text-protein" },
  active: { icon: Dumbbell, tint: "bg-fat/15 text-fat" },
  athlete: { icon: Zap, tint: "bg-danger/15 text-danger" },
};

function ActivityStep({
  value,
  onPick,
}: {
  value: Activity | null;
  onPick: (a: Activity) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <Heading
        title="How active are you?"
        subtitle="Think of a typical week."
      />
      <div className="flex flex-col gap-3">
        {ACTIVITIES.map((a, i) => (
          <OptionCard
            key={a.id}
            index={i}
            selected={value === a.id}
            onClick={() => onPick(a.id)}
            icon={ACTIVITY_STYLE[a.id].icon}
            tint={ACTIVITY_STYLE[a.id].tint}
            title={a.label}
            hint={a.hint}
          />
        ))}
      </div>
    </div>
  );
}

const PLAN_MACROS = [
  { key: "protein", label: "Protein", pct: 30, color: "bg-protein" },
  { key: "carbs", label: "Carbs", pct: 40, color: "bg-carbs" },
  { key: "fat", label: "Fat", pct: 30, color: "bg-fat" },
] as const;

function PlanStep({
  name,
  calories,
  maintenance,
  units,
  adjusted,
  onAdjust,
}: {
  name: string;
  calories: number;
  maintenance: number;
  units: Units;
  adjusted: boolean;
  onAdjust: (delta: number) => void;
}) {
  const macros = autoMacros(calories);
  const weeklyKg = ((calories - maintenance) * 7) / 7700;
  const weekly = units === "imperial" ? weeklyKg * 2.20462 : weeklyKg;
  const unit = units === "imperial" ? "lb" : "kg";
  const pace =
    Math.abs(weekly) < 0.05
      ? "Holds your weight steady"
      : `${weekly < 0 ? "Lose" : "Gain"} about ${Math.abs(weekly).toFixed(1)} ${unit} a week`;

  const size = 232;
  const stroke = 16;
  const r = (size - stroke) / 2;

  return (
    <div className="flex flex-1 flex-col items-center gap-7 text-center">
      <Heading
        title={name ? `${name}, your plan is ready` : "Your plan is ready"}
      />

      <div
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
      >
        <Burst />
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <defs>
            <linearGradient id="plan-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--protein)" />
              <stop offset="50%" stopColor="var(--carbs)" />
              <stop offset="100%" stopColor="var(--fat)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-surface-2"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke="url(#plan-ring)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.3, delay: 0.2, ease: EASE }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-medium text-muted">
            Daily target
          </span>
          <span className="mt-1 text-[52px] leading-none font-semibold tracking-[-0.05em] tabular-nums">
            <AnimatedNumber
              value={calories}
              from={0}
              duration={adjusted ? 0.3 : 1.3}
              delay={adjusted ? 0 : 0.2}
            />
          </span>
          <span className="mt-1.5 text-[13px] text-muted">kcal / day</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onAdjust(-50)}
          disabled={calories <= MIN_CALORIES}
          aria-label="Decrease by 50 calories"
          className="grid size-11 place-items-center rounded-full bg-surface shadow-card transition enabled:active:scale-95 disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <motion.p
          className="min-w-[200px] text-[14px] text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          {pace}
          <span className="block text-[12px] text-faint">
            Maintenance ≈ {fmt(Math.round(maintenance / 10) * 10)} kcal
          </span>
        </motion.p>
        <button
          type="button"
          onClick={() => onAdjust(50)}
          disabled={calories >= MAX_CALORIES}
          aria-label="Increase by 50 calories"
          className="grid size-11 place-items-center rounded-full bg-surface shadow-card transition enabled:active:scale-95 disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {PLAN_MACROS.map(({ key, label, pct, color }, i) => (
          <motion.div
            key={key}
            className="rounded-[20px] bg-surface p-4 text-left shadow-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.1, duration: 0.4, ease: EASE }}
          >
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <span className={cn("size-2 rounded-full", color)} />
              {label}
            </span>
            <span className="mt-2 block text-[22px] font-semibold tracking-tight tabular-nums">
              {macros[key]}
              <span className="ml-0.5 text-[13px] font-normal text-muted">
                g
              </span>
            </span>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className={cn("h-full rounded-full", color)}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 1.2 + i * 0.1, duration: 0.7, ease: EASE }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** A one-shot confetti pop as the ring completes. */
function Burst() {
  const colors = ["bg-protein", "bg-carbs", "bg-fat", "bg-danger", "bg-fg"];
  const pieces = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (i % 2) * 0.15;
    const dist = 150 + (i % 4) * 22;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      color: colors[i % colors.length],
      size: i % 3 === 0 ? "size-2.5" : "size-1.5",
      rotate: (i % 2 ? 1 : -1) * (90 + i * 12),
    };
  });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className={cn(
            "absolute",
            p.size,
            p.color,
            i % 3 === 0 ? "rounded-[2px]" : "rounded-full",
          )}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0.6],
            rotate: p.rotate,
          }}
          transition={{ delay: 1.35, duration: 1.1, ease: [0.2, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
