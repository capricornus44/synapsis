<script setup lang="ts">
import { ref } from "vue";
import { useTheme, type ThemeMode } from "../composables/useTheme";
import {
  Palette as PaletteIcon,
  Search as SearchIcon,
  X as XIcon,
  ChevronDown as ChevronDownIcon,
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

const { themeMode, setTheme } = useTheme();

const activeTab = ref<"appearance" | "general" | "editor">("appearance");
const searchQuery = ref("");

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Adapt to system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const handleThemeChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  setTheme(target.value as ThemeMode);
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
              class="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-emerald-500"
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
                  <PaletteIcon class="w-3.5 h-3.5 text-emerald-500" />
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

              <!-- Select Box -->
              <div class="relative shrink-0">
                <select
                  :value="themeMode"
                  @change="handleThemeChange"
                  class="appearance-none bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs font-medium"
                >
                  <option
                    v-for="opt in themeOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
                <ChevronDownIcon
                  class="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
