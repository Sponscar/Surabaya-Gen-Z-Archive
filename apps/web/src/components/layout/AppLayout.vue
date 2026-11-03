<script setup lang="ts">
import Navbar from './Navbar.vue'
import { isPageLoading, pageLoadingProgress } from '@/router'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#FFFBF0] text-[#0D0D0D] relative">
    <!-- Top Loading Progress Bar (Neubrutalism) -->
    <div
      v-if="isPageLoading"
      class="fixed top-0 left-0 right-0 h-1.5 z-[9999] bg-[#0D0D0D] pointer-events-none"
    >
      <div
        class="h-full bg-[#FFE500] border-r-2 border-[#0D0D0D] transition-all duration-100 ease-out"
        :style="{ width: `${pageLoadingProgress}%` }"
      ></div>
    </div>

    <!-- Floating Loading Badge Indicator -->
    <Transition name="nb-pop">
      <div
        v-if="isPageLoading"
        class="fixed top-22 right-6 z-[9999] border-3 border-[#0D0D0D] bg-[#FFE500] text-[#0D0D0D] px-4 py-2 font-black text-xs uppercase shadow-[4px_4px_0px_#0D0D0D] flex items-center gap-2.5 pointer-events-none"
      >
        <span class="w-2.5 h-2.5 bg-[#0D0D0D] inline-block animate-spin"></span>
        <span>MEMUAT HALAMAN...</span>
      </div>
    </Transition>

    <Navbar />
    <main class="flex-1">
      <slot />
    </main>
    <footer class="border-t-3 border-[#0D0D0D] bg-[#0D0D0D] text-white py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span class="font-extrabold text-sm tracking-wide text-[#FFE500]">SGZA // Surabaya Gen-Z Archive</span>
          <p class="text-xs text-neutral-400 mt-1">Anak muda bukan objek penelitian, tapi pelaku pengarsipan.</p>
        </div>
        <div class="text-xs font-mono text-neutral-400">
          Sprint 1 MVP • 2026
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.nb-pop-enter-active,
.nb-pop-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.nb-pop-enter-from,
.nb-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
