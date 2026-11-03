<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'primary' | 'danger' | 'success' | 'outline' | 'black'
  size?: 'sm' | 'md' | 'lg'
  class?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  type: 'button',
})

const variantClasses = {
  primary: 'bg-[#FFE500] text-[#0D0D0D] hover:bg-[#ffe81a]',
  danger: 'bg-[#FF3B3B] text-white hover:bg-[#e03030]',
  success: 'bg-[#00C566] text-[#0D0D0D] hover:bg-[#00b05b]',
  outline: 'bg-white text-[#0D0D0D] hover:bg-neutral-100',
  black: 'bg-[#0D0D0D] text-[#FFE500] hover:bg-neutral-800',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
}

const buttonClass = computed(() => {
  return cn(
    'inline-flex items-center justify-center font-extrabold uppercase tracking-wide border-3 border-[#0D0D0D] shadow-[3px_3px_0px_#0D0D0D] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#0D0D0D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#0D0D0D]',
    variantClasses[props.variant],
    sizeClasses[props.size],
    props.class
  )
})
</script>

<template>
  <button :type="type" :disabled="disabled" :class="buttonClass">
    <slot />
  </button>
</template>
