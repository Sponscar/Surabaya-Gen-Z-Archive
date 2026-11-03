<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const user = computed(() => authStore.user)
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isVerified = computed(() => authStore.isVerified)

function logout() {
  authStore.logout()
  router.push('/login')
}

function scrollToSection(sectionId: string) {
  if (route.path === '/') {
    if (sectionId === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      const el = document.getElementById(sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  } else {
    router.push({ path: '/', hash: sectionId === 'top' ? undefined : `#${sectionId}` })
  }
}
</script>

<template>
  <header class="sticky top-0 z-50 bg-[#FFE500] border-b-3 border-[#0D0D0D]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
      <!-- Brand Logo -->
      <button
        type="button"
        @click="scrollToSection('top')"
        class="flex items-center gap-3 group bg-transparent border-0 p-0 text-left cursor-pointer"
      >
        <div class="bg-[#0D0D0D] text-[#FFE500] font-black text-xl px-2.5 py-1 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D] group-hover:rotate-[-2deg] transition-transform">
          SGZA
        </div>
        <div class="flex flex-col">
          <span class="font-extrabold text-base tracking-tight leading-none text-[#0D0D0D]">SURABAYA GEN-Z ARCHIVE</span>
          <span class="text-[10px] font-bold tracking-widest text-[#0D0D0D]/70 uppercase">Everyday Ethnographer</span>
        </div>
      </button>

      <!-- Navigation Links -->
      <nav class="hidden md:flex items-center gap-6 font-bold text-sm tracking-wide">
        <button
          type="button"
          @click="scrollToSection('top')"
          class="hover:underline underline-offset-4 decoration-2 text-[#0D0D0D] font-bold tracking-wide bg-transparent border-0 cursor-pointer p-0"
        >
          HOME
        </button>
        <button
          type="button"
          @click="scrollToSection('sejarah')"
          class="hover:underline underline-offset-4 decoration-2 text-[#0D0D0D] font-bold tracking-wide bg-transparent border-0 cursor-pointer p-0"
        >
          SEJARAH
        </button>
        <button
          type="button"
          @click="scrollToSection('peta-budaya')"
          class="hover:underline underline-offset-4 decoration-2 text-[#0D0D0D] font-bold tracking-wide bg-transparent border-0 cursor-pointer p-0"
        >
          PETA BUDAYA
        </button>
        <button
          type="button"
          @click="scrollToSection('slang')"
          class="hover:underline underline-offset-4 decoration-2 text-[#0D0D0D] font-bold tracking-wide bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1.5"
        >
          <span>SLANG</span>
          <Badge variant="red" class="text-[9px] py-0 px-1">SOON</Badge>
        </button>
        <button
          type="button"
          @click="scrollToSection('komunitas')"
          class="hover:underline underline-offset-4 decoration-2 text-[#0D0D0D] font-bold tracking-wide bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1.5"
        >
          <span>KOMUNITAS</span>
          <Badge variant="red" class="text-[9px] py-0 px-1">SOON</Badge>
        </button>
        <RouterLink v-if="user?.isAdmin" to="/admin" class="hover:underline underline-offset-4 decoration-2">
          <Badge variant="black">ADMIN</Badge>
        </RouterLink>
      </nav>

      <!-- Auth Controls -->
      <div class="flex items-center gap-3">
        <template v-if="isAuthenticated">
          <div class="hidden sm:flex items-center gap-2">
            <span class="font-bold text-xs uppercase">{{ user?.namaLengkap }}</span>
            <Badge v-if="isVerified" variant="green">VERIFIED</Badge>
            <Badge v-else variant="yellow">PENDING</Badge>
          </div>
          <Button variant="outline" size="sm" @click="logout">LOGOUT</Button>
        </template>
        <template v-else>
          <RouterLink to="/login">
            <Button variant="outline" size="sm">MASUK</Button>
          </RouterLink>
          <RouterLink to="/register">
            <Button variant="black" size="sm">DAFTAR</Button>
          </RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>
