import { useState, useEffect } from "react";
import { ScanSearch, Play, Loader2, AlertCircle, FileText } from "lucide-react";
import { api } from "../invoke";
import type { ConnectionInfo, SchemaTable, ProfilingRun, QueryResult } from "../types";
import { SearchableSelect } from "../components/SearchableSelect";
import { ProfileTable, ProfileSummaryCards } from "./ProfilingShared";

const SAMPLE_LIMIT = 20;

// ── Sample data table ─────────────────────────────────────────────────────

function SampleDataTable({ data }: { data: QueryResult }) {
  if (data.rows.length === 0) {
    return <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No rows returned.</p>;
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto" style={{ maxHeight: "420px" }}>
        <table className="text-xs border-collapse" style={{ minWidth: "100%" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: "var(--bg-tertiary)" }}>
              <th
                className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", width: "40px" }}
              >
                #
              </th>
              {data.columns.map(col => (
                <th
                  key={col}
                  className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                  style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  borderBottom: i < data.rows.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <td className="px-3 py-2 tabular-nums" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>{i + 1}</td>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-3 py-2 whitespace-nowrap"
                    style={{
                      color: cell === null ? "var(--text-secondary)" : "var(--text-primary)",
                      fontStyle: cell === null ? "italic" : "normal",
                      maxWidth: "240px",
                    }}
                  >
                    <span className="block truncate" title={cell === null ? "NULL" : String(cell)}>
                      {cell === null ? "NULL" : String(cell)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
        Showing {data.rows.length} of up to {SAMPLE_LIMIT} rows
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

type Tab = "statistics" | "sample";

export function ProfilingPage() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [schema, setSchema] = useState("");
  const [table, setTable] = useState("");
  const [profiling, setProfiling] = useState(false);
  const [run, setRun] = useState<ProfilingRun | null>(null);
  const [sample, setSample] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("statistics");

  useEffect(() => {
    api.listConnections().then(cs => {
      setConnections(cs);
      if (cs.length > 0) setConnectionId(cs[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!connectionId) return;
    setTables([]);
    setSchema("");
    setTable("");
    setRun(null);
    setSample(null);
    setError(null);
    setLoadingTables(true);
    api.getTables(connectionId).then(tbls => {
      setTables(tbls);
      if (tbls.length === 1) { setSchema(tbls[0].schema); setTable(tbls[0].table); }
    }).catch(() => {}).finally(() => setLoadingTables(false));
  }, [connectionId]);

  function handleTableChange(val: string) {
    const [s, t] = val.split("||");
    setSchema(s ?? "");
    setTable(t ?? "");
    setRun(null);
    setSample(null);
    setError(null);
  }

  async function handleProfile() {
    if (!connectionId || !schema || !table) return;
    setProfiling(true);
    setError(null);
    setRun(null);
    setSample(null);
    setActiveTab("statistics");
    try {
      const [profileResult, sampleResult] = await Promise.all([
        api.profileTable(connectionId, schema, table),
        api.sampleTable(connectionId, schema, table, SAMPLE_LIMIT),
      ]);
      setRun(profileResult);
      setSample(sampleResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setProfiling(false);
    }
  }

  const selectedConn = connections.find(c => c.id === connectionId);
  const isFileConn = selectedConn?.config.type === "csv" || selectedConn?.config.type === "excel";

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-colors";
  const inputStyle = { background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-bold">Data Profiling</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Analyze column statistics and sample data across any data source
        </p>
      </div>

      {/* Controls */}
      <div className="rounded-xl p-4 mb-6 flex flex-wrap items-end gap-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Connection</label>
          <select className={inputCls} style={inputStyle} value={connectionId} onChange={e => setConnectionId(e.target.value)}>
            {connections.length === 0 && <option value="">No connections</option>}
            {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {isFileConn ? (tables.length === 1 ? "File" : "Sheet") : "Table"}
          </label>
          {isFileConn && tables.length === 1 ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <FileText size={13} style={{ color: "var(--text-secondary)" }} />
              <span className="font-medium">{tables[0].table}</span>
              <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>auto-selected</span>
            </div>
          ) : (
            <SearchableSelect
              value={schema && table ? `${schema}||${table}` : ""}
              onChange={handleTableChange}
              options={tables.map(t => ({ value: `${t.schema}||${t.table}`, label: isFileConn ? t.table : `${t.schema}.${t.table}` }))}
              placeholder={loadingTables ? "Loading…" : `Select ${isFileConn ? "sheet" : "table"}…`}
              searchPlaceholder="Filter…"
              disabled={loadingTables || tables.length === 0}
            />
          )}
        </div>

        <button
          onClick={handleProfile}
          disabled={profiling || !connectionId || !schema || !table}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity hover:opacity-85 shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {profiling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {profiling ? "Profiling…" : "Profile"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl mb-6" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={15} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
          <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {profiling && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: "var(--text-secondary)" }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-sm">Profiling {schema}.{table}…</p>
          <p className="text-xs opacity-60">Fetching column statistics and sample data</p>
        </div>
      )}

      {run && !profiling && (
        <>
          <ProfileSummaryCards profiles={run.profiles} />

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4" style={{ borderBottom: "1px solid var(--border)" }}>
            {(["statistics", "sample"] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 text-sm font-medium transition-colors capitalize"
                style={{
                  color: activeTab === tab ? "var(--accent-hover)" : "var(--text-secondary)",
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: "-1px",
                  background: "transparent",
                }}
              >
                {tab === "statistics" ? "Column Statistics" : `Sample Data`}
                {tab === "sample" && sample && (
                  <span
                    className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                  >
                    {sample.rows.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "statistics" && <ProfileTable profiles={run.profiles} />}
          {activeTab === "sample" && sample && <SampleDataTable data={sample} />}

          <p className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
            {run.profiles.length} column{run.profiles.length !== 1 ? "s" : ""}
            {" · "}{(run.profiles[0]?.row_count ?? 0).toLocaleString()} total rows
            {" · "}{run.schema}.{run.table}
            {" · "}{run.connection_name}
          </p>
        </>
      )}

      {!run && !profiling && !error && (
        <div className="flex flex-col items-center gap-4 py-24 rounded-xl" style={{ border: "1px dashed var(--border)" }}>
          <ScanSearch size={40} style={{ color: "var(--text-secondary)", opacity: 0.3 }} />
          <div className="text-center">
            <p className="font-semibold text-sm">No profile yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Select a connection and table, then click Profile</p>
          </div>
        </div>
      )}
    </div>
  );
}
