<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'white' | 'yellow' | 'green' | 'red' | 'cream'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'white',
})

const variantClasses = {
  white: 'bg-white text-[#0D0D0D]',
  yellow: 'bg-[#FFE500] text-[#0D0D0D]',
  green: 'bg-[#00C566] text-[#0D0D0D]',
  red: 'bg-[#FF3B3B] text-white',
  cream: 'bg-[#FFFBF0] text-[#0D0D0D]',
}

const cardClass = computed(() => {
  return cn(
    'border-3 border-[#0D0D0D] shadow-[4px_4px_0px_#0D0D0D] p-5 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]',
    variantClasses[props.variant],
    props.class
  )
})
</script>

<template>
  <div :class="cardClass">
    <slot />
  </div>
</template>
