"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ModalSize = "sm" | "md" | "lg" | "xl";
interface ModalOptions {
  size?: ModalSize;
  persistent?: boolean;
}
interface ModalContextValue {
  openModal: (content: ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within <ModalProvider>");
  return ctx;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-[440px]",
  md: "max-w-[560px]",
  lg: "max-w-[760px]",
  xl: "max-w-[960px]",
};

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ content: ReactNode; options: ModalOptions } | null>(null);

  const openModal = useCallback((content: ReactNode, options: ModalOptions = {}) => setState({ content, options }), []);
  const closeModal = useCallback(() => setState(null), []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {state ? (
        // Two nested containers, deliberately: the OUTER one is the fixed,
        // scrollable overlay (not a flex container) and the INNER one is
        // `min-h-full` + flex-centered. Centering a flex item directly on
        // a scrollable flex container clips it to the top the moment its
        // content is taller than the viewport (a well-known CSS quirk) —
        // a tall form like "Give New Loan" would render pinned to the top
        // instead of centered. With the split, short content still centers
        // normally; tall content just grows past 100vh and scrolls, with
        // even padding instead of being clipped.
        <div
          className="fixed inset-0 z-[1000] bg-black/55 backdrop-blur-[3px] overflow-y-auto animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !state.options.persistent) closeModal();
          }}
        >
          <div className="min-h-full flex items-center justify-center p-0 sm:p-5">
            <div
              role="dialog"
              aria-modal="true"
              className={cn(
                "w-full bg-surface border border-border shadow-card-lg flex flex-col",
                "rounded-t-[18px] sm:rounded-[18px] max-h-[94vh] sm:max-h-[calc(100vh-40px)] animate-pop-in",
                SIZE_CLASS[state.options.size ?? "md"]
              )}
            >
              {state.content}
            </div>
          </div>
        </div>
      ) : null}
    </ModalContext.Provider>
  );
}
