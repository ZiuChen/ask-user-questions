<script setup lang="ts">
import { computed, ref } from 'vue'
import { provideQuestions } from '@/composables/use-questions'
import { useDarkMode } from '@/composables/use-dark-mode'
import { useI18n } from 'vue-i18n'
import type { SubQuestionAnswer } from '@/lib/api'
import QuestionCard from '@/components/question-card.vue'
import SettingsPanel from '@/components/settings-panel.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const { questions, config, connected, error, answer } = provideQuestions()
const { t } = useI18n()
const { theme, cycleTheme } = useDarkMode()

const settingsOpen = ref(false)

const currentQuestion = computed(() => questions.value.find((q) => q.status === 'pending') ?? null)
const pendingCount = computed(() => questions.value.filter((q) => q.status === 'pending').length)

function handleAnswer(id: string, answers: SubQuestionAnswer[]) {
  answer(id, answers)
}

function handleDecline(id: string) {
  const q = questions.value.find((item) => item.id === id)
  if (!q) return
  const emptyAnswers: SubQuestionAnswer[] = q.questions.map(() => ({
    selected: [],
    freeText: undefined
  }))
  answer(id, emptyAnswers)
}

const themeIcon = computed(() => {
  switch (theme.value) {
    case 'light':
      return 'icon-[mdi--white-balance-sunny]'
    case 'dark':
      return 'icon-[mdi--weather-night]'
    default:
      return 'icon-[mdi--monitor]'
  }
})
</script>

<template>
  <TooltipProvider>
    <div class="min-h-screen flex flex-col">
      <!-- Header -->
      <header class="flex items-center justify-between px-4 py-3 max-w-lg mx-auto w-full">
        <div class="flex items-center gap-2">
          <span class="icon-[mdi--chat-question] size-5 text-primary" />
          <span class="text-sm font-semibold">{{ t('appTitle') }}</span>
          <Tooltip>
            <TooltipTrigger as-child>
              <span
                class="size-2 rounded-full"
                :class="connected ? 'bg-green-500' : 'bg-red-500'"
              />
            </TooltipTrigger>
            <TooltipContent>
              {{ connected ? t('connected') : t('disconnected') }}
            </TooltipContent>
          </Tooltip>
        </div>
        <div class="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" @click="cycleTheme">
            <span :class="themeIcon" class="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" @click="settingsOpen = true">
            <span class="icon-[mdi--cog] size-4" />
          </Button>
        </div>
      </header>

      <!-- Error banner -->
      <div v-if="error" class="mx-auto max-w-lg w-full px-4">
        <div class="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {{ error === 'connectionLost' ? t('connectionLost') : error }}
        </div>
      </div>

      <!-- Main content -->
      <main class="flex-1 flex items-start justify-center px-4 py-6">
        <template v-if="currentQuestion">
          <QuestionCard
            :key="currentQuestion.id"
            :question="currentQuestion"
            :pending-count="pendingCount"
            @answer="handleAnswer"
            @decline="handleDecline"
          />
        </template>

        <div v-else class="flex flex-col items-center justify-center py-20 text-center max-w-sm">
          <span class="icon-[mdi--chat-question-outline] size-12 text-muted-foreground/30 mb-4" />
          <h2 class="text-lg font-medium text-muted-foreground">{{ t('noQuestionsYet') }}</h2>
          <p class="text-sm text-muted-foreground/70 mt-2">
            {{ t('noQuestionsDescription') }}
          </p>
        </div>
      </main>
    </div>

    <!-- Settings Dialog -->
    <Dialog v-model:open="settingsOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('settings') }}</DialogTitle>
        </DialogHeader>
        <SettingsPanel :config="config" />
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
