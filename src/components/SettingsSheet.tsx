"use client";

import { ChevronRight, Download, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ACTIVITIES, GOALS } from "@/lib/plan";
import type { Entry, Goals, Profile } from "@/lib/types";
import { autoMacros, cn, dayKey } from "@/lib/utils";
import { NumberField } from "./NumberField";
import { Sheet } from "./Sheet";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  goals: Goals;
  onSave: (goals: Goals) => void;
  entries: Entry[];
  onDeleteAll: () => void;
  profile: Profile;
  onRedoSetup: () => void;
}

export function SettingsSheet(props: SettingsSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Settings">
      {/* Remount on open so the form starts from the saved goals. */}
      {props.open && <SettingsForm {...props} />}
    </Sheet>
  );
}

function SettingsForm({
  goals,
  onSave,
  entries,
  onDeleteAll,
  profile,
  onRedoSetup,
}: SettingsSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage ?? null))
      .catch(() => {});
  }, []);

  const update = (patch: Partial<Goals>) => {
    const next = { ...goals, ...patch };
    if (next.autoMacros) Object.assign(next, autoMacros(next.calories));
    onSave(next);
  };

  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), profile, goals, entries },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calapp-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-col gap-8 pt-2">
      <button
        type="button"
        onClick={onRedoSetup}
        className="flex items-center gap-3.5 rounded-[20px] bg-surface-2/60 p-4 text-left transition-colors hover:bg-surface-2"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-fg text-[17px] font-semibold text-inverse">
          {profile.name ? (
            profile.name[0].toUpperCase()
          ) : (
            <RotateCcw className="size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {profile.name || "Your plan"}
          </span>
          <span className="block truncate text-[13px] text-muted">
            {GOALS.find((g) => g.id === profile.goal)?.label} ·{" "}
            {ACTIVITIES.find((a) => a.id === profile.activity)?.label}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-muted">
          Redo setup
          <ChevronRight className="size-4" />
        </span>
      </button>

      <section aria-labelledby="goals-heading" className="flex flex-col gap-4">
        <h3 id="goals-heading" className="text-[13px] font-medium text-muted">
          Daily goal
        </h3>
        <div className="flex items-center gap-3">
          <NumberField
            label="Calories"
            value={goals.calories}
            min={500}
            max={10000}
            suffix="kcal"
            onChange={(calories) => update({ calories: Math.round(calories) })}
            className="flex-1"
            inputClassName="text-lg h-12"
          />
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Presets">
          {[1600, 1800, 2000, 2200, 2500].map((kcal) => (
            <button
              key={kcal}
              type="button"
              onClick={() => update({ calories: kcal })}
              aria-pressed={goals.calories === kcal}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium tabular-nums transition-colors",
                goals.calories === kcal
                  ? "bg-fg text-inverse"
                  : "bg-surface-2 text-muted hover:text-fg",
              )}
            >
              {kcal.toLocaleString()}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="macros-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h3
            id="macros-heading"
            className="text-[13px] font-medium text-muted"
          >
            Macro targets
          </h3>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
            Balanced
            <span className="relative inline-flex">
              <input
                type="checkbox"
                role="switch"
                checked={goals.autoMacros}
                onChange={(e) => update({ autoMacros: e.target.checked })}
                className="peer sr-only"
              />
              <span className="h-6 w-10 rounded-full bg-surface-3 transition-colors peer-checked:bg-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg" />
              <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
        </div>
        {goals.autoMacros ? (
          <p className="text-[13px] leading-relaxed text-muted">
            30% protein, 40% carbs, 30% fat — {goals.protein} g, {goals.carbs} g
            and {goals.fat} g a day.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Protein"
              value={goals.protein}
              suffix="g"
              max={1000}
              onChange={(protein) => update({ protein: Math.round(protein) })}
            />
            <NumberField
              label="Carbs"
              value={goals.carbs}
              suffix="g"
              max={1500}
              onChange={(carbs) => update({ carbs: Math.round(carbs) })}
            />
            <NumberField
              label="Fat"
              value={goals.fat}
              suffix="g"
              max={1000}
              onChange={(fat) => update({ fat: Math.round(fat) })}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="data-heading" className="flex flex-col gap-3">
        <h3 id="data-heading" className="text-[13px] font-medium text-muted">
          Your data
        </h3>
        <p className="text-[13px] leading-relaxed text-muted">
          Everything is stored in this browser
          {!!usage && <> ({formatBytes(usage)} used)</>}. Photos are sent for
          analysis and not kept on the server.
        </p>
        <div className="overflow-hidden rounded-[20px] bg-surface-2/60">
          <button
            type="button"
            onClick={exportData}
            disabled={entries.length === 0}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium transition-colors enabled:hover:bg-surface-2 disabled:opacity-40"
          >
            <Download className="size-[18px] text-muted" />
            Export as JSON
            <span className="ml-auto text-[13px] font-normal text-muted tabular-nums">
              {entries.length} {entries.length === 1 ? "meal" : "meals"}
            </span>
          </button>
          <div className="h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              if (confirming) {
                onDeleteAll();
                setConfirming(false);
              } else setConfirming(true);
            }}
            onBlur={() => setConfirming(false)}
            disabled={entries.length === 0}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium transition-colors disabled:opacity-40",
              confirming
                ? "bg-danger text-white"
                : "text-danger enabled:hover:bg-surface-2",
            )}
          >
            <Trash2 className="size-[18px]" />
            {confirming ? "Tap again to delete everything" : "Delete all meals"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
