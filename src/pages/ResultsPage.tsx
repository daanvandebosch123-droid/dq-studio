import { useState, useEffect, useMemo } from "react";
import { Play, CheckCircle2, XCircle, Code, PlayCircle, ChevronDown, ChevronRight, Table2, History } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import { api } from "../invoke";
import type { Rule, RuleResult, QueryResult, RuleRunRecord } from "../types";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";

const C_PASS = "#22c55e";
const C_FAIL = "#ef4444";
const C_MUTED = "#6b7280";

// ── history helpers ────────────────────────────────────────────────────────

interface Batch {
  batch_id: string;
  ran_at: string;
  passed: number;
  failed: number;
  pass_rate: number;
  records: RuleRunRecord[];
}

function groupIntoBatches(records: RuleRunRecord[]): Batch[] {
  const map = new Map<string, RuleRunRecord[]>();
  for (const r of records) {
    const list = map.get(r.batch_id) ?? [];
    list.push(r);
    map.set(r.batch_id, list);
  }
  return [...map.entries()]
    .map(([batch_id, recs]) => {
      const passed = recs.filter(r => r.passed).length;
      const failed = recs.filter(r => !r.passed).length;
      const total = passed + failed;
      return {
        batch_id,
        ran_at: recs[0].ran_at,
        records: recs,
        passed,
        failed,
        pass_rate: total > 0 ? Math.round((passed / total) * 100) : 0,
      };
    })
    .sort((a, b) => new Date(a.ran_at).getTime() - new Date(b.ran_at).getTime());
}

function fmtShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// ── Failing rows modal ─────────────────────────────────────────────────────

function FailingRowsModal({ ruleId, ruleName, onClose }: { ruleId: string; ruleName: string; onClose: () => void }) {
  const [data, setData] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getFailingRows(ruleId).then(setData).catch(e => setError(String(e)));
  }, [ruleId]);

  return (
    <Modal title={`Failing rows — ${ruleName}`} onClose={onClose} width="860px">
      {!data && !error && <p className="text-sm py-4 text-center" style={{ color: "var(--text-secondary)" }}>Loading...</p>}
      {error && <p className="text-sm py-4 text-center" style={{ color: C_FAIL }}>{error}</p>}
      {data && (
        <>
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Showing up to 500 failing rows</p>
          <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--bg-tertiary)" }}>
                  {data.columns.map(col => (
                    <th key={col} className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={data.columns.length} className="px-3 py-4 text-center" style={{ color: "var(--text-secondary)" }}>No rows returned</td></tr>
                )}
                {data.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 whitespace-nowrap" style={{ color: cell === null ? "var(--text-secondary)" : "var(--text-primary)", fontStyle: cell === null ? "italic" : "normal" }}>
                        {cell === null ? "NULL" : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Charts ─────────────────────────────────────────────────────────────────

function OverallDonut({ passed, failed }: { passed: number; failed: number }) {
  const data = [
    { name: "Passed", value: passed },
    { name: "Failed", value: failed },
  ].filter(d => d.value > 0);

  const total = passed + failed;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="rounded-lg p-4 flex flex-col" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-medium mb-3">Overall Health</p>
      <div className="flex items-center gap-4 flex-1">
        <div style={{ width: 120, height: 120, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={i === 0 ? C_PASS : C_FAIL} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} itemStyle={{ color: "var(--text-primary)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-2xl font-bold">{pct}%</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>pass rate</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C_PASS }} />
              <span style={{ color: "var(--text-secondary)" }}>Passed</span>
              <span className="font-medium ml-auto">{passed}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C_FAIL }} />
              <span style={{ color: "var(--text-secondary)" }}>Failed</span>
              <span className="font-medium ml-auto">{failed}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupBar({ groups }: { groups: { name: string; passed: number; failed: number }[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="rounded-lg p-4 flex flex-col" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-medium mb-3">Results by Group</p>
      <div style={{ flex: 1, minHeight: 120 }}>
        <ResponsiveContainer width="100%" height={Math.max(120, groups.length * 36 + 24)}>
          <BarChart data={groups} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} width={80} />
            <Tooltip contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} itemStyle={{ color: "var(--text-primary)" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="passed" name="Passed" stackId="a" fill={C_PASS} radius={[0, 0, 0, 0]} />
            <Bar dataKey="failed" name="Failed" stackId="a" fill={C_FAIL} radius={[2, 2, 2, 2]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FailureRateBar({ results }: { results: RuleResult[] }) {
  const failing = results
    .filter(r => !r.passed && r.total_count > 0)
    .map(r => ({
      name: r.rule_name.length > 22 ? r.rule_name.slice(0, 22) + "…" : r.rule_name,
      rate: Math.round((r.failing_count / r.total_count) * 100),
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  if (failing.length === 0) return null;

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-medium mb-3">Failure Rate by Rule <span className="font-normal text-xs" style={{ color: "var(--text-secondary)" }}>(top {failing.length})</span></p>
      <ResponsiveContainer width="100%" height={Math.max(120, failing.length * 32 + 24)}>
        <BarChart data={failing} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} width={140} />
          <Tooltip formatter={(v) => [`${v}%`, "Failure rate"]} contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} itemStyle={{ color: "var(--text-primary)" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="rate" name="Failure rate" fill={C_FAIL} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Pass rate trend chart ──────────────────────────────────────────────────

const GROUP_COLORS = ["#6366f1", "#f59e0b", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];
const OVERALL_KEY = "Overall";

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: Record<string, unknown> }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date as string | undefined;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", minWidth: 140 }}>
      {date && <p className="font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{date}</p>}
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span style={{ color: "var(--text-primary)" }}>{p.name}</span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

function PassRateTrend({ batches, rules }: { batches: Batch[]; rules: Rule[] }) {
  const groups = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rules) if (r.group) seen.add(r.group);
    return [...seen].sort();
  }, [rules]);

  const allKeys = [OVERALL_KEY, ...groups];
  const [visible, setVisible] = useState<Set<string>>(() => new Set(allKeys));

  // Keep visible in sync if groups change
  useEffect(() => {
    setVisible(new Set(allKeys));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.join(",")]);

  if (batches.length < 2) return null;

  // Map rule_id → group using current rules
  const ruleGroupMap = new Map(rules.map(r => [r.id, r.group ?? null]));

  const data = batches.map((b, idx) => {
    const point: Record<string, string | number> = { idx, date: fmtShort(b.ran_at) };

    // Overall
    const total = b.passed + b.failed;
    point[OVERALL_KEY] = total > 0 ? Math.round((b.passed / total) * 100) : 0;

    // Per group
    for (const g of groups) {
      const groupRecs = b.records.filter(r => ruleGroupMap.get(r.rule_id) === g);
      const gTotal = groupRecs.length;
      const gPassed = groupRecs.filter(r => r.passed).length;
      point[g] = gTotal > 0 ? Math.round((gPassed / gTotal) * 100) : 0;
    }

    return point;
  });

  function toggle(key: string) {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-medium">Pass Rate Trend</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {allKeys.map((key, i) => {
            const color = key === OVERALL_KEY ? C_PASS : GROUP_COLORS[(i - 1) % GROUP_COLORS.length];
            const on = visible.has(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity"
                style={{
                  background: on ? `${color}22` : "var(--bg-tertiary)",
                  border: `1px solid ${on ? color : "var(--border)"}`,
                  color: on ? color : "var(--text-secondary)",
                  opacity: on ? 1 : 0.5,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? color : "var(--text-secondary)" }} />
                {key}
              </button>
            );
          })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="idx" type="number" domain={[0, batches.length - 1]} tickCount={batches.length} tickFormatter={i => data[i as number]?.date as string ?? ""} tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} />
          <Tooltip content={<TrendTooltip />} />
          {allKeys.map((key, i) => {
            if (!visible.has(key)) return null;
            const color = key === OVERALL_KEY ? C_PASS : GROUP_COLORS[(i - 1) % GROUP_COLORS.length];
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={key === OVERALL_KEY ? 2.5 : 1.5}
                dot={{ r: 3 }}
                strokeDasharray={key === OVERALL_KEY ? undefined : "5 2"}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Rule sparkline (dots showing recent pass/fail) ─────────────────────────

function RuleSparkline({ ruleName, batches }: { ruleName: string; batches: Batch[] }) {
  const recentRuns = batches
    .map(b => b.records.find(r => r.rule_name === ruleName))
    .filter(Boolean)
    .slice(-8) as RuleRunRecord[];

  if (recentRuns.length < 2) return null;

  return (
    <div className="flex items-center gap-0.5" title="Recent runs (oldest → newest)">
      {recentRuns.map((r, i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: r.passed ? C_PASS : C_FAIL, opacity: 0.4 + 0.6 * ((i + 1) / recentRuns.length) }}
        />
      ))}
    </div>
  );
}

// ── Rule failing-count trend (shown in expanded rule view) ─────────────────

function RuleFailingTrend({ ruleName, batches }: { ruleName: string; batches: Batch[] }) {
  const data = batches
    .map(b => {
      const rec = b.records.find(r => r.rule_name === ruleName);
      if (!rec) return null;
      return { date: fmtShort(b.ran_at), failing: rec.failing_count };
    })
    .filter(Boolean) as { date: string; failing: number }[];

  if (data.length < 2) return null;

  return (
    <div className="mt-2 rounded p-2" style={{ background: "var(--bg-tertiary)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Failing rows over time</p>
      <ResponsiveContainer width="100%" height={72}>
        <LineChart data={data} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: C_MUTED }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: C_MUTED }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip
            contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}
            itemStyle={{ color: "var(--text-primary)" }}
          />
          <Line type="monotone" dataKey="failing" name="Failing rows" stroke={C_FAIL} strokeWidth={1.5} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Rule history modal ─────────────────────────────────────────────────────

function RuleHistoryModal({ ruleId, ruleName, allBatches, onClose }: {
  ruleId: string;
  ruleName: string;
  allBatches: Batch[];
  onClose: () => void;
}) {
  const runs = allBatches
    .map(b => ({ batch: b, rec: b.records.find(r => r.rule_id === ruleId) }))
    .filter(x => x.rec)
    .map(x => ({ ...x.rec!, ran_at: x.batch.ran_at }))
    .sort((a, b) => new Date(a.ran_at).getTime() - new Date(b.ran_at).getTime());

  const chartData = runs.map((r, idx) => ({
    idx,
    date: fmtShort(r.ran_at),
    failing: r.failing_count,
    passed: r.passed ? 1 : 0,
  }));

  return (
    <Modal title={`Execution History — ${ruleName}`} onClose={onClose} width="620px">
      {runs.length === 0 && (
        <p className="text-sm py-6 text-center" style={{ color: "var(--text-secondary)" }}>No history recorded for this rule yet.</p>
      )}

      {runs.length > 0 && (
        <>
          {/* Trend chart */}
          {runs.length >= 2 && (
            <div className="mb-4 rounded-lg p-3" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Failing rows over time</p>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="idx" type="number" domain={[0, runs.length - 1]} tickCount={runs.length} tickFormatter={i => chartData[i as number]?.date ?? ""} tick={{ fontSize: 9, fill: C_MUTED }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: C_MUTED }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    labelFormatter={i => chartData[i as number]?.date ?? ""}
                  />
                  <Line type="monotone" dataKey="failing" name="Failing rows" stroke={C_FAIL} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Run log */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--bg-tertiary)" }}>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>Run time</th>
                  <th className="text-center px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>Result</th>
                  <th className="text-right px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>Failing</th>
                  <th className="text-right px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>Total</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {[...runs].reverse().map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-secondary)" : "transparent" }}>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtShort(r.ran_at)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={r.passed ? "success" : "danger"}>{r.passed ? "PASS" : "FAIL"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: r.failing_count > 0 ? C_FAIL : "var(--text-secondary)" }}>
                      {r.failing_count > 0 ? r.failing_count.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {r.total_count > 0 ? r.total_count.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 truncate max-w-0" style={{ color: "var(--text-secondary)", maxWidth: 180 }}>{r.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Group result section ───────────────────────────────────────────────────

function ResultGroup({
  name,
  results,
  running,
  runningGroup,
  batches,
  onRunGroup,
  onViewQuery,
  onViewRows,
  onViewHistory,
}: {
  name: string;
  results: RuleResult[];
  running: boolean;
  runningGroup: string | null;
  batches: Batch[];
  onRunGroup: (groupName: string) => void;
  onViewQuery: (sql: string) => void;
  onViewRows: (ruleId: string, ruleName: string) => void;
  onViewHistory: (ruleId: string, ruleName: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const failed = results.filter(r => !r.passed).length;
  const groupRunning = runningGroup === name;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-3 select-none" style={{ background: "var(--bg-tertiary)" }}>
        <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? <ChevronRight size={14} style={{ color: "var(--text-secondary)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />}
          <span className="font-medium text-sm truncate">{name}</span>
          <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>{results.length} rule{results.length !== 1 ? "s" : ""}</span>
          {results.length > 0 && (
            failed === 0
              ? <Badge variant="success">All Passed</Badge>
              : <Badge variant="danger">{failed} Failed</Badge>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRunGroup(name); }}
          disabled={groupRunning || running}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium disabled:opacity-40 shrink-0 ml-2"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <PlayCircle size={12} className={groupRunning ? "animate-pulse" : ""} />
          {groupRunning ? "Running..." : "Run Group"}
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y" style={{ borderTop: "1px solid var(--border)" }}>
          {results.map((r, i) => {
            const canViewRows = !r.passed;
            const failPct = r.total_count > 0 ? Math.min(100, (r.failing_count / r.total_count) * 100) : 0;
            const isExpanded = expandedRule === r.rule_id;
            return (
              <div key={i}>
                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  style={{
                    background: r.passed ? "var(--bg-secondary)" : "rgba(239,68,68,0.06)",
                    borderLeft: r.passed ? "3px solid transparent" : `3px solid ${C_FAIL}`,
                  }}
                  onClick={() => setExpandedRule(isExpanded ? null : r.rule_id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {r.passed ? <CheckCircle2 size={16} style={{ color: C_PASS }} /> : <XCircle size={16} style={{ color: C_FAIL }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{r.rule_name}</span>
                      <Badge variant={r.passed ? "success" : "danger"}>{r.passed ? "PASS" : "FAIL"}</Badge>
                      {!r.passed && r.failing_count > 0 && (
                        <span className="text-xs font-medium" style={{ color: C_FAIL }}>
                          {r.failing_count.toLocaleString()} failing row{r.failing_count !== 1 ? "s" : ""}
                        </span>
                      )}
                      <RuleSparkline ruleName={r.rule_name} batches={batches} />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{r.details}</p>
                    {!r.passed && r.total_count > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)", width: "160px" }}>
                          <div className="h-full rounded-full" style={{ background: C_FAIL, width: `${failPct}%` }} />
                        </div>
                        <span className="text-xs" style={{ color: C_FAIL }}>{Math.round(failPct)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canViewRows && (
                      <button
                        onClick={e => { e.stopPropagation(); onViewRows(r.rule_id, r.rule_name); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium"
                        style={{ background: "rgba(239,68,68,0.15)", color: C_FAIL }}
                        title="View failing rows"
                      >
                        <Table2 size={12} /> View Rows
                      </button>
                    )}
                    {r.query_used && (
                      <button
                        onClick={e => { e.stopPropagation(); onViewQuery(r.query_used); }}
                        className="p-1.5 rounded opacity-50 hover:opacity-100"
                        title="View SQL"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Code size={14} />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); onViewHistory(r.rule_id, r.rule_name); }}
                      className="p-1.5 rounded opacity-50 hover:opacity-100"
                      title="View execution history"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <History size={14} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3" style={{ background: r.passed ? "var(--bg-secondary)" : "rgba(239,68,68,0.03)" }}>
                    <RuleFailingTrend ruleName={r.rule_name} batches={batches} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ResultsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [results, setResults] = useState<RuleResult[]>([]);
  const [history, setHistory] = useState<RuleRunRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [runningGroup, setRunningGroup] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [viewingRows, setViewingRows] = useState<{ ruleId: string; ruleName: string } | null>(null);
  const [viewingRuleHistory, setViewingRuleHistory] = useState<{ ruleId: string; ruleName: string } | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  async function load() {
    const [r, res, hist] = await Promise.all([api.listRules(), api.getLastResults(), api.getResultsHistory()]);
    setRules(r);
    setResults(res);
    setHistory(hist);
  }

  useEffect(() => { load(); }, []);

  const batches = useMemo(() => groupIntoBatches(history), [history]);
  const isFiltered = !!(dateFrom || dateTo);

  const filteredBatches = useMemo(() => {
    if (!isFiltered) return batches;
    return batches.filter(b => {
      const d = b.ran_at.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [batches, dateFrom, dateTo, isFiltered]);

  // When filtered: latest result per rule within the period. Otherwise: last run.
  const activeResults = useMemo<RuleResult[]>(() => {
    if (!isFiltered) return results;
    const rangeRecords = history.filter(r => {
      const d = r.ran_at.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
    const latestByRule = new Map<string, RuleRunRecord>();
    for (const r of rangeRecords) {
      const existing = latestByRule.get(r.rule_id);
      if (!existing || r.ran_at > existing.ran_at) latestByRule.set(r.rule_id, r);
    }
    return [...latestByRule.values()].map(r => ({
      rule_id: r.rule_id,
      rule_name: r.rule_name,
      passed: r.passed,
      failing_count: r.failing_count,
      total_count: r.total_count,
      details: r.details,
      query_used: "",
    }));
  }, [isFiltered, results, history, dateFrom, dateTo]);

  function applyPreset(days: number | null) {
    if (days === null) { setDateFrom(""); setDateTo(""); return; }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    setDateFrom(toDateStr(from));
    setDateTo(toDateStr(to));
  }

  async function runAll() {
    setRunning(true);
    try {
      const r = await api.runAllRules();
      setResults(r);
      const hist = await api.getResultsHistory();
      setHistory(hist);
    } finally {
      setRunning(false);
    }
  }

  async function runGroup(groupName: string) {
    const groupRules = groupName === "Ungrouped"
      ? rules.filter(r => !r.group)
      : rules.filter(r => r.group === groupName);
    setRunningGroup(groupName);
    const batchId = crypto.randomUUID();
    const newResults: RuleResult[] = [];
    try {
      for (const rule of groupRules) {
        try {
          const res = await api.runRule(rule.id, batchId);
          newResults.push(res);
        } catch { /* continue */ }
      }
      setResults(prev => {
        const map = new Map(prev.map(r => [r.rule_id, r]));
        for (const r of newResults) map.set(r.rule_id, r);
        return [...map.values()];
      });
      const hist = await api.getResultsHistory();
      setHistory(hist);
    } finally {
      setRunningGroup(null);
    }
  }

  const ruleGroupMap = new Map(rules.map(r => [r.id, r.group ?? null]));
  const resultsByGroup = new Map<string, RuleResult[]>();
  const ungroupedResults: RuleResult[] = [];

  for (const result of activeResults) {
    const group = ruleGroupMap.get(result.rule_id) ?? null;
    if (group) {
      const list = resultsByGroup.get(group) ?? [];
      list.push(result);
      resultsByGroup.set(group, list);
    } else {
      ungroupedResults.push(result);
    }
  }
  const sortedGroups = [...resultsByGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  const hasGroups = sortedGroups.length > 0;

  const passed = activeResults.filter(r => r.passed).length;
  const failed = activeResults.filter(r => !r.passed).length;

  const groupBarData = sortedGroups.map(([name, res]) => ({
    name: name.length > 16 ? name.slice(0, 16) + "…" : name,
    passed: res.filter(r => r.passed).length,
    failed: res.filter(r => !r.passed).length,
  }));
  if (ungroupedResults.length > 0 && hasGroups) {
    groupBarData.push({
      name: "Ungrouped",
      passed: ungroupedResults.filter(r => r.passed).length,
      failed: ungroupedResults.filter(r => !r.passed).length,
    });
  }

  const PRESETS: [string, number | null][] = [["Today", 1], ["7 days", 7], ["30 days", 30], ["90 days", 90], ["All time", null]];

  function isPresetActive(days: number | null) {
    if (days === null) return !dateFrom && !dateTo;
    const expectedFrom = toDateStr((() => { const d = new Date(); d.setDate(d.getDate() - days + 1); return d; })());
    return dateFrom === expectedFrom && dateTo === toDateStr(new Date());
  }

  const hasAnyResults = results.length > 0 || (isFiltered && activeResults.length > 0);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Run Results</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Run all rules or individual groups and view outcomes
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={running || !!runningGroup}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Play size={14} className={running ? "animate-pulse" : ""} />
          {running ? "Running..." : "Run All Rules"}
        </button>
      </div>

      {/* Date filter bar — always visible once there is any history */}
      {(results.length > 0 || history.length > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-5 rounded-lg flex-wrap" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>Filter</span>
          <div className="flex items-center gap-1 flex-wrap">
            {PRESETS.map(([label, days]) => (
              <button
                key={label}
                onClick={() => applyPreset(days)}
                className="px-2.5 py-1 rounded text-xs font-medium"
                style={{
                  background: isPresetActive(days) ? "var(--accent)" : "var(--bg-tertiary)",
                  color: isPresetActive(days) ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${isPresetActive(days) ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded px-2 py-1 text-xs"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded px-2 py-1 text-xs"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          {isFiltered && (
            <span className="text-xs ml-1" style={{ color: "var(--text-secondary)" }}>
              {activeResults.length} rule{activeResults.length !== 1 ? "s" : ""} in period
            </span>
          )}
        </div>
      )}

      {!hasAnyResults && !running && (
        <div className="text-center py-16 rounded-lg" style={{ border: "1px dashed var(--border)" }}>
          <p style={{ color: "var(--text-secondary)" }}>
            {isFiltered ? "No results found in the selected period." : "Click \"Run All Rules\" to see results here."}
          </p>
        </div>
      )}

      {(activeResults.length > 0 || running) && (
        <>
          {isFiltered && (
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
              Showing latest result per rule in the selected period. Live actions (View Rows, SQL) are only available for the most recent run.
            </p>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-bold">{activeResults.length}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Total Rules</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-2xl font-bold" style={{ color: C_PASS }}>{passed}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Passed</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-2xl font-bold" style={{ color: C_FAIL }}>{failed}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Failed</p>
            </div>
          </div>

          {/* Charts row */}
          <div className={`grid gap-4 mb-4 ${hasGroups ? "grid-cols-2" : "grid-cols-1"}`}>
            <OverallDonut passed={passed} failed={failed} />
            {hasGroups && <GroupBar groups={groupBarData} />}
          </div>

          {/* Pass rate trend — only if 2+ historical batches */}
          {filteredBatches.length >= 2 && (
            <div className="mb-4 rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <PassRateTrend batches={filteredBatches} rules={rules} />
            </div>
          )}

          {/* Failure rate chart */}
          {activeResults.some(r => !r.passed && r.total_count > 0) && (
            <div className="mb-6">
              <FailureRateBar results={activeResults} />
            </div>
          )}

          {/* Grouped rule lists */}
          <div className="space-y-3">
            {sortedGroups.map(([groupName, groupResults]) => (
              <ResultGroup
                key={groupName}
                name={groupName}
                results={groupResults}
                running={running}
                runningGroup={runningGroup}
                batches={filteredBatches}
                onRunGroup={isFiltered ? () => {} : runGroup}
                onViewQuery={isFiltered ? () => {} : setSelectedQuery}
                onViewRows={isFiltered ? () => {} : (id, name) => setViewingRows({ ruleId: id, ruleName: name })}
                onViewHistory={(id, name) => setViewingRuleHistory({ ruleId: id, ruleName: name })}
              />
            ))}

            {ungroupedResults.length > 0 && (
              hasGroups ? (
                <ResultGroup
                  key="__ungrouped__"
                  name="Ungrouped"
                  results={ungroupedResults}
                  running={running}
                  runningGroup={runningGroup}
                  batches={filteredBatches}
                  onRunGroup={isFiltered ? () => {} : runGroup}
                  onViewQuery={isFiltered ? () => {} : setSelectedQuery}
                  onViewRows={isFiltered ? () => {} : (id, name) => setViewingRows({ ruleId: id, ruleName: name })}
                  onViewHistory={(id, name) => setViewingRuleHistory({ ruleId: id, ruleName: name })}
                />
              ) : (
                <div className="space-y-2">
                  {ungroupedResults.map((r, i) => {
                    const canViewRows = !r.passed;
                    const failPct = r.total_count > 0 ? Math.min(100, (r.failing_count / r.total_count) * 100) : 0;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 rounded-lg"
                        style={{
                          background: r.passed ? "var(--bg-secondary)" : "rgba(239,68,68,0.06)",
                          border: r.passed ? "1px solid var(--border)" : `1px solid rgba(239,68,68,0.3)`,
                          borderLeft: r.passed ? undefined : `3px solid ${C_FAIL}`,
                        }}
                      >
                        <div className="mt-0.5 shrink-0">
                          {r.passed ? <CheckCircle2 size={16} style={{ color: C_PASS }} /> : <XCircle size={16} style={{ color: C_FAIL }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{r.rule_name}</span>
                            <Badge variant={r.passed ? "success" : "danger"}>{r.passed ? "PASS" : "FAIL"}</Badge>
                            {!r.passed && r.failing_count > 0 && (
                              <span className="text-xs font-medium" style={{ color: C_FAIL }}>
                                {r.failing_count.toLocaleString()} failing row{r.failing_count !== 1 ? "s" : ""}
                              </span>
                            )}
                            <RuleSparkline ruleName={r.rule_name} batches={filteredBatches} />
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{r.details}</p>
                          {!r.passed && r.total_count > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)", width: "160px" }}>
                                <div className="h-full rounded-full" style={{ background: C_FAIL, width: `${failPct}%` }} />
                              </div>
                              <span className="text-xs" style={{ color: C_FAIL }}>{Math.round(failPct)}%</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canViewRows && !isFiltered && (
                            <button
                              onClick={() => setViewingRows({ ruleId: r.rule_id, ruleName: r.rule_name })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium"
                              style={{ background: "rgba(239,68,68,0.15)", color: C_FAIL }}
                            >
                              <Table2 size={12} /> View Rows
                            </button>
                          )}
                          {r.query_used && !isFiltered && (
                            <button
                              onClick={() => setSelectedQuery(r.query_used)}
                              className="p-1.5 rounded opacity-50 hover:opacity-100 shrink-0"
                              title="View SQL"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <Code size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setViewingRuleHistory({ ruleId: r.rule_id, ruleName: r.rule_name })}
                            className="p-1.5 rounded opacity-50 hover:opacity-100 shrink-0"
                            title="View execution history"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </>
      )}

      {selectedQuery && (
        <Modal title="SQL Used" onClose={() => setSelectedQuery(null)}>
          <pre className="text-xs p-3 rounded overflow-auto" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "monospace", maxHeight: "300px" }}>
            {selectedQuery}
          </pre>
        </Modal>
      )}

      {viewingRows && (
        <FailingRowsModal
          ruleId={viewingRows.ruleId}
          ruleName={viewingRows.ruleName}
          onClose={() => setViewingRows(null)}
        />
      )}

      {viewingRuleHistory && (
        <RuleHistoryModal
          ruleId={viewingRuleHistory.ruleId}
          ruleName={viewingRuleHistory.ruleName}
          allBatches={batches}
          onClose={() => setViewingRuleHistory(null)}
        />
      )}
    </div>
  );
}
