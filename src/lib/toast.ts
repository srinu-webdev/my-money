import { toast as sonnerToast, type ExternalToast } from "sonner";

// sonner's toast.*() calls return a toast id (string | number), which is
// convenient for dismissing a toast later but breaks the common
// `return toast.error(...)` early-return idiom: it makes the enclosing
// function return `string | number` where React (startTransition,
// form actions, Dropdown's onClick, etc.) requires `void`. This thin
// void-returning wrapper is what the rest of the app imports instead.
export const toast = {
  success: (message: string, opts?: ExternalToast): void => void sonnerToast.success(message, opts),
  error: (message: string, opts?: ExternalToast): void => void sonnerToast.error(message, opts),
  warning: (message: string, opts?: ExternalToast): void => void sonnerToast.warning(message, opts),
  info: (message: string, opts?: ExternalToast): void => void sonnerToast.info(message, opts),
};
