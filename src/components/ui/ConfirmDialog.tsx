"use client";

import { AlertTriangle, Info, Trash } from "@/components/ui/icons";
import type { ReactNode } from "react";
import { useModal } from "@/components/providers/ModalProvider";
import { Button } from "./Button";
import { ModalFooter } from "./Modal";

type Tone = "danger" | "warning" | "primary";

const TONE_ICON: Record<Tone, typeof Trash> = { danger: Trash, warning: AlertTriangle, primary: Info };
const TONE_CLASS: Record<Tone, string> = {
  danger: "bg-danger-light text-danger",
  warning: "bg-warning-light text-warning-dark",
  primary: "bg-primary-50 text-primary-600",
};

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
  extra?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
  const { openModal, closeModal } = useModal();
  return function confirm(opts: ConfirmOptions) {
    const tone = opts.tone ?? "danger";
    const Icon = TONE_ICON[tone];
    openModal(<ConfirmBody opts={opts} tone={tone} Icon={Icon} closeModal={closeModal} />, { size: "sm" });
  };
}

export function useAlert() {
  const { openModal, closeModal } = useModal();
  return function alert(opts: { title: string; message: ReactNode; tone?: "warning" | "primary" }) {
    const tone = opts.tone ?? "warning";
    const Icon = TONE_ICON[tone];
    openModal(
      <>
        <div className="px-6 pt-7 pb-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3.5 ${TONE_CLASS[tone]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold mb-2">{opts.title}</h3>
          <div className="text-text-secondary leading-relaxed">{opts.message}</div>
        </div>
        <ModalFooter>
          <Button variant="primary" onClick={closeModal}>
            OK
          </Button>
        </ModalFooter>
      </>,
      { size: "sm" }
    );
  };
}

function ConfirmBody({ opts, tone, Icon, closeModal }: { opts: ConfirmOptions; tone: Tone; Icon: typeof Trash; closeModal: () => void }) {
  return (
    <>
      <div className="px-6 pt-7 pb-2">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3.5 ${TONE_CLASS[tone]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold mb-2">{opts.title}</h3>
        <div className="text-text-secondary leading-relaxed">{opts.message}</div>
        {opts.extra}
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={closeModal}>
          {opts.cancelText ?? "Cancel"}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={async () => {
            await opts.onConfirm();
          }}
        >
          {opts.confirmText ?? "Confirm"}
        </Button>
      </ModalFooter>
    </>
  );
}
