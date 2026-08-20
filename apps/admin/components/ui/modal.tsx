import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer: ReactNode;
  destructive?: boolean;
  wide?: boolean;
}

export function Modal({
  title,
  children,
  onClose,
  footer,
  destructive = false,
  wide = false,
}: ModalProps) {
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        className="modal-scrim"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <section
        className={`modal-card ${destructive ? "destructive-modal" : ""} ${wide ? "wide-modal" : ""}`}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        <footer>{footer}</footer>
      </section>
    </div>
  );
}
