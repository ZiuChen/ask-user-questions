<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuestions } from '@/composables/use-questions'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const { questions } = useQuestions()
const { t } = useI18n()
const router = useRouter()

const pendingQuestions = computed(() => questions.value.filter((q) => q.status === 'pending'))

const answeredQuestions = computed(() => questions.value.filter((q) => q.status !== 'pending'))

function goToQuestion(id: string) {
  router.push({ name: 'question', params: { id } })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-lg flex items-center gap-2">
        {{ t('pendingQuestions') }}
        <Badge>{{ pendingQuestions.length }}</Badge>
      </CardTitle>
    </CardHeader>

    <CardContent>
      <!-- Empty state -->
      <div
        v-if="pendingQuestions.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto"
      >
        <img class="size-12 draggable-none opacity-30 mb-4" src="/logo.png" alt="logo" />
        <h2 class="text-lg font-medium text-muted-foreground">{{ t('noQuestionsYet') }}</h2>
        <p class="text-sm text-muted-foreground/70 mt-2">
          {{ t('noQuestionsDescription') }}
        </p>
      </div>

      <div class="space-y-2">
        <div
          v-for="q in pendingQuestions"
          :key="q.id"
          class="px-5 py-2 rounded-md border cursor-pointer transition-colors hover:bg-muted/50"
          @click="goToQuestion(q.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-normal leading-relaxed truncate flex-1">
              {{ q.questions[0]?.question || '...' }}
            </h2>
            <div class="flex items-center gap-2 shrink-0">
              <Badge v-if="q.questions.length > 1" variant="secondary" class="text-[10px]">
                {{ q.questions.length }} {{ t('questions') }}
              </Badge>
              <Badge variant="outline" class="text-[10px]">
                {{ formatTime(q.createdAt) }}
              </Badge>
            </div>
          </div>
        </div>

        <div
          v-for="q in answeredQuestions"
          :key="q.id"
          class="px-5 py-2 rounded-md border cursor-pointer transition-colors hover:bg-muted/50 opacity-50"
          @click="goToQuestion(q.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-normal leading-relaxed truncate flex-1">
              {{ q.questions[0]?.question || '...' }}
            </h2>
            <div class="flex items-center gap-2 shrink-0">
              <Badge
                :variant="q.status === 'timeout' ? 'destructive' : 'secondary'"
                class="text-[10px]"
              >
                {{ q.status === 'timeout' ? t('timedOut') : t('answered') }}
              </Badge>
              <Badge variant="outline" class="text-[10px]">
                {{ formatTime(q.answeredAt || q.createdAt) }}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <!-- History -->
      <section v-if="answeredQuestions.length > 0">
        <div class="space-y-2"></div>
      </section>
    </CardContent>
  </Card>
</template>
