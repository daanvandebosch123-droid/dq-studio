import { useState, useEffect } from "react";
import { FolderOpen, RotateCcw, AlertTriangle, HardDrive, FileJson, Sun, Moon } from "lucide-react";
import { api } from "../invoke";
import { getTheme, applyTheme, type Theme } from "../theme";

const DATA_FILES = [
  { file: "connections.json",     desc: "Saved database connections" },
  { file: "rules.json",           desc: "Data quality rule definitions" },
  { file: "results.json",         desc: "Latest rule run results" },
  { file: "results_history.json", desc: "Historical rule run records" },
  { file: "profiling_runs.json",  desc: "Table profiling history" },
  { file: "schedules.json",       desc: "Rule schedules" },
];

interface Settings {
  data_dir: string;
  default_data_dir: string;
  is_custom: boolean;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getTheme);

  function handleTheme(t: Theme) {
    applyTheme(t);
    setTheme(t);
  }

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(e => setError(String(e)));
  }, []);

  async function handlePick() {
    try {
      const dir = await api.pickDirectory();
      if (!dir) return;
      setSaving(true);
      setError(null);
      await api.setDataDir(dir);
      setSettings(s => s ? { ...s, data_dir: dir, is_custom: dir !== s.default_data_dir } : s);
      setRestartRequired(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      await api.setDataDir(settings.default_data_dir);
      setSettings(s => s ? { ...s, data_dir: s.default_data_dir, is_custom: false } : s);
      setRestartRequired(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const sectionStyle = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-semibold mb-1">Settings</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Configure application preferences
      </p>

      {restartRequired && (
        <div
          className="flex items-start gap-3 p-4 rounded-lg mb-6 text-sm"
          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Restart required</p>
            <p className="mt-0.5 opacity-80">
              The new data directory will be used the next time DQ Studio starts.
              Existing data files are not moved automatically — copy them manually if needed.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-lg mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <section className="rounded-xl overflow-hidden mb-6" style={sectionStyle}>
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <Sun size={15} style={{ color: "var(--accent)" }} />
          <h2 className="text-sm font-semibold">Appearance</h2>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Theme</p>
          <div
            className="inline-flex rounded-lg p-1 gap-1"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
          >
            {(["dark", "light"] as Theme[]).map(t => (
              <button
                key={t}
                onClick={() => handleTheme(t)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all"
                style={
                  theme === t
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "transparent", color: "var(--text-secondary)" }
                }
              >
                {t === "dark" ? <Moon size={13} /> : <Sun size={13} />}
                {t === "dark" ? "Dark" : "Light"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data Storage ──────────────────────────────────────────────────── */}
      <section className="rounded-xl overflow-hidden mb-6" style={sectionStyle}>
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <HardDrive size={15} style={{ color: "var(--accent)" }} />
          <h2 className="text-sm font-semibold">Data Storage</h2>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Data directory
            </p>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-mono break-all"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <FolderOpen size={14} className="shrink-0" style={{ color: "var(--text-secondary)" }} />
              <span className="flex-1 min-w-0 break-all">
                {settings ? settings.data_dir : "Loading…"}
              </span>
              {settings?.is_custom && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}
                >
                  custom
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePick}
              disabled={saving || !settings}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <FolderOpen size={13} />
              {saving ? "Saving…" : "Change directory"}
            </button>

            {settings?.is_custom && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <RotateCcw size={13} />
                Reset to default
              </button>
            )}
          </div>

          {settings && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Default location: <span className="font-mono">{settings.default_data_dir}</span>
            </p>
          )}
        </div>
      </section>

      {/* ── Data Files ────────────────────────────────────────────────────── */}
      <section className="rounded-xl overflow-hidden" style={sectionStyle}>
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <FileJson size={15} style={{ color: "var(--accent)" }} />
          <h2 className="text-sm font-semibold">Data Files</h2>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {DATA_FILES.map(({ file, desc }) => (
            <div key={file} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-mono">{file}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
