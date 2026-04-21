import { useState, useEffect } from "react";
import { Play, CheckCircle2, XCircle, Code, PlayCircle, ChevronDown, ChevronRight, Table2 } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { api } from "../invoke";
import type { Rule, RuleResult, QueryResult } from "../types";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";

const C_PASS = "#22c55e";
const C_FAIL = "#ef4444";
const C_MUTED = "#6b7280";


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
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? C_PASS : C_FAIL} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                itemStyle={{ color: "var(--text-primary)" }}
              />
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
            <Tooltip
              contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
              itemStyle={{ color: "var(--text-primary)" }}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
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
          <Tooltip
            formatter={(v) => [`${v}%`, "Failure rate"]}
            contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            itemStyle={{ color: "var(--text-primary)" }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="rate" name="Failure rate" fill={C_FAIL} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Group result section ───────────────────────────────────────────────────

function ResultGroup({
  name,
  results,
  running,
  runningGroup,
  onRunGroup,
  onViewQuery,
  onViewRows,
}: {
  name: string;
  results: RuleResult[];
  running: boolean;
  runningGroup: string | null;
  onRunGroup: (groupName: string) => void;
  onViewQuery: (sql: string) => void;
  onViewRows: (ruleId: string, ruleName: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const failed = results.filter(r => !r.passed).length;
  const groupRunning = runningGroup === name;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div
        className="flex items-center justify-between px-4 py-3 select-none"
        style={{ background: "var(--bg-tertiary)" }}
      >
        <div
          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
          onClick={() => setCollapsed(c => !c)}
        >
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
            return (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-3"
                style={{
                  background: r.passed ? "var(--bg-secondary)" : "rgba(239,68,68,0.06)",
                  borderLeft: r.passed ? "3px solid transparent" : `3px solid ${C_FAIL}`,
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {r.passed
                    ? <CheckCircle2 size={16} style={{ color: C_PASS }} />
                    : <XCircle size={16} style={{ color: C_FAIL }} />
                  }
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
                      onClick={() => onViewRows(r.rule_id, r.rule_name)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium"
                      style={{ background: "rgba(239,68,68,0.15)", color: C_FAIL }}
                      title="View failing rows"
                    >
                      <Table2 size={12} /> View Rows
                    </button>
                  )}
                  {r.query_used && (
                    <button
                      onClick={() => onViewQuery(r.query_used)}
                      className="p-1.5 rounded opacity-50 hover:opacity-100"
                      title="View SQL"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Code size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function ResultsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [results, setResults] = useState<RuleResult[]>([]);
  const [running, setRunning] = useState(false);
  const [runningGroup, setRunningGroup] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [viewingRows, setViewingRows] = useState<{ ruleId: string; ruleName: string } | null>(null);

  async function load() {
    const [r, res] = await Promise.all([api.listRules(), api.getLastResults()]);
    setRules(r);
    setResults(res);
  }

  useEffect(() => { load(); }, []);

  async function runAll() {
    setRunning(true);
    try {
      const r = await api.runAllRules();
      setResults(r);
    } finally {
      setRunning(false);
    }
  }

  async function runGroup(groupName: string) {
    const groupRules = rules.filter(r => r.group === groupName);
    setRunningGroup(groupName);
    const newResults: RuleResult[] = [];
    try {
      for (const rule of groupRules) {
        try {
          const res = await api.runRule(rule.id);
          newResults.push(res);
        } catch { /* continue */ }
      }
      setResults(prev => {
        const map = new Map(prev.map(r => [r.rule_id, r]));
        for (const r of newResults) map.set(r.rule_id, r);
        return [...map.values()];
      });
    } finally {
      setRunningGroup(null);
    }
  }

  // Lookup maps derived from rules
  const ruleGroupMap = new Map(rules.map(r => [r.id, r.group ?? null]));
  const resultsByGroup = new Map<string, RuleResult[]>();
  const ungroupedResults: RuleResult[] = [];

  for (const result of results) {
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

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  // Data for group bar chart
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

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
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

      {results.length === 0 && !running && (
        <div className="text-center py-16 rounded-lg" style={{ border: "1px dashed var(--border)" }}>
          <p style={{ color: "var(--text-secondary)" }}>Click "Run All Rules" to see results here.</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-bold">{results.length}</p>
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
          <div className={`grid gap-4 mb-6 ${hasGroups ? "grid-cols-2" : "grid-cols-1"}`}>
            <OverallDonut passed={passed} failed={failed} />
            {hasGroups && <GroupBar groups={groupBarData} />}
          </div>

          {/* Failure rate chart — only when there are failing rules with row counts */}
          {results.some(r => !r.passed && r.total_count > 0) && (
            <div className="mb-6">
              <FailureRateBar results={results} />
            </div>
          )}

          {/* Grouped result lists */}
          <div className="space-y-3">
            {sortedGroups.map(([groupName, groupResults]) => (
              <ResultGroup
                key={groupName}
                name={groupName}
                results={groupResults}
                running={running}
                runningGroup={runningGroup}

                onRunGroup={runGroup}
                onViewQuery={setSelectedQuery}
                onViewRows={(id, name) => setViewingRows({ ruleId: id, ruleName: name })}
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
  
                  onRunGroup={() => {}}
                  onViewQuery={setSelectedQuery}
                  onViewRows={(id, name) => setViewingRows({ ruleId: id, ruleName: name })}
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
                          {r.passed
                            ? <CheckCircle2 size={16} style={{ color: C_PASS }} />
                            : <XCircle size={16} style={{ color: C_FAIL }} />
                          }
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
                              onClick={() => setViewingRows({ ruleId: r.rule_id, ruleName: r.rule_name })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium"
                              style={{ background: "rgba(239,68,68,0.15)", color: C_FAIL }}
                            >
                              <Table2 size={12} /> View Rows
                            </button>
                          )}
                          {r.query_used && (
                            <button
                              onClick={() => setSelectedQuery(r.query_used)}
                              className="p-1.5 rounded opacity-50 hover:opacity-100 shrink-0"
                              title="View SQL"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <Code size={14} />
                            </button>
                          )}
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
    </div>
  );
}
