## 命名规范

所有文件命名，统一使用小写字母和短横线分隔（kebab-case），例如 `user-profile.vue`。

组件命名的第一个单词基于组件类型：
- 卡片组件以 `card-` 开头，例如 `card-user-profile.vue`。
- 弹窗组件以 `dialog-` 开头，例如 `dialog-settings.vue`。
- 浮层组件以 `popover-` 开头，例如 `popover-user-menu.vue`。
- 抽屉组件以 `sheet-` 开头，例如 `sheet-notifications.vue`。

## 组件库偏好

优先使用 shadcn-vue 作为组件库

```sh
# 添加按钮组件
pnpm dlx shadcn-vue@latest add button
```

```vue
<script setup lang="ts">
import { Button } from "@/components/ui/button";
</script>

<template>
  <Button>按钮</Button>
</template>
```

## 尽量少地声明 `ref`

仅在必要时使用 `ref`，并优先考虑抽取组件、函数驱动的方式。

不推荐：过度使用 ref

```vue
<script setup lang="ts">
import { ref } from "vue";

const isOpen = ref(false);
</script>

<template>
  <button @click="isOpen = !isOpen">{{ isOpen ? "关闭" : "打开" }}</button>
  <Dialog v-model:open="isOpen">内容</Dialog>
</template>
```

推荐：直接使用组件或函数驱动

```vue
<template>
  <ToggleDialog>
    <button slot="trigger">打开弹窗</Button>
  </ToggleDialog>
</template>
```

## 优先使用 `@vueuse/core` 中的 hook 组织异步数据

在处理异步数据时，优先使用 `computedAsync` 和 `useAsyncState`，以提高代码的可读性和维护性。

使用 computedAsync 维护异步来源状态：

```vue
<script setup lang="ts">
import { computedAsync, useAsyncState } from "@vueuse/core";

const asyncData = computedAsync(async () => {
  const response = await fetch("/api/data");
  return await response.json();
});
</script>
```

使用 useAsyncState 维护异步动作状态：

```vue
<script setup lang="ts">
import { useAsyncState } from "@vueuse/core";

const { state: asyncData, isLoading, error } = useAsyncState(
  async () => {
    const response = await fetch("/api/data");
    return await response.json();
  },
  null
);
</script>
```

## 合理拆分组件与状态

避免在一个组件中处理过多逻辑，合理拆分组件和状态管理，以提高代码的可维护性和复用性。

1. 将复杂组件按职责拆分为多个子组件
2. 使用 Pinia 管理全局状态，合理拆分为多个 store
3. 使用组合式函数（composables）封装可复用的逻辑
