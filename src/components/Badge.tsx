interface Props {
  variant: "success" | "danger" | "warning" | "neutral";
  children: React.ReactNode;
}

const styles: Record<Props["variant"], string> = {
  success: "bg-green-900/40 text-green-400 border-green-800",
  danger: "bg-red-900/40 text-red-400 border-red-800",
  warning: "bg-amber-900/40 text-amber-400 border-amber-800",
  neutral: "bg-slate-700/40 text-slate-400 border-slate-600",
};

export function Badge({ variant, children }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}
