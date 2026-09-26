<script setup lang="ts">
import { computed, ref } from "vue";
import { useTheme, type ThemeMode } from "../composables/useTheme";
import {
  Palette as PaletteIcon,
  Search as SearchIcon,
  X as XIcon,
  ChevronDown as ChevronDownIcon,
  Check as CheckIcon,
  RotateCcw as RotateCcwIcon,
  SlidersHorizontal as SlidersIcon,
  FileText as FileTextIcon,
  FolderCog as FolderCogIcon,
  Keyboard as KeyboardIcon,
} from "@lucide/vue";

defineProps<{
  isOpen: boolean;
  vaultName?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const {
  themeMode,
  accentColor,
  DEFAULT_ACCENT,
  setTheme,
  setAccentColor,
  resetAccentColor,
} = useTheme();

const activeTab = ref<"appearance" | "general" | "editor">("appearance");
const searchQuery = ref("");

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Adapt to system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const isThemeMenuOpen = ref(false);
const highlightedIndex = ref(0);

const currentThemeLabel = computed(
  () => themeOptions.find((opt) => opt.value === themeMode.value)?.label,
);

const openThemeMenu = () => {
  highlightedIndex.value = Math.max(
    0,
    themeOptions.findIndex((opt) => opt.value === themeMode.value),
  );
  isThemeMenuOpen.value = true;
};

const toggleThemeMenu = () => {
  if (isThemeMenuOpen.value) {
    isThemeMenuOpen.value = false;
  } else {
    openThemeMenu();
  }
};

const selectTheme = (mode: ThemeMode) => {
  setTheme(mode);
  isThemeMenuOpen.value = false;
};

// Mirrors native <select> keyboard behaviour; focus stays on the trigger button.
const handleThemeMenuKeydown = (e: KeyboardEvent) => {
  const count = themeOptions.length;

  if (!isThemeMenuOpen.value) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openThemeMenu();
    }
    return;
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      highlightedIndex.value = (highlightedIndex.value + 1) % count;
      break;
    case "ArrowUp":
      e.preventDefault();
      highlightedIndex.value = (highlightedIndex.value - 1 + count) % count;
      break;
    case "Home":
      e.preventDefault();
      highlightedIndex.value = 0;
      break;
    case "End":
      e.preventDefault();
      highlightedIndex.value = count - 1;
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      selectTheme(themeOptions[highlightedIndex.value].value);
      break;
    case "Escape":
      e.stopPropagation();
      isThemeMenuOpen.value = false;
      break;
    case "Tab":
      isThemeMenuOpen.value = false;
      break;
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl max-w-3xl w-full h-[540px] flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-100 transition-colors"
      @keydown.esc="emit('close')"
    >
      <!-- Top Titlebar -->
      <div
        class="h-10 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-100/60 dark:bg-neutral-950/40 select-none shrink-0"
      >
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 mr-2">
            <span
              class="w-3 h-3 rounded-full bg-red-500/80 inline-block"
            ></span>
            <span
              class="w-3 h-3 rounded-full bg-amber-500/80 inline-block"
            ></span>
            <span
              class="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"
            ></span>
          </div>
          <span
            class="text-xs font-semibold text-neutral-600 dark:text-neutral-400"
          >
            Settings {{ vaultName ? ` - ${vaultName}` : "" }}
          </span>
        </div>

        <button
          @click="emit('close')"
          class="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Close Settings (Esc)"
        >
          <XIcon class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Layout -->
      <div class="flex flex-1 min-h-0">
        <!-- Sidebar Navigation -->
        <aside
          class="w-56 bg-neutral-50 dark:bg-neutral-950/50 border-r border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3 shrink-0 select-none"
        >
          <!-- Search box -->
          <div class="relative">
            <SearchIcon
              class="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search settings..."
              class="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
            />
          </div>

          <!-- Menu items -->
          <div class="flex-1 overflow-y-auto space-y-4">
            <div>
              <div
                class="px-2 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider"
              >
                Options
              </div>
              <div class="space-y-0.5 mt-1">
                <button
                  @click="activeTab = 'appearance'"
                  :class="[
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left',
                    activeTab === 'appearance'
                      ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200',
                  ]"
                >
                  <PaletteIcon
                    class="w-3.5 h-3.5"
                    :style="{ color: accentColor }"
                  />
                  <span>Appearance</span>
                </button>

                <button
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-400 dark:text-neutral-500 opacity-60 cursor-not-allowed text-left"
                  title="Coming soon"
                >
                  <SlidersIcon class="w-3.5 h-3.5" />
                  <span>General</span>
                </button>

                <button
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-400 dark:text-neutral-500 opacity-60 cursor-not-allowed text-left"
                  title="Coming soon"
                >
                  <FileTextIcon class="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>

                <button
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-400 dark:text-neutral-500 opacity-60 cursor-not-allowed text-left"
                  title="Coming soon"
                >
                  <FolderCogIcon class="w-3.5 h-3.5" />
                  <span>Files & Links</span>
                </button>

                <button
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-400 dark:text-neutral-500 opacity-60 cursor-not-allowed text-left"
                  title="Coming soon"
                >
                  <KeyboardIcon class="w-3.5 h-3.5" />
                  <span>Hotkeys</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <!-- Right Content Area -->
        <main class="flex-1 p-6 overflow-y-auto">
          <div v-if="activeTab === 'appearance'" class="space-y-6">
            <div>
              <h2
                class="text-base font-semibold text-neutral-900 dark:text-white"
              >
                Appearance
              </h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Customize look and feel of Synapsis
              </p>
            </div>

            <!-- Base Colour Scheme Row -->
            <div
              class="flex items-center justify-between py-3.5 border-b border-neutral-200 dark:border-neutral-800"
            >
              <div class="space-y-0.5 pr-4">
                <div
                  class="text-xs font-semibold text-neutral-900 dark:text-neutral-100"
                >
                  Base colour scheme
                </div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400">
                  Choose Synapsis's default colour scheme.
                </div>
              </div>

              <!-- Select Box (custom, so the highlight follows the accent colour) -->
              <div class="relative shrink-0" @keydown="handleThemeMenuKeydown">
                <button
                  @click="toggleThemeMenu"
                  aria-haspopup="listbox"
                  :aria-expanded="isThemeMenuOpen"
                  class="relative bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs rounded-lg pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer shadow-xs font-medium"
                >
                  {{ currentThemeLabel }}
                  <ChevronDownIcon
                    class="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </button>

                <template v-if="isThemeMenuOpen">
                  <div
                    class="fixed inset-0 z-10"
                    @click="isThemeMenuOpen = false"
                  ></div>
                  <div
                    role="listbox"
                    class="absolute right-0 top-full mt-1 z-20 min-w-40 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl"
                  >
                    <button
                      v-for="(opt, idx) in themeOptions"
                      :key="opt.value"
                      role="option"
                      tabindex="-1"
                      :aria-selected="opt.value === themeMode"
                      @mousedown.prevent
                      @mouseenter="highlightedIndex = idx"
                      @click="selectTheme(opt.value)"
                      :class="[
                        'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-left font-medium cursor-pointer',
                        highlightedIndex === idx
                          ? 'bg-accent text-white'
                          : 'text-neutral-800 dark:text-neutral-100',
                      ]"
                    >
                      <CheckIcon
                        class="w-3.5 h-3.5 shrink-0"
                        :class="opt.value === themeMode ? '' : 'invisible'"
                      />
                      <span>{{ opt.label }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </div>

            <!-- Accent Colour Row -->
            <div
              class="flex items-center justify-between py-3.5 border-b border-neutral-200 dark:border-neutral-800"
            >
              <div class="space-y-0.5 pr-4">
                <div
                  class="text-xs font-semibold text-neutral-900 dark:text-neutral-100"
                >
                  Accent colour
                </div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400">
                  Choose the accent colour used throughout the app.
                </div>
              </div>

              <!-- Accent Color Controls: Reset + Color Picker Swatch -->
              <div class="flex items-center gap-2.5 shrink-0">
                <button
                  v-if="
                    accentColor.toLowerCase() !== DEFAULT_ACCENT.toLowerCase()
                  "
                  @click="resetAccentColor"
                  class="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Reset to default colour"
                >
                  <RotateCcwIcon class="w-3.5 h-3.5" />
                </button>

                <!-- Native Color Palette Picker Swatch -->
                <label
                  class="relative inline-flex items-center justify-center cursor-pointer group"
                  title="Choose accent colour"
                >
                  <input
                    type="color"
                    :value="accentColor"
                    @input="
                      (e) =>
                        setAccentColor((e.target as HTMLInputElement).value)
                    "
                    class="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                  />
                  <div
                    class="w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-700 shadow-sm transition-transform group-hover:scale-110 group-active:scale-95 ring-2 ring-transparent group-hover:ring-neutral-400/40"
                    :style="{ backgroundColor: accentColor }"
                  ></div>
                </label>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
