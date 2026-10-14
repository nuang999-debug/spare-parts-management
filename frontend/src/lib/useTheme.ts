import { useEffect, useState } from "react";

/** Each id has a matching `:root[data-theme="<id>"]` block in App.css ("dark" is the default :root). */
export const THEMES = [
  { id: "dark", label: "มืด" },
  { id: "light", label: "สว่าง" },
  { id: "latte", label: "Catppuccin Latte" },
  { id: "nord", label: "Nord" },
  { id: "tokyo", label: "Tokyo Night" },
  { id: "gruvbox", label: "Gruvbox Dark" },
  { id: "everforest", label: "Everforest" },
  { id: "dracula", label: "Dracula" },
  { id: "solarized-light", label: "Solarized Light" },
] as const;

export type Theme = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "spareparts_theme";

function isTheme(v: string | null): v is Theme {
  return THEMES.some((t) => t.id === v);
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isTheme(saved) ? saved : "dark";
  } catch {
    return "dark";
  }
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage blocked (private window etc.): the theme still applies for this visit
    }
  }, [theme]);

  return [theme, setTheme];
}
