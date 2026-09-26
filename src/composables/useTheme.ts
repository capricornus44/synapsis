import { ref } from "vue";

export type ThemeMode = "system" | "light" | "dark";

export const DEFAULT_ACCENT = "#7c3aed";

const STORAGE_THEME_KEY = "synapsis:theme_mode";
const STORAGE_ACCENT_KEY = "synapsis:accent_color";

const themeMode = ref<ThemeMode>("system");
const effectiveTheme = ref<"light" | "dark">("dark");
const accentColor = ref<string>(DEFAULT_ACCENT);

export function useTheme() {
  const applyAccent = () => {
    document.documentElement.style.setProperty(
      "--color-accent",
      accentColor.value,
    );
  };

  const setAccentColor = (color: string) => {
    accentColor.value = color;
    localStorage.setItem(STORAGE_ACCENT_KEY, color);
    applyAccent();
  };

  const resetAccentColor = () => {
    setAccentColor(DEFAULT_ACCENT);
  };

  const applyTheme = () => {
    let resolved: "light" | "dark" = "dark";
    if (themeMode.value === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      resolved = prefersDark ? "dark" : "light";
    } else {
      resolved = themeMode.value;
    }

    effectiveTheme.value = resolved;
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
    applyAccent();
  };

  const setTheme = (mode: ThemeMode) => {
    themeMode.value = mode;
    localStorage.setItem(STORAGE_THEME_KEY, mode);
    applyTheme();
  };

  const initTheme = () => {
    const savedMode = localStorage.getItem(
      STORAGE_THEME_KEY,
    ) as ThemeMode | null;
    if (savedMode && ["system", "light", "dark"].includes(savedMode)) {
      themeMode.value = savedMode;
    } else {
      themeMode.value = "system";
    }

    const savedAccent = localStorage.getItem(STORAGE_ACCENT_KEY);
    if (savedAccent) {
      accentColor.value = savedAccent;
    } else {
      accentColor.value = DEFAULT_ACCENT;
    }

    applyTheme();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      if (themeMode.value === "system") {
        applyTheme();
      }
    });
  };

  return {
    themeMode,
    effectiveTheme,
    accentColor,
    DEFAULT_ACCENT,
    setTheme,
    setAccentColor,
    resetAccentColor,
    initTheme,
  };
}
