"use client";

import { AnimatePresence, motion } from "motion/react";
import { Utensils } from "lucide-react";
import { MEAL_TYPES, type Entry } from "@/lib/types";
import { entryTotals, fmt, formatTime, sumEntries } from "@/lib/utils";

export function Thumb({ entry, size = 56 }: { entry: Entry; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-2xl bg-surface-2"
      style={{ width: size, height: size }}
    >
      {entry.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.image}
          alt=""
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="grid size-full place-items-center text-faint">
          <Utensils className="size-5" />
        </div>
      )}
    </div>
  );
}

export function MealList({
  entries,
  onOpen,
}: {
  entries: Entry[];
  onOpen: (entry: Entry) => void;
}) {
  const groups = MEAL_TYPES.map((type) => ({
    ...type,
    entries: entries.filter((e) => e.mealType === type.id),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="flex flex-col gap-7">
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <motion.section
            key={group.id}
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-labelledby={`group-${group.id}`}
          >
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3
                id={`group-${group.id}`}
                className="text-[13px] font-medium text-muted"
              >
                {group.label}
              </h3>
              <span className="text-[13px] text-muted tabular-nums">
                {fmt(sumEntries(group.entries).calories)} kcal
              </span>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-[24px] bg-surface shadow-card">
              <AnimatePresence initial={false}>
                {group.entries.map((entry) => {
                  const t = entryTotals(entry);
                  return (
                    <motion.li
                      key={entry.id}
                      layout="position"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(entry)}
                        className="flex w-full items-center gap-3.5 p-3 pr-4 text-left transition-colors hover:bg-surface-2/60 active:bg-surface-2"
                      >
                        <Thumb entry={entry} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-medium">
                            {entry.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[13px] text-muted tabular-nums">
                            <span>{formatTime(entry.eatenAt)}</span>
                            <span aria-hidden className="text-faint">
                              ·
                            </span>
                            <span className="truncate">
                              <span className="sr-only">Protein </span>P{" "}
                              {t.protein}
                              <span className="sr-only">
                                {" "}
                                grams, carbs
                              </span> C {t.carbs}
                              <span className="sr-only">
                                {" "}
                                grams, fat
                              </span> F {t.fat}
                              <span className="sr-only"> grams</span>
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[15px] font-semibold tabular-nums">
                            {fmt(t.calories)}
                          </div>
                          <div className="text-[11px] text-muted">kcal</div>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}
