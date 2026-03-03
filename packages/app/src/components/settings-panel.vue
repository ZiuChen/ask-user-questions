<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppConfig } from '@/lib/api'
import { updateConfig } from '@/lib/api'
import { type Locale, ALL_LOCALES, LOCALE_NAMES, setLocale } from '@/lib/i18n'
import { useDarkMode, type Theme } from '@/composables/use-dark-mode'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

const props = defineProps<{
  config: AppConfig
}>()

const { t, locale } = useI18n()
const { theme, setTheme } = useDarkMode()

const saving = ref(false)
const saved = ref(false)
const localTimeout = ref(props.config.timeout)
const localAutoOpenBrowser = ref(props.config.autoOpenBrowser)

watch(
  () => props.config,
  (c) => {
    localTimeout.value = c.timeout
    localAutoOpenBrowser.value = c.autoOpenBrowser
  },
  { deep: true }
)

async function save() {
  saving.value = true
  saved.value = false
  try {
    await updateConfig({
      timeout: localTimeout.value,
      autoOpenBrowser: localAutoOpenBrowser.value
    })
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } finally {
    saving.value = false
  }
}

function formatTimeout(ms: number): string {
  if (ms === 0) return t('noTimeout')
  if (ms < 60000) return `${ms / 1000}${t('secondsUnit')}`
  return `${ms / 60000}${t('minutesUnit')}`
}
</script>

<template>
  <div class="space-y-5">
    <!-- Auto Open Browser -->
    <div class="flex items-center justify-between gap-4">
      <div class="space-y-0.5">
        <p class="text-sm font-medium">{{ t('autoOpenBrowser') }}</p>
        <p class="text-xs text-muted-foreground">{{ t('autoOpenBrowserDescription') }}</p>
      </div>
      <Switch
        :model-value="localAutoOpenBrowser"
        @update:model-value="localAutoOpenBrowser = $event"
      />
    </div>

    <Separator />

    <!-- Timeout -->
    <div class="space-y-3">
      <div class="space-y-0.5">
        <p class="text-sm font-medium">{{ t('timeout') }}</p>
        <p class="text-xs text-muted-foreground">{{ t('timeoutDescription') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <Slider
          :model-value="[localTimeout]"
          :min="0"
          :max="600000"
          :step="30000"
          class="flex-1"
          @update:model-value="
            (v) => {
              if (v) localTimeout = v[0]
            }
          "
        />
        <Badge variant="outline" class="min-w-[72px] justify-center text-xs">
          {{ formatTimeout(localTimeout) }}
        </Badge>
      </div>
      <p class="text-xs text-muted-foreground">{{ t('timeoutHint') }}</p>
    </div>

    <Separator />

    <!-- Language -->
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm font-medium">{{ t('language') }}</p>
      <Select
        :model-value="locale"
        @update:model-value="
          (v) => {
            if (v) setLocale(v as Locale)
          }
        "
      >
        <SelectTrigger class="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="l in ALL_LOCALES" :key="l" :value="l">
            {{ LOCALE_NAMES[l] }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Separator />

    <!-- Theme -->
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm font-medium">{{ t('theme') }}</p>
      <Select
        :model-value="theme"
        @update:model-value="
          (v) => {
            if (v) setTheme(v as Theme)
          }
        "
      >
        <SelectTrigger class="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">{{ t('system') }}</SelectItem>
          <SelectItem value="light">{{ t('light') }}</SelectItem>
          <SelectItem value="dark">{{ t('dark') }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Separator />

    <!-- Save -->
    <div class="flex items-center justify-end gap-3">
      <span v-if="saved" class="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
        <span class="icon-[mdi--check] size-4" /> {{ t('saved') }}
      </span>
      <Button :disabled="saving" @click="save">
        {{ saving ? t('saving') : t('saveSettings') }}
      </Button>
    </div>
  </div>
</template>
