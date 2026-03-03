<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuestions } from '@/composables/use-questions'
import type { SubQuestionAnswer } from '@/lib/api'
import QuestionCard from '@/components/question-card.vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  id: string
}>()

const { questions, answer } = useQuestions()
const { t } = useI18n()
const router = useRouter()

const question = computed(() => questions.value.find((q) => q.id === props.id) ?? null)

// Watch for the question becoming available (e.g., from WS init after navigation)
const loading = ref(!question.value)
watch(question, (q) => {
  if (q) loading.value = false
})

onMounted(() => {
  if (question.value) loading.value = false
})

function handleAnswer(id: string, answers: SubQuestionAnswer[]) {
  answer(id, answers)
}

function handleDecline(id: string) {
  const q = question.value
  if (!q) return
  const emptyAnswers: SubQuestionAnswer[] = q.questions.map(() => ({
    selected: [],
    freeText: undefined
  }))
  answer(id, emptyAnswers)
}

function goBack() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Back button -->
    <Button variant="ghost" size="sm" class="gap-1.5" @click="goBack">
      <span class="icon-[mdi--arrow-left] size-4" />
      {{ t('back') }}
    </Button>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center py-20 text-muted-foreground">
      <span class="icon-[mdi--loading] size-6 animate-spin" />
    </div>

    <!-- Not found -->
    <div v-else-if="!question" class="flex flex-col items-center py-20 text-center">
      <span class="icon-[mdi--alert-circle-outline] size-10 text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">{{ t('questionNotFound') }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="goBack">
        {{ t('back') }}
      </Button>
    </div>

    <!-- Question card -->
    <QuestionCard
      v-else
      :question="question"
      :pending-count="0"
      @answer="handleAnswer"
      @decline="handleDecline"
    />
  </div>
</template>
