"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import type { Goals, Macros } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";

export function AnimatedNumber({
  value,
  from,
  duration = 0.6,
  delay = 0,
}: {
  value: number;
  /** Start value on mount; defaults to `value` (no count-up). */
  from?: number;
  duration?: number;
  delay?: number;
}) {
  const mv = useMotionValue(from ?? value);
  const text = useTransform(mv, (v) => fmt(v));
  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      delay,
      ease: [0.32, 0.72, 0, 1],
    });
    return () => controls.stop();
  }, [mv, value, duration, delay]);
  return <motion.span>{text}</motion.span>;
}

function Ring({ eaten, goal }: { eaten: number; goal: number }) {
  const size = 176;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const over = eaten > goal;
  const progress = goal > 0 ? Math.min(eaten / goal, 1) : 0;
  const remaining = Math.abs(goal - eaten);

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        over
          ? `${fmt(remaining)} calories over your ${fmt(goal)} goal`
          : `${fmt(remaining)} of ${fmt(goal)} calories remaining`
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        {progress > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={over ? "stroke-danger" : "stroke-fg"}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: progress }}
            transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums",
            over && "text-danger",
          )}
        >
          <AnimatedNumber value={remaining} />
        </span>
        <span className="mt-1.5 text-[13px] text-muted">
          {over ? "kcal over" : "kcal left"}
        </span>
      </div>
    </div>
  );
}

const MACROS = [
  { key: "protein", label: "Protein", color: "bg-protein" },
  { key: "carbs", label: "Carbs", color: "bg-carbs" },
  { key: "fat", label: "Fat", color: "bg-fat" },
] as const;

export function Summary({ totals, goals }: { totals: Macros; goals: Goals }) {
  return (
    <section
      aria-label="Daily summary"
      className="rounded-[28px] bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex items-center gap-5 sm:gap-8">
        <Ring eaten={totals.calories} goal={goals.calories} />
        <dl className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <dt className="text-[13px] text-muted">Eaten</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">
              <AnimatedNumber value={totals.calories} />
              <span className="ml-1 text-sm font-normal text-muted">kcal</span>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">Goal</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">
              {fmt(goals.calories)}
              <span className="ml-1 text-sm font-normal text-muted">kcal</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {MACROS.map(({ key, label, color }) => {
          const value = totals[key];
          const goal = goals[key];
          const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[13px] text-muted">{label}</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-label={`${label}: ${value} of ${goal} grams`}
                aria-valuemin={0}
                aria-valuemax={goal}
                aria-valuenow={Math.min(value, goal)}
              >
                <motion.div
                  className={cn("h-full rounded-full", color)}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                />
              </div>
              <div className="mt-2 text-sm font-medium tabular-nums">
                {fmt(value)}
                <span className="font-normal text-muted"> / {fmt(goal)}g</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
