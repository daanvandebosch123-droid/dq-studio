export type Theme = "dark" | "light";

export function getTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

/** Call once before React mounts to avoid a flash of the wrong theme. */
export function initTheme(): void {
  applyTheme(getTheme());
}
