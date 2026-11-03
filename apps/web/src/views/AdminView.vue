<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
  id: number | string
  namaLengkap: string
  email: string
  nik?: string
  nikDecrypted?: string
  ktpPath?: string
  ktpUrl?: string
  whatsapp: string
  jenisInstansi: string
  instansiDetail?: Record<string, any>
  status: string
}

const pendingUsers = ref<PendingUser[]>([])
const loadingUsers = ref(true)
const selectedUser = ref<PendingUser | null>(null)
const userActionLoading = ref<number | string | null>(null)

// Titik State
interface PendingTitik {
  id: number | string
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
const titikActionLoading = ref<number | string | null>(null)

// Error / success
const successMsg = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

interface FormattedDetailItem {
  label: string
  value: string
}

function getOrderedInstansiDetails(detail?: Record<string, any>): FormattedDetailItem[] {
  if (!detail || typeof detail !== 'object') return []

  const items: FormattedDetailItem[] = []

  // 1. Perguruan Tinggi (Urutan: Nama Perguruan Tinggi, Fakultas, Jurusan, NIM)
  const namaPT = detail.namaPerguruanTinggi || detail.namaPT || detail.namaKampus || detail.nama
  const fakultas = detail.fakultas
  const jurusan = detail.jurusan
  const nim = detail.nim

  if (namaPT) items.push({ label: 'Nama Perguruan Tinggi', value: String(namaPT) })
  if (fakultas) items.push({ label: 'Fakultas', value: String(fakultas) })
  if (jurusan) items.push({ label: 'Jurusan', value: String(jurusan) })
  if (nim) items.push({ label: 'NIM', value: String(nim) })

  // 2. Sekolah (Urutan: Nama Sekolah, Kelas, NISN)
  const namaSekolah = detail.namaSekolah
  const kelas = detail.kelas
  const nisn = detail.nisn

  if (namaSekolah) items.push({ label: 'Nama Sekolah', value: String(namaSekolah) })
  if (kelas) items.push({ label: 'Kelas', value: String(kelas) })
  if (nisn) items.push({ label: 'NISN', value: String(nisn) })

  // 3. Komunitas (Urutan: Nama Komunitas, Peran, Media Sosial)
  const namaKomunitas = detail.namaKomunitas
  const peran = detail.peran
  const mediaSosial = detail.mediaSosial

  if (namaKomunitas) items.push({ label: 'Nama Komunitas', value: String(namaKomunitas) })
  if (peran) items.push({ label: 'Peran', value: String(peran) })
  if (mediaSosial) items.push({ label: 'Media Sosial', value: String(mediaSosial) })

  // 4. Lainnya (Urutan: Nama Lembaga, Deskripsi)
  const namaLembaga = detail.namaLembaga
  const deskripsi = detail.deskripsi

  if (namaLembaga && !items.some(i => i.value === String(namaLembaga))) {
    items.push({ label: 'Nama Lembaga', value: String(namaLembaga) })
  }
  if (deskripsi && !items.some(i => i.value === String(deskripsi))) {
    items.push({ label: 'Deskripsi', value: String(deskripsi) })
  }

  // Fallback untuk atribut custom lain jika ada
  const handledKeys = new Set([
    'namaperguruantinggi', 'namapt', 'namakampus', 'nama',
    'fakultas', 'jurusan', 'nim',
    'namasekolah', 'kelas', 'nisn',
    'namakomunitas', 'peran', 'mediasosial',
    'namalembaga', 'deskripsi'
  ])

  for (const [k, v] of Object.entries(detail)) {
    const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (v && !handledKeys.has(normalizedKey)) {
      const prettyKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
      items.push({ label: prettyKey, value: String(v) })
    }
  }

  return items
}

function getKtpUrl(user: PendingUser): string {
  const base = user.ktpUrl || (user.ktpPath ? `/api/uploads/ktp/${user.ktpPath}` : '')
  if (!base) return ''
  return authStore.token ? `${base}?token=${authStore.token}` : base
}

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

async function updateUserStatus(userId: number | string, status: 'VERIFIED' | 'REJECTED') {
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

async function updateTitikStatus(titikId: number | string, status: 'APPROVED' | 'REJECTED') {
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
      <div class="flex items-center gap-2 font-extrabold text-sm"><span class="px-1.5 py-0.5 bg-[#0D0D0D] text-[#00C566] text-[10px] font-black border border-[#0D0D0D]">BERHASIL</span> {{ successMsg }}</div>
      <button @click="successMsg = null" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 text-xs">✕</button>
    </div>
    <div v-if="errorMsg" class="border-3 border-[#0D0D0D] bg-[#FF3B3B] text-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
      <div class="flex items-center gap-2 font-extrabold text-sm"><span class="px-1.5 py-0.5 bg-white text-[#FF3B3B] text-[10px] font-black border border-white">PERINGATAN</span> {{ errorMsg }}</div>
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
        Verifikasi KTP
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
        Kurasi Titik Budaya
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
        <div class="w-10 h-10 mx-auto mb-2 border-2 border-[#0D0D0D] bg-[#00C566] text-[#0D0D0D] font-black text-sm flex items-center justify-center">OK</div>
        <p class="font-extrabold text-neutral-700">Semua pendaftar sudah terverifikasi!</p>
        <p class="text-xs font-medium text-neutral-500 mt-1">Tidak ada antrian user berstatus PENDING.</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="(user, index) in pendingUsers"
          :key="user.id"
          class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_#0D0D0D] space-y-4 transition-all duration-150 hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <!-- User Info Row -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <Badge variant="yellow" class="text-[10px]">PENDING VERIFIKASI</Badge>
                <span class="text-xs font-mono font-bold text-neutral-400">ID: #{{ index + 1 }}</span>
              </div>
              <h3 class="text-lg font-black uppercase text-[#0D0D0D]">{{ user.namaLengkap }}</h3>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs font-mono mt-2">
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">Email</span><br>{{ user.email }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">NIK (Dekripsi)</span><br>{{ user.nikDecrypted || user.nik }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">WhatsApp</span><br>{{ user.whatsapp }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">Instansi</span><br>{{ user.jenisInstansi }}</div>
              </div>
              <div v-if="getOrderedInstansiDetails(user.instansiDetail).length > 0" class="text-xs font-mono text-neutral-800 bg-[#FFFBF0] border border-[#0D0D0D] p-2.5 mt-2 max-w-md shadow-[2px_2px_0px_#0D0D0D]">
                <span class="font-black uppercase text-[10px] block mb-1 text-neutral-500">DETAIL INSTANSI:</span>
                <div class="space-y-1">
                  <div v-for="item in getOrderedInstansiDetails(user.instansiDetail)" :key="item.label" class="flex flex-wrap items-baseline gap-1">
                    <span class="font-bold text-[#0D0D0D]">{{ item.label }}:</span>
                    <span class="text-neutral-800">{{ item.value }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- KTP Preview -->
            <div v-if="getKtpUrl(user)" class="flex-shrink-0">
              <span class="text-[10px] font-black uppercase text-neutral-500 block mb-1">Foto KTP:</span>
              <a :href="getKtpUrl(user)" target="_blank">
                <img
                  :src="getKtpUrl(user)"
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
        <div class="w-10 h-10 mx-auto mb-2 border-2 border-[#0D0D0D] bg-[#FFE500] text-[#0D0D0D] font-black text-xs flex items-center justify-center">PETA</div>
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
            <span class="text-xs font-mono font-black text-neutral-400 uppercase tracking-widest">[FOTO TIDAK TERSEDIA]</span>
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
              Slang: {{ titik.slangTerkait }}
            </div>

            <div class="text-xs font-mono text-neutral-500 space-y-0.5">
              <div>Koordinat: {{ titik.lat?.toFixed(5) }}, {{ titik.lng?.toFixed(5) }}</div>
              <div v-if="titik.user">Etnografer: {{ titik.user.namaLengkap }} ({{ titik.user.email }})</div>
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
