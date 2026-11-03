<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'yellow' | 'red' | 'green' | 'black' | 'white'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'yellow',
})

const variantClasses = {
  yellow: 'bg-[#FFE500] text-[#0D0D0D]',
  red: 'bg-[#FF3B3B] text-white',
  green: 'bg-[#00C566] text-[#0D0D0D]',
  black: 'bg-[#0D0D0D] text-[#FFE500]',
  white: 'bg-white text-[#0D0D0D]',
}

const badgeClass = computed(() => {
  return cn(
    'inline-flex items-center px-2.5 py-0.5 text-xs font-black uppercase tracking-wider border-2 border-[#0D0D0D] select-none',
    variantClasses[props.variant],
    props.class
  )
})
</script>

<template>
  <span :class="badgeClass">
    <slot />
  </span>
</template>
