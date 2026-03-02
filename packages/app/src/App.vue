<script setup lang="ts">
import { ref } from 'vue'
import QuestionList from '@/components/QuestionList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useQuestions } from '@/composables/useQuestions'
import { useI18n } from '@/lib/i18n'

const { questions, config, connected, error, answer } = useQuestions()
const { t, locale, setLocale, locales, localeNames } = useI18n()
const { theme, cycleTheme } = useDarkMode()

const activeTab = ref<'questions' | 'settings'>('questions')
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header
      class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div class="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-4">
        <!-- Logo + Title -->
        <div class="flex items-center gap-2 shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-primary"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          <h1 class="text-base font-semibold hidden sm:block">{{ t.appTitle }}</h1>
        </div>

        <!-- Navigation Tabs -->
        <nav class="flex items-center gap-1">
          <button
            class="px-3 py-1.5 text-sm rounded-md transition-colors"
            :class="
              activeTab === 'questions'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="activeTab = 'questions'"
          >
            {{ t.questions }}
          </button>
          <button
            class="px-3 py-1.5 text-sm rounded-md transition-colors"
            :class="
              activeTab === 'settings'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="activeTab = 'settings'"
          >
            {{ t.settings }}
          </button>
        </nav>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Controls -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- Language Selector -->
          <select
            :value="locale"
            class="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            @change="setLocale(($event.target as HTMLSelectElement).value as any)"
          >
            <option v-for="l in locales" :key="l" :value="l">
              {{ localeNames[l] }}
            </option>
          </select>

          <!-- Theme Toggle -->
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            :title="t.theme"
            @click="cycleTheme"
          >
            <!-- Sun (light) -->
            <svg
              v-if="theme === 'light'"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
            <!-- Moon (dark) -->
            <svg
              v-else-if="theme === 'dark'"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
            <!-- Monitor (system) -->
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <line x1="8" x2="16" y1="21" y2="21" />
              <line x1="12" x2="12" y1="17" y2="21" />
            </svg>
          </button>

          <!-- Connection Status -->
          <div class="flex items-center gap-1.5 ml-1">
            <span
              class="inline-block h-2 w-2 rounded-full shrink-0"
              :class="connected ? 'bg-green-500' : 'bg-red-500'"
            />
            <span class="text-xs text-muted-foreground hidden sm:inline">
              {{ connected ? t.connected : t.disconnected }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <!-- Error Banner -->
      <div
        v-if="error"
        class="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 sm:p-4 text-sm text-destructive"
      >
        {{ error === 'connectionLost' ? t.connectionLost : error }}
      </div>

      <!-- Questions Tab -->
      <template v-if="activeTab === 'questions'">
        <!-- Empty State -->
        <div
          v-if="questions.length === 0 && connected"
          class="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mb-4 text-muted-foreground/50"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h2 class="text-xl font-semibold text-muted-foreground">{{ t.noQuestionsYet }}</h2>
          <p class="mt-2 max-w-sm text-sm text-muted-foreground">
            {{ t.noQuestionsDescription }}
          </p>
        </div>

        <!-- Question List -->
        <QuestionList
          v-else
          :questions="questions"
          @answer="(id, answers) => answer(id, answers)"
        />
      </template>

      <!-- Settings Tab -->
      <template v-if="activeTab === 'settings'">
        <div class="max-w-2xl mx-auto">
          <SettingsPanel :config="config" />
        </div>
      </template>
    </main>
  </div>
</template>
