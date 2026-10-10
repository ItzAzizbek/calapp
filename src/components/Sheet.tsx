"use client";

import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
} from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (still announced to screen readers). */
  hideTitle?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

// Stack of open sheets so Escape and scroll-lock only affect the top one.
const stack: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet(props: SheetProps) {
  return (
    <AnimatePresence>{props.open && <SheetPanel {...props} />}</AnimatePresence>
  );
}

function SheetPanel({
  onClose,
  title,
  hideTitle,
  children,
  footer,
  className,
}: SheetProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const desktop = useMediaQuery("(min-width: 640px)");
  const dragControls = useDragControls();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(id);
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    // Focus the first autofocus target, else the panel itself.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const auto = panel.querySelector<HTMLElement>("[data-autofocus]");
      (auto ?? panel).focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const nodes = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((n) => n.offsetParent !== null);
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
      if (stack.length === 0) {
        body.style.overflow = prevOverflow;
        body.style.paddingRight = prevPadding;
      }
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [id]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface text-fg shadow-float outline-none",
          "rounded-t-[28px] sm:max-h-[min(88dvh,820px)] sm:max-w-[480px] sm:rounded-[28px]",
          className,
        )}
        initial={desktop ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
        animate={desktop ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
        exit={desktop ? { opacity: 0, y: 8, scale: 0.98 } : { y: "100%" }}
        transition={
          desktop
            ? { duration: 0.2, ease: [0.32, 0.72, 0, 1] }
            : { type: "spring", damping: 34, stiffness: 380, mass: 0.9 }
        }
        drag={desktop ? false : "y"}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={onDragEnd}
      >
        <div
          className="flex shrink-0 touch-none flex-col sm:touch-auto"
          onPointerDown={(e) => {
            if (!desktop && !(e.target as HTMLElement).closest("button")) {
              dragControls.start(e);
            }
          }}
        >
          <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-surface-3" />
          </div>
          <div
            className={cn(
              "flex items-center justify-between gap-4 px-6 pt-3 pb-2 sm:pt-5",
              hideTitle && "pb-0",
            )}
          >
            <h2
              id={titleId}
              className={cn(
                "text-lg font-semibold tracking-tight",
                hideTitle && "sr-only",
              )}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "-mr-2 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg",
                hideTitle && "ml-auto",
              )}
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div
          className={cn(
            "thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-6",
            footer ? "pb-6" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}
