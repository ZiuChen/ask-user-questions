<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuestions } from '@/composables/use-questions'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

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
  <div class="space-y-6">
    <!-- Pending questions -->
    <section v-if="pendingQuestions.length > 0">
      <h2 class="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <span class="icon-[mdi--chat-question] size-4" />
        {{ t('pendingQuestions') }}
        <Badge variant="destructive" class="text-[10px]">{{ pendingQuestions.length }}</Badge>
      </h2>
      <div class="space-y-2">
        <Card
          v-for="q in pendingQuestions"
          :key="q.id"
          class="cursor-pointer transition-colors hover:bg-muted/50"
          @click="goToQuestion(q.id)"
        >
          <CardHeader class="py-3 px-4">
            <div class="flex items-center justify-between gap-2">
              <CardTitle class="text-sm font-normal leading-relaxed truncate flex-1">
                {{ q.questions[0]?.question || '...' }}
              </CardTitle>
              <div class="flex items-center gap-2 shrink-0">
                <Badge v-if="q.questions.length > 1" variant="secondary" class="text-[10px]">
                  {{ q.questions.length }} {{ t('questions') }}
                </Badge>
                <Badge variant="outline" class="text-[10px]">
                  {{ formatTime(q.createdAt) }}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </section>

    <!-- Empty state -->
    <div
      v-if="pendingQuestions.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto"
    >
      <span class="icon-[mdi--chat-question-outline] size-12 text-muted-foreground/30 mb-4" />
      <h2 class="text-lg font-medium text-muted-foreground">{{ t('noQuestionsYet') }}</h2>
      <p class="text-sm text-muted-foreground/70 mt-2">
        {{ t('noQuestionsDescription') }}
      </p>
    </div>

    <!-- History -->
    <section v-if="answeredQuestions.length > 0">
      <h2 class="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <span class="icon-[mdi--history] size-4" />
        {{ t('history') }}
      </h2>
      <div class="space-y-2">
        <Card
          v-for="q in answeredQuestions"
          :key="q.id"
          class="cursor-pointer transition-colors hover:bg-muted/50 opacity-70"
          @click="goToQuestion(q.id)"
        >
          <CardHeader class="py-3 px-4">
            <div class="flex items-center justify-between gap-2">
              <CardTitle class="text-sm font-normal leading-relaxed truncate flex-1">
                {{ q.questions[0]?.question || '...' }}
              </CardTitle>
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
          </CardHeader>
        </Card>
      </div>
    </section>
  </div>
</template>
