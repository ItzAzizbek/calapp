"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export interface ToastData {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, toast.action ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 400 }}
            className="pointer-events-auto flex items-center gap-4 rounded-full bg-fg py-2.5 pr-2.5 pl-5 text-[15px] font-medium text-inverse shadow-float"
          >
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss();
                }}
                className="rounded-full bg-inverse/15 px-3.5 py-1 text-[14px] font-semibold transition-colors hover:bg-inverse/25"
              >
                {toast.action.label}
              </button>
            ) : (
              <span className="w-2.5" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
