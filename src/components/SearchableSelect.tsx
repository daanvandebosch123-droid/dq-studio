import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Filter…",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  function close() {
    setOpen(false);
    setSearch("");
    setHovered(null);
  }

  useEffect(() => {
    if (!open) return;
    // Delay so the button's click event doesn't immediately close via outside-click
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onMouseDown); };
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Enter" && filtered.length === 1) {
      onChange(filtered[0].value);
      close();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 ml-2 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--text-secondary)" }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-2xl"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", minWidth: "100%" }}
        >
          {/* Search input */}
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              <Search size={11} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
              <input
                ref={searchRef}
                className="flex-1 text-xs outline-none bg-transparent"
                style={{ color: "var(--text-primary)" }}
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-xs opacity-50 hover:opacity-100"
                  style={{ color: "var(--text-secondary)" }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>
                No matches for "{search}"
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = opt.value === value;
                const isHovered = opt.value === hovered;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); close(); }}
                    onMouseEnter={() => setHovered(opt.value)}
                    onMouseLeave={() => setHovered(null)}
                    className="w-full text-left px-3 py-2 text-sm"
                    style={{
                      background: isSelected
                        ? "rgba(99,102,241,0.15)"
                        : isHovered
                        ? "var(--bg-tertiary)"
                        : "transparent",
                      color: isSelected ? "#818cf8" : "var(--text-primary)",
                      fontWeight: isSelected ? 500 : undefined,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>

          {filtered.length > 0 && (
            <div
              className="px-3 py-1.5 text-xs"
              style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}
            >
              {filtered.length} of {options.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
