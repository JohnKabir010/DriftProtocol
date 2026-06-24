"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";

export type ToastKind = "info" | "success" | "error" | "warn";

interface ToastEntry {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: ToastEntry[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
}

const COLORS: Record<ToastKind, string> = {
  info:    "border-neon-cyan/40 text-neon-cyan",
  success: "border-neon-volt/40 text-neon-volt",
  error:   "border-neon-magenta/60 text-neon-magenta",
  warn:    "border-yellow-400/40 text-yellow-400",
};

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, kind = "info") =>
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID(), message, kind }],
    })),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function ToastItem({ entry }: { entry: ToastEntry }) {
  const dismiss = useToast((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(entry.id), 4000);
    return () => clearTimeout(timer);
  }, [entry.id, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      onClick={() => dismiss(entry.id)}
      className={`holo-card cursor-pointer px-5 py-3 font-display text-xs tracking-widest border ${COLORS[entry.kind]} min-w-[220px] max-w-xs`}
    >
      {entry.message}
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useToast((s) => s.toasts);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem entry={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
