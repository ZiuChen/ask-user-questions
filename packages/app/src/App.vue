<script setup lang="ts">
import { computed, ref } from 'vue'
import { provideQuestions } from '@/composables/use-questions'
import { useDarkMode } from '@/composables/use-dark-mode'
import { useI18n } from 'vue-i18n'
import SettingsPanel from '@/components/settings-panel.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const { config, connected, error } = provideQuestions()
const { t } = useI18n()
const { theme, cycleTheme } = useDarkMode()

const settingsOpen = ref(false)

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
        <router-link
          :to="{ name: 'home' }"
          class="flex items-center gap-2 no-underline text-foreground"
        >
          <img class="size-5 draggable-none" src="/logo.png" alt="logo" />
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
        </router-link>
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
        <div class="w-full max-w-lg">
          <router-view />
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
