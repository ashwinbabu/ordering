import { Check, CircleAlert, Clock3, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

interface ToastProps {
  tone: ToastTone;
  message: string;
  onDismiss: () => void;
}

export function Toast({ tone, message, onDismiss }: ToastProps) {
  return (
    <div className={`toast toast-${tone}`} role="status">
      {tone === "success" ? <Check size={18} /> : tone === "error" ? <CircleAlert size={18} /> : <Clock3 size={18} />}
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss"><X size={16} /></button>
    </div>
  );
}
