import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { History, ChevronDown, ChevronRight, Trash2, Loader2, X } from "lucide-react";
import { api } from "../invoke";
import type { ProfilingRun } from "../types";
import { ProfileSummaryCards, ProfileTable } from "./ProfilingShared";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function RunCard({ run, onDelete }: { run: ProfilingRun; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const rowCount = run.profiles[0]?.row_count ?? 0;
  const colsWithNulls = run.profiles.filter(p => p.null_count > 0).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ background: "var(--bg-secondary)" }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{run.schema}.{run.table}</span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {run.connection_name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatDate(run.ran_at)}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {rowCount.toLocaleString()} row{rowCount !== 1 ? "s" : ""}
            </span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {run.profiles.length} column{run.profiles.length !== 1 ? "s" : ""}
            </span>
            {colsWithNulls > 0 && (
              <span className="text-xs" style={{ color: "#f59e0b" }}>
                {colsWithNulls} column{colsWithNulls !== 1 ? "s" : ""} with nulls
              </span>
            )}
          </div>
        </div>

        <button
          onClick={e => { e.stopPropagation(); onDelete(run.id); }}
          className="p-1.5 rounded-lg transition-opacity opacity-30 hover:opacity-100 shrink-0"
          style={{ color: "var(--danger)" }}
          title="Delete run"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4" style={{ background: "var(--bg-primary)", borderTop: "1px solid var(--border)" }}>
          <ProfileSummaryCards profiles={run.profiles} />
          <ProfileTable profiles={run.profiles} />
        </div>
      )}
    </div>
  );
}

export function ProfilingHistoryPage() {
  const [runs, setRuns] = useState<ProfilingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRuns(await api.listProfilingRuns());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unlisten = listen("profiling://changed", () => load());
    return () => { unlisten.then(f => f()); };
  }, []);

  async function handleDelete(id: string) {
    await api.deleteProfilingRun(id);
    setRuns(prev => prev.filter(r => r.id !== id));
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      await api.clearProfilingRuns();
      setRuns([]);
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">Profiling History</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {runs.length > 0
              ? `${runs.length} past profiling run${runs.length !== 1 ? "s" : ""}`
              : "No profiling runs yet"}
          </p>
        </div>

        {runs.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Delete all runs?</span>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: "var(--danger)", color: "#fff" }}
                >
                  {clearing && <Loader2 size={11} className="animate-spin" />}
                  {clearing ? "Clearing…" : "Yes, clear all"}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="p-1.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--danger)" }}
              >
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16" style={{ color: "var(--text-secondary)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 rounded-xl" style={{ border: "1px dashed var(--border)" }}>
          <History size={40} style={{ color: "var(--text-secondary)", opacity: 0.3 }} />
          <div className="text-center">
            <p className="font-semibold text-sm">No history yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Profile a table and results will appear here automatically
            </p>
          </div>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="space-y-3">
          {runs.map(run => (
            <RunCard key={run.id} run={run} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
