"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: ReactNode;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
}

/** Numeric input that tolerates empty/partial text while typing. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max = 99999,
  className,
  inputClassName,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  // Sync when the value changes from outside (e.g. a stepper).
  if (value !== prev) {
    setPrev(value);
    if (Number(text) !== value) setText(String(value));
  }

  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center rounded-xl bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-fg/80">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(",", ".");
            if (!/^\d*\.?\d*$/.test(raw)) return;
            setText(raw);
            const n = Number(raw);
            if (raw !== "" && raw !== "." && Number.isFinite(n)) {
              const clamped = Math.min(max, Math.max(min, n));
              setPrev(clamped);
              onChange(clamped);
            }
          }}
          onBlur={() => {
            const n = Number(text);
            if (text === "" || text === "." || !Number.isFinite(n)) {
              setText(String(value));
            } else {
              setText(String(Math.min(max, Math.max(min, n))));
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-10 w-full min-w-0 bg-transparent text-[15px] font-medium tabular-nums outline-none",
            inputClassName,
          )}
        />
        {suffix && <span className="pl-1 text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
