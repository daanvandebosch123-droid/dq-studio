import { useState, useEffect } from "react";
import { Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Pencil, ChevronDown, Loader2 } from "lucide-react";
import { api } from "../invoke";
import type { ConnectionConfig, ConnectionInfo, SqlServerConfig, OracleConfig, SnowflakeConfig, Db2Config, CsvConfig, ExcelConfig } from "../types";
import { FolderOpen } from "lucide-react";
import { Modal } from "../components/Modal";

const DB_LABELS: Record<string, string> = {
  sql_server: "SQL Server",
  oracle: "Oracle",
  snowflake: "Snowflake",
  db2: "IBM DB2",
  csv: "CSV File",
  excel: "Excel File",
};

const inputCls = "w-full rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500";
const inputStyle = { background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;

// Dropdown populated from the server after credential validation
function DatabaseDropdown({
  value,
  databases,
  onChange,
}: {
  value: string;
  databases: string[];
  onChange: (v: string) => void;
}) {
  if (databases.length === 0) return null;
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Database</label>
      <div className="relative">
        <select
          className={inputCls}
          style={{ ...inputStyle, appearance: "none", paddingRight: "2rem" }}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">Select database...</option>
          {databases.map(db => <option key={db} value={db}>{db}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-secondary)" }} />
      </div>
    </div>
  );
}

function ConnectionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ConnectionInfo;
  onSave: (name: string, config: ConnectionConfig) => Promise<void>;
  onCancel: () => void;
}) {
  const initType = initial?.config.type ?? "sql_server";

  const [name, setName] = useState(initial?.name ?? "");
  const [dbType, setDbType] = useState<"sql_server" | "oracle" | "snowflake" | "db2" | "csv" | "excel">(initType as "sql_server" | "oracle" | "snowflake" | "db2" | "csv" | "excel");
  const [validating, setValidating] = useState(false);
  const [validResult, setValidResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [ss, setSs] = useState<Omit<SqlServerConfig, "type">>(
    initial?.config.type === "sql_server"
      ? { host: initial.config.host, port: initial.config.port, database: initial.config.database, username: initial.config.username, password: initial.config.password, trust_cert: initial.config.trust_cert }
      : { host: "", port: 1433, database: "", username: "", password: "", trust_cert: true }
  );
  const [ora, setOra] = useState<Omit<OracleConfig, "type">>(
    initial?.config.type === "oracle"
      ? { host: initial.config.host, port: initial.config.port, service_name: initial.config.service_name, username: initial.config.username, password: initial.config.password }
      : { host: "", port: 1521, service_name: "", username: "", password: "" }
  );
  const [sf, setSf] = useState<Omit<SnowflakeConfig, "type">>(
    initial?.config.type === "snowflake"
      ? { account: initial.config.account, warehouse: initial.config.warehouse, database: initial.config.database, schema: initial.config.schema, username: initial.config.username, password: initial.config.password }
      : { account: "", warehouse: "", database: "", schema: "PUBLIC", username: "", password: "" }
  );
  const [db2, setDb2] = useState<Omit<Db2Config, "type">>(
    initial?.config.type === "db2"
      ? { host: initial.config.host, port: initial.config.port, database: initial.config.database, username: initial.config.username, password: initial.config.password }
      : { host: "", port: 50000, database: "", username: "", password: "" }
  );
  const [filePath, setFilePath] = useState<string>(
    initial?.config.type === "csv" ? (initial.config as CsvConfig).path
    : initial?.config.type === "excel" ? (initial.config as ExcelConfig).path
    : ""
  );
  const [browsing, setBrowsing] = useState(false);

  // Pre-populate databases list when editing an existing connection
  useEffect(() => {
    if (!initial) return;
    if (initial.config.type === "sql_server" || initial.config.type === "snowflake" || initial.config.type === "db2") {
      setDatabases([initial.config.database]);
    }
  }, []);

  async function handleBrowse() {
    setBrowsing(true);
    try {
      const ext = dbType === "csv" ? ["csv", "tsv", "txt"] : ["xlsx", "xls", "xlsm", "xlsb"];
      const label = dbType === "csv" ? "CSV Files" : "Excel Files";
      const result = await api.pickFile(label, ext);
      if (result) setFilePath(result);
    } finally {
      setBrowsing(false);
    }
  }

  function credentialsComplete(): boolean {
    if (dbType === "csv" || dbType === "excel") return !!filePath;
    if (dbType === "sql_server") return !!(ss.host && ss.username && ss.password);
    if (dbType === "oracle") return !!(ora.host && ora.service_name && ora.username && ora.password);
    if (dbType === "db2") return !!(db2.host && db2.database && db2.username && db2.password);
    return !!(sf.account && sf.warehouse && sf.username && sf.password);
  }

  async function handleValidate() {
    setValidating(true);
    setValidResult(null);
    setDatabases([]);
    try {
      if (dbType === "sql_server") {
        const dbs = await api.listDatabases({ type: "sql_server", host: ss.host, port: ss.port, username: ss.username, password: ss.password, trust_cert: ss.trust_cert });
        setDatabases(dbs);
        setSs(p => ({ ...p, database: dbs[0] ?? "" }));
        setValidResult({ ok: true, msg: `Connected — ${dbs.length} database${dbs.length !== 1 ? "s" : ""} found` });
      } else if (dbType === "oracle") {
        await api.testConnection({ type: "oracle", ...ora });
        setValidResult({ ok: true, msg: "Connected successfully" });
      } else if (dbType === "db2") {
        const dbs = await api.listDatabases({ type: "db2", ...db2 });
        setDatabases(dbs);
        setDb2(p => ({ ...p, database: dbs[0] ?? p.database }));
        setValidResult({ ok: true, msg: "Connected successfully" });
      } else {
        const dbs = await api.listDatabases({ type: "snowflake", account: sf.account, warehouse: sf.warehouse, username: sf.username, password: sf.password });
        setDatabases(dbs);
        setSf(p => ({ ...p, database: dbs[0] ?? "" }));
        setValidResult({ ok: true, msg: `Connected — ${dbs.length} database${dbs.length !== 1 ? "s" : ""} found` });
      }
    } catch (e: unknown) {
      setValidResult({ ok: false, msg: String(e) });
    } finally {
      setValidating(false);
    }
  }

  function buildConfig(): ConnectionConfig {
    if (dbType === "csv") return { type: "csv", path: filePath };
    if (dbType === "excel") return { type: "excel", path: filePath };
    if (dbType === "sql_server") return { type: "sql_server", ...ss };
    if (dbType === "oracle") return { type: "oracle", ...ora };
    if (dbType === "db2") return { type: "db2", ...db2 };
    return { type: "snowflake", ...sf };
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name, buildConfig());
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim() && (
    dbType === "csv" || dbType === "excel" ? !!filePath :
    dbType === "oracle" ? !!(ora.host && ora.service_name && ora.username) :
    dbType === "sql_server" ? !!(ss.host && ss.username && ss.database) :
    dbType === "db2" ? !!(db2.host && db2.database && db2.username) :
    !!(sf.account && sf.warehouse && sf.database && sf.username)
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Connection Name</label>
        <input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="My Database" />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Database Type</label>
        <select
          className={inputCls} style={inputStyle}
          value={dbType}
          onChange={e => { setDbType(e.target.value as typeof dbType); setDatabases([]); setValidResult(null); }}
          disabled={!!initial}
        >
          <option value="sql_server">SQL Server</option>
          <option value="oracle">Oracle</option>
          <option value="snowflake">Snowflake</option>
          <option value="db2">IBM DB2</option>
          <option value="csv">CSV File</option>
          <option value="excel">Excel File</option>
        </select>
      </div>

      {/* ── SQL Server ── */}
      {dbType === "sql_server" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Host</label>
              <input className={inputCls} style={inputStyle} value={ss.host} onChange={e => setSs(p => ({ ...p, host: e.target.value }))} placeholder="localhost" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Port</label>
              <input type="number" className={inputCls} style={inputStyle} value={ss.port} onChange={e => setSs(p => ({ ...p, port: +e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Username</label>
              <input className={inputCls} style={inputStyle} value={ss.username} onChange={e => setSs(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
              <input type="password" className={inputCls} style={inputStyle} value={ss.password} onChange={e => setSs(p => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={ss.trust_cert} onChange={e => setSs(p => ({ ...p, trust_cert: e.target.checked }))} />
            Trust server certificate
          </label>
          <DatabaseDropdown value={ss.database} databases={databases} onChange={v => setSs(p => ({ ...p, database: v }))} />
        </>
      )}

      {/* ── Oracle ── */}
      {dbType === "oracle" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Host</label>
              <input className={inputCls} style={inputStyle} value={ora.host} onChange={e => setOra(p => ({ ...p, host: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Port</label>
              <input type="number" className={inputCls} style={inputStyle} value={ora.port} onChange={e => setOra(p => ({ ...p, port: +e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Service Name</label>
            <input className={inputCls} style={inputStyle} value={ora.service_name} onChange={e => setOra(p => ({ ...p, service_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Username</label>
              <input className={inputCls} style={inputStyle} value={ora.username} onChange={e => setOra(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
              <input type="password" className={inputCls} style={inputStyle} value={ora.password} onChange={e => setOra(p => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
        </>
      )}

      {/* ── Snowflake ── */}
      {dbType === "snowflake" && (
        <>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Account (e.g. xy12345.us-east-1)</label>
            <input className={inputCls} style={inputStyle} value={sf.account} onChange={e => setSf(p => ({ ...p, account: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Warehouse</label>
            <input className={inputCls} style={inputStyle} value={sf.warehouse} onChange={e => setSf(p => ({ ...p, warehouse: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Username</label>
              <input className={inputCls} style={inputStyle} value={sf.username} onChange={e => setSf(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
              <input type="password" className={inputCls} style={inputStyle} value={sf.password} onChange={e => setSf(p => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
          <DatabaseDropdown value={sf.database} databases={databases} onChange={v => setSf(p => ({ ...p, database: v }))} />
          {sf.database && (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Schema</label>
              <input className={inputCls} style={inputStyle} value={sf.schema} onChange={e => setSf(p => ({ ...p, schema: e.target.value }))} />
            </div>
          )}
        </>
      )}

      {/* ── DB2 ── */}
      {dbType === "db2" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Host</label>
              <input className={inputCls} style={inputStyle} value={db2.host} onChange={e => setDb2(p => ({ ...p, host: e.target.value }))} placeholder="localhost" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Port</label>
              <input type="number" className={inputCls} style={inputStyle} value={db2.port} onChange={e => setDb2(p => ({ ...p, port: +e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Database</label>
            <input className={inputCls} style={inputStyle} value={db2.database} onChange={e => setDb2(p => ({ ...p, database: e.target.value }))} placeholder="SAMPLE" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Username</label>
              <input className={inputCls} style={inputStyle} value={db2.username} onChange={e => setDb2(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
              <input type="password" className={inputCls} style={inputStyle} value={db2.password} onChange={e => setDb2(p => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
        </>
      )}

      {/* ── CSV / Excel ── */}
      {(dbType === "csv" || dbType === "excel") && (
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
            {dbType === "csv" ? "CSV File Path" : "Excel File Path"}
          </label>
          <div className="flex gap-2">
            <input
              className={inputCls}
              style={inputStyle}
              value={filePath}
              onChange={e => setFilePath(e.target.value)}
              placeholder={dbType === "csv" ? "C:\\data\\file.csv" : "C:\\data\\workbook.xlsx"}
            />
            <button
              onClick={handleBrowse}
              disabled={browsing}
              className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium shrink-0 disabled:opacity-50 transition-opacity hover:opacity-80"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <FolderOpen size={14} />
              Browse
            </button>
          </div>
          {filePath && (
            <p className="text-xs mt-1.5 truncate" style={{ color: "var(--text-secondary)" }}>
              {filePath}
            </p>
          )}
        </div>
      )}

      {/* Validate feedback */}
      {validResult && (
        <div className={`flex items-start gap-2 text-sm p-3 rounded ${validResult.ok ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
          {validResult.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
          {validResult.msg}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {dbType !== "csv" && dbType !== "excel" && (
          <button
            onClick={handleValidate}
            disabled={validating || !credentialsComplete()}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors disabled:opacity-50"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            <RefreshCw size={14} className={validating ? "animate-spin" : ""} />
            {validating ? "Connecting..." : "Validate & Load Databases"}
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onCancel} className="px-4 py-2 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {saving ? "Saving..." : initial ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}

type ConnStatus = "testing" | "ok" | "error";

export function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ConnectionInfo | null>(null);
  const [connStatus, setConnStatus] = useState<Record<string, ConnStatus>>({});

  async function testConnections(conns: ConnectionInfo[]) {
    setConnStatus(Object.fromEntries(conns.map(c => [c.id, "testing"])));
    await Promise.all(conns.map(async conn => {
      try {
        await api.testConnection(conn.config);
        setConnStatus(prev => ({ ...prev, [conn.id]: "ok" }));
      } catch {
        setConnStatus(prev => ({ ...prev, [conn.id]: "error" }));
      }
    }));
  }

  async function load() {
    const conns = await api.listConnections();
    setConnections(conns);
    testConnections(conns);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(name: string, config: ConnectionConfig) {
    await api.addConnection(name, config);
    setShowAdd(false);
    load();
  }

  async function handleUpdate(name: string, config: ConnectionConfig) {
    if (!editing) return;
    await api.updateConnection(editing.id, name, config);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    await api.removeConnection(id);
    load();
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Connections</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Manage your database connections</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus size={14} /> Add Connection
        </button>
      </div>

      {connections.length === 0 ? (
        <div className="text-center py-16 rounded-lg" style={{ border: "1px dashed var(--border)" }}>
          <p style={{ color: "var(--text-secondary)" }}>No connections yet. Add your first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map(conn => (
            <div
              key={conn.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "#fff" }}>
                  {DB_LABELS[conn.config.type]?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{conn.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{DB_LABELS[conn.config.type]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connStatus[conn.id] === "testing" && (
                  <Loader2 size={15} className="animate-spin" style={{ color: "var(--text-secondary)" }} title="Testing connection…" />
                )}
                {connStatus[conn.id] === "ok" && (
                  <CheckCircle2 size={15} style={{ color: "var(--success)" }} title="Connection OK" />
                )}
                {connStatus[conn.id] === "error" && (
                  <XCircle size={15} style={{ color: "var(--danger)" }} title="Connection failed" />
                )}
                <button onClick={() => setEditing(conn)} className="p-2 rounded opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--text-secondary)" }} title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(conn.id)} className="p-2 rounded opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--danger)" }} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Connection" onClose={() => setShowAdd(false)} width="520px">
          <ConnectionForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit Connection" onClose={() => setEditing(null)} width="520px">
          <ConnectionForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
