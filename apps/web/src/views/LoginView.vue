<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMsg = ref<string | null>(null)

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMsg.value = 'Email dan password wajib diisi.'
    return
  }

  isLoading.value = true
  errorMsg.value = null

  try {
    const res = await api.post('/auth/login', {
      email: email.value,
      password: password.value,
    })

    const { accessToken, user } = res.data
    authStore.setAuth(accessToken, user)

    if (user.isAdmin) {
      router.push('/admin')
    } else {
      router.push('/map')
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || 'Login gagal. Periksa kembali email dan password Anda.'
  } finally {
    isLoading.value = false
  }
}

function fillDemoAdmin() {
  email.value = 'admin@sgza.id'
  password.value = 'AdminSGZA2026!'
}
</script>

<template>
  <div class="py-12 px-4 max-w-md mx-auto space-y-4">
    <Card variant="white" class="space-y-6">
      <div class="space-y-1">
        <Badge variant="black">AUTENTIKASI</Badge>
        <h2 class="text-2xl font-black uppercase">Masuk Akun SGZA</h2>
        <p class="text-xs font-bold text-neutral-600">Masuk untuk mengarsipkan titik budaya kota</p>
      </div>

      <div v-if="errorMsg" class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white p-3 text-xs font-bold shadow-[2px_2px_0px_#0D0D0D]">
        ⚠️ {{ errorMsg }}
      </div>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <div class="space-y-1">
          <label class="text-xs font-black uppercase">Email</label>
          <Input v-model="email" type="email" placeholder="nama@email.com" required />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-black uppercase">Password</label>
          <div class="relative">
            <Input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="pr-12"
              required
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 border-2 border-[#0D0D0D] bg-[#FFE500] hover:bg-[#ffe81a] text-[#0D0D0D] shadow-[1px_1px_0px_#0D0D0D] transition-all flex items-center justify-center cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
              :title="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              aria-label="Toggle password visibility"
            >
              <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
        <Button variant="primary" class="w-full" type="submit" :disabled="isLoading">
          {{ isLoading ? 'MEMVERIFIKASI...' : 'MASUK SEKARANG ➔' }}
        </Button>
      </form>

      <div class="border-2 border-dashed border-[#0D0D0D] p-3 bg-[#FFFBF0] flex items-center justify-between">
        <div>
          <span class="text-[10px] font-black uppercase block text-neutral-500">Demo Akun Kurator Admin</span>
          <span class="text-xs font-mono font-bold">admin@sgza.id</span>
        </div>
        <Button variant="outline" size="sm" class="text-[11px]" @click="fillDemoAdmin">
          Gunakan Demo
        </Button>
      </div>

      <div class="text-center text-xs font-bold">
        Belum punya akun etnografer? <RouterLink to="/register" class="underline hover:text-[#FF3B3B]">Daftar KTP Surabaya</RouterLink>
      </div>
    </Card>
  </div>
</template>
