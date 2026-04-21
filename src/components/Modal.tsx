import { X } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, width = "480px" }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-lg shadow-2xl flex flex-col"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", width, maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
