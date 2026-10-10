import { cn } from "@/lib/utils";

/**
 * Calapp mark: a calorie ring shaped like an apple, open at the top right
 * (so it also reads as a "C"), with a leaf where the ring starts.
 * Paths are mirrored in src/app/icon.svg and src/app/apple-icon.tsx.
 */
export const LOGO_RING = "M46.72 26.5A17 17 0 1 1 32 18";
export const LOGO_LEAF =
  "M33.5 17C33.5 9 39 3.5 47.5 3.5 47.5 11.5 42 17 33.5 17Z";

export function Logo({
  className,
  ring = "currentColor",
  leaf = "var(--carbs)",
}: {
  className?: string;
  ring?: string;
  leaf?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path d={LOGO_RING} stroke={ring} strokeWidth={7} strokeLinecap="round" />
      <path d={LOGO_LEAF} fill={leaf} />
    </svg>
  );
}
