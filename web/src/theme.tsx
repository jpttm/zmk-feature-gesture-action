import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useT } from "./i18n";

export type Theme = "auto" | "light" | "dark";

const STORAGE_KEY = "zmk-gesture-action.theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "auto",
  setTheme: () => {},
});

/**
 * Follows the operating system until told otherwise.
 *
 * "auto" is the default rather than a fixed light theme: someone who has set
 * their machine to dark has already answered this question once.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (t === "auto") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, t);
    }
  }, []);

  useEffect(() => {
    // No attribute at all means "whatever prefers-color-scheme says", which is
    // exactly what the stylesheet's media query already handles.
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  const t = useT();

  const options: { value: Theme; label: string }[] = [
    { value: "auto", label: t("themeAuto") },
    { value: "light", label: t("themeLight") },
    { value: "dark", label: t("themeDark") },
  ];

  return (
    <div className="langToggle" role="group" aria-label={t("theme")}>
      {options.map((option) => (
        <button
          key={option.value}
          className={theme === option.value ? "lang on" : "lang"}
          onClick={() => setTheme(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
