<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Question, SubQuestionAnswer } from '@/lib/api'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

const { question } = defineProps<{
  question: Question
  pendingCount: number
}>()

const emit = defineEmits<{
  answer: [id: string, answers: SubQuestionAnswer[]]
  decline: [id: string]
}>()

const { t } = useI18n()

const selections = reactive<string[][]>(question.questions.map(() => []))
const otherTexts = reactive<string[]>(question.questions.map(() => ''))
const otherActive = reactive<boolean[]>(question.questions.map((sq) => !sq.options?.length))
const submitting = ref(false)

watch(
  () => question.id,
  () => {
    question.questions.forEach((sq, i) => {
      selections[i] = []
      otherTexts[i] = ''
      otherActive[i] = !sq.options?.length
    })
  }
)

function toggleOption(qIdx: number, label: string) {
  const sq = question.questions[qIdx]
  if (sq.multiSelect) {
    const idx = selections[qIdx].indexOf(label)
    if (idx >= 0) selections[qIdx].splice(idx, 1)
    else selections[qIdx].push(label)
  } else {
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
  const sq = question.questions[qIdx]
  otherActive[qIdx] = !otherActive[qIdx]
  if (!sq.multiSelect && otherActive[qIdx]) selections[qIdx] = []
  if (!otherActive[qIdx]) otherTexts[qIdx] = ''
}

function isSelected(qIdx: number, label: string): boolean {
  return selections[qIdx].includes(label)
}

const canSubmit = computed(() =>
  question.questions.every(
    (_, idx) => selections[idx].length > 0 || otherTexts[idx].trim().length > 0
  )
)

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  const answers: SubQuestionAnswer[] = question.questions.map((_, idx) => ({
    selected: [...selections[idx]],
    freeText: otherTexts[idx].trim() || undefined
  }))
  emit('answer', question.id, answers)
  submitting.value = false
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
const submitShortcut = computed(() =>
  t('pressToSubmit', { shortcut: isMac ? '⌘+Enter' : 'Ctrl+Enter' })
)
</script>

<template>
  <Card class="w-full max-w-lg">
    <!-- Sub-questions (each gets its own header+content section) -->
    <template v-for="(sq, idx) in question.questions" :key="idx">
      <Separator v-if="idx > 0" />

      <!-- Question text as header -->
      <CardHeader>
        <div class="flex items-center justify-between gap-2">
          <Badge v-if="question.questions.length > 1" variant="secondary" class="text-[10px]">
            {{ idx + 1 }}/{{ question.questions.length }}
          </Badge>
          <span v-if="sq.multiSelect && sq.options?.length" class="text-xs text-muted-foreground">
            {{ t('selectOneOrMore') }}
          </span>
        </div>
        <CardTitle class="text-base font-normal leading-relaxed whitespace-pre-wrap break-words">
          {{ sq.question }}
        </CardTitle>
      </CardHeader>

      <CardContent class="space-y-2">
        <!-- Options (when pending) -->
        <template v-if="question.status === 'pending'">
          <button
            v-for="opt in sq.options"
            :key="opt.label"
            class="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
            :class="isSelected(idx, opt.label) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'"
            @click="toggleOption(idx, opt.label)"
          >
            <span
              class="size-4 shrink-0"
              :class="
                isSelected(idx, opt.label)
                  ? 'icon-[mdi--radiobox-marked] text-primary'
                  : 'icon-[mdi--radiobox-blank] text-muted-foreground'
              "
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span>{{ opt.label }}</span>
                <span v-if="opt.recommended" class="icon-[mdi--star] size-3.5 text-amber-500" />
              </div>
              <p v-if="opt.description" class="text-xs text-muted-foreground mt-0.5">
                {{ opt.description }}
              </p>
            </div>
          </button>

          <!-- "Other" free-text option -->
          <button
            v-if="sq.options?.length"
            class="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
            :class="otherActive[idx] ? 'bg-primary/10 text-primary' : 'hover:bg-muted'"
            @click="toggleOther(idx)"
          >
            <span
              class="size-4 shrink-0"
              :class="
                otherActive[idx]
                  ? 'icon-[mdi--radiobox-marked] text-primary'
                  : 'icon-[mdi--radiobox-blank] text-muted-foreground'
              "
            />
            <span>{{ t('freeText') }}</span>
          </button>

          <Textarea
            v-if="otherActive[idx]"
            v-model="otherTexts[idx]"
            :placeholder="t('typeYourAnswer')"
            class="resize-none min-h-[80px]"
            @keydown.meta.enter="handleSubmit"
            @keydown.ctrl.enter="handleSubmit"
          />
        </template>

        <!-- Answered / Timeout display -->
        <template v-else>
          <div
            v-if="question.answers?.[idx]"
            class="rounded-lg p-3 space-y-2"
            :class="question.status === 'timeout' ? 'bg-destructive/5' : 'bg-muted/50'"
          >
            <p class="text-xs font-medium text-muted-foreground">
              {{ question.status === 'timeout' ? t('timedOutLabel') : t('yourAnswer') }}
            </p>
            <div v-if="question.answers[idx].selected.length" class="flex flex-wrap gap-1.5">
              <Badge v-for="s in question.answers[idx].selected" :key="s" variant="secondary">
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
        </template>
      </CardContent>
    </template>

    <!-- Footer: Submit + Decline -->
    <CardFooter v-if="question.status === 'pending'" class="flex-col gap-2">
      <div class="flex w-full gap-2">
        <Button variant="ghost" class="flex-1" @click="emit('decline', question.id)">
          {{ t('decline') }}
        </Button>
        <Button class="flex-1" :disabled="!canSubmit || submitting" @click="handleSubmit">
          {{ submitting ? t('submitting') : t('submitAnswer') }}
        </Button>
      </div>
      <p class="text-xs text-center text-muted-foreground">
        {{ submitShortcut }}
      </p>
    </CardFooter>
  </Card>
</template>
