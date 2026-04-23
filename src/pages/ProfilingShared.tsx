import type { ColumnProfile } from "../types";

function MiniBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: "5px", background: "var(--bg-tertiary)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "9999px", transition: "width 0.4s" }} />
      </div>
      <span className="text-xs w-10 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{sub}</p>}
    </div>
  );
}

export function ProfileSummaryCards({ profiles }: { profiles: ColumnProfile[] }) {
  const rowCount = profiles[0]?.row_count ?? 0;
  const colsWithNulls = profiles.filter(p => p.null_count > 0).length;
  const colsFullyDistinct = profiles.filter(p => p.distinct_count === p.row_count && p.row_count > 0).length;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatCard label="Total Rows" value={rowCount.toLocaleString()} />
      <StatCard label="Columns" value={profiles.length} />
      <StatCard
        label="Columns with Nulls"
        value={colsWithNulls}
        sub={colsWithNulls > 0 ? `${((colsWithNulls / profiles.length) * 100).toFixed(0)}% of columns` : "All complete"}
      />
      <StatCard
        label="Fully Unique Columns"
        value={colsFullyDistinct}
        sub={colsFullyDistinct > 0 ? `${((colsFullyDistinct / profiles.length) * 100).toFixed(0)}% of columns` : undefined}
      />
    </div>
  );
}

export function ProfileTable({ profiles }: { profiles: ColumnProfile[] }) {
  if (profiles.length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "var(--text-secondary)" }}>No columns found.</p>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "var(--bg-tertiary)" }}>
              {["Column", "Type", "Null %", "Distinct %", "Min", "Max"].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((col, i) => {
              const nullRate = col.row_count > 0 ? col.null_count / col.row_count : 0;
              const distinctRate = col.row_count > 0 ? col.distinct_count / col.row_count : 0;
              const nullColor = nullRate === 0 ? "var(--success)" : nullRate > 0.5 ? "var(--danger)" : "#f59e0b";
              return (
                <tr
                  key={col.column_name}
                  style={{
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    borderBottom: i < profiles.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                    {col.column_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-mono"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {col.data_type}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ minWidth: "140px" }}>
                    <MiniBar value={nullRate} color={nullColor} />
                    {col.null_count > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {col.null_count.toLocaleString()} null{col.null_count !== 1 ? "s" : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ minWidth: "140px" }}>
                    <MiniBar value={distinctRate} color="rgb(99,102,241)" />
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {col.distinct_count.toLocaleString()} unique
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs" style={{ color: "var(--text-secondary)", maxWidth: "160px" }}>
                    <span className="truncate block" title={col.min_value ?? ""}>
                      {col.min_value ?? <span style={{ opacity: 0.4 }}>—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs" style={{ color: "var(--text-secondary)", maxWidth: "160px" }}>
                    <span className="truncate block" title={col.max_value ?? ""}>
                      {col.max_value ?? <span style={{ opacity: 0.4 }}>—</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
