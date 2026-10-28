import { useEffect, useState } from "react";

/** Each id has a matching `:root[data-theme="<id>"]` block in App.css ("dark" is the default :root). */
export const THEMES = [
  { id: "dark", label: "มืด", labelEn: "Dark" },
  { id: "light", label: "สว่าง", labelEn: "Light" },
  { id: "latte", label: "Catppuccin Latte", labelEn: "Catppuccin Latte" },
  { id: "nord", label: "Nord", labelEn: "Nord" },
  { id: "tokyo", label: "Tokyo Night", labelEn: "Tokyo Night" },
  { id: "gruvbox", label: "Gruvbox Dark", labelEn: "Gruvbox Dark" },
  { id: "everforest", label: "Everforest", labelEn: "Everforest" },
  { id: "dracula", label: "Dracula", labelEn: "Dracula" },
  { id: "solarized-light", label: "Solarized Light", labelEn: "Solarized Light" },
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
