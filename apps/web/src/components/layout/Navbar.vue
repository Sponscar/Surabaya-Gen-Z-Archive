<script setup lang="ts">
import { computed, ref } from 'vue'
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

// Modal konfirmasi logout
const showLogoutModal = ref(false)

function confirmLogout() {
  showLogoutModal.value = true
}

function doLogout() {
  showLogoutModal.value = false
  authStore.logout()
  router.push('/login')
}

function cancelLogout() {
  showLogoutModal.value = false
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
          <Button variant="outline" size="sm" @click="confirmLogout">LOGOUT</Button>
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

  <!-- Modal Konfirmasi Logout (Neubrutalism) -->
  <Transition name="modal-fade">
    <div
      v-if="showLogoutModal"
      class="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      @click.self="cancelLogout"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-[#0D0D0D]/60 backdrop-blur-[2px]"></div>

      <!-- Card Modal -->
      <div class="relative border-3 border-[#0D0D0D] bg-white shadow-[8px_8px_0px_#0D0D0D] w-full max-w-sm z-10">
        <!-- Header Card -->
        <div class="border-b-3 border-[#0D0D0D] bg-[#FF3B3B] px-5 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 bg-[#0D0D0D] text-[#FF3B3B] font-black text-xs flex items-center justify-center border border-white">!</span>
            <span class="font-black text-sm uppercase tracking-wide text-white">Konfirmasi Logout</span>
          </div>
          <button
            @click="cancelLogout"
            class="border-2 border-white bg-white/20 text-white font-black text-xs px-2 py-0.5 hover:bg-white hover:text-[#FF3B3B] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <!-- Body Card -->
        <div class="p-6 space-y-4">
          <!-- User Info -->
          <div class="border-2 border-[#0D0D0D] bg-[#FFFBF0] p-3 flex items-center gap-3">
            <div class="w-10 h-10 bg-[#0D0D0D] text-[#FFE500] font-black text-base flex items-center justify-center border-2 border-[#0D0D0D] flex-shrink-0">
              {{ user?.namaLengkap?.charAt(0)?.toUpperCase() || 'U' }}
            </div>
            <div>
              <p class="font-black text-sm uppercase text-[#0D0D0D] leading-tight">{{ user?.namaLengkap }}</p>
              <p class="text-[11px] font-mono text-neutral-500">{{ user?.email || 'Sesi aktif' }}</p>
            </div>
          </div>

          <p class="text-sm font-bold text-[#0D0D0D]">
            Apakah kamu yakin ingin keluar dari akun SGZA? Sesi aktif akan diakhiri.
          </p>

          <!-- Action Buttons -->
          <div class="flex gap-3 pt-1">
            <Button
              variant="danger"
              size="md"
              class="flex-1 justify-center"
              @click="doLogout"
            >
              ✓ Ya, Logout
            </Button>
            <Button
              variant="outline"
              size="md"
              class="flex-1 justify-center"
              @click="cancelLogout"
            >
              Batal
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .relative,
.modal-fade-leave-active .relative {
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-fade-enter-from .relative {
  transform: scale(0.95) translateY(-8px);
}
.modal-fade-leave-to .relative {
  transform: scale(0.95) translateY(-8px);
}
</style>
