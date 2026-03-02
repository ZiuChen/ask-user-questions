<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Question, SubQuestionAnswer } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{
  question: Question
}>()

const emit = defineEmits<{
  answer: [id: string, answers: SubQuestionAnswer[]]
}>()

const { t } = useI18n()

// Per sub-question state
const selections = reactive<string[][]>(props.question.questions.map(() => []))
const otherTexts = reactive<string[]>(props.question.questions.map(() => ''))
const otherActive = reactive<boolean[]>(props.question.questions.map((sq) => !sq.options?.length))
const submitting = ref(false)

// Reset state when question changes
watch(
  () => props.question.id,
  () => {
    props.question.questions.forEach((sq, i) => {
      selections[i] = []
      otherTexts[i] = ''
      otherActive[i] = !sq.options?.length
    })
  }
)

function toggleOption(qIdx: number, label: string) {
  const sq = props.question.questions[qIdx]
  if (sq.multiSelect) {
    const idx = selections[qIdx].indexOf(label)
    if (idx >= 0) {
      selections[qIdx].splice(idx, 1)
    } else {
      selections[qIdx].push(label)
    }
  } else {
    // Single select - toggle
    if (selections[qIdx][0] === label) {
      selections[qIdx] = []
    } else {
      selections[qIdx] = [label]
      otherActive[qIdx] = false
      otherTexts[qIdx] = ''
    }
  }
}

function toggleOther(qIdx: number) {
  const sq = props.question.questions[qIdx]
  otherActive[qIdx] = !otherActive[qIdx]
  if (!sq.multiSelect && otherActive[qIdx]) {
    selections[qIdx] = []
  }
  if (!otherActive[qIdx]) {
    otherTexts[qIdx] = ''
  }
}

function isSelected(qIdx: number, label: string): boolean {
  return selections[qIdx].includes(label)
}

const canSubmit = computed(() => {
  return props.question.questions.every((_, idx) => {
    return selections[idx].length > 0 || otherTexts[idx].trim().length > 0
  })
})

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true

  const answers: SubQuestionAnswer[] = props.question.questions.map((_, idx) => ({
    selected: [...selections[idx]],
    freeText: otherTexts[idx].trim() || undefined
  }))

  emit('answer', props.question.id, answers)
  submitting.value = false
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const statusIcon = computed(() => {
  switch (props.question.status) {
    case 'pending':
      return t.value.aiQuestion
    case 'answered':
      return t.value.answered
    case 'timeout':
      return t.value.timedOut
  }
})

const statusLabel = computed(() => {
  switch (props.question.status) {
    case 'pending':
      return t.value.pending
    case 'answered':
      return t.value.answered
    case 'timeout':
      return t.value.timedOut
  }
})

const badgeVariant = computed(() => {
  switch (props.question.status) {
    case 'pending':
      return 'warning' as const
    case 'answered':
      return 'success' as const
    case 'timeout':
      return 'destructive' as const
  }
})

const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
const submitShortcut = computed(() =>
  t.value.pressToSubmit.replace('{shortcut}', isMac ? '⌘+Enter' : 'Ctrl+Enter')
)
</script>

<template>
  <Card
    :class="[
      'transition-all duration-200',
      question.status === 'pending' ? 'border-primary/50 shadow-md' : 'opacity-75'
    ]"
  >
    <CardHeader class="p-4 sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <CardTitle class="text-sm sm:text-base">
          {{ statusIcon }}
        </CardTitle>
        <Badge :variant="badgeVariant">
          {{ statusLabel }}
        </Badge>
      </div>
      <CardDescription>
        {{ formatTime(question.createdAt) }}
        <span v-if="question.questions.length > 1" class="ml-2">
          · {{ question.questions.length }} {{ t.questions.toLowerCase() }}
        </span>
      </CardDescription>
    </CardHeader>

    <CardContent class="px-4 pb-4 sm:px-6 sm:pb-6 pt-0 space-y-5">
      <!-- Pending: Interactive sub-questions -->
      <template v-if="question.status === 'pending'">
        <div
          v-for="(sq, idx) in question.questions"
          :key="idx"
          :class="[
            'space-y-3',
            question.questions.length > 1 ? 'rounded-lg border p-3 sm:p-4' : ''
          ]"
        >
          <!-- Sub-question text -->
          <div class="rounded-md bg-muted p-3 sm:p-4">
            <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {{ sq.question }}
            </p>
          </div>

          <!-- Options -->
          <div v-if="sq.options?.length" class="flex flex-wrap gap-2">
            <button
              v-for="opt in sq.options"
              :key="opt.label"
              class="group relative flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent/50"
              :class="
                isSelected(idx, opt.label)
                  ? 'border-primary bg-primary/10 dark:bg-primary/20'
                  : 'border-input'
              "
              @click="toggleOption(idx, opt.label)"
            >
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium">{{ opt.label }}</span>
                <Badge v-if="opt.recommended" variant="outline" class="text-[10px] px-1 py-0">
                  ★
                </Badge>
              </div>
              <span v-if="opt.description" class="text-xs text-muted-foreground mt-0.5">
                {{ opt.description }}
              </span>
            </button>
          </div>

          <!-- Multi-select hint -->
          <p v-if="sq.multiSelect && sq.options?.length" class="text-xs text-muted-foreground">
            {{ t.selectOneOrMore }}
          </p>

          <!-- "Other" free-text input -->
          <div class="space-y-2">
            <button
              v-if="sq.options?.length"
              class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
              :class="
                otherActive[idx]
                  ? 'border-primary bg-primary/10 dark:bg-primary/20'
                  : 'border-input'
              "
              @click="toggleOther(idx)"
            >
              <span class="text-muted-foreground">✏️</span>
              <span>{{ t.freeText }}</span>
            </button>
            <Textarea
              v-if="otherActive[idx]"
              v-model="otherTexts[idx]"
              :placeholder="t.typeYourAnswer"
              class="resize-none min-h-[60px]"
              @keydown.meta.enter="handleSubmit"
              @keydown.ctrl.enter="handleSubmit"
            />
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          {{ submitShortcut }}
        </p>
      </template>

      <!-- Answered / Timed out: Display answers -->
      <template v-else>
        <div
          v-for="(sq, idx) in question.questions"
          :key="idx"
          :class="[
            'space-y-2',
            question.questions.length > 1 ? 'rounded-lg border p-3 sm:p-4' : ''
          ]"
        >
          <!-- Sub-question text -->
          <div class="rounded-md bg-muted p-3">
            <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {{ sq.question }}
            </p>
          </div>

          <!-- Answer display -->
          <div
            v-if="question.answers?.[idx]"
            :class="[
              'rounded-md p-3',
              question.status === 'timeout'
                ? 'bg-destructive/10'
                : 'bg-green-500/10 dark:bg-green-500/20'
            ]"
          >
            <p class="text-xs font-medium text-muted-foreground mb-1">
              {{ question.status === 'timeout' ? t.timedOutLabel : t.yourAnswer }}
            </p>
            <div v-if="question.answers[idx].selected.length" class="flex flex-wrap gap-1 mb-1">
              <Badge
                v-for="s in question.answers[idx].selected"
                :key="s"
                variant="secondary"
                class="text-xs"
              >
                {{ s }}
              </Badge>
            </div>
            <p
              v-if="question.answers[idx].freeText"
              class="text-sm whitespace-pre-wrap break-words"
            >
              {{ question.answers[idx].freeText }}
            </p>
          </div>
        </div>

        <p v-if="question.answeredAt" class="text-xs text-muted-foreground">
          {{ question.status === 'timeout' ? t.timedOutAt : t.answeredAt }}
          {{ formatTime(question.answeredAt) }}
        </p>
      </template>
    </CardContent>

    <CardFooter v-if="question.status === 'pending'" class="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
      <Button class="w-full" :disabled="!canSubmit || submitting" @click="handleSubmit">
        {{ submitting ? t.submitting : t.submitAnswer }}
      </Button>
    </CardFooter>
  </Card>
</template>
