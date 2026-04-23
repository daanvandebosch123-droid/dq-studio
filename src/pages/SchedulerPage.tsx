<<<<<<< HEAD
import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
=======
import { useState, useEffect, useCallback } from "react";
>>>>>>> origin/main
import { Plus, Play, Trash2, Clock, CheckCircle2, XCircle, Calendar, ToggleLeft, ToggleRight, Edit2 } from "lucide-react";
import { api } from "../invoke";
import type { Schedule, ScheduleTarget, Recurrence, Rule } from "../types";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";

// ── helpers ────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function fmtDatetime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtNext(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "Overdue";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(diff / 3600000);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.round(diff / 86400000);
  return `in ${days}d`;
}

function describeTarget(target: ScheduleTarget, rules: Rule[]) {
  if (target.type === "all") return "All rules";
  if (target.type === "group") return `Group: ${target.group}`;
  if (target.type === "rules") {
    const names = target.rule_ids.map(id => rules.find(r => r.id === id)?.name ?? id);
    return names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  }
  return "";
}

function describeRecurrence(r: Recurrence) {
  if (r.type === "once") return `Once at ${fmtDatetime(r.at)}`;
  if (r.type === "hourly") return "Every hour";
  if (r.type === "daily") return `Daily at ${r.time}`;
  if (r.type === "weekly") return `Weekly on ${DAYS[r.day]} at ${r.time}`;
  return "";
}

function emptySchedule(): Schedule {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5, 0, 0);
  return {
    id: "",
    name: "",
    target: { type: "all" },
    recurrence: { type: "daily", time: "08:00" },
    enabled: true,
    last_ran_at: null,
    next_run_at: "",
  };
}

<<<<<<< HEAD
function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

=======
>>>>>>> origin/main
// ── Schedule form modal ────────────────────────────────────────────────────

function ScheduleModal({
  initial,
  rules,
  groups,
  onSave,
  onClose,
}: {
  initial: Schedule;
  rules: Rule[];
  groups: string[];
  onSave: (s: Schedule) => Promise<string>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Schedule>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setTarget(t: ScheduleTarget) { setForm(f => ({ ...f, target: t })); }
  function setRecurrence(r: Recurrence) { setForm(f => ({ ...f, recurrence: r })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!initial.id;

  return (
    <Modal title={isEdit ? "Edit Schedule" : "New Schedule"} onClose={onClose} width="520px">
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            placeholder="e.g. Daily quality check"
          />
        </div>

        {/* Target */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>What to run</label>
          <div className="flex gap-2 mb-2">
            {(["all", "group", "rules"] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  if (t === "all") setTarget({ type: "all" });
                  else if (t === "group") setTarget({ type: "group", group: groups[0] ?? "" });
                  else setTarget({ type: "rules", rule_ids: [] });
                }}
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={{
                  background: form.target.type === t ? "var(--accent)" : "var(--bg-tertiary)",
                  color: form.target.type === t ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${form.target.type === t ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {t === "all" ? "All Rules" : t === "group" ? "Group" : "Specific Rules"}
              </button>
            ))}
          </div>

          {form.target.type === "group" && (
            <select
              value={form.target.group}
              onChange={e => setTarget({ type: "group", group: e.target.value })}
              className="w-full rounded px-3 py-2 text-sm"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {groups.length === 0 && <option value="">No groups defined</option>}
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          {form.target.type === "rules" && (
            <div className="rounded overflow-auto" style={{ border: "1px solid var(--border)", maxHeight: 160 }}>
              {rules.map(r => {
                const selected = form.target.type === "rules" && form.target.rule_ids.includes(r.id);
                return (
                  <label key={r.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:opacity-80" style={{ borderBottom: "1px solid var(--border)" }}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={e => {
                        const ids = form.target.type === "rules" ? form.target.rule_ids : [];
                        setTarget({ type: "rules", rule_ids: e.target.checked ? [...ids, r.id] : ids.filter(id => id !== r.id) });
                      }}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="text-sm">{r.name}</span>
                    {r.group && <span className="text-xs ml-auto" style={{ color: "var(--text-secondary)" }}>{r.group}</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Recurrence</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {(["once", "hourly", "daily", "weekly"] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  if (t === "once") {
                    const d = new Date(); d.setMinutes(d.getMinutes() + 60, 0, 0);
<<<<<<< HEAD
                    setRecurrence({ type: "once", at: toLocalDateTimeInputValue(d) });
=======
                    setRecurrence({ type: "once", at: d.toISOString().slice(0, 16) });
>>>>>>> origin/main
                  } else if (t === "hourly") setRecurrence({ type: "hourly" });
                  else if (t === "daily") setRecurrence({ type: "daily", time: "08:00" });
                  else setRecurrence({ type: "weekly", day: 0, time: "08:00" });
                }}
                className="px-3 py-1.5 rounded text-xs font-medium capitalize"
                style={{
                  background: form.recurrence.type === t ? "var(--accent)" : "var(--bg-tertiary)",
                  color: form.recurrence.type === t ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${form.recurrence.type === t ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {form.recurrence.type === "once" && (
            <input
              type="datetime-local"
              value={form.recurrence.at}
              onChange={e => setRecurrence({ type: "once", at: e.target.value })}
              className="rounded px-3 py-2 text-sm"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          )}

          {form.recurrence.type === "daily" && (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>At</span>
              <input
                type="time"
                value={form.recurrence.time}
                onChange={e => setRecurrence({ type: "daily", time: e.target.value })}
                className="rounded px-3 py-2 text-sm"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          {form.recurrence.type === "weekly" && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={form.recurrence.day}
                onChange={e => setRecurrence({ type: "weekly", day: Number(e.target.value), time: (form.recurrence as { type: "weekly"; day: number; time: string }).time })}
                className="rounded px-3 py-2 text-sm"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>at</span>
              <input
                type="time"
                value={form.recurrence.time}
                onChange={e => setRecurrence({ type: "weekly", day: (form.recurrence as { type: "weekly"; day: number; time: string }).day, time: e.target.value })}
                className="rounded px-3 py-2 text-sm"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}
        </div>

        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Schedule"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Schedule card ──────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  rules,
  running,
  onRun,
  onEdit,
  onDelete,
  onToggle,
}: {
  schedule: Schedule;
  rules: Rule[];
  running: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const isOverdue = schedule.enabled && new Date(schedule.next_run_at) < new Date();

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--bg-secondary)",
        border: `1px solid ${isOverdue ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Calendar size={16} style={{ color: schedule.enabled ? "var(--accent)" : "var(--text-secondary)", opacity: schedule.enabled ? 1 : 0.4 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{schedule.name}</span>
            {!schedule.enabled && <Badge variant="neutral">Disabled</Badge>}
            {isOverdue && <Badge variant="danger">Overdue</Badge>}
            {schedule.recurrence.type === "once" && !isOverdue && <Badge variant="neutral">One-time</Badge>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {describeTarget(schedule.target, rules)} · {describeRecurrence(schedule.recurrence)}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            {schedule.enabled && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                Next: <span style={{ color: isOverdue ? "#ef4444" : "var(--text-primary)" }}>{fmtNext(schedule.next_run_at)}</span>
                <span className="opacity-60">({fmtDatetime(schedule.next_run_at)})</span>
              </span>
            )}
            {schedule.last_ran_at && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={11} />
                Last ran: {fmtDatetime(schedule.last_ran_at)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRun}
            disabled={running}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
            title="Run now"
          >
            <Play size={11} className={running ? "animate-pulse" : ""} />
            {running ? "Running…" : "Run Now"}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded opacity-60 hover:opacity-100"
            title={schedule.enabled ? "Disable" : "Enable"}
            style={{ color: "var(--text-secondary)" }}
          >
            {schedule.enabled ? <ToggleRight size={16} style={{ color: "var(--accent)" }} /> : <ToggleLeft size={16} />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded opacity-60 hover:opacity-100" title="Edit" style={{ color: "var(--text-secondary)" }}>
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded opacity-60 hover:opacity-100" title="Delete" style={{ color: "#ef4444" }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function SchedulerPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

<<<<<<< HEAD
  const rulesRef = useRef<Rule[]>([]);
  useEffect(() => { rulesRef.current = rules; }, [rules]);

=======
>>>>>>> origin/main
  const groups = [...new Set(rules.map(r => r.group).filter(Boolean) as string[])].sort();

  async function load() {
    const [s, r] = await Promise.all([api.listSchedules(), api.listRules()]);
    setSchedules(s);
    setRules(r);
  }

<<<<<<< HEAD
  useEffect(() => {
    load();
    const unlisten = listen("schedules://changed", () => load());
    return () => { unlisten.then(f => f()); };
  }, []);

  const executeSchedule = useCallback(async (schedule: Schedule) => {
=======
  useEffect(() => { load(); }, []);

  // Auto-check due schedules every 60 seconds
  const checkDue = useCallback(async () => {
    const due = await api.getDueSchedules();
    for (const s of due) {
      await executeSchedule(s);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(checkDue, 60_000);
    return () => clearInterval(id);
  }, [checkDue]);

  async function executeSchedule(schedule: Schedule) {
>>>>>>> origin/main
    const batchId = crypto.randomUUID();
    try {
      if (schedule.target.type === "all") {
        await api.runAllRules();
      } else if (schedule.target.type === "group") {
        const groupName = (schedule.target as { type: "group"; group: string }).group;
<<<<<<< HEAD
        const groupRules = rulesRef.current.filter(r => r.group === groupName);
=======
        const groupRules = rules.filter(r => r.group === groupName);
>>>>>>> origin/main
        for (const r of groupRules) await api.runRule(r.id, batchId);
      } else if (schedule.target.type === "rules") {
        for (const id of (schedule.target as { type: "rules"; rule_ids: string[] }).rule_ids) {
          await api.runRule(id, batchId);
        }
      }
      const updated = await api.markScheduleRan(schedule.id);
      setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
      setLastRunResult({ id: schedule.id, ok: true, msg: `Ran successfully at ${new Date().toLocaleTimeString()}` });
    } catch (e) {
      setLastRunResult({ id: schedule.id, ok: false, msg: String(e) });
    }
<<<<<<< HEAD
  }, []);

  // Auto-check due schedules every 60 seconds
  const checkDue = useCallback(async () => {
    const due = await api.getDueSchedules();
    for (const s of due) {
      await executeSchedule(s);
    }
  }, [executeSchedule]);

  useEffect(() => {
    const id = setInterval(checkDue, 60_000);
    return () => clearInterval(id);
  }, [checkDue]);
=======
  }
>>>>>>> origin/main

  async function runNow(schedule: Schedule) {
    setRunningId(schedule.id);
    setLastRunResult(null);
    try {
      await executeSchedule(schedule);
    } finally {
      setRunningId(null);
    }
  }

  async function handleSave(s: Schedule) {
<<<<<<< HEAD
    const id = await api.saveSchedule(s);
=======
    // Convert datetime-local string to full ISO for Once schedules
    const normalized = s.recurrence.type === "once"
      ? { ...s, recurrence: { type: "once" as const, at: new Date(s.recurrence.at).toISOString() } }
      : s;
    const id = await api.saveSchedule(normalized);
>>>>>>> origin/main
    await load();
    return id;
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule?")) return;
    await api.deleteSchedule(id);
    setSchedules(prev => prev.filter(s => s.id !== id));
  }

  async function handleToggle(schedule: Schedule) {
<<<<<<< HEAD
    await api.saveSchedule({ ...schedule, enabled: !schedule.enabled });
    await load();
=======
    const updated = { ...schedule, enabled: !schedule.enabled };
    await api.saveSchedule(updated);
    setSchedules(prev => prev.map(s => s.id === schedule.id ? updated : s));
>>>>>>> origin/main
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Scheduler</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Schedule rules or groups to run automatically
          </p>
        </div>
        <button
          onClick={() => setEditingSchedule(emptySchedule())}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus size={14} />
          New Schedule
        </button>
      </div>

      {schedules.length === 0 && (
        <div className="text-center py-16 rounded-lg" style={{ border: "1px dashed var(--border)" }}>
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No schedules yet. Create one to automate rule runs.</p>
        </div>
      )}

      <div className="space-y-3">
        {schedules.map(s => (
          <div key={s.id}>
            <ScheduleCard
              schedule={s}
              rules={rules}
              running={runningId === s.id}
              onRun={() => runNow(s)}
              onEdit={() => setEditingSchedule(s)}
              onDelete={() => handleDelete(s.id)}
              onToggle={() => handleToggle(s)}
            />
            {lastRunResult?.id === s.id && (
              <div className="flex items-center gap-2 mt-1.5 px-2 text-xs" style={{ color: lastRunResult.ok ? "#22c55e" : "#ef4444" }}>
                {lastRunResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {lastRunResult.msg}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingSchedule && (
        <ScheduleModal
          initial={editingSchedule}
          rules={rules}
          groups={groups}
          onSave={handleSave}
          onClose={() => setEditingSchedule(null)}
        />
      )}
    </div>
  );
}
