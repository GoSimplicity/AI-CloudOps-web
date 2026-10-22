<script lang="ts" setup>
import type { ThemeModeType } from '@vben/types';

import { MoonStar, Sun, SunMoon } from '@vben/icons';
import { $t } from '@vben/locales';
import {
  preferences,
  updatePreferences,
} from '@vben/preferences';
import {
  ToggleGroup,
  ToggleGroupItem,
  VbenTooltip,
} from '@vben-core/shadcn-ui';

defineOptions({
  name: 'ThemeToggle',
});

withDefaults(defineProps<{ shouldOnHover?: boolean }>(), {
  shouldOnHover: false,
});

const PRESETS = [
  {
    icon: Sun,
    name: 'light',
    title: $t('preferences.theme.light'),
  },
  {
    icon: MoonStar,
    name: 'dark',
    title: $t('preferences.theme.dark'),
  },
  {
    icon: SunMoon,
    name: 'auto',
    title: $t('preferences.followSystem'),
  },
];
</script>
<template>
  <div>
    <VbenTooltip :disabled="!shouldOnHover" side="bottom">
      <ToggleGroup :model-value="preferences.theme.mode" class="gap-2" type="single" variant="outline"
        @update:model-value="
          (val) => val && updatePreferences({ theme: { mode: val as ThemeModeType } })
        ">
        <ToggleGroupItem v-for="item in PRESETS" :key="item.name" :value="item.name" :aria-label="item.title" :title="item.title">
          <component :is="item.icon" class="size-5" />
        </ToggleGroupItem>
      </ToggleGroup>
    </VbenTooltip>
  </div>
</template>
