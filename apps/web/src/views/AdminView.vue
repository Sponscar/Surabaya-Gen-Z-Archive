<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'

const router = useRouter()
const authStore = useAuthStore()

// Tab state
const activeTab = ref<'users' | 'titik'>('users')

// Users State
interface PendingUser {
  id: string
  namaLengkap: string
  email: string
  nik: string
  ktpPath: string
  whatsapp: string
  jenisInstansi: string
  instansiDetail: Record<string, any>
  status: string
}

const pendingUsers = ref<PendingUser[]>([])
const loadingUsers = ref(true)
const selectedUser = ref<PendingUser | null>(null)
const userActionLoading = ref<string | null>(null)

// Titik State
interface PendingTitik {
  id: string
  judul: string
  deskripsi: string
  slangTerkait?: string
  fotoPath?: string
  lat: number
  lng: number
  status: string
  createdAt: string
  user?: { namaLengkap: string; email: string }
}

const pendingTitik = ref<PendingTitik[]>([])
const loadingTitik = ref(true)
const titikActionLoading = ref<string | null>(null)

// Error / success
const successMsg = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

// Redirect if not admin
onMounted(async () => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) {
    router.push('/login')
    return
  }
  await Promise.all([loadPendingUsers(), loadPendingTitik()])
})

async function loadPendingUsers() {
  loadingUsers.value = true
  try {
    const res = await api.get<PendingUser[]>('/admin/users?status=PENDING')
    pendingUsers.value = res.data
  } catch {
    pendingUsers.value = []
  } finally {
    loadingUsers.value = false
  }
}

async function loadPendingTitik() {
  loadingTitik.value = true
  try {
    const res = await api.get<PendingTitik[]>('/admin/titik-budaya?status=PENDING_REVIEW')
    pendingTitik.value = res.data
  } catch {
    pendingTitik.value = []
  } finally {
    loadingTitik.value = false
  }
}

async function updateUserStatus(userId: string, status: 'VERIFIED' | 'REJECTED') {
  userActionLoading.value = userId
  errorMsg.value = null
  try {
    await api.patch(`/admin/users/${userId}/status`, { status })
    successMsg.value = `User berhasil di-${status === 'VERIFIED' ? 'verifikasi' : 'tolak'}.`
    selectedUser.value = null
    await loadPendingUsers()
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || 'Gagal mengubah status user.'
  } finally {
    userActionLoading.value = null
  }
}

async function updateTitikStatus(titikId: string, status: 'APPROVED' | 'REJECTED') {
  titikActionLoading.value = titikId
  errorMsg.value = null
  try {
    await api.patch(`/admin/titik-budaya/${titikId}/status`, { status })
    successMsg.value = `Titik budaya berhasil di-${status === 'APPROVED' ? 'approve' : 'tolak'}.`
    await loadPendingTitik()
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || 'Gagal mengubah status titik.'
  } finally {
    titikActionLoading.value = null
  }
}
</script>

<template>
  <div class="py-8 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">

    <!-- Admin Header -->
    <div class="border-3 border-[#0D0D0D] bg-[#FF3B3B] text-white p-6 shadow-[6px_6px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Badge variant="yellow" class="text-xs">PANEL ADMIN</Badge>
          <Badge variant="black" class="text-xs">KURATOR SGZA</Badge>
        </div>
        <h1 class="text-3xl font-black uppercase text-white">Panel Validator SGZA</h1>
        <p class="text-sm font-bold text-white/90">Verifikasi KTP Warga Surabaya & Moderasi Titik Budaya</p>
      </div>
      <div class="text-right">
        <p class="text-xs font-mono font-bold text-white/70">Masuk sebagai</p>
        <p class="font-black text-sm">{{ authStore.user?.namaLengkap }}</p>
      </div>
    </div>

    <!-- Notifications -->
    <div v-if="successMsg" class="border-3 border-[#0D0D0D] bg-[#00C566] text-[#0D0D0D] p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
      <div class="flex items-center gap-2 font-extrabold text-sm">✅ {{ successMsg }}</div>
      <button @click="successMsg = null" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 text-xs">✕</button>
    </div>
    <div v-if="errorMsg" class="border-3 border-[#0D0D0D] bg-[#FF3B3B] text-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
      <div class="flex items-center gap-2 font-extrabold text-sm">⚠️ {{ errorMsg }}</div>
      <button @click="errorMsg = null" class="border-2 border-white bg-white/10 font-black px-2 py-0.5 text-xs text-white">✕</button>
    </div>

    <!-- Tab Navigation -->
    <div class="flex items-center gap-0 border-3 border-[#0D0D0D] bg-white w-fit shadow-[4px_4px_0px_#0D0D0D]">
      <button
        @click="activeTab = 'users'"
        :class="[
          'px-5 py-2.5 text-sm font-black uppercase border-r-2 border-[#0D0D0D] transition-colors',
          activeTab === 'users' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        👤 Verifikasi KTP
        <span v-if="pendingUsers.length > 0" class="ml-1.5 bg-[#FF3B3B] text-white text-[10px] font-black px-1.5 py-0.5 border border-[#0D0D0D]">
          {{ pendingUsers.length }}
        </span>
      </button>
      <button
        @click="activeTab = 'titik'"
        :class="[
          'px-5 py-2.5 text-sm font-black uppercase transition-colors',
          activeTab === 'titik' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        📍 Kurasi Titik Budaya
        <span v-if="pendingTitik.length > 0" class="ml-1.5 bg-[#FF3B3B] text-white text-[10px] font-black px-1.5 py-0.5 border border-[#0D0D0D]">
          {{ pendingTitik.length }}
        </span>
      </button>
    </div>

    <!-- ===== TAB: Verifikasi KTP Users ===== -->
    <div v-if="activeTab === 'users'">
      <div v-if="loadingUsers" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat daftar pendaftar...</p>
      </div>

      <div v-else-if="pendingUsers.length === 0" class="border-3 border-dashed border-[#0D0D0D] bg-white p-10 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="text-2xl mb-2">🎉</p>
        <p class="font-extrabold text-neutral-700">Semua pendaftar sudah terverifikasi!</p>
        <p class="text-xs font-medium text-neutral-500 mt-1">Tidak ada antrian user berstatus PENDING.</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="user in pendingUsers"
          :key="user.id"
          class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_#0D0D0D] space-y-4 transition-all duration-150 hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <!-- User Info Row -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <Badge variant="yellow" class="text-[10px]">PENDING VERIFIKASI</Badge>
                <span class="text-xs font-mono font-bold text-neutral-400">ID: {{ user.id.slice(0, 8) }}...</span>
              </div>
              <h3 class="text-lg font-black uppercase text-[#0D0D0D]">{{ user.namaLengkap }}</h3>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs font-mono mt-2">
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">Email</span><br>{{ user.email }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">NIK (Dekripsi)</span><br>{{ user.nik }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">WhatsApp</span><br>{{ user.whatsapp }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">Instansi</span><br>{{ user.jenisInstansi }}</div>
              </div>
              <div v-if="user.instansiDetail" class="text-xs font-mono text-neutral-600 bg-[#FFFBF0] border border-[#0D0D0D] p-2 mt-1 max-w-sm">
                <span class="font-black uppercase text-[10px] block mb-1 text-neutral-500">Detail Instansi:</span>
                <template v-for="(val, key) in user.instansiDetail" :key="key">
                  <span class="font-bold">{{ key }}:</span> {{ val }}&nbsp;
                </template>
              </div>
            </div>

            <!-- KTP Preview -->
            <div v-if="user.ktpPath" class="flex-shrink-0">
              <span class="text-[10px] font-black uppercase text-neutral-500 block mb-1">Foto KTP:</span>
              <a :href="`/api/uploads/ktp/${user.ktpPath}`" target="_blank">
                <img
                  :src="`/api/uploads/ktp/${user.ktpPath}`"
                  alt="Foto KTP"
                  class="w-36 h-24 object-cover border-2 border-[#0D0D0D] shadow-[3px_3px_0px_#0D0D0D] cursor-pointer hover:opacity-90 transition-opacity"
                />
              </a>
              <span class="text-[10px] text-neutral-400 font-mono block mt-0.5">Klik untuk perbesar</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-3 pt-3 border-t-2 border-[#0D0D0D]">
            <Button
              variant="success"
              size="sm"
              :disabled="userActionLoading === user.id"
              @click="updateUserStatus(user.id, 'VERIFIED')"
            >
              {{ userActionLoading === user.id ? 'Memproses...' : '✓ VERIFIKASI & SETUJUI' }}
            </Button>
            <Button
              variant="danger"
              size="sm"
              :disabled="userActionLoading === user.id"
              @click="updateUserStatus(user.id, 'REJECTED')"
            >
              {{ userActionLoading === user.id ? 'Memproses...' : '✕ TOLAK / REJECT' }}
            </Button>
            <span class="text-xs font-bold text-neutral-500 font-mono">
              Perubahan tidak dapat dibatalkan.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== TAB: Kurasi Titik Budaya ===== -->
    <div v-if="activeTab === 'titik'">
      <div v-if="loadingTitik" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat titik budaya pending...</p>
      </div>

      <div v-else-if="pendingTitik.length === 0" class="border-3 border-dashed border-[#0D0D0D] bg-white p-10 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="text-2xl mb-2">🗺️</p>
        <p class="font-extrabold text-neutral-700">Tidak ada titik budaya yang menunggu kurasi.</p>
        <p class="text-xs font-medium text-neutral-500 mt-1">Semua titik telah dimoderasi.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          v-for="titik in pendingTitik"
          :key="titik.id"
          class="border-3 border-[#0D0D0D] bg-white shadow-[5px_5px_0px_#0D0D0D] flex flex-col transition-all duration-150 hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <!-- Foto Preview -->
          <div v-if="titik.fotoPath" class="border-b-2 border-[#0D0D0D] overflow-hidden h-40">
            <img
              :src="`/api/uploads/titik/${titik.fotoPath}`"
              :alt="titik.judul"
              class="w-full h-full object-cover"
            />
          </div>
          <div v-else class="border-b-2 border-[#0D0D0D] h-24 bg-[#FFFBF0] flex items-center justify-center">
            <span class="text-4xl opacity-30">🏙️</span>
          </div>

          <div class="p-5 flex flex-col flex-1 space-y-3">
            <div class="flex items-center justify-between">
              <Badge variant="yellow" class="text-[10px]">PENDING REVIEW</Badge>
              <span class="text-[10px] font-mono font-bold text-neutral-400">
                {{ new Date(titik.createdAt).toLocaleDateString('id-ID') }}
              </span>
            </div>

            <h3 class="text-base font-black uppercase text-[#0D0D0D]">{{ titik.judul }}</h3>
            <p class="text-xs font-medium text-neutral-700 line-clamp-3">{{ titik.deskripsi }}</p>

            <div v-if="titik.slangTerkait" class="text-xs font-bold bg-[#FFE500] border border-[#0D0D0D] px-2 py-1 w-fit">
              🗣️ Slang: {{ titik.slangTerkait }}
            </div>

            <div class="text-xs font-mono text-neutral-500 space-y-0.5">
              <div>📍 Koordinat: {{ titik.lat?.toFixed(5) }}, {{ titik.lng?.toFixed(5) }}</div>
              <div v-if="titik.user">👤 Oleh: {{ titik.user.namaLengkap }} ({{ titik.user.email }})</div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 pt-3 border-t-2 border-[#0D0D0D] mt-auto">
              <Button
                variant="success"
                size="sm"
                class="flex-1 justify-center"
                :disabled="titikActionLoading === titik.id"
                @click="updateTitikStatus(titik.id, 'APPROVED')"
              >
                {{ titikActionLoading === titik.id ? '...' : '✓ APPROVE' }}
              </Button>
              <Button
                variant="danger"
                size="sm"
                class="flex-1 justify-center"
                :disabled="titikActionLoading === titik.id"
                @click="updateTitikStatus(titik.id, 'REJECTED')"
              >
                {{ titikActionLoading === titik.id ? '...' : '✕ TOLAK' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
