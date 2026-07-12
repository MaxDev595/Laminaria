"use client";

import { Moon, Sun } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const locale = useLocale();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("laminaria-theme");
    const next = stored === "light" ? "light" : "dark";
    const frame = window.requestAnimationFrame(() => {
      setTheme(next);
      document.documentElement.dataset.theme = next;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("laminaria-theme", next);
  }

  return (
    <button
      type="button"
      className="utility-button utility-button--icon"
      onClick={toggle}
      aria-label={
        locale === "ru"
          ? theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
          : theme === "dark" ? "Use light theme" : "Use dark theme"
      }
    >
      {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
