import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Play, Pencil, Table2, ChevronDown, ChevronRight,
  PlayCircle, FolderPlus, GripVertical, X, ShieldCheck, Loader2,
  CheckCircle2, XCircle, FileText,
} from "lucide-react";
import { api } from "../invoke";
import type {
  ConnectionInfo, Rule, RuleDefinition, ColumnInfo, SchemaTable, QueryResult
} from "../types";
import { Modal } from "../components/Modal";
import { SearchableSelect } from "../components/SearchableSelect";

const RULE_KIND_LABELS: Record<string, string> = {
  not_null: "Not Null",
  unique: "Unique",
  min_value: "Min Value",
  max_value: "Max Value",
  regex: "Regex Match",
  custom_sql: "Custom SQL",
  row_count: "Row Count",
  referential_integrity: "Referential Integrity",
};

const RULE_KIND_COLORS: Record<string, { bg: string; text: string }> = {
  not_null:              { bg: "rgba(99,102,241,0.15)",  text: "#818cf8" },
  unique:                { bg: "rgba(99,102,241,0.15)",  text: "#818cf8" },
  min_value:             { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24" },
  max_value:             { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24" },
  row_count:             { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24" },
  regex:                 { bg: "rgba(168,85,247,0.15)",  text: "#c084fc" },
  custom_sql:            { bg: "rgba(20,184,166,0.15)",  text: "#2dd4bf" },
  referential_integrity: { bg: "rgba(236,72,153,0.15)", text: "#f472b6" },
};

const KINDS_WITH_FAILING_ROWS = new Set(["not_null", "unique", "min_value", "max_value", "regex", "referential_integrity"]);

// ── Rule kind pill ─────────────────────────────────────────────────────────

function KindPill({ kind }: { kind: string }) {
  const c = RULE_KIND_COLORS[kind] ?? { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
      style={{ background: c.bg, color: c.text, borderColor: `${c.text}30` }}
    >
      {RULE_KIND_LABELS[kind] ?? kind}
    </span>
  );
}

// ── Rule form ──────────────────────────────────────────────────────────────

function RuleForm({
  connections,
  initial,
  existingGroups,
  onSave,
  onCancel,
}: {
  connections: ConnectionInfo[];
  initial?: Rule;
  existingGroups: string[];
  onSave: (rule: Omit<Rule, "id"> & { id: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");
  const [connectionId, setConnectionId] = useState(initial?.connection_id ?? connections[0]?.id ?? "");
  const [schema, setSchema] = useState(initial?.schema ?? "");
  const [table, setTable] = useState(initial?.table ?? "");
  const [kind, setKind] = useState<RuleDefinition["kind"]>(initial?.definition.kind ?? "not_null");
  const [column, setColumn] = useState(
    initial?.definition && "column" in initial.definition ? initial.definition.column : ""
  );
  const [min, setMin] = useState(
    initial?.definition.kind === "min_value" ? String(initial.definition.min) : ""
  );
  const [max, setMax] = useState(
    initial?.definition.kind === "max_value" ? String(initial.definition.max) : ""
  );
  const [pattern, setPattern] = useState(
    initial?.definition.kind === "regex" ? initial.definition.pattern : ""
  );
  const [sql, setSql] = useState(
    initial?.definition.kind === "custom_sql" ? initial.definition.sql : ""
  );
  const [rowMin, setRowMin] = useState(
    initial?.definition.kind === "row_count" && initial.definition.min != null
      ? String(initial.definition.min) : ""
  );
  const [rowMax, setRowMax] = useState(
    initial?.definition.kind === "row_count" && initial.definition.max != null
      ? String(initial.definition.max) : ""
  );
  const [refConnectionId, setRefConnectionId] = useState(
    initial?.definition.kind === "referential_integrity"
      ? (initial.definition.ref_connection_id ?? initial.connection_id)
      : (initial?.connection_id ?? connections[0]?.id ?? "")
  );
  const [refSchema, setRefSchema] = useState(
    initial?.definition.kind === "referential_integrity" ? initial.definition.ref_schema : ""
  );
  const [refTable, setRefTable] = useState(
    initial?.definition.kind === "referential_integrity" ? initial.definition.ref_table : ""
  );
  const [refColumn, setRefColumn] = useState(
    initial?.definition.kind === "referential_integrity" ? initial.definition.ref_column : ""
  );
  const [refTables, setRefTables] = useState<SchemaTable[]>([]);

  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [refColumns, setRefColumns] = useState<ColumnInfo[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedConn = connections.find(c => c.id === connectionId);
  const isFileConn = selectedConn?.config.type === "csv" || selectedConn?.config.type === "excel";

  useEffect(() => {
    if (!connectionId) return;
    api.getTables(connectionId).then(tbls => {
      setTables(tbls);
      // CSV always has exactly one table — select it automatically
      if (tbls.length === 1 && !initial) {
        setSchema(tbls[0].schema);
        setTable(tbls[0].table);
        setColumn("");
      }
    }).catch(() => setTables([]));
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId || !schema || !table) return;
    api.getColumns(connectionId, schema, table).then(setColumns).catch(() => setColumns([]));
  }, [connectionId, schema, table]);

  useEffect(() => {
    if (!refConnectionId) return;
    api.getTables(refConnectionId).then(tbls => {
      setRefTables(tbls);
      // Auto-select single table for CSV ref connections
      if (tbls.length === 1 && !refTable) {
        setRefSchema(tbls[0].schema);
        setRefTable(tbls[0].table);
      }
    }).catch(() => setRefTables([]));
  }, [refConnectionId]);

  useEffect(() => {
    if (!refConnectionId || !refSchema || !refTable) return;
    api.getColumns(refConnectionId, refSchema, refTable).then(setRefColumns).catch(() => setRefColumns([]));
  }, [refConnectionId, refSchema, refTable]);

  function handleTableChange(val: string) {
    const [s, t] = val.split("||");
    setSchema(s ?? "");
    setTable(t ?? "");
    setColumn("");
  }

  function handleRefTableChange(val: string) {
    const [s, t] = val.split("||");
    setRefSchema(s ?? "");
    setRefTable(t ?? "");
    setRefColumn("");
  }

  function buildDefinition(): RuleDefinition {
    switch (kind) {
      case "not_null": return { kind, column };
      case "unique": return { kind, column };
      case "min_value": return { kind, column, min: parseFloat(min) || 0 };
      case "max_value": return { kind, column, max: parseFloat(max) || 0 };
      case "regex": return { kind, column, pattern };
      case "custom_sql": return { kind, sql };
      case "row_count": return {
        kind,
        min: rowMin ? parseInt(rowMin) : undefined,
        max: rowMax ? parseInt(rowMax) : undefined,
      };
      case "referential_integrity": return {
        kind, column,
        ref_connection_id: refConnectionId !== connectionId ? refConnectionId : undefined,
        ref_schema: refSchema, ref_table: refTable, ref_column: refColumn,
      };
    }
  }

  async function handleSave() {
    if (!name || !connectionId || !schema || !table) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? "",
        name,
        connection_id: connectionId,
        schema,
        table,
        definition: buildDefinition(),
        enabled: true,
        group: group.trim() || undefined,
        description: description.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-colors";
  const inputStyle = { background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" };
  const labelCls = "block text-xs font-medium mb-1.5";
  const labelStyle = { color: "var(--text-secondary)" };
  const needsColumn = ["not_null", "unique", "min_value", "max_value", "regex"].includes(kind);

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} style={labelStyle}>Rule Name</label>
          <input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Email not null" />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>
            Group <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
          </label>
          <input
            className={inputCls} style={inputStyle}
            list="group-suggestions"
            value={group}
            onChange={e => setGroup(e.target.value)}
            placeholder="e.g. Sales, Core Checks"
          />
          <datalist id="group-suggestions">
            {existingGroups.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>
          Description <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
        </label>
        <textarea
          className={inputCls}
          style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this rule check and why does it matter?"
        />
      </div>

      {/* Target */}
      <div
        className="rounded-lg p-3 space-y-3"
        style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Target</p>
        <div>
          <label className={labelCls} style={labelStyle}>Connection</label>
          <select
            className={inputCls} style={inputStyle}
            value={connectionId}
            onChange={e => {
              const conn = connections.find(c => c.id === e.target.value);
              const nextIsFile = conn?.config.type === "csv" || conn?.config.type === "excel";
              setConnectionId(e.target.value);
              setSchema(""); setTable(""); setColumn("");
              if (nextIsFile && kind === "referential_integrity") setKind("not_null");
            }}
          >
            {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Table / Sheet — different UI for files vs databases */}
        {isFileConn ? (
          tables.length === 1 ? (
            // CSV: single table, show as a static chip (auto-selected)
            <div>
              <label className={labelCls} style={labelStyle}>File</label>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                <FileText size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                <span className="font-medium">{tables[0].table}</span>
                <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>auto-selected</span>
              </div>
            </div>
          ) : (
            // Excel: sheet picker — clean names, no "file." prefix
            <div>
              <label className={labelCls} style={labelStyle}>Sheet</label>
              <SearchableSelect
                value={table}
                onChange={val => { setTable(val); setSchema("file"); setColumn(""); }}
                options={tables.map(t => ({ value: t.table, label: t.table }))}
                placeholder="Select a sheet…"
                searchPlaceholder="Filter sheets…"
              />
            </div>
          )
        ) : (
          // Database: schema.table dropdown
          <div>
            <label className={labelCls} style={labelStyle}>Table</label>
            <SearchableSelect
              value={schema && table ? `${schema}||${table}` : ""}
              onChange={handleTableChange}
              options={tables.map(t => ({ value: `${t.schema}||${t.table}`, label: `${t.schema}.${t.table}` }))}
              placeholder="Select a table…"
              searchPlaceholder="Filter tables…"
            />
          </div>
        )}
      </div>

      {/* Rule definition */}
      <div
        className="rounded-lg p-3 space-y-3"
        style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Rule</p>
        <div>
          <label className={labelCls} style={labelStyle}>Rule Type</label>
          <select className={inputCls} style={inputStyle} value={kind} onChange={e => setKind(e.target.value as RuleDefinition["kind"])}>
            {Object.entries(RULE_KIND_LABELS)
              .filter(([k]) => !(isFileConn && k === "referential_integrity"))
              .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        {needsColumn && (
          <div>
            <label className={labelCls} style={labelStyle}>Column</label>
            <SearchableSelect
              value={column}
              onChange={setColumn}
              options={columns.map(c => ({ value: c.name, label: isFileConn ? c.name : `${c.name} (${c.data_type})` }))}
              placeholder="Select column…"
              searchPlaceholder="Filter columns…"
              disabled={!table}
            />
          </div>
        )}

        {kind === "min_value" && (
          <div>
            <label className={labelCls} style={labelStyle}>Minimum Value</label>
            <input type="number" className={inputCls} style={inputStyle} value={min} onChange={e => setMin(e.target.value)} />
          </div>
        )}
        {kind === "max_value" && (
          <div>
            <label className={labelCls} style={labelStyle}>Maximum Value</label>
            <input type="number" className={inputCls} style={inputStyle} value={max} onChange={e => setMax(e.target.value)} />
          </div>
        )}
        {kind === "regex" && (
          <div>
            <label className={labelCls} style={labelStyle}>Pattern (SQL LIKE syntax)</label>
            <input className={inputCls} style={inputStyle} value={pattern} onChange={e => setPattern(e.target.value)} placeholder="%.example.com" />
          </div>
        )}
        {kind === "referential_integrity" && (() => {
          const refConn = connections.find(c => c.id === refConnectionId);
          const isRefFile = refConn?.config.type === "csv" || refConn?.config.type === "excel";
          return (
            <>
              <div>
                <label className={labelCls} style={labelStyle}>Column</label>
                <SearchableSelect
                  value={column}
                  onChange={setColumn}
                  options={columns.map(c => ({ value: c.name, label: isFileConn ? c.name : `${c.name} (${c.data_type})` }))}
                  placeholder="Select column…"
                  searchPlaceholder="Filter columns…"
                  disabled={!table}
                />
              </div>

              <div
                className="rounded-lg p-3 space-y-3"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Reference</p>

                <div>
                  <label className={labelCls} style={labelStyle}>Reference Connection</label>
                  <select
                    className={inputCls} style={inputStyle}
                    value={refConnectionId}
                    onChange={e => { setRefConnectionId(e.target.value); setRefSchema(""); setRefTable(""); setRefColumn(""); }}
                  >
                    {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {isRefFile && refTables.length === 1 ? (
                  <div>
                    <label className={labelCls} style={labelStyle}>File</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <FileText size={13} style={{ color: "var(--text-secondary)" }} />
                      <span className="font-medium">{refTables[0].table}</span>
                      <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>auto-selected</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls} style={labelStyle}>{isRefFile ? "Sheet" : "Table"}</label>
                    <SearchableSelect
                      value={refSchema && refTable ? `${refSchema}||${refTable}` : ""}
                      onChange={handleRefTableChange}
                      options={refTables.map(t => ({ value: `${t.schema}||${t.table}`, label: isRefFile ? t.table : `${t.schema}.${t.table}` }))}
                      placeholder={`Select ${isRefFile ? "sheet" : "table"}…`}
                      searchPlaceholder={`Filter ${isRefFile ? "sheets" : "tables"}…`}
                    />
                  </div>
                )}

                <div>
                  <label className={labelCls} style={labelStyle}>Referenced Column</label>
                  <SearchableSelect
                    value={refColumn}
                    onChange={setRefColumn}
                    options={refColumns.map(c => ({ value: c.name, label: isRefFile ? c.name : `${c.name} (${c.data_type})` }))}
                    placeholder="Select column…"
                    searchPlaceholder="Filter columns…"
                    disabled={!refTable}
                  />
                </div>
              </div>
            </>
          );
        })()}

        {kind === "custom_sql" && (
          <div>
            <label className={labelCls} style={labelStyle}>SQL <span style={{ fontWeight: 400, opacity: 0.7 }}>(must return failing_count, total_count)</span></label>
            <textarea
              className={inputCls}
              style={{ ...inputStyle, height: "100px", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
              value={sql} onChange={e => setSql(e.target.value)}
              placeholder="SELECT COUNT(*) as failing_count, COUNT(*) as total_count FROM ..."
            />
          </div>
        )}
        {kind === "row_count" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Min Rows</label>
              <input type="number" className={inputCls} style={inputStyle} value={rowMin} onChange={e => setRowMin(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Max Rows</label>
              <input type="number" className={inputCls} style={inputStyle} value={rowMax} onChange={e => setRowMax(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name || !connectionId || !schema || !table}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? "Saving…" : initial ? "Update Rule" : "Save Rule"}
        </button>
      </div>
    </div>
  );
}

// ── Failing rows modal ─────────────────────────────────────────────────────

function FailingRowsModal({ ruleId, ruleName, onClose }: { ruleId: string; ruleName: string; onClose: () => void }) {
  const [data, setData] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getFailingRows(ruleId)
      .then(setData)
      .catch(e => setError(String(e)));
  }, [ruleId]);

  return (
    <Modal title={`Failing rows — ${ruleName}`} onClose={onClose} width="860px">
      {!data && !error && (
        <div className="flex items-center justify-center gap-2 py-8" style={{ color: "var(--text-secondary)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}
      {error && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--danger)" }}>{error}</p>
      )}
      {data && (
        <>
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Showing up to 500 failing rows
          </p>
          <div className="overflow-auto rounded-lg" style={{ maxHeight: "60vh", border: "1px solid var(--border)" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--bg-tertiary)" }}>
                  {data.columns.map(col => (
                    <th key={col} className="text-left px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={data.columns.length} className="px-3 py-6 text-center" style={{ color: "var(--text-secondary)" }}>
                      No rows returned
                    </td>
                  </tr>
                )}
                {data.rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}
                  >
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

// ── Rule card ─────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  connMap,
  result,
  running,
  isDragging,
  onDragStart,
  onDragEnd,
  onRun,
  onEdit,
  onDelete,
  onViewRows,
}: {
  rule: Rule;
  connMap: Record<string, string>;
  result?: { passed: boolean; details: string };
  running: string | null;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onRun: (rule: Rule) => void;
  onEdit: (rule: Rule) => void;
  onDelete: (id: string) => void;
  onViewRows: (ruleId: string, ruleName: string) => void;
}) {
  const isRunning = running === rule.id;
  const canViewRows = result && !result.passed && KINDS_WITH_FAILING_ROWS.has(rule.definition.kind);

  const leftBorderColor = result
    ? result.passed ? "var(--success)" : "var(--danger)"
    : "var(--border)";

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", rule.id);
        onDragStart(rule.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      className="rounded-lg flex items-stretch gap-0"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        overflow: "hidden",
      }}
    >
      {/* Colored left border stripe */}
      <div style={{ width: "3px", background: leftBorderColor, flexShrink: 0, transition: "background 0.3s" }} />

      <div className="flex items-start gap-2 px-3 py-3 flex-1 min-w-0">
        <div className="pt-0.5 shrink-0" style={{ color: "var(--text-secondary)", opacity: 0.35 }}>
          <GripVertical size={14} />
        </div>

        <div className="flex-1 flex items-start justify-between gap-4 min-w-0">
          {/* Left: rule info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{rule.name}</span>
              <KindPill kind={rule.definition.kind} />
              {result && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    background: result.passed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    color: result.passed ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {result.passed
                    ? <CheckCircle2 size={10} />
                    : <XCircle size={10} />
                  }
                  {result.passed ? "Passed" : "Failed"}
                </span>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {connMap[rule.connection_id] ?? rule.connection_id}
              <span className="mx-1.5" style={{ opacity: 0.4 }}>·</span>
              {rule.schema}.{rule.table}
            </p>
            {rule.description && (
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)", opacity: 0.8 }}>
                {rule.description}
              </p>
            )}
            {result && (
              <p className="text-xs mt-1 font-medium" style={{ color: result.passed ? "var(--success)" : "var(--danger)" }}>
                {result.details}
              </p>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            {canViewRows && (
              <button
                onClick={() => onViewRows(rule.id, rule.name)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)" }}
                title="View failing rows"
              >
                <Table2 size={11} /> Rows
              </button>
            )}
            <button
              onClick={() => onRun(rule)}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              title="Run this rule"
            >
              {isRunning
                ? <Loader2 size={11} className="animate-spin" />
                : <Play size={11} />
              }
              {isRunning ? "Running…" : "Run"}
            </button>
            <button
              onClick={() => onEdit(rule)}
              className="p-1.5 rounded-lg transition-opacity opacity-40 hover:opacity-100"
              style={{ color: "var(--text-secondary)" }}
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(rule.id)}
              className="p-1.5 rounded-lg transition-opacity opacity-40 hover:opacity-100"
              style={{ color: "var(--danger)" }}
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Group section ──────────────────────────────────────────────────────────

function RuleGroup({
  name,
  rules,
  connMap,
  lastResults,
  running,
  runningGroup,
  dragRuleId,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onRun,
  onRunGroup,
  onEdit,
  onDelete,
  onViewRows,
  onDeleteGroup,
}: {
  name: string;
  rules: Rule[];
  connMap: Record<string, string>;
  lastResults: Record<string, { passed: boolean; details: string }>;
  running: string | null;
  runningGroup: string | null;
  dragRuleId: string | null;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (ruleId: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onRun: (rule: Rule) => void;
  onRunGroup: (groupName: string, rules: Rule[]) => void;
  onEdit: (rule: Rule) => void;
  onDelete: (id: string) => void;
  onViewRows: (ruleId: string, ruleName: string) => void;
  onDeleteGroup: (name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const ruleResults = rules.map(r => lastResults[r.id]).filter(Boolean);
  const allRan = rules.length > 0 && ruleResults.length === rules.length;
  const passCount = ruleResults.filter(r => r.passed).length;
  const failCount = ruleResults.filter(r => !r.passed).length;
  const groupRunning = runningGroup === name;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: isDragOver ? "1px solid var(--accent)" : "1px solid var(--border)",
        boxShadow: isDragOver ? "0 0 0 2px rgba(99,102,241,0.15)" : undefined,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onDragEnter={e => { e.preventDefault(); onDragEnter(); }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeave(); }}
      onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData("text/plain")); }}
    >
      {/* Group header */}
      <div
        className="flex items-center justify-between px-4 py-3 select-none"
        style={{ background: "var(--bg-tertiary)", borderBottom: collapsed ? "none" : "1px solid var(--border)" }}
        onDragOver={e => e.preventDefault()}
      >
        <div
          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed
            ? <ChevronRight size={13} style={{ color: "var(--text-secondary)" }} />
            : <ChevronDown size={13} style={{ color: "var(--text-secondary)" }} />
          }
          <span className="font-semibold text-sm truncate">{name}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(148,163,184,0.12)", color: "var(--text-secondary)" }}
          >
            {rules.length}
          </span>
          {allRan && (
            failCount === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "var(--success)" }}>
                <CheckCircle2 size={11} /> All passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>
                <XCircle size={11} /> {failCount} failed
                {passCount > 0 && <span style={{ opacity: 0.6 }}>· {passCount} passed</span>}
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={e => { e.stopPropagation(); onRunGroup(name, rules); }}
            disabled={groupRunning || rules.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
            title="Run all rules in this group"
          >
            {groupRunning
              ? <Loader2 size={11} className="animate-spin" />
              : <PlayCircle size={11} />
            }
            {groupRunning ? "Running…" : "Run Group"}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDeleteGroup(name); }}
            className="p-1.5 rounded-lg transition-opacity opacity-30 hover:opacity-100"
            style={{ color: "var(--danger)" }}
            title="Delete group"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          className="p-3 space-y-2"
          style={{ background: "var(--bg-primary)" }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(e.dataTransfer.getData("text/plain")); }}
        >
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              connMap={connMap}
              result={lastResults[rule.id]}
              running={running}
              isDragging={dragRuleId === rule.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onRun={onRun}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewRows={onViewRows}
            />
          ))}
          {rules.length === 0 && (
            <div
              className="text-center py-6 rounded-lg text-xs flex items-center justify-center gap-2"
              style={{ border: "1px dashed var(--border)", color: "var(--text-secondary)" }}
            >
              Drop rules here
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runningGroup, setRunningGroup] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, { passed: boolean; details: string }>>({});
  const [viewingRows, setViewingRows] = useState<{ ruleId: string; ruleName: string } | null>(null);

  const [emptyGroups, setEmptyGroups] = useState<string[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const dragRuleIdRef = useRef<string | null>(null);
  const [dragRuleId, setDragRuleId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  async function load() {
    const [r, c, res] = await Promise.all([api.listRules(), api.listConnections(), api.getLastResults()]);
    setRules(r);
    setConnections(c);
    const map: Record<string, { passed: boolean; details: string }> = {};
    for (const x of res) map[x.rule_id] = { passed: x.passed, details: x.details };
    setLastResults(map);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(rule: Omit<Rule, "id"> & { id: string }) {
    await api.saveRule(rule);
    setShowAdd(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    await api.deleteRule(id);
    load();
  }

  async function handleRun(rule: Rule) {
    setRunning(rule.id);
    try {
      const result = await api.runRule(rule.id);
      setLastResults(prev => ({ ...prev, [rule.id]: { passed: result.passed, details: result.details } }));
    } finally {
      setRunning(null);
    }
  }

  async function handleRunGroup(groupName: string, groupRules: Rule[]) {
    setRunningGroup(groupName);
    try {
      for (const rule of groupRules) {
        setRunning(rule.id);
        try {
          const result = await api.runRule(rule.id);
          setLastResults(prev => ({ ...prev, [rule.id]: { passed: result.passed, details: result.details } }));
        } catch { /* continue */ }
      }
    } finally {
      setRunning(null);
      setRunningGroup(null);
    }
  }

  function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const allGroups = [...new Set(rules.map(r => r.group).filter(Boolean) as string[]), ...emptyGroups];
    if (!allGroups.includes(name)) {
      setEmptyGroups(prev => [...prev, name]);
    }
    setNewGroupName("");
    setShowCreateGroup(false);
  }

  function handleDeleteGroup(groupName: string) {
    setEmptyGroups(prev => prev.filter(g => g !== groupName));
    const groupRules = rules.filter(r => r.group === groupName);
    Promise.all(groupRules.map(rule => api.saveRule({ ...rule, group: undefined }))).then(load);
  }

  async function handleDrop(ruleId: string | null | undefined, targetGroup: string | null) {
    const id = ruleId || dragRuleIdRef.current;
    if (!id) return;
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    if ((rule.group ?? null) === targetGroup) return;

    const sourceGroup = rule.group ?? null;
    if (sourceGroup) {
      const remainingInSource = rules.filter(r => r.id !== id && r.group === sourceGroup);
      if (remainingInSource.length === 0) {
        setEmptyGroups(prev => prev.includes(sourceGroup) ? prev : [...prev, sourceGroup]);
      }
    }

    dragRuleIdRef.current = null;
    setDragRuleId(null);
    setDragOverGroup(null);
    await api.saveRule({ ...rule, group: targetGroup ?? undefined });
    if (targetGroup) setEmptyGroups(prev => prev.filter(g => g !== targetGroup));
    load();
  }

  const connMap = Object.fromEntries(connections.map(c => [c.id, c.name]));
  const persistedGroups = [...new Set(rules.map(r => r.group).filter(Boolean) as string[])];
  const existingGroups = [...new Set([...persistedGroups, ...emptyGroups])].sort();

  const groupMap = new Map<string, Rule[]>();
  const ungrouped: Rule[] = [];
  for (const rule of rules) {
    if (rule.group) {
      const list = groupMap.get(rule.group) ?? [];
      list.push(rule);
      groupMap.set(rule.group, list);
    } else {
      ungrouped.push(rule);
    }
  }
  for (const g of emptyGroups) {
    if (!groupMap.has(g)) groupMap.set(g, []);
  }
  const sortedGroups = [...groupMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const hasAnyGroups = sortedGroups.length > 0;

  // Summary stats
  const ranResults = Object.values(lastResults);
  const totalPassed = ranResults.filter(r => r.passed).length;
  const totalFailed = ranResults.filter(r => !r.passed).length;
  const hasResults = ranResults.length > 0;

  const sharedDragProps = {
    dragRuleId,
    onDragStart: (id: string) => { dragRuleIdRef.current = id; setDragRuleId(id); },
    onDragEnd: () => { dragRuleIdRef.current = null; setDragRuleId(null); setDragOverGroup(null); },
  };

  const sharedActionProps = {
    connMap,
    lastResults,
    running,
    onRun: handleRun,
    onEdit: setEditing,
    onDelete: handleDelete,
    onViewRows: (ruleId: string, ruleName: string) => setViewingRows({ ruleId, ruleName }),
  };

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">Data Quality Rules</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {rules.length} rule{rules.length !== 1 ? "s" : ""}
              {hasAnyGroups && ` · ${sortedGroups.length} group${sortedGroups.length !== 1 ? "s" : ""}`}
            </span>
            {hasResults && (
              <>
                <span style={{ color: "var(--border)" }}>|</span>
                {totalPassed > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--success)" }}>
                    <CheckCircle2 size={11} /> {totalPassed} passed
                  </span>
                )}
                {totalFailed > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--danger)" }}>
                    <XCircle size={11} /> {totalFailed} failed
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showCreateGroup ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", width: "180px" }}
                placeholder="Group name…"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreateGroup();
                  if (e.key === "Escape") { setShowCreateGroup(false); setNewGroupName(""); }
                }}
              />
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                Create
              </button>
              <button
                onClick={() => { setShowCreateGroup(false); setNewGroupName(""); }}
                className="p-2 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-secondary)" }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <FolderPlus size={13} /> New Group
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <Plus size={13} /> Add Rule
          </button>
        </div>
      </div>

      {/* Content */}
      {rules.length === 0 && sortedGroups.length === 0 ? (
        <div className="text-center py-20 rounded-xl flex flex-col items-center gap-4" style={{ border: "1px dashed var(--border)" }}>
          <ShieldCheck size={40} style={{ color: "var(--text-secondary)", opacity: 0.3 }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>No rules yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Add your first data quality rule to start monitoring.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mt-1 transition-opacity hover:opacity-85"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <Plus size={13} /> Add Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedGroups.map(([groupName, groupRules]) => (
            <RuleGroup
              key={groupName}
              name={groupName}
              rules={groupRules}
              runningGroup={runningGroup}
              isDragOver={dragOverGroup === groupName}
              onDragEnter={() => setDragOverGroup(groupName)}
              onDragLeave={() => setDragOverGroup(null)}
              onDrop={ruleId => handleDrop(ruleId, groupName)}
              onRunGroup={handleRunGroup}
              onDeleteGroup={handleDeleteGroup}
              {...sharedDragProps}
              {...sharedActionProps}
            />
          ))}

          {ungrouped.length > 0 && hasAnyGroups && (
            <RuleGroup
              key="__ungrouped__"
              name="Ungrouped"
              rules={ungrouped}
              runningGroup={runningGroup}
              isDragOver={dragOverGroup === "__ungrouped__"}
              onDragEnter={() => setDragOverGroup("__ungrouped__")}
              onDragLeave={() => setDragOverGroup(null)}
              onDrop={ruleId => handleDrop(ruleId, null)}
              onRunGroup={handleRunGroup}
              onDeleteGroup={() => {}}
              {...sharedDragProps}
              {...sharedActionProps}
            />
          )}

          {!hasAnyGroups && ungrouped.length > 0 && (
            <div className="space-y-2">
              {ungrouped.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  result={lastResults[rule.id]}
                  isDragging={dragRuleId === rule.id}
                  {...sharedDragProps}
                  {...sharedActionProps}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Data Quality Rule" onClose={() => setShowAdd(false)} width="580px">
          <RuleForm connections={connections} existingGroups={existingGroups} onSave={handleSave} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit Rule" onClose={() => setEditing(null)} width="580px">
          <RuleForm connections={connections} existingGroups={existingGroups} initial={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
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
