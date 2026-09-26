import { ref } from "vue";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "synapsis:theme_mode";

const themeMode = ref<ThemeMode>("system");
const effectiveTheme = ref<"light" | "dark">("dark");

export function useTheme() {
  const applyTheme = () => {
    let resolved: "light" | "dark" = "dark";
    if (themeMode.value === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
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
  };

  const setTheme = (mode: ThemeMode) => {
    themeMode.value = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme();
  };

  const initTheme = () => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved && ["system", "light", "dark"].includes(saved)) {
      themeMode.value = saved;
    } else {
      themeMode.value = "system";
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
    setTheme,
    initTheme,
  };
}
