<script setup lang="ts">
import { computed } from 'vue'
import type { Question, SubQuestionAnswer } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import QuestionCard from './QuestionCard.vue'

const props = defineProps<{
  questions: Question[]
}>()

const emit = defineEmits<{
  answer: [id: string, answers: SubQuestionAnswer[]]
}>()

const { t } = useI18n()

const pending = computed(() => props.questions.filter((q) => q.status === 'pending'))

const answered = computed(() => props.questions.filter((q) => q.status !== 'pending'))
</script>

<template>
  <div class="space-y-6 sm:space-y-8">
    <!-- Pending Questions -->
    <section v-if="pending.length > 0">
      <h2 class="mb-3 sm:mb-4 text-base sm:text-lg font-semibold flex items-center gap-2">
        <span class="inline-block h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        {{ t.pendingQuestions }}
        <span class="text-sm font-normal text-muted-foreground"> ({{ pending.length }}) </span>
      </h2>
      <div class="space-y-3 sm:space-y-4">
        <QuestionCard
          v-for="question in pending"
          :key="question.id"
          :question="question"
          @answer="(id, answers) => emit('answer', id, answers)"
        />
      </div>
    </section>

    <!-- Answered Questions -->
    <section v-if="answered.length > 0">
      <h2 class="mb-3 sm:mb-4 text-base sm:text-lg font-semibold flex items-center gap-2">
        {{ t.history }}
        <span class="text-sm font-normal text-muted-foreground"> ({{ answered.length }}) </span>
      </h2>
      <div class="space-y-3 sm:space-y-4">
        <QuestionCard
          v-for="question in answered"
          :key="question.id"
          :question="question"
          @answer="(id, answers) => emit('answer', id, answers)"
        />
      </div>
    </section>
  </div>
</template>
