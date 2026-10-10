"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { addDays, cn, parseDayKey, weekOf } from "@/lib/utils";

interface WeekStripProps {
  selected: string;
  today: string;
  /** Calories per day, for the progress dots. */
  caloriesByDay: Map<string, number>;
  goal: number;
  onSelect: (day: string) => void;
}

function MiniRing({ pct, active }: { pct: number; active: boolean }) {
  const size = 22;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className={active ? "stroke-inverse/25" : "stroke-surface-3"}
      />
      {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${Math.min(pct, 1)} 1`}
          className={cn(
            pct > 1 ? "stroke-danger" : active ? "stroke-inverse" : "stroke-fg",
          )}
        />
      )}
    </svg>
  );
}

export function WeekStrip({
  selected,
  today,
  caloriesByDay,
  goal,
  onSelect,
}: WeekStripProps) {
  const days = weekOf(selected);
  const canGoForward = days[6] < today;

  return (
    <nav aria-label="Choose day" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(addDays(selected, -7))}
        aria-label="Previous week"
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <ChevronLeft className="size-5" />
      </button>
      <ol className="grid flex-1 grid-cols-7 gap-1">
        {days.map((day) => {
          const date = parseDayKey(day);
          const active = day === selected;
          const future = day > today;
          const kcal = caloriesByDay.get(day) ?? 0;
          const label = date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
          return (
            <li key={day}>
              <button
                type="button"
                disabled={future}
                onClick={() => onSelect(day)}
                aria-current={active ? "date" : undefined}
                aria-label={`${label}${day === today ? ", today" : ""}${kcal ? `, ${Math.round(kcal)} kcal` : ""}`}
                className={cn(
                  "relative flex w-full flex-col items-center gap-1.5 rounded-2xl py-2 transition-colors",
                  future
                    ? "cursor-not-allowed opacity-35"
                    : !active && "hover:bg-surface-2",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="day-pill"
                    className="absolute inset-0 rounded-2xl bg-fg"
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  />
                )}
                <span
                  className={cn(
                    "relative text-[11px] font-medium uppercase tracking-wide",
                    active ? "text-inverse/70" : "text-muted",
                  )}
                >
                  {date.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
                <span
                  className={cn(
                    "relative text-[15px] font-semibold tabular-nums",
                    active ? "text-inverse" : "text-fg",
                  )}
                >
                  {date.getDate()}
                </span>
                <span className="relative">
                  <MiniRing pct={goal > 0 ? kcal / goal : 0} active={active} />
                </span>
                {day === today && !active && (
                  <span className="absolute top-1 right-1/2 size-1 translate-x-[14px] rounded-full bg-fg" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => {
          const next = addDays(selected, 7);
          onSelect(next > today ? today : next);
        }}
        disabled={selected === today}
        aria-label={canGoForward ? "Next week" : "Go to today"}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors enabled:hover:bg-surface-2 enabled:hover:text-fg disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>
    </nav>
  );
}
