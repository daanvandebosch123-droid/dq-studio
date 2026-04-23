import { useState, useEffect, useMemo } from "react";
import { History, ChevronDown, ChevronRight, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api } from "../invoke";
import type { RuleRunRecord } from "../types";
import { Badge } from "../components/Badge";

const C_PASS = "#22c55e";
const C_FAIL = "#ef4444";
const C_MUTED = "#6b7280";

// ── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

<<<<<<< HEAD
=======
function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

>>>>>>> origin/main
interface Batch {
  batch_id: string;
  ran_at: string;
  records: RuleRunRecord[];
  passed: number;
  failed: number;
  pass_rate: number;
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

// ── per-rule trend chart ───────────────────────────────────────────────────

<<<<<<< HEAD
function RuleTrendChart({ ruleId, batches }: { ruleId: string; batches: Batch[] }) {
  const data = batches
    .map(b => {
      const rec = b.records.find(r => r.rule_id === ruleId);
      if (!rec) return null;
      return {
        date: fmtDate(b.ran_at),
=======
function RuleTrendChart({ ruleName, batches }: { ruleName: string; batches: Batch[] }) {
  const data = batches
    .map(b => {
      const rec = b.records.find(r => r.rule_name === ruleName);
      if (!rec) return null;
      return {
        date: fmtDateShort(b.ran_at),
>>>>>>> origin/main
        failing: rec.failing_count,
        total: rec.total_count,
        passed: rec.passed ? 1 : 0,
      };
    })
    .filter(Boolean) as { date: string; failing: number; total: number; passed: number }[];

  if (data.length < 2) return null;

  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Failing rows over time</p>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C_MUTED }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: C_MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
            itemStyle={{ color: "var(--text-primary)" }}
          />
          <Line type="monotone" dataKey="failing" name="Failing rows" stroke={C_FAIL} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── batch row ──────────────────────────────────────────────────────────────

function BatchRow({ batch, allBatches }: { batch: Batch; allBatches: Batch[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ background: "var(--bg-tertiary)" }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />
          : <ChevronRight size={14} style={{ color: "var(--text-secondary)" }} />
        }
        <span className="text-sm font-medium flex-1">{fmtDate(batch.ran_at)}</span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{batch.records.length} rule{batch.records.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-2 ml-3">
          <span className="text-xs font-semibold" style={{ color: batch.pass_rate === 100 ? C_PASS : batch.pass_rate < 50 ? C_FAIL : "var(--text-primary)" }}>
            {batch.pass_rate}%
          </span>
          {batch.failed > 0
            ? <Badge variant="danger">{batch.failed} Failed</Badge>
            : <Badge variant="success">All Passed</Badge>
          }
        </div>
      </div>

      {expanded && (
        <div className="divide-y" style={{ borderTop: "1px solid var(--border)" }}>
          {batch.records.map(r => (
            <div key={r.id}>
              <div
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                style={{
                  background: r.passed ? "var(--bg-secondary)" : "rgba(239,68,68,0.05)",
                  borderLeft: r.passed ? "3px solid transparent" : `3px solid ${C_FAIL}`,
                }}
                onClick={() => setExpandedRule(expandedRule === r.rule_name ? null : r.rule_name)}
              >
                <div className="shrink-0">
                  {r.passed
                    ? <CheckCircle2 size={14} style={{ color: C_PASS }} />
                    : <XCircle size={14} style={{ color: C_FAIL }} />
                  }
                </div>
                <span className="text-sm flex-1">{r.rule_name}</span>
                {!r.passed && r.total_count > 0 && (
                  <span className="text-xs" style={{ color: C_FAIL }}>
                    {r.failing_count.toLocaleString()} / {r.total_count.toLocaleString()} failing
                  </span>
                )}
                <Badge variant={r.passed ? "success" : "danger"}>{r.passed ? "PASS" : "FAIL"}</Badge>
              </div>
              {expandedRule === r.rule_name && (
                <div className="px-4 pb-3" style={{ background: r.passed ? "var(--bg-secondary)" : "rgba(239,68,68,0.03)" }}>
<<<<<<< HEAD
                  <RuleTrendChart ruleId={r.rule_id} batches={allBatches} />
=======
                  <RuleTrendChart ruleName={r.rule_name} batches={allBatches} />
>>>>>>> origin/main
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── trend chart (overall pass rate) ───────────────────────────────────────

function OverallTrendChart({ batches }: { batches: Batch[] }) {
  if (batches.length < 2) return null;

  const data = batches.map(b => ({
<<<<<<< HEAD
    date: fmtDate(b.ran_at),
=======
    date: fmtDateShort(b.ran_at),
>>>>>>> origin/main
    "Pass rate": b.pass_rate,
    Passed: b.passed,
    Failed: b.failed,
  }));

  return (
    <div className="rounded-lg p-4 mb-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-medium mb-3">Pass Rate Over Time</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: C_MUTED }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            itemStyle={{ color: "var(--text-primary)" }}
            formatter={(v, name) => name === "Pass rate" ? [`${v}%`, name] : [`${v}`, name]}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Line type="monotone" dataKey="Pass rate" stroke={C_PASS} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Failed" stroke={C_FAIL} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── per-rule summary table ─────────────────────────────────────────────────

function RuleSummaryTable({ batches }: { batches: Batch[] }) {
<<<<<<< HEAD
  const ruleEntries = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of batches) for (const r of b.records) map.set(r.rule_id, r.rule_name);
    return [...map.entries()].sort(([, a], [, b]) => a.localeCompare(b));
  }, [batches]);

  if (ruleEntries.length === 0 || batches.length < 2) return null;
=======
  const ruleNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of batches) for (const r of b.records) names.add(r.rule_name);
    return [...names].sort();
  }, [batches]);

  if (ruleNames.length === 0 || batches.length < 2) return null;
>>>>>>> origin/main

  return (
    <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border)" }}>
      <p className="text-sm font-medium px-4 py-3" style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
        Rule Trend Summary
      </p>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "var(--bg-tertiary)" }}>
              <th className="text-left px-4 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Rule</th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Runs</th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Pass rate</th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Last run</th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Trend</th>
            </tr>
          </thead>
          <tbody>
<<<<<<< HEAD
            {ruleEntries.map(([ruleId, ruleName]) => {
              const recs = batches.flatMap(b => b.records.filter(r => r.rule_id === ruleId));
=======
            {ruleNames.map(name => {
              const recs = batches.flatMap(b => b.records.filter(r => r.rule_name === name));
>>>>>>> origin/main
              const passCount = recs.filter(r => r.passed).length;
              const rate = recs.length > 0 ? Math.round((passCount / recs.length) * 100) : 0;
              const last = recs[recs.length - 1];
              const recentStatuses = recs.slice(-5).map(r => r.passed);

              return (
<<<<<<< HEAD
                <tr key={ruleId} style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <td className="px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>{ruleName}</td>
=======
                <tr key={name} style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <td className="px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>{name}</td>
>>>>>>> origin/main
                  <td className="px-3 py-2 text-center" style={{ color: "var(--text-secondary)" }}>{recs.length}</td>
                  <td className="px-3 py-2 text-center font-semibold" style={{ color: rate === 100 ? C_PASS : rate < 50 ? C_FAIL : "var(--text-primary)" }}>
                    {rate}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={last.passed ? "success" : "danger"}>{last.passed ? "PASS" : "FAIL"}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {recentStatuses.map((p, i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ background: p ? C_PASS : C_FAIL }}
                          title={p ? "Pass" : "Fail"}
                        />
                      ))}
                    </div>
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

// ── page ───────────────────────────────────────────────────────────────────

export function ResultsHistoryPage() {
  const [records, setRecords] = useState<RuleRunRecord[]>([]);
  const [clearing, setClearing] = useState(false);

  async function load() {
    const r = await api.getResultsHistory();
    setRecords(r);
  }

  useEffect(() => { load(); }, []);

  const batches = useMemo(() => groupIntoBatches(records), [records]);

  async function handleClear() {
    if (!confirm("Clear all rule run history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await api.clearResultsHistory();
      setRecords([]);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <History size={18} />
            Rule Run History
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Historical pass/fail trends across all rule executions
          </p>
        </div>
        {records.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.12)", color: C_FAIL }}
          >
            <Trash2 size={12} />
            {clearing ? "Clearing..." : "Clear History"}
          </button>
        )}
      </div>

      {records.length === 0 && (
        <div className="text-center py-16 rounded-lg" style={{ border: "1px dashed var(--border)" }}>
          <History size={32} className="mx-auto mb-3 opacity-30" />
          <p style={{ color: "var(--text-secondary)" }}>No history yet. Run some rules to see trends here.</p>
        </div>
      )}

      {batches.length > 0 && (
        <>
          <OverallTrendChart batches={batches} />
          <RuleSummaryTable batches={batches} />

          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {batches.length} run{batches.length !== 1 ? "s" : ""} recorded
            </p>
            {[...batches].reverse().map(b => (
              <BatchRow key={b.batch_id} batch={b} allBatches={batches} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
