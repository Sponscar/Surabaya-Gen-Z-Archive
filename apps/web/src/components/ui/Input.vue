<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const inputClass = computed(() => {
  return cn(
    'w-full px-3.5 py-2.5 font-medium border-3 border-[#0D0D0D] bg-white text-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D] outline-none transition-all placeholder:text-neutral-500 focus:border-[#FFE500] focus:shadow-[4px_4px_0px_#0D0D0D] disabled:opacity-50 disabled:cursor-not-allowed',
    props.class
  )
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="inputClass"
    @input="onInput"
  />
</template>
