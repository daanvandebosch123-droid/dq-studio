<<<<<<< HEAD
import { Database, ShieldCheck, BarChart3, ScanSearch, History, CalendarClock, Settings } from "lucide-react";
=======
import { Database, ShieldCheck, BarChart3, ScanSearch, History, CalendarClock } from "lucide-react";
>>>>>>> origin/main
import { NavLink } from "react-router-dom";

const groups = [
  {
    label: null,
    items: [
      { to: "/", icon: Database, label: "Connections", end: true },
    ],
  },
  {
    label: "Data Quality",
    items: [
      { to: "/rules", icon: ShieldCheck, label: "Rules", end: false },
      { to: "/results", icon: BarChart3, label: "Results", end: false },
      { to: "/scheduler", icon: CalendarClock, label: "Scheduler", end: false },
    ],
  },
  {
    label: "Profiling",
    items: [
      { to: "/profiling", icon: ScanSearch, label: "Profile", end: true },
      { to: "/profiling/history", icon: History, label: "History", end: false },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="flex flex-col w-56 min-h-screen border-r" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-sm tracking-wide">DQ Studio</span>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {groups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : ""}>
            {group.label && (
              <p
                className="px-4 mb-1 text-xs font-semibold uppercase tracking-widest select-none"
                style={{ color: "var(--text-secondary)", opacity: 0.5 }}
              >
                {group.label}
              </p>
            )}
            {group.items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive ? "font-medium" : "hover:opacity-80"
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? "var(--accent-hover)" : "var(--text-secondary)",
                  background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                })}
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
<<<<<<< HEAD

      <div className="border-t py-2" style={{ borderColor: "var(--border)" }}>
        <NavLink
          to="/settings"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              isActive ? "font-medium" : "hover:opacity-80"
            }`
          }
          style={({ isActive }) => ({
            color: isActive ? "var(--accent-hover)" : "var(--text-secondary)",
            background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
          })}
        >
          <Settings size={15} />
          Settings
        </NavLink>
      </div>
=======
>>>>>>> origin/main
    </aside>
  );
}
