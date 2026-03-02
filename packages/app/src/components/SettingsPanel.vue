<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AppConfig } from '@/lib/api'
import { updateConfig } from '@/lib/api'
import { type Locale, useI18n } from '@/lib/i18n'
import { useDarkMode, type Theme } from '@/composables/useDarkMode'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const props = defineProps<{
  config: AppConfig
}>()

const { t, locale, setLocale, locales, localeNames } = useI18n()
const { theme, setTheme } = useDarkMode()

const saving = ref(false)
const saved = ref(false)
const localTimeout = ref(props.config.timeout)
const localNotification = ref(props.config.notification)
const localAutoOpenBrowser = ref(props.config.autoOpenBrowser)

watch(
  () => props.config,
  (newConfig) => {
    localTimeout.value = newConfig.timeout
    localNotification.value = newConfig.notification
    localAutoOpenBrowser.value = newConfig.autoOpenBrowser
  },
  { deep: true }
)

async function save() {
  saving.value = true
  saved.value = false
  try {
    await updateConfig({
      timeout: localTimeout.value,
      notification: localNotification.value,
      autoOpenBrowser: localAutoOpenBrowser.value
    })
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 2000)
  } finally {
    saving.value = false
  }
}

function formatTimeout(ms: number): string {
  if (ms === 0) return t.value.noTimeout
  if (ms < 60000) return `${ms / 1000}${t.value.secondsUnit}`
  return `${ms / 60000}${t.value.minutesUnit}`
}

const themeOptions: { value: Theme; icon: string }[] = [
  { value: 'system', icon: '💻' },
  { value: 'light', icon: '☀️' },
  { value: 'dark', icon: '🌙' }
]

function themeLabel(v: Theme): string {
  switch (v) {
    case 'light':
      return t.value.light
    case 'dark':
      return t.value.dark
    case 'system':
      return t.value.system
  }
}
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Timeout -->
    <Card>
      <CardHeader class="p-4 sm:p-6">
        <CardTitle class="text-sm sm:text-base">{{ t.timeout }}</CardTitle>
        <CardDescription class="text-xs sm:text-sm">
          {{ t.timeoutDescription }}
        </CardDescription>
      </CardHeader>
      <CardContent class="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
        <div class="flex items-center gap-3 sm:gap-4">
          <input
            v-model.number="localTimeout"
            type="range"
            min="0"
            max="600000"
            step="30000"
            class="flex-1 accent-primary"
          />
          <Badge variant="outline" class="min-w-[72px] sm:min-w-[80px] justify-center text-xs">
            {{ formatTimeout(localTimeout) }}
          </Badge>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          {{ t.timeoutHint }}
        </p>
      </CardContent>
    </Card>

    <!-- Notification -->
    <Card>
      <CardContent class="p-4 sm:p-6">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <p class="text-sm sm:text-base font-semibold leading-none tracking-tight">
              {{ t.notification }}
            </p>
            <p class="text-xs sm:text-sm text-muted-foreground">{{ t.notificationDescription }}</p>
          </div>
          <button
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="localNotification ? 'bg-primary' : 'bg-input'"
            role="switch"
            :aria-checked="localNotification"
            @click="localNotification = !localNotification"
          >
            <span
              class="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
              :class="localNotification ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </CardContent>
    </Card>

    <!-- Auto Open Browser -->
    <Card>
      <CardContent class="p-4 sm:p-6">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <p class="text-sm sm:text-base font-semibold leading-none tracking-tight">
              {{ t.autoOpenBrowser }}
            </p>
            <p class="text-xs sm:text-sm text-muted-foreground">
              {{ t.autoOpenBrowserDescription }}
            </p>
          </div>
          <button
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="localAutoOpenBrowser ? 'bg-primary' : 'bg-input'"
            role="switch"
            :aria-checked="localAutoOpenBrowser"
            @click="localAutoOpenBrowser = !localAutoOpenBrowser"
          >
            <span
              class="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
              :class="localAutoOpenBrowser ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </CardContent>
    </Card>

    <!-- Language -->
    <Card>
      <CardHeader class="p-4 sm:p-6">
        <CardTitle class="text-sm sm:text-base">{{ t.language }}</CardTitle>
      </CardHeader>
      <CardContent class="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="l in locales"
            :key="l"
            class="px-3 py-1.5 text-sm rounded-md border transition-colors"
            :class="
              locale === l
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent border-input'
            "
            @click="setLocale(l as Locale)"
          >
            {{ localeNames[l as Locale] }}
          </button>
        </div>
      </CardContent>
    </Card>

    <!-- Theme -->
    <Card>
      <CardHeader class="p-4 sm:p-6">
        <CardTitle class="text-sm sm:text-base">{{ t.theme }}</CardTitle>
      </CardHeader>
      <CardContent class="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            class="px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1.5"
            :class="
              theme === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent border-input'
            "
            @click="setTheme(opt.value)"
          >
            <span>{{ opt.icon }}</span>
            <span>{{ themeLabel(opt.value) }}</span>
          </button>
        </div>
      </CardContent>
    </Card>

    <!-- Save -->
    <div class="flex items-center justify-end gap-3">
      <span v-if="saved" class="text-sm text-green-600 dark:text-green-400"> ✓ {{ t.saved }} </span>
      <Button :disabled="saving" @click="save">
        {{ saving ? t.saving : t.saveSettings }}
      </Button>
    </div>
  </div>
</template>
