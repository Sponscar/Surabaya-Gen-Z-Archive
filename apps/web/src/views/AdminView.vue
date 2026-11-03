<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useAuthStore } from '@/stores/auth'
import { api, apiFormData } from '@/lib/api'
import { findWilayahKeyByCoords } from '@/lib/surabaya-geo'

const router = useRouter()
const authStore = useAuthStore()

// Tab state
type AdminTab = 'users-verify' | 'users-all' | 'titik-budaya' | 'titik-sejarah' | 'slang' | 'komunitas'
const activeTab = ref<AdminTab>('users-verify')

// Global Notification State
const successMsg = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

// Confirmation Delete Modal State
interface DeleteConfirmState {
  isOpen: boolean
  title: string
  itemName: string
  itemType: string
  warningText: string
  loading: boolean
  action: () => Promise<void>
}

const deleteModal = ref<DeleteConfirmState>({
  isOpen: false,
  title: '',
  itemName: '',
  itemType: '',
  warningText: '',
  loading: false,
  action: async () => {},
})

function closeDeleteModal() {
  deleteModal.value.isOpen = false
}

async function runConfirmedDelete() {
  deleteModal.value.loading = true
  try {
    await deleteModal.value.action()
    deleteModal.value.isOpen = false
  } finally {
    deleteModal.value.loading = false
  }
}

function showSuccess(msg: string) {
  successMsg.value = msg
  errorMsg.value = null
  setTimeout(() => { if (successMsg.value === msg) successMsg.value = null }, 5000)
}

function showError(msg: string) {
  errorMsg.value = msg
  successMsg.value = null
}

// ==========================================
// 1. DATA PENGGUNA & VERIFIKASI KTP STATE
// ==========================================
interface UserItem {
  id: number
  email: string
  namaLengkap: string
  nik?: string
  nikDecrypted?: string
  ktpPath?: string
  ktpUrl?: string
  whatsapp: string
  alamatLengkap?: string
  jenisInstansi: string
  instansiDetail?: Record<string, any>
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | string
  isAdmin: boolean
  createdAt: string
  verifiedAt?: string
}

const allUsers = ref<UserItem[]>([])
const loadingUsers = ref(true)
const userActionLoading = ref<number | null>(null)
const userSearch = ref('')
const userStatusFilter = ref<string>('ALL')

const pendingUsers = computed(() => {
  return allUsers.value.filter((u) => u.status === 'PENDING')
})

const nonAdminUsers = computed(() => {
  return allUsers.value.filter((u) => !u.isAdmin)
})

const filteredAllUsers = computed(() => {
  return nonAdminUsers.value.filter((u) => {
    const matchStatus = userStatusFilter.value === 'ALL' || u.status === userStatusFilter.value
    if (!matchStatus) return false

    if (!userSearch.value.trim()) return true
    const q = userSearch.value.toLowerCase()
    const nameMatch = (u.namaLengkap || '').toLowerCase().includes(q)
    const emailMatch = (u.email || '').toLowerCase().includes(q)
    const nikMatch = (u.nikDecrypted || u.nik || '').toLowerCase().includes(q)
    const waMatch = (u.whatsapp || '').toLowerCase().includes(q)
    const instansiMatch = (u.jenisInstansi || '').toLowerCase().includes(q)
    return nameMatch || emailMatch || nikMatch || waMatch || instansiMatch
  })
})

interface FormattedDetailItem {
  label: string
  value: string
}

function getOrderedInstansiDetails(detail?: Record<string, any>): FormattedDetailItem[] {
  if (!detail || typeof detail !== 'object') return []
  const items: FormattedDetailItem[] = []

  const namaPT = detail.namaPerguruanTinggi || detail.namaPT || detail.namaKampus || detail.nama
  const fakultas = detail.fakultas
  const jurusan = detail.jurusan
  const nim = detail.nim

  if (namaPT) items.push({ label: 'Nama Perguruan Tinggi', value: String(namaPT) })
  if (fakultas) items.push({ label: 'Fakultas', value: String(fakultas) })
  if (jurusan) items.push({ label: 'Jurusan', value: String(jurusan) })
  if (nim) items.push({ label: 'NIM', value: String(nim) })

  const namaSekolah = detail.namaSekolah
  const kelas = detail.kelas
  const nisn = detail.nisn

  if (namaSekolah) items.push({ label: 'Nama Sekolah', value: String(namaSekolah) })
  if (kelas) items.push({ label: 'Kelas', value: String(kelas) })
  if (nisn) items.push({ label: 'NISN', value: String(nisn) })

  const namaKomunitas = detail.namaKomunitas
  const peran = detail.peran
  const mediaSosial = detail.mediaSosial

  if (namaKomunitas) items.push({ label: 'Nama Komunitas', value: String(namaKomunitas) })
  if (peran) items.push({ label: 'Peran', value: String(peran) })
  if (mediaSosial) items.push({ label: 'Media Sosial', value: String(mediaSosial) })

  const namaLembaga = detail.namaLembaga
  const deskripsi = detail.deskripsi

  if (namaLembaga && !items.some((i) => i.value === String(namaLembaga))) {
    items.push({ label: 'Nama Lembaga', value: String(namaLembaga) })
  }
  if (deskripsi && !items.some((i) => i.value === String(deskripsi))) {
    items.push({ label: 'Deskripsi', value: String(deskripsi) })
  }

  const handledKeys = new Set([
    'namaperguruantinggi', 'namapt', 'namakampus', 'nama',
    'fakultas', 'jurusan', 'nim',
    'namasekolah', 'kelas', 'nisn',
    'namakomunitas', 'peran', 'mediasosial',
    'namalembaga', 'deskripsi',
  ])

  for (const [k, v] of Object.entries(detail)) {
    const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (v && !handledKeys.has(normalizedKey)) {
      const prettyKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()
      items.push({ label: prettyKey, value: String(v) })
    }
  }

  return items
}

function getKtpUrl(user: UserItem): string {
  const base = user.ktpUrl || (user.ktpPath ? `/api/uploads/ktp/${user.ktpPath}` : '')
  if (!base) return ''
  return authStore.token ? `${base}?token=${authStore.token}` : base
}

async function loadUsers() {
  loadingUsers.value = true
  try {
    const res = await api.get<UserItem[]>('/admin/users')
    allUsers.value = res.data
  } catch (err: any) {
    allUsers.value = []
  } finally {
    loadingUsers.value = false
  }
}

async function updateUserStatus(userId: number, status: 'VERIFIED' | 'REJECTED' | 'PENDING') {
  userActionLoading.value = userId
  try {
    await api.patch(`/admin/users/${userId}/status`, { status })
    showSuccess(`Status user berhasil diubah menjadi ${status}.`)
    await loadUsers()
  } catch (e: any) {
    showError(e.response?.data?.message || 'Gagal mengubah status user.')
  } finally {
    userActionLoading.value = null
  }
}

function deleteUser(userId: number, name: string) {
  deleteModal.value = {
    isOpen: true,
    title: 'HAPUS DATA PENGGUNA',
    itemName: name,
    itemType: 'PENGGUNA / ETNOGRAFER',
    warningText: 'Data akun pengguna ini akan dihapus secara permanen dari basis data SGZA. Tindakan ini tidak dapat dibatalkan.',
    loading: false,
    action: async () => {
      userActionLoading.value = userId
      try {
        await api.delete(`/admin/users/${userId}`)
        showSuccess(`Pengguna "${name}" berhasil dihapus.`)
        await loadUsers()
      } catch (e: any) {
        showError(e.response?.data?.message || 'Gagal menghapus pengguna.')
      } finally {
        userActionLoading.value = null
      }
    },
  }
}

// ==========================================
// 2. TITIK BUDAYA CRUD STATE
// ==========================================
interface TitikBudayaItem {
  id: number
  wilayahId?: number
  judul: string
  deskripsi: string
  alamat?: string
  slangTerkait?: string
  fotoPath?: string
  lat: number
  lng: number
  status: string
  createdAt: string
  reviewedAt?: string
  wilayah?: { id: number; nama: string }
  user?: { id: number; namaLengkap: string; email: string }
}

const titikBudayaList = ref<TitikBudayaItem[]>([])
const loadingTitik = ref(true)
const titikActionLoading = ref<number | null>(null)
const titikStatusFilter = ref<string>('ALL')

const filteredTitikBudaya = computed(() => {
  if (titikStatusFilter.value === 'ALL') return titikBudayaList.value
  return titikBudayaList.value.filter((t) => t.status === titikStatusFilter.value)
})

function getTitikFotoUrl(path?: string): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/api/uploads/titik/')) return path
  if (path.startsWith('/uploads/titik/')) return `/api${path}`
  if (path.startsWith('/')) return path
  return `/api/uploads/titik/${path}`
}

async function loadTitikBudaya() {
  loadingTitik.value = true
  try {
    const res = await api.get<TitikBudayaItem[]>('/admin/titik-budaya')
    titikBudayaList.value = res.data
  } catch {
    titikBudayaList.value = []
  } finally {
    loadingTitik.value = false
  }
}

function getWilayahIdFromKey(key: string | null): number | null {
  if (!key) return null
  switch (key.toUpperCase()) {
    case 'BARAT': return 1
    case 'TIMUR': return 2
    case 'SELATAN': return 3
    case 'UTARA': return 4
    case 'PUSAT': return 5
    default: return null
  }
}

function createBudayaMarkerIcon() {
  return L.divIcon({
    className: 'custom-cultural-marker-wrap',
    html: `
      <div class="sgza-pin-budaya" style="cursor: grab;" title="Titik Budaya Arek Suroboyo">
        <div class="sgza-pin-head">
          <span class="sgza-pin-label">BUDAYA</span>
          <div class="sgza-pin-icon">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z" fill="#0D0D0D"/>
              <circle cx="12" cy="12" r="3" fill="#FFE500"/>
              <circle cx="12" cy="12" r="1.5" fill="#00C566"/>
            </svg>
          </div>
        </div>
        <div class="sgza-pin-pointer"></div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
  })
}

function createSejarahMarkerIcon() {
  return L.divIcon({
    className: 'custom-sejarah-marker-wrap',
    html: `
      <div class="sgza-pin-sejarah" style="cursor: grab;" title="Titik Sejarah Kota">
        <div class="sgza-pin-head">
          <span class="sgza-pin-label">SEJARAH</span>
          <div class="sgza-pin-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 21H19V18H5V21Z" fill="#0D0D0D"/>
              <path d="M7 18H17V16H7V18Z" fill="#0D0D0D"/>
              <path d="M9 16L11 4C11 3 13 3 13 4L15 16H9Z" fill="#0D0D0D"/>
              <path d="M12 1L13 4H11L12 1Z" fill="#FF3B3B"/>
              <line x1="12" y1="5" x2="12" y2="15" stroke="#FFE500" stroke-width="1.2"/>
            </svg>
          </div>
        </div>
        <div class="sgza-pin-pointer"></div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
  })
}

// Modal Titik Budaya
const isTitikModalOpen = ref(false)
const isEditTitikMode = ref(false)
const titikFormId = ref<number | null>(null)
const formTitikJudul = ref('')
const formTitikDeskripsi = ref('')
const formTitikAlamat = ref('')
const formTitikSlang = ref('')
const formTitikWilayahId = ref<number>(1)
const formTitikLat = ref<number>(-7.2575)
const formTitikLng = ref<number>(112.7521)
const formTitikFoto = ref<File | null>(null)
const formTitikFotoPreview = ref<string | null>(null)
const formTitikStatus = ref<string>('APPROVED')

// Titik Budaya Mini Map State
const titikMiniMapContainer = ref<HTMLDivElement | null>(null)
let titikMiniMapInstance: L.Map | null = null
let titikMiniMapMarker: L.Marker | null = null
const isTitikMiniMapVisible = ref(false)
const isTitikSearchingAddress = ref(false)
const titikAddressMsg = ref<string | null>(null)
const titikAddressErr = ref<string | null>(null)

function initOrUpdateTitikMiniMap(lat: number, lng: number) {
  isTitikMiniMapVisible.value = true
  nextTick(() => {
    if (!titikMiniMapContainer.value) return
    if (!titikMiniMapInstance) {
      titikMiniMapInstance = L.map(titikMiniMapContainer.value, {
        zoomControl: true,
        attributionControl: false,
      }).setView([lat, lng], 16)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(titikMiniMapInstance)

      titikMiniMapMarker = L.marker([lat, lng], {
        draggable: true,
        icon: createBudayaMarkerIcon(),
      }).addTo(titikMiniMapInstance)

      titikMiniMapMarker.on('dragend', () => {
        if (!titikMiniMapMarker) return
        const pos = titikMiniMapMarker.getLatLng()
        formTitikLat.value = parseFloat(pos.lat.toFixed(6))
        formTitikLng.value = parseFloat(pos.lng.toFixed(6))
        const key = findWilayahKeyByCoords(formTitikLat.value, formTitikLng.value)
        const id = getWilayahIdFromKey(key)
        if (id) formTitikWilayahId.value = id
      })

      titikMiniMapInstance.on('click', (e: L.LeafletMouseEvent) => {
        formTitikLat.value = parseFloat(e.latlng.lat.toFixed(6))
        formTitikLng.value = parseFloat(e.latlng.lng.toFixed(6))
        titikMiniMapMarker?.setLatLng(e.latlng)
        const key = findWilayahKeyByCoords(formTitikLat.value, formTitikLng.value)
        const id = getWilayahIdFromKey(key)
        if (id) formTitikWilayahId.value = id
      })
    } else {
      titikMiniMapInstance.setView([lat, lng], 16)
      titikMiniMapMarker?.setLatLng([lat, lng])
      titikMiniMapInstance.invalidateSize()
    }
    setTimeout(() => {
      titikMiniMapInstance?.invalidateSize()
    }, 150)
  })
}

function destroyTitikMiniMap() {
  if (titikMiniMapInstance) {
    titikMiniMapInstance.remove()
    titikMiniMapInstance = null
    titikMiniMapMarker = null
  }
  isTitikMiniMapVisible.value = false
  titikAddressMsg.value = null
  titikAddressErr.value = null
}

async function searchTitikAddress() {
  if (!formTitikAlamat.value.trim()) {
    titikAddressErr.value = 'Ketik alamat terlebih dahulu untuk mencari titik koordinat.'
    return
  }
  isTitikSearchingAddress.value = true
  titikAddressErr.value = null
  titikAddressMsg.value = null

  try {
    const query = formTitikAlamat.value.toLowerCase().includes('surabaya')
      ? formTitikAlamat.value
      : `${formTitikAlamat.value}, Surabaya, Jawa Timur`

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=id`,
      { headers: { Accept: 'application/json' } },
    )
    if (res.ok) {
      const results = await res.json()
      if (results && results.length > 0) {
        const item = results[0]
        const lat = parseFloat(parseFloat(item.lat).toFixed(6))
        const lng = parseFloat(parseFloat(item.lon).toFixed(6))
        formTitikLat.value = lat
        formTitikLng.value = lng

        const detectedKey = findWilayahKeyByCoords(lat, lng)
        const detectedId = getWilayahIdFromKey(detectedKey)
        if (detectedId) formTitikWilayahId.value = detectedId

        initOrUpdateTitikMiniMap(lat, lng)
        titikAddressMsg.value = 'Titik lokasi berhasil ditemukan di peta!'
      } else {
        titikAddressErr.value = 'Alamat tidak ditemukan di peta Surabaya. Coba gunakan nama jalan/gedung yang lebih spesifik.'
      }
    } else {
      titikAddressErr.value = 'Layanan pencarian peta sedang sibuk. Coba lagi.'
    }
  } catch (err) {
    console.warn('Geocoding error:', err)
    titikAddressErr.value = 'Gagal mencari koordinat alamat. Periksa koneksi internet.'
  } finally {
    isTitikSearchingAddress.value = false
  }
}

function openCreateTitikModal() {
  destroyTitikMiniMap()
  isEditTitikMode.value = false
  titikFormId.value = null
  formTitikJudul.value = ''
  formTitikDeskripsi.value = ''
  formTitikAlamat.value = ''
  formTitikSlang.value = ''
  formTitikWilayahId.value = 1
  formTitikLat.value = -7.2575
  formTitikLng.value = 112.7521
  formTitikFoto.value = null
  formTitikFotoPreview.value = null
  formTitikStatus.value = 'APPROVED'
  isTitikModalOpen.value = true
}

function openEditTitikModal(item: TitikBudayaItem) {
  destroyTitikMiniMap()
  isEditTitikMode.value = true
  titikFormId.value = item.id
  formTitikJudul.value = item.judul
  formTitikDeskripsi.value = item.deskripsi
  formTitikAlamat.value = item.alamat || ''
  formTitikSlang.value = item.slangTerkait || ''
  formTitikWilayahId.value = item.wilayahId || item.wilayah?.id || 1
  formTitikLat.value = item.lat
  formTitikLng.value = item.lng
  formTitikFoto.value = null
  formTitikFotoPreview.value = item.fotoPath ? getTitikFotoUrl(item.fotoPath) : null
  formTitikStatus.value = item.status || 'APPROVED'
  isTitikModalOpen.value = true
  if (typeof item.lat === 'number' && typeof item.lng === 'number') {
    initOrUpdateTitikMiniMap(item.lat, item.lng)
  }
}

function handleTitikFotoChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    formTitikFoto.value = target.files[0]
    formTitikFotoPreview.value = URL.createObjectURL(target.files[0])
  }
}

async function saveTitikBudaya() {
  if (!formTitikJudul.value || !formTitikDeskripsi.value || !formTitikAlamat.value.trim()) {
    showError('Judul, Deskripsi, dan Alamat Lengkap wajib diisi.')
    return
  }

  titikActionLoading.value = titikFormId.value || 999999
  try {
    const formData = new FormData()
    formData.append('judul', formTitikJudul.value)
    formData.append('deskripsi', formTitikDeskripsi.value)
    formData.append('alamat', formTitikAlamat.value || '')
    formData.append('slangTerkait', formTitikSlang.value || '')
    formData.append('wilayahId', String(formTitikWilayahId.value))
    formData.append('lat', String(formTitikLat.value))
    formData.append('lng', String(formTitikLng.value))
    formData.append('status', formTitikStatus.value)

    if (formTitikFoto.value) {
      formData.append('foto', formTitikFoto.value)
    }

    if (isEditTitikMode.value && titikFormId.value) {
      // Gunakan fetch native via apiFormData untuk menghindari konflik axios Content-Type boundary
      await apiFormData('PATCH', `/admin/titik-budaya/${titikFormId.value}`, formData)
      showSuccess('Titik budaya dan foto berhasil diperbarui!')
    } else {
      await apiFormData('POST', '/admin/titik-budaya', formData)
      showSuccess('Titik budaya baru berhasil ditambahkan!')
    }

    isTitikModalOpen.value = false
    await loadTitikBudaya()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Gagal menyimpan titik budaya.')
  } finally {
    titikActionLoading.value = null
  }
}

function deleteTitikBudaya(id: number, judul: string) {
  deleteModal.value = {
    isOpen: true,
    title: 'HAPUS TITIK BUDAYA',
    itemName: judul,
    itemType: 'TITIK BUDAYA SURABAYA',
    warningText: 'Titik budaya ini beserta koordinat, arsip foto, dan narasi kulturnya akan dihapus permanen dari sistem.',
    loading: false,
    action: async () => {
      titikActionLoading.value = id
      try {
        await api.delete(`/admin/titik-budaya/${id}`)
        showSuccess(`Titik budaya "${judul}" berhasil dihapus.`)
        await loadTitikBudaya()
      } catch (e: any) {
        showError(e.response?.data?.message || 'Gagal menghapus titik budaya.')
      } finally {
        titikActionLoading.value = null
      }
    },
  }
}

async function quickUpdateTitikStatus(titikId: number, status: 'APPROVED' | 'REJECTED') {
  titikActionLoading.value = titikId
  try {
    await api.patch(`/admin/titik-budaya/${titikId}/status`, { status })
    showSuccess(`Titik budaya berhasil di-${status === 'APPROVED' ? 'approve' : 'tolak'}.`)
    await loadTitikBudaya()
  } catch (e: any) {
    showError(e.response?.data?.message || 'Gagal mengubah status titik.')
  } finally {
    titikActionLoading.value = null
  }
}

// ==========================================
// 3. TITIK SEJARAH CRUD STATE
// ==========================================
interface TitikSejarahItem {
  id: number
  wilayahId: number
  namaLokasi: string
  deskripsi: string
  alamat?: string
  fotoUrl?: string
  lat: number
  lng: number
  wilayah?: { id: number; nama: string }
}

const titikSejarahList = ref<TitikSejarahItem[]>([])
const loadingSejarah = ref(true)
const sejarahActionLoading = ref<number | null>(null)
const sejarahWilayahFilter = ref<string>('ALL')

const filteredTitikSejarah = computed(() => {
  if (sejarahWilayahFilter.value === 'ALL') return titikSejarahList.value
  return titikSejarahList.value.filter((s) => String(s.wilayahId || s.wilayah?.id) === sejarahWilayahFilter.value)
})

async function loadTitikSejarah() {
  loadingSejarah.value = true
  try {
    const res = await api.get<TitikSejarahItem[]>('/admin/titik-sejarah')
    titikSejarahList.value = res.data
  } catch {
    titikSejarahList.value = []
  } finally {
    loadingSejarah.value = false
  }
}

// Modal Sejarah
const isSejarahModalOpen = ref(false)
const isEditSejarahMode = ref(false)
const sejarahFormId = ref<number | null>(null)
const formSejarahNama = ref('')
const formSejarahDeskripsi = ref('')
const formSejarahAlamat = ref('')
const formSejarahWilayahId = ref<number>(1)
const formSejarahLat = ref<number>(-7.2575)
const formSejarahLng = ref<number>(112.7521)
const formSejarahFoto = ref<File | null>(null)
const formSejarahFotoPreview = ref<string | null>(null)

// Titik Sejarah Mini Map State
const sejarahMiniMapContainer = ref<HTMLDivElement | null>(null)
let sejarahMiniMapInstance: L.Map | null = null
let sejarahMiniMapMarker: L.Marker | null = null
const isSejarahMiniMapVisible = ref(false)
const isSejarahSearchingAddress = ref(false)
const sejarahAddressMsg = ref<string | null>(null)
const sejarahAddressErr = ref<string | null>(null)

function initOrUpdateSejarahMiniMap(lat: number, lng: number) {
  isSejarahMiniMapVisible.value = true
  nextTick(() => {
    if (!sejarahMiniMapContainer.value) return
    if (!sejarahMiniMapInstance) {
      sejarahMiniMapInstance = L.map(sejarahMiniMapContainer.value, {
        zoomControl: true,
        attributionControl: false,
      }).setView([lat, lng], 16)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(sejarahMiniMapInstance)

      sejarahMiniMapMarker = L.marker([lat, lng], {
        draggable: true,
        icon: createSejarahMarkerIcon(),
      }).addTo(sejarahMiniMapInstance)

      sejarahMiniMapMarker.on('dragend', () => {
        if (!sejarahMiniMapMarker) return
        const pos = sejarahMiniMapMarker.getLatLng()
        formSejarahLat.value = parseFloat(pos.lat.toFixed(6))
        formSejarahLng.value = parseFloat(pos.lng.toFixed(6))
        const key = findWilayahKeyByCoords(formSejarahLat.value, formSejarahLng.value)
        const id = getWilayahIdFromKey(key)
        if (id) formSejarahWilayahId.value = id
      })

      sejarahMiniMapInstance.on('click', (e: L.LeafletMouseEvent) => {
        formSejarahLat.value = parseFloat(e.latlng.lat.toFixed(6))
        formSejarahLng.value = parseFloat(e.latlng.lng.toFixed(6))
        sejarahMiniMapMarker?.setLatLng(e.latlng)
        const key = findWilayahKeyByCoords(formSejarahLat.value, formSejarahLng.value)
        const id = getWilayahIdFromKey(key)
        if (id) formSejarahWilayahId.value = id
      })
    } else {
      sejarahMiniMapInstance.setView([lat, lng], 16)
      sejarahMiniMapMarker?.setLatLng([lat, lng])
      sejarahMiniMapInstance.invalidateSize()
    }
    setTimeout(() => {
      sejarahMiniMapInstance?.invalidateSize()
    }, 150)
  })
}

function destroySejarahMiniMap() {
  if (sejarahMiniMapInstance) {
    sejarahMiniMapInstance.remove()
    sejarahMiniMapInstance = null
    sejarahMiniMapMarker = null
  }
  isSejarahMiniMapVisible.value = false
  sejarahAddressMsg.value = null
  sejarahAddressErr.value = null
}

async function searchSejarahAddress() {
  if (!formSejarahAlamat.value.trim()) {
    sejarahAddressErr.value = 'Ketik alamat terlebih dahulu untuk mencari titik koordinat.'
    return
  }
  isSejarahSearchingAddress.value = true
  sejarahAddressErr.value = null
  sejarahAddressMsg.value = null

  try {
    const query = formSejarahAlamat.value.toLowerCase().includes('surabaya')
      ? formSejarahAlamat.value
      : `${formSejarahAlamat.value}, Surabaya, Jawa Timur`

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=id`,
      { headers: { Accept: 'application/json' } },
    )
    if (res.ok) {
      const results = await res.json()
      if (results && results.length > 0) {
        const item = results[0]
        const lat = parseFloat(parseFloat(item.lat).toFixed(6))
        const lng = parseFloat(parseFloat(item.lon).toFixed(6))
        formSejarahLat.value = lat
        formSejarahLng.value = lng

        const detectedKey = findWilayahKeyByCoords(lat, lng)
        const detectedId = getWilayahIdFromKey(detectedKey)
        if (detectedId) formSejarahWilayahId.value = detectedId

        initOrUpdateSejarahMiniMap(lat, lng)
        sejarahAddressMsg.value = 'Titik lokasi sejarah berhasil ditemukan di peta!'
      } else {
        sejarahAddressErr.value = 'Alamat tidak ditemukan di peta Surabaya. Coba gunakan nama jalan/gedung yang lebih spesifik.'
      }
    } else {
      sejarahAddressErr.value = 'Layanan pencarian peta sedang sibuk. Coba lagi.'
    }
  } catch (err) {
    console.warn('Geocoding error:', err)
    sejarahAddressErr.value = 'Gagal mencari koordinat alamat. Periksa koneksi internet.'
  } finally {
    isSejarahSearchingAddress.value = false
  }
}

function handleSejarahFotoChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    formSejarahFoto.value = target.files[0]
    formSejarahFotoPreview.value = URL.createObjectURL(target.files[0])
  }
}

function openCreateSejarahModal() {
  destroySejarahMiniMap()
  isEditSejarahMode.value = false
  sejarahFormId.value = null
  formSejarahNama.value = ''
  formSejarahDeskripsi.value = ''
  formSejarahAlamat.value = ''
  formSejarahWilayahId.value = 1
  formSejarahLat.value = -7.2575
  formSejarahLng.value = 112.7521
  formSejarahFoto.value = null
  formSejarahFotoPreview.value = null
  isSejarahModalOpen.value = true
}

function openEditSejarahModal(item: TitikSejarahItem) {
  destroySejarahMiniMap()
  isEditSejarahMode.value = true
  sejarahFormId.value = item.id
  formSejarahNama.value = item.namaLokasi
  formSejarahDeskripsi.value = item.deskripsi
  formSejarahAlamat.value = item.alamat || ''
  formSejarahWilayahId.value = item.wilayahId || item.wilayah?.id || 1
  formSejarahLat.value = item.lat
  formSejarahLng.value = item.lng
  formSejarahFoto.value = null
  formSejarahFotoPreview.value = item.fotoUrl ? getTitikFotoUrl(item.fotoUrl) : null
  isSejarahModalOpen.value = true
  if (typeof item.lat === 'number' && typeof item.lng === 'number') {
    initOrUpdateSejarahMiniMap(item.lat, item.lng)
  }
}

async function saveTitikSejarah() {
  if (!formSejarahNama.value || !formSejarahDeskripsi.value || !formSejarahAlamat.value.trim()) {
    showError('Nama Lokasi, Deskripsi, dan Alamat Lengkap wajib diisi.')
    return
  }
  sejarahActionLoading.value = sejarahFormId.value || 999999
  try {
    const formData = new FormData()
    formData.append('namaLokasi', formSejarahNama.value)
    formData.append('deskripsi', formSejarahDeskripsi.value)
    formData.append('alamat', formSejarahAlamat.value || '')
    formData.append('wilayahId', String(formSejarahWilayahId.value))
    formData.append('lat', String(formSejarahLat.value))
    formData.append('lng', String(formSejarahLng.value))

    if (formSejarahFoto.value) {
      formData.append('foto', formSejarahFoto.value)
    }

    if (isEditSejarahMode.value && sejarahFormId.value) {
      await apiFormData('PATCH', `/admin/titik-sejarah/${sejarahFormId.value}`, formData)
      showSuccess('Titik sejarah dan foto berhasil diperbarui!')
    } else {
      await apiFormData('POST', '/admin/titik-sejarah', formData)
      showSuccess('Titik sejarah baru berhasil ditambahkan!')
    }

    isSejarahModalOpen.value = false
    await loadTitikSejarah()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Gagal menyimpan titik sejarah.')
  } finally {
    sejarahActionLoading.value = null
  }
}

function deleteTitikSejarah(id: number, nama: string) {
  deleteModal.value = {
    isOpen: true,
    title: 'HAPUS TITIK SEJARAH',
    itemName: nama,
    itemType: 'TITIK SEJARAH (HERITAGE)',
    warningText: 'Titik sejarah ini beserta arsip cagar budayanya akan dihapus permanen dari basis data SGZA.',
    loading: false,
    action: async () => {
      sejarahActionLoading.value = id
      try {
        await api.delete(`/admin/titik-sejarah/${id}`)
        showSuccess(`Titik sejarah "${nama}" berhasil dihapus.`)
        await loadTitikSejarah()
      } catch (e: any) {
        showError(e.response?.data?.message || 'Gagal menghapus titik sejarah.')
      } finally {
        sejarahActionLoading.value = null
      }
    },
  }
}

// ==========================================
// 4. KAMUS SLANG CRUD STATE
// ==========================================
interface SlangItem {
  id: number
  istilah: string
  arti: string
  contoh: string
  kategori?: string
  createdAt: string
}

const slangList = ref<SlangItem[]>([])
const loadingSlang = ref(true)
const slangActionLoading = ref<number | null>(null)

async function loadSlang() {
  loadingSlang.value = true
  try {
    const res = await api.get<SlangItem[]>('/admin/slang')
    slangList.value = res.data
  } catch {
    slangList.value = []
  } finally {
    loadingSlang.value = false
  }
}

// Modal Slang
const isSlangModalOpen = ref(false)
const isEditSlangMode = ref(false)
const slangFormId = ref<number | null>(null)
const formSlangIstilah = ref('')
const formSlangArti = ref('')
const formSlangContoh = ref('')
const formSlangKategori = ref('Umum')

function openCreateSlangModal() {
  isEditSlangMode.value = false
  slangFormId.value = null
  formSlangIstilah.value = ''
  formSlangArti.value = ''
  formSlangContoh.value = ''
  formSlangKategori.value = 'Umum'
  isSlangModalOpen.value = true
}

function openEditSlangModal(item: SlangItem) {
  isEditSlangMode.value = true
  slangFormId.value = item.id
  formSlangIstilah.value = item.istilah
  formSlangArti.value = item.arti
  formSlangContoh.value = item.contoh
  formSlangKategori.value = item.kategori || 'Umum'
  isSlangModalOpen.value = true
}

async function saveSlang() {
  if (!formSlangIstilah.value || !formSlangArti.value || !formSlangContoh.value) {
    showError('Istilah, Arti, dan Contoh kalimat wajib diisi.')
    return
  }
  slangActionLoading.value = slangFormId.value || 999999
  try {
    const payload = {
      istilah: formSlangIstilah.value,
      arti: formSlangArti.value,
      contoh: formSlangContoh.value,
      kategori: formSlangKategori.value,
    }

    if (isEditSlangMode.value && slangFormId.value) {
      await api.patch(`/admin/slang/${slangFormId.value}`, payload)
      showSuccess(`Slang '${formSlangIstilah.value}' berhasil diperbarui!`)
    } else {
      await api.post('/admin/slang', payload)
      showSuccess(`Slang '${formSlangIstilah.value}' berhasil ditambahkan!`)
    }

    isSlangModalOpen.value = false
    await loadSlang()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Gagal menyimpan data slang.')
  } finally {
    slangActionLoading.value = null
  }
}

function deleteSlang(id: number, istilah: string) {
  deleteModal.value = {
    isOpen: true,
    title: 'HAPUS ISTILAH SLANG',
    itemName: istilah,
    itemType: 'KAMUS SUROBOYOAN',
    warningText: 'Istilah slang ini beserta contoh kalimatnya akan dihapus permanen dari kamus publik SGZA.',
    loading: false,
    action: async () => {
      slangActionLoading.value = id
      try {
        await api.delete(`/admin/slang/${id}`)
        showSuccess(`Slang "${istilah}" berhasil dihapus.`)
        await loadSlang()
      } catch (e: any) {
        showError(e.response?.data?.message || 'Gagal menghapus slang.')
      } finally {
        slangActionLoading.value = null
      }
    },
  }
}

// ==========================================
// 5. KOMUNITAS CRUD STATE
// ==========================================
interface KomunitasItem {
  id: number
  nama: string
  kategori: string
  deskripsi: string
  kontak?: string
  wilayahId?: number
  wilayahNama?: string
  createdAt: string
}

const komunitasList = ref<KomunitasItem[]>([])
const loadingKomunitas = ref(true)
const komunitasActionLoading = ref<number | null>(null)

async function loadKomunitas() {
  loadingKomunitas.value = true
  try {
    const res = await api.get<KomunitasItem[]>('/admin/komunitas')
    komunitasList.value = res.data
  } catch {
    komunitasList.value = []
  } finally {
    loadingKomunitas.value = false
  }
}

// Modal Komunitas
const isKomunitasModalOpen = ref(false)
const isEditKomunitasMode = ref(false)
const komunitasFormId = ref<number | null>(null)
const formKomunitasNama = ref('')
const formKomunitasKategori = ref('Kolektif Seni & Mural')
const formKomunitasDeskripsi = ref('')
const formKomunitasKontak = ref('')
const formKomunitasWilayahId = ref<number | null>(null)

function openCreateKomunitasModal() {
  isEditKomunitasMode.value = false
  komunitasFormId.value = null
  formKomunitasNama.value = ''
  formKomunitasKategori.value = 'Kolektif Seni & Mural'
  formKomunitasDeskripsi.value = ''
  formKomunitasKontak.value = ''
  formKomunitasWilayahId.value = 5
  isKomunitasModalOpen.value = true
}

function openEditKomunitasModal(item: KomunitasItem) {
  isEditKomunitasMode.value = true
  komunitasFormId.value = item.id
  formKomunitasNama.value = item.nama
  formKomunitasKategori.value = item.kategori
  formKomunitasDeskripsi.value = item.deskripsi
  formKomunitasKontak.value = item.kontak || ''
  formKomunitasWilayahId.value = item.wilayahId || null
  isKomunitasModalOpen.value = true
}

async function saveKomunitas() {
  if (!formKomunitasNama.value || !formKomunitasDeskripsi.value) {
    showError('Nama Komunitas dan Deskripsi wajib diisi.')
    return
  }
  komunitasActionLoading.value = komunitasFormId.value || 999999
  try {
    const payload = {
      nama: formKomunitasNama.value,
      kategori: formKomunitasKategori.value,
      deskripsi: formKomunitasDeskripsi.value,
      kontak: formKomunitasKontak.value,
      wilayahId: formKomunitasWilayahId.value,
    }

    if (isEditKomunitasMode.value && komunitasFormId.value) {
      await api.patch(`/admin/komunitas/${komunitasFormId.value}`, payload)
      showSuccess(`Komunitas '${formKomunitasNama.value}' berhasil diperbarui!`)
    } else {
      await api.post('/admin/komunitas', payload)
      showSuccess(`Komunitas '${formKomunitasNama.value}' berhasil ditambahkan!`)
    }

    isKomunitasModalOpen.value = false
    await loadKomunitas()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Gagal menyimpan data komunitas.')
  } finally {
    komunitasActionLoading.value = null
  }
}

function deleteKomunitas(id: number, nama: string) {
  deleteModal.value = {
    isOpen: true,
    title: 'HAPUS DATA KOMUNITAS',
    itemName: nama,
    itemType: 'DIREKTORI KOMUNITAS',
    warningText: 'Data komunitas ini beserta kontaknya akan dihapus permanen dari direktori publik SGZA.',
    loading: false,
    action: async () => {
      komunitasActionLoading.value = id
      try {
        await api.delete(`/admin/komunitas/${id}`)
        showSuccess(`Komunitas "${nama}" berhasil dihapus.`)
        await loadKomunitas()
      } catch (e: any) {
        showError(e.response?.data?.message || 'Gagal menghapus komunitas.')
      } finally {
        komunitasActionLoading.value = null
      }
    },
  }
}

// Redirect if not admin & load initial data
onMounted(async () => {
  if (!authStore.isAuthenticated || !authStore.isAdmin) {
    router.push('/login')
    return
  }
  await Promise.all([
    loadUsers(),
    loadTitikBudaya(),
    loadTitikSejarah(),
    loadSlang(),
    loadKomunitas(),
  ])
})

onUnmounted(() => {
  destroyTitikMiniMap()
  destroySejarahMiniMap()
})
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
        <h1 class="text-3xl font-black uppercase text-white">Panel Validator & Manajemen SGZA</h1>
        <p class="text-sm font-bold text-white/90">Kurasi KTP Warga, Moderasi Titik Budaya, Sejarah, Slang, & Direktori Komunitas</p>
      </div>
      <div class="text-right">
        <p class="text-xs font-mono font-bold text-white/70">Masuk sebagai</p>
        <p class="font-black text-sm">{{ authStore.user?.namaLengkap }}</p>
      </div>
    </div>

    <!-- Notifications -->
    <div v-if="successMsg" class="border-3 border-[#0D0D0D] bg-[#00C566] text-[#0D0D0D] p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
      <div class="flex items-center gap-2 font-extrabold text-sm">
        <span class="px-1.5 py-0.5 bg-[#0D0D0D] text-[#00C566] text-[10px] font-black border border-[#0D0D0D]">BERHASIL</span>
        {{ successMsg }}
      </div>
      <button @click="successMsg = null" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 text-xs cursor-pointer">✕</button>
    </div>
    <div v-if="errorMsg" class="border-3 border-[#0D0D0D] bg-[#FF3B3B] text-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
      <div class="flex items-center gap-2 font-extrabold text-sm">
        <span class="px-1.5 py-0.5 bg-white text-[#FF3B3B] text-[10px] font-black border border-white">PERINGATAN</span>
        {{ errorMsg }}
      </div>
      <button @click="errorMsg = null" class="border-2 border-white bg-white/10 font-black px-2 py-0.5 text-xs text-white cursor-pointer">✕</button>
    </div>

    <!-- Tab Navigation (6 Tabs) -->
    <div class="flex flex-wrap items-center gap-0 border-3 border-[#0D0D0D] bg-white shadow-[4px_4px_0px_#0D0D0D]">
      <button
        @click="activeTab = 'users-verify'"
        :class="[
          'px-4 py-2.5 text-xs sm:text-sm font-black uppercase border-r-2 border-[#0D0D0D] transition-colors cursor-pointer',
          activeTab === 'users-verify' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        Verifikasi KTP
        <span v-if="pendingUsers.length > 0" class="ml-1.5 bg-[#FF3B3B] text-white text-[10px] font-black px-1.5 py-0.5 border border-[#0D0D0D]">
          {{ pendingUsers.length }}
        </span>
      </button>

      <button
        @click="activeTab = 'users-all'"
        :class="[
          'px-4 py-2.5 text-xs sm:text-sm font-black uppercase border-r-2 border-[#0D0D0D] transition-colors cursor-pointer',
          activeTab === 'users-all' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        Data Pengguna
        <span class="ml-1.5 text-[11px] font-mono">({{ nonAdminUsers.length }})</span>
      </button>

      <button
        @click="activeTab = 'titik-budaya'"
        :class="[
          'px-4 py-2.5 text-xs sm:text-sm font-black uppercase border-r-2 border-[#0D0D0D] transition-colors cursor-pointer',
          activeTab === 'titik-budaya' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        Titik Budaya
        <span class="ml-1.5 text-[11px] font-mono">({{ titikBudayaList.length }})</span>
      </button>

      <button
        @click="activeTab = 'titik-sejarah'"
        :class="[
          'px-4 py-2.5 text-xs sm:text-sm font-black uppercase border-r-2 border-[#0D0D0D] transition-colors cursor-pointer',
          activeTab === 'titik-sejarah' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        Titik Sejarah
        <span class="ml-1.5 text-[11px] font-mono">({{ titikSejarahList.length }})</span>
      </button>

      <button
        @click="activeTab = 'slang'"
        :class="[
          'px-4 py-2.5 text-xs sm:text-sm font-black uppercase border-r-2 border-[#0D0D0D] transition-colors cursor-pointer',
          activeTab === 'slang' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        Kamus Slang
        <span class="ml-1.5 text-[11px] font-mono">({{ slangList.length }})</span>
      </button>

      <button
        @click="activeTab = 'komunitas'"
        :class="[
          'px-4 py-2.5 text-xs sm:text-sm font-black uppercase transition-colors cursor-pointer',
          activeTab === 'komunitas' ? 'bg-[#FFE500] text-[#0D0D0D]' : 'bg-white text-neutral-600 hover:bg-neutral-100'
        ]"
      >
        Komunitas
        <span class="ml-1.5 text-[11px] font-mono">({{ komunitasList.length }})</span>
      </button>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 1: VERIFIKASI KTP (ID USER TETAP, TIDAK TERESET)     -->
    <!-- ======================================================== -->
    <div v-if="activeTab === 'users-verify'">
      <div v-if="loadingUsers" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat daftar pendaftar pending...</p>
      </div>

      <div v-else-if="pendingUsers.length === 0" class="border-3 border-dashed border-[#0D0D0D] bg-white p-10 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <div class="w-10 h-10 mx-auto mb-2 border-2 border-[#0D0D0D] bg-[#00C566] text-[#0D0D0D] font-black text-sm flex items-center justify-center">OK</div>
        <p class="font-extrabold text-neutral-700">Semua pendaftar sudah terverifikasi!</p>
        <p class="text-xs font-medium text-neutral-500 mt-1">Tidak ada antrean user berstatus PENDING.</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="user in pendingUsers"
          :key="user.id"
          class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_#0D0D0D] space-y-4 transition-all duration-150 hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <!-- User Info Row: ID USER MENGGUNAKAN user.id PERMANEN DARI DATABASE -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <Badge variant="yellow" class="text-[10px]">PENDING VERIFIKASI</Badge>
                <!-- PERMINTAAN USER: ID tidak boleh di-reset jika user di-approve! Gunakan user.id permanen -->
                <span class="text-xs font-mono font-black text-[#0D0D0D] bg-neutral-100 px-2 py-0.5 border border-[#0D0D0D]">
                  ID USER: #{{ user.id }}
                </span>
                <span class="text-[10px] font-mono text-neutral-500">
                  Daftar: {{ new Date(user.createdAt).toLocaleDateString('id-ID') }}
                </span>
              </div>
              <h3 class="text-lg font-black uppercase text-[#0D0D0D]">{{ user.namaLengkap }}</h3>
              
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs font-mono mt-2">
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">Email</span><br>{{ user.email }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">NIK (Dekripsi)</span><br>{{ user.nikDecrypted || user.nik }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">WhatsApp</span><br>{{ user.whatsapp }}</div>
                <div><span class="font-black text-neutral-500 uppercase text-[10px]">Instansi</span><br>{{ user.jenisInstansi }}</div>
              </div>

              <div v-if="getOrderedInstansiDetails(user.instansiDetail).length > 0" class="text-xs font-mono text-neutral-800 bg-[#FFFBF0] border border-[#0D0D0D] p-2.5 mt-2 max-w-lg shadow-[2px_2px_0px_#0D0D0D]">
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
              Status akun akan terupdate langsung di sistem.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 2: DATA PENGGUNA (TAB FITUR BARU)                    -->
    <!-- Menampilkan Nama, Email, NIK, No WhatsApp, Detail Instansi-->
    <!-- ======================================================== -->
    <div v-if="activeTab === 'users-all'" class="space-y-4">
      <!-- Toolbar Filter & Search -->
      <div class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase text-neutral-600">FILTER STATUS:</span>
          <select
            v-model="userStatusFilter"
            class="border-2 border-[#0D0D0D] bg-white font-black text-xs p-1.5 shadow-[2px_2px_0px_#0D0D0D] outline-none"
          >
            <option value="ALL">SEMUA STATUS ({{ nonAdminUsers.length }})</option>
            <option value="VERIFIED">TERVERIFIKASI</option>
            <option value="PENDING">PENDING</option>
            <option value="REJECTED">DITOLAK</option>
          </select>
        </div>

        <div class="w-full md:w-80">
          <Input
            v-model="userSearch"
            placeholder="Cari nama, email, NIK, WA, instansi..."
            class="w-full text-xs"
          />
        </div>
      </div>

      <!-- Users Table / List -->
      <div v-if="loadingUsers" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat seluruh data pengguna...</p>
      </div>

      <div v-else-if="filteredAllUsers.length === 0" class="border-3 border-dashed border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-black text-neutral-600">Tidak ada data pengguna yang cocok dengan pencarian.</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="u in filteredAllUsers"
          :key="u.id"
          class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:shadow-[6px_6px_0px_#0D0D0D]"
        >
          <!-- Info Utama -->
          <div class="space-y-2 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono font-black text-xs bg-[#0D0D0D] text-[#FFE500] px-2 py-0.5 border border-[#0D0D0D]">
                ID: #{{ u.id }}
              </span>
              <span class="text-base font-black uppercase text-[#0D0D0D]">{{ u.namaLengkap }}</span>
              <Badge :variant="u.status === 'VERIFIED' ? 'green' : u.status === 'PENDING' ? 'yellow' : 'red'" class="text-[9px]">
                {{ u.status }}
              </Badge>
            </div>

            <!-- Field Sesuai Request: Nama, Email, NIK, No WhatsApp, Detail Instansi -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono bg-neutral-50 p-2.5 border-2 border-[#0D0D0D]">
              <div>
                <span class="text-[10px] font-black uppercase text-neutral-500 block">EMAIL:</span>
                <span class="font-bold text-[#0D0D0D] break-all">{{ u.email }}</span>
              </div>
              <div>
                <span class="text-[10px] font-black uppercase text-neutral-500 block">NIK:</span>
                <span class="font-bold text-[#0D0D0D]">{{ u.nikDecrypted || u.nik || '-' }}</span>
              </div>
              <div>
                <span class="text-[10px] font-black uppercase text-neutral-500 block">NO WHATSAPP:</span>
                <span class="font-bold text-[#0D0D0D]">{{ u.whatsapp || '-' }}</span>
              </div>
              <div>
                <span class="text-[10px] font-black uppercase text-neutral-500 block">INSTANSI:</span>
                <span class="font-bold text-[#0D0D0D]">{{ u.jenisInstansi || '-' }}</span>
              </div>
            </div>

            <!-- Detail Instansi (Breakdown Lengkap) -->
            <div v-if="getOrderedInstansiDetails(u.instansiDetail).length > 0" class="text-xs font-mono text-neutral-800 bg-[#FFFBF0] border border-[#0D0D0D] p-2">
              <span class="font-black text-[10px] uppercase text-neutral-500 block mb-1">DETAIL INSTANSI:</span>
              <div class="flex flex-wrap gap-x-4 gap-y-1">
                <span v-for="item in getOrderedInstansiDetails(u.instansiDetail)" :key="item.label" class="inline-flex items-center gap-1">
                  <strong class="text-[#0D0D0D]">{{ item.label }}:</strong> {{ item.value }}
                </span>
              </div>
            </div>
          </div>

          <!-- Aksi User: Dropdown ubah status dihilangkan sesuai permintaan user -->
          <div class="flex items-center gap-2 self-end lg:self-center shrink-0">
            <button
              type="button"
              @click="deleteUser(u.id, u.namaLengkap)"
              :disabled="userActionLoading === u.id"
              class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white font-black text-xs px-3 py-1.5 shadow-[2px_2px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#0D0D0D] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#0D0D0D] transition-all disabled:opacity-40 cursor-pointer"
              title="Hapus Pengguna"
            >
              {{ userActionLoading === u.id ? 'Menghapus...' : '✕ Hapus Pengguna' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 3: CRUD TITIK BUDAYA                                 -->
    <!-- ======================================================== -->
    <div v-if="activeTab === 'titik-budaya'" class="space-y-4">
      <div class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase text-neutral-600">FILTER STATUS:</span>
          <select
            v-model="titikStatusFilter"
            class="border-2 border-[#0D0D0D] bg-white font-black text-xs p-1.5 shadow-[2px_2px_0px_#0D0D0D] outline-none"
          >
            <option value="ALL">SEMUA STATUS ({{ titikBudayaList.length }})</option>
            <option value="PENDING_REVIEW">PENDING REVIEW</option>
            <option value="APPROVED">APPROVED (TAMPIL DI PETA)</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>

        <Button variant="primary" size="sm" @click="openCreateTitikModal">
          + TAMBAH TITIK BUDAYA BARU
        </Button>
      </div>

      <div v-if="loadingTitik" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat titik budaya...</p>
      </div>

      <div v-else-if="filteredTitikBudaya.length === 0" class="border-3 border-dashed border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-extrabold text-neutral-700">Tidak ada titik budaya pada status ini.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          v-for="titik in filteredTitikBudaya"
          :key="titik.id"
          class="border-3 border-[#0D0D0D] bg-white shadow-[5px_5px_0px_#0D0D0D] flex flex-col transition-all hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <!-- Foto Preview -->
          <div v-if="titik.fotoPath" class="border-b-2 border-[#0D0D0D] overflow-hidden h-64 bg-neutral-900 relative group">
            <a :href="getTitikFotoUrl(titik.fotoPath)" target="_blank" class="block w-full h-full">
              <img
                :src="getTitikFotoUrl(titik.fotoPath)"
                :alt="titik.judul"
                class="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              />
            </a>
          </div>
          <div v-else class="border-b-2 border-[#0D0D0D] h-20 bg-[#FFFBF0] flex items-center justify-center">
            <span class="text-xs font-mono font-black text-neutral-400 uppercase">[FOTO TIDAK TERSEDIA]</span>
          </div>

          <div class="p-4 flex flex-col flex-1 space-y-2">
            <div class="flex items-center justify-between">
              <Badge :variant="titik.status === 'APPROVED' ? 'green' : titik.status === 'PENDING_REVIEW' ? 'yellow' : 'red'" class="text-[10px]">
                {{ titik.status }}
              </Badge>
              <span class="text-[10px] font-mono font-bold text-neutral-400">ID: #{{ titik.id }}</span>
            </div>

            <h3 class="text-base font-black uppercase text-[#0D0D0D]">{{ titik.judul }}</h3>
            <div v-if="titik.alamat" class="text-xs font-semibold text-neutral-800 bg-[#FFFBF0] border border-[#0D0D0D] p-1.5">
              <span class="font-black text-[9px] uppercase bg-[#FFE500] px-1 py-0.5 border border-[#0D0D0D] mr-1">ALAMAT</span>
              {{ titik.alamat }}
            </div>
            <p class="text-xs font-medium text-neutral-700 line-clamp-2">{{ titik.deskripsi }}</p>

            <div v-if="titik.slangTerkait" class="text-xs font-bold bg-[#FFE500] border border-[#0D0D0D] px-2 py-0.5 w-fit">
              Slang: {{ titik.slangTerkait }}
            </div>

            <div class="text-[11px] font-mono text-neutral-500">
              Koordinat: {{ titik.lat?.toFixed(5) }}, {{ titik.lng?.toFixed(5) }}
              <span v-if="titik.wilayah"> • Wilayah: {{ titik.wilayah.nama }}</span>
            </div>

            <!-- Action Buttons: Approve / Reject / Edit / Hapus -->
            <div class="flex flex-wrap items-center gap-2 pt-3 border-t-2 border-[#0D0D0D] mt-auto">
              <template v-if="titik.status === 'PENDING_REVIEW'">
                <Button variant="success" size="sm" class="flex-1 text-[11px]" @click="quickUpdateTitikStatus(titik.id, 'APPROVED')">
                  ✓ APPROVE
                </Button>
                <Button variant="danger" size="sm" class="flex-1 text-[11px]" @click="quickUpdateTitikStatus(titik.id, 'REJECTED')">
                  ✕ TOLAK
                </Button>
              </template>
              <Button variant="outline" size="sm" class="text-[11px]" @click="openEditTitikModal(titik)">
                ✎ EDIT
              </Button>
              <button
                type="button"
                @click="deleteTitikBudaya(titik.id, titik.judul)"
                class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white font-black text-xs px-2.5 py-1.5 shadow-[2px_2px_0px_#0D0D0D] hover:bg-[#d62828] cursor-pointer"
              >
                HAPUS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 4: CRUD TITIK SEJARAH                                -->
    <!-- ======================================================== -->
    <div v-if="activeTab === 'titik-sejarah'" class="space-y-4">
      <div class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase text-neutral-600">FILTER WILAYAH:</span>
          <select
            v-model="sejarahWilayahFilter"
            class="border-2 border-[#0D0D0D] bg-white font-black text-xs p-1.5 shadow-[2px_2px_0px_#0D0D0D] outline-none"
          >
            <option value="ALL">SEMUA WILAYAH ({{ titikSejarahList.length }})</option>
            <option value="1">BARAT</option>
            <option value="2">TIMUR</option>
            <option value="3">SELATAN</option>
            <option value="4">UTARA</option>
            <option value="5">PUSAT</option>
          </select>
        </div>

        <Button variant="primary" size="sm" @click="openCreateSejarahModal">
          + TAMBAH TITIK SEJARAH BARU
        </Button>
      </div>

      <div v-if="loadingSejarah" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat titik sejarah...</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          v-for="s in filteredTitikSejarah"
          :key="s.id"
          class="border-3 border-[#0D0D0D] bg-white shadow-[5px_5px_0px_#0D0D0D] flex flex-col transition-all hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <!-- Foto Preview -->
          <div v-if="s.fotoUrl" class="border-b-2 border-[#0D0D0D] overflow-hidden h-64 bg-neutral-900 relative group">
            <a :href="getTitikFotoUrl(s.fotoUrl)" target="_blank" class="block w-full h-full">
              <img
                :src="getTitikFotoUrl(s.fotoUrl)"
                :alt="s.namaLokasi"
                class="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              />
            </a>
          </div>
          <div v-else class="border-b-2 border-[#0D0D0D] h-20 bg-[#FFFBF0] flex items-center justify-center">
            <span class="text-xs font-mono font-black text-neutral-400 uppercase">[FOTO BELUM TERSEDIA]</span>
          </div>

          <div class="p-4 flex flex-col flex-1 space-y-2">
            <div class="flex items-center justify-between">
              <Badge variant="yellow" class="text-[10px]">
                {{ s.wilayah?.nama || (s.wilayahId === 1 ? 'BARAT' : s.wilayahId === 2 ? 'TIMUR' : s.wilayahId === 3 ? 'SELATAN' : s.wilayahId === 4 ? 'UTARA' : 'PUSAT') }}
              </Badge>
              <span class="text-[10px] font-mono font-bold text-neutral-400">ID: #{{ s.id }}</span>
            </div>

            <h3 class="text-base font-black uppercase text-[#0D0D0D]">{{ s.namaLokasi }}</h3>
            <div v-if="s.alamat" class="text-xs font-semibold text-neutral-800 bg-[#FFFBF0] border border-[#0D0D0D] p-1.5">
              <span class="font-black text-[9px] uppercase bg-[#FFE500] px-1 py-0.5 border border-[#0D0D0D] mr-1">ALAMAT</span>
              {{ s.alamat }}
            </div>
            <p class="text-xs font-medium text-neutral-700 line-clamp-2">{{ s.deskripsi }}</p>
            <div class="text-[11px] font-mono text-neutral-500">
              Koordinat: {{ s.lat?.toFixed(5) }}, {{ s.lng?.toFixed(5) }}
            </div>

            <div class="pt-3 mt-auto border-t border-neutral-200 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" class="text-xs" @click="openEditSejarahModal(s)">
                ✎ EDIT
              </Button>
              <button
                type="button"
                @click="deleteTitikSejarah(s.id, s.namaLokasi)"
                class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white font-black text-xs px-2.5 py-1.5 shadow-[2px_2px_0px_#0D0D0D] hover:bg-[#d62828] cursor-pointer"
              >
                HAPUS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 5: CRUD KAMUS SLANG                                  -->
    <!-- ======================================================== -->
    <div v-if="activeTab === 'slang'" class="space-y-4">
      <div class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
        <div>
          <h2 class="text-lg font-black uppercase">Manajemen Kamus Slang Suroboyoan</h2>
          <p class="text-xs font-medium text-neutral-600">Kelola dialek, idiom jalanan, dan semantik bahasa arek Surabaya</p>
        </div>
        <Button variant="primary" size="sm" @click="openCreateSlangModal">
          + TAMBAH SLANG BARU
        </Button>
      </div>

      <div v-if="loadingSlang" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat kamus slang...</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="item in slangList"
          :key="item.id"
          class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex flex-col justify-between space-y-3 hover:shadow-[6px_6px_0px_#0D0D0D]"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xl font-black uppercase text-[#0D0D0D]">{{ item.istilah }}</span>
              <Badge variant="yellow" class="text-[9px]">{{ item.kategori || 'Umum' }}</Badge>
            </div>
            <p class="text-xs font-medium text-neutral-800">{{ item.arti }}</p>
            <div class="p-2 bg-[#FFFBF0] border border-[#0D0D0D] text-xs font-mono font-bold text-[#0D0D0D]">
              "{{ item.contoh }}"
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-[#0D0D0D]">
            <Button variant="outline" size="sm" class="text-xs" @click="openEditSlangModal(item)">
              ✎ Edit
            </Button>
            <button
              type="button"
              @click="deleteSlang(item.id, item.istilah)"
              class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white font-black text-xs px-2.5 py-1.5 shadow-[2px_2px_0px_#0D0D0D] hover:bg-[#d62828] cursor-pointer"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 6: CRUD KOMUNITAS                                    -->
    <!-- ======================================================== -->
    <div v-if="activeTab === 'komunitas'" class="space-y-4">
      <div class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
        <div>
          <h2 class="text-lg font-black uppercase">Manajemen Direktori Komunitas</h2>
          <p class="text-xs font-medium text-neutral-600">Kelola direktori kolektif kreatif, zine, musik, dan warkop independen</p>
        </div>
        <Button variant="primary" size="sm" @click="openCreateKomunitasModal">
          + TAMBAH KOMUNITAS BARU
        </Button>
      </div>

      <div v-if="loadingKomunitas" class="border-3 border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_#0D0D0D]">
        <p class="font-bold text-neutral-500 animate-pulse">Memuat komunitas...</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="k in komunitasList"
          :key="k.id"
          class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] flex flex-col justify-between space-y-3 hover:shadow-[6px_6px_0px_#0D0D0D]"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-lg font-black uppercase text-[#0D0D0D]">{{ k.nama }}</span>
              <Badge variant="green" class="text-[9px]">{{ k.kategori }}</Badge>
            </div>
            <p class="text-xs font-medium text-neutral-700">{{ k.deskripsi }}</p>
            <div class="text-xs font-mono font-bold text-neutral-600 space-y-0.5">
              <div v-if="k.kontak">Kontak: <span class="text-[#0D0D0D]">{{ k.kontak }}</span></div>
              <div v-if="k.wilayahNama">Wilayah: <span class="text-[#0D0D0D]">{{ k.wilayahNama }}</span></div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-[#0D0D0D]">
            <Button variant="outline" size="sm" class="text-xs" @click="openEditKomunitasModal(k)">
              ✎ Edit
            </Button>
            <button
              type="button"
              @click="deleteKomunitas(k.id, k.nama)"
              class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white font-black text-xs px-2.5 py-1.5 shadow-[2px_2px_0px_#0D0D0D] hover:bg-[#d62828] cursor-pointer"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL 1: CREATE / EDIT TITIK BUDAYA                      -->
    <!-- ======================================================== -->
    <div v-if="isTitikModalOpen" class="fixed inset-0 z-50 bg-[#0D0D0D]/60 flex items-center justify-center p-4 overflow-y-auto">
      <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] w-full max-w-lg p-6 shadow-[8px_8px_0px_#0D0D0D] space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b-2 border-[#0D0D0D] pb-3">
          <div>
            <Badge variant="black">{{ isEditTitikMode ? 'EDIT ARSIP' : 'INPUT ARSIP' }}</Badge>
            <h3 class="text-xl font-black uppercase text-[#0D0D0D] mt-1">
              {{ isEditTitikMode ? 'Edit Titik Budaya' : 'Tambah Titik Budaya' }}
            </h3>
          </div>
          <button @click="destroyTitikMiniMap(); isTitikModalOpen = false" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 cursor-pointer">✕</button>
        </div>

        <form @submit.prevent="saveTitikBudaya" class="space-y-3">
          <div>
            <label class="block text-xs font-black uppercase mb-1">Judul / Nama Titik *</label>
            <Input v-model="formTitikJudul" placeholder="Contoh: Warkop Giras 57 / Mural Kenjeran" required />
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Deskripsi Naratif *</label>
            <textarea
              v-model="formTitikDeskripsi"
              rows="3"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-medium text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              required
            ></textarea>
          </div>

          <!-- Alamat / Patokan Lokasi (Wajib, tepat di atas Wilayah Surabaya) -->
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">
              Alamat Lengkap / Patokan Lokasi <span class="text-[#FF3B3B]">*</span>
            </label>
            <textarea
              v-model="formTitikAlamat"
              rows="2"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2 font-medium text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              placeholder="Contoh: Jl. Embong Malang No. 12, Genteng, Surabaya"
              required
            ></textarea>
            <div class="flex items-center justify-between gap-2 pt-0.5">
              <span class="text-[10px] text-neutral-500 font-medium">Ketik alamat lalu klik cari untuk menemukan titik lokasi di peta.</span>
              <button
                type="button"
                @click="searchTitikAddress"
                :disabled="isTitikSearchingAddress || !formTitikAlamat"
                class="border-2 border-[#0D0D0D] bg-[#FFE500] text-[#0D0D0D] font-black text-[10px] uppercase px-2.5 py-1 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {{ isTitikSearchingAddress ? 'Mencari...' : 'CARI DI PETA ➔' }}
              </button>
            </div>
            <div v-if="titikAddressMsg" class="text-[10px] font-bold text-[#0D0D0D] bg-[#00C566] px-2 py-0.5 border border-[#0D0D0D]">
              {{ titikAddressMsg }}
            </div>
            <div v-if="titikAddressErr" class="text-[10px] font-bold text-white bg-[#FF3B3B] px-2 py-0.5 border border-[#0D0D0D]">
              {{ titikAddressErr }}
            </div>
          </div>

          <!-- Peta Mini & Titik Koordinat Titik Budaya -->
          <div v-show="isTitikMiniMapVisible || (formTitikLat !== null && formTitikLng !== null)" class="border-2 border-[#0D0D0D] bg-[#FFFBF0] p-2.5 space-y-2 shadow-[2px_2px_0px_#0D0D0D]">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 text-[#0D0D0D]">
                <span class="inline-block w-2.5 h-2.5 bg-[#00C566] border border-[#0D0D0D]"></span>
                PETA TITIK LOKASI & KOORDINAT
              </span>
              <span class="font-mono font-black text-[10px] bg-[#0D0D0D] text-[#FFE500] px-1.5 py-0.5 border border-[#0D0D0D]">
                Lat: {{ formTitikLat?.toFixed(6) }}, Lng: {{ formTitikLng?.toFixed(6) }}
              </span>
            </div>
            <div
              ref="titikMiniMapContainer"
              class="w-full h-44 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D] relative z-0 bg-neutral-200"
            ></div>
            <p class="text-[10px] text-neutral-600 font-bold leading-tight">
              💡 Geser pin (drag) atau klik peta di atas untuk mengoreksi posisi koordinat & auto-detect wilayah.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-black uppercase mb-1">Wilayah Surabaya <span class="text-[#FF3B3B]">*</span></label>
              <select
                v-model="formTitikWilayahId"
                class="border-3 border-[#0D0D0D] bg-white w-full p-2 font-bold text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
                required
              >
                <option :value="1">BARAT</option>
                <option :value="2">TIMUR</option>
                <option :value="3">SELATAN</option>
                <option :value="4">UTARA</option>
                <option :value="5">PUSAT</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-black uppercase mb-1">Status Kurasi</label>
              <select
                v-model="formTitikStatus"
                class="border-3 border-[#0D0D0D] bg-white w-full p-2 font-bold text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              >
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-black uppercase mb-1">Latitude</label>
              <Input v-model.number="formTitikLat" type="number" step="any" required />
            </div>
            <div>
              <label class="block text-xs font-black uppercase mb-1">Longitude</label>
              <Input v-model.number="formTitikLng" type="number" step="any" required />
            </div>
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Slang Terkait</label>
            <Input v-model="formTitikSlang" placeholder="Contoh: Giras, Cangkruk, Mbois" />
          </div>

          <!-- File Foto -->
          <div>
            <label class="block text-xs font-black uppercase mb-2">File Foto Dokumentasi</label>

            <!-- Preview foto saat ini (edit mode) atau foto baru dipilih -->
            <div v-if="formTitikFotoPreview" class="mb-2 border-2 border-[#0D0D0D] bg-neutral-900 relative overflow-hidden h-64">
              <img :src="formTitikFotoPreview" alt="Preview Foto" class="w-full h-full object-cover" />
              <div class="absolute top-2 right-2">
                <button
                  type="button"
                  @click="formTitikFoto = null; formTitikFotoPreview = null"
                  class="bg-[#FF3B3B] border-2 border-[#0D0D0D] text-white font-black text-xs px-2 py-0.5 cursor-pointer shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  HAPUS
                </button>
              </div>
            </div>

            <!-- Tombol pilih / ganti foto -->
            <label
              class="flex items-center gap-2 border-2 border-[#0D0D0D] bg-[#FFE500] px-3 py-2 cursor-pointer font-black text-xs uppercase shadow-[3px_3px_0px_#0D0D0D] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all w-fit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15" stroke="#0D0D0D" stroke-width="2.5" stroke-linecap="square"/>
                <path d="M17 8L12 3L7 8" stroke="#0D0D0D" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="#0D0D0D" stroke-width="2.5" stroke-linecap="square"/>
              </svg>
              {{ formTitikFotoPreview ? 'GANTI FOTO' : 'PILIH FOTO' }}
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleTitikFotoChange"
              />
            </label>
            <p class="text-[10px] text-neutral-500 mt-1">Format: JPG, PNG, WebP. Maks 5MB.</p>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0D0D0D]">
            <Button type="button" variant="outline" size="sm" @click="destroyTitikMiniMap(); isTitikModalOpen = false">Batal</Button>
            <Button type="submit" variant="primary" size="sm">Simpan Titik Budaya</Button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL 2: CREATE / EDIT TITIK SEJARAH                     -->
    <!-- ======================================================== -->
    <div v-if="isSejarahModalOpen" class="fixed inset-0 z-50 bg-[#0D0D0D]/60 flex items-center justify-center p-4 overflow-y-auto">
      <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] w-full max-w-lg p-6 shadow-[8px_8px_0px_#0D0D0D] space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b-2 border-[#0D0D0D] pb-3">
          <div>
            <Badge variant="black">JANGKAR HISTORIS</Badge>
            <h3 class="text-xl font-black uppercase text-[#0D0D0D] mt-1">
              {{ isEditSejarahMode ? 'Edit Titik Sejarah' : 'Tambah Titik Sejarah' }}
            </h3>
          </div>
          <button @click="destroySejarahMiniMap(); isSejarahModalOpen = false" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 cursor-pointer">✕</button>
        </div>

        <form @submit.prevent="saveTitikSejarah" class="space-y-3">
          <div>
            <label class="block text-xs font-black uppercase mb-1">Nama Lokasi Sejarah *</label>
            <Input v-model="formSejarahNama" placeholder="Contoh: Monumen Kapal Selam" required />
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Deskripsi Naratif *</label>
            <textarea
              v-model="formSejarahDeskripsi"
              rows="3"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-medium text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              required
            ></textarea>
          </div>

          <!-- Alamat Lengkap (Wajib, tepat di atas Wilayah Surabaya) -->
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">
              Alamat Lengkap <span class="text-[#FF3B3B]">*</span>
            </label>
            <textarea
              v-model="formSejarahAlamat"
              rows="2"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2 font-medium text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              placeholder="Contoh: Jl. Pemuda No. 39, Genteng, Surabaya"
              required
            ></textarea>
            <div class="flex items-center justify-between gap-2 pt-0.5">
              <span class="text-[10px] text-neutral-500 font-medium">Ketik alamat lalu klik cari untuk menemukan titik sejarah di peta.</span>
              <button
                type="button"
                @click="searchSejarahAddress"
                :disabled="isSejarahSearchingAddress || !formSejarahAlamat"
                class="border-2 border-[#0D0D0D] bg-[#FFE500] text-[#0D0D0D] font-black text-[10px] uppercase px-2.5 py-1 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {{ isSejarahSearchingAddress ? 'Mencari...' : 'CARI DI PETA ➔' }}
              </button>
            </div>
            <div v-if="sejarahAddressMsg" class="text-[10px] font-bold text-[#0D0D0D] bg-[#00C566] px-2 py-0.5 border border-[#0D0D0D]">
              {{ sejarahAddressMsg }}
            </div>
            <div v-if="sejarahAddressErr" class="text-[10px] font-bold text-white bg-[#FF3B3B] px-2 py-0.5 border border-[#0D0D0D]">
              {{ sejarahAddressErr }}
            </div>
          </div>

          <!-- Peta Mini & Titik Koordinat Titik Sejarah -->
          <div v-show="isSejarahMiniMapVisible || (formSejarahLat !== null && formSejarahLng !== null)" class="border-2 border-[#0D0D0D] bg-[#FFFBF0] p-2.5 space-y-2 shadow-[2px_2px_0px_#0D0D0D]">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 text-[#0D0D0D]">
                <span class="inline-block w-2.5 h-2.5 bg-[#FFE500] border border-[#0D0D0D]"></span>
                PETA TITIK LOKASI & KOORDINAT
              </span>
              <span class="font-mono font-black text-[10px] bg-[#0D0D0D] text-[#FFE500] px-1.5 py-0.5 border border-[#0D0D0D]">
                Lat: {{ formSejarahLat?.toFixed(6) }}, Lng: {{ formSejarahLng?.toFixed(6) }}
              </span>
            </div>
            <div
              ref="sejarahMiniMapContainer"
              class="w-full h-44 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D] relative z-0 bg-neutral-200"
            ></div>
            <p class="text-[10px] text-neutral-600 font-bold leading-tight">
              💡 Geser pin (drag) atau klik peta di atas untuk mengoreksi posisi koordinat & auto-detect wilayah.
            </p>
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Wilayah Surabaya <span class="text-[#FF3B3B]">*</span></label>
            <select
              v-model="formSejarahWilayahId"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2 font-bold text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              required
            >
              <option :value="1">BARAT</option>
              <option :value="2">TIMUR</option>
              <option :value="3">SELATAN</option>
              <option :value="4">UTARA</option>
              <option :value="5">PUSAT</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-black uppercase mb-1">Latitude</label>
              <Input v-model.number="formSejarahLat" type="number" step="any" required />
            </div>
            <div>
              <label class="block text-xs font-black uppercase mb-1">Longitude</label>
              <Input v-model.number="formSejarahLng" type="number" step="any" required />
            </div>
          </div>

          <!-- File Foto Dokumentasi -->
          <div>
            <label class="block text-xs font-black uppercase mb-2">File Foto Dokumentasi</label>

            <!-- Preview foto saat ini atau foto baru dipilih -->
            <div v-if="formSejarahFotoPreview" class="mb-2 border-2 border-[#0D0D0D] bg-neutral-900 relative overflow-hidden h-64">
              <img :src="formSejarahFotoPreview" alt="Preview Foto Sejarah" class="w-full h-full object-cover" />
              <div class="absolute top-2 right-2">
                <button
                  type="button"
                  @click="formSejarahFoto = null; formSejarahFotoPreview = null"
                  class="bg-[#FF3B3B] border-2 border-[#0D0D0D] text-white font-black text-xs px-2 py-0.5 cursor-pointer shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  HAPUS
                </button>
              </div>
            </div>

            <!-- Tombol pilih / ganti foto -->
            <label
              class="flex items-center gap-2 border-2 border-[#0D0D0D] bg-[#FFE500] px-3 py-2 cursor-pointer font-black text-xs uppercase shadow-[3px_3px_0px_#0D0D0D] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all w-fit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15" stroke="#0D0D0D" stroke-width="2.5" stroke-linecap="square"/>
                <path d="M17 8L12 3L7 8" stroke="#0D0D0D" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="#0D0D0D" stroke-width="2.5" stroke-linecap="square"/>
              </svg>
              {{ formSejarahFotoPreview ? 'GANTI FOTO' : 'PILIH FOTO' }}
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleSejarahFotoChange"
              />
            </label>
            <p class="text-[10px] text-neutral-500 mt-1">Format: JPG, PNG, WebP. Maks 5MB.</p>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0D0D0D]">
            <Button type="button" variant="outline" size="sm" @click="destroySejarahMiniMap(); isSejarahModalOpen = false">Batal</Button>
            <Button type="submit" variant="primary" size="sm">Simpan Titik Sejarah</Button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL 3: CREATE / EDIT KAMUS SLANG                       -->
    <!-- ======================================================== -->
    <div v-if="isSlangModalOpen" class="fixed inset-0 z-50 bg-[#0D0D0D]/60 flex items-center justify-center p-4">
      <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] w-full max-w-md p-6 shadow-[8px_8px_0px_#0D0D0D] space-y-4">
        <div class="flex items-center justify-between border-b-2 border-[#0D0D0D] pb-3">
          <div>
            <Badge variant="yellow">KAMUS DIALEK</Badge>
            <h3 class="text-xl font-black uppercase text-[#0D0D0D] mt-1">
              {{ isEditSlangMode ? 'Edit Istilah Slang' : 'Tambah Istilah Slang' }}
            </h3>
          </div>
          <button @click="isSlangModalOpen = false" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 cursor-pointer">✕</button>
        </div>

        <form @submit.prevent="saveSlang" class="space-y-3">
          <div>
            <label class="block text-xs font-black uppercase mb-1">Istilah Slang *</label>
            <Input v-model="formSlangIstilah" placeholder="Contoh: Mbois / Cangkruk" required />
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Kategori Slang</label>
            <Input v-model="formSlangKategori" placeholder="Contoh: Tongkrongan, Kuliner, Sapaan" />
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Arti / Makna *</label>
            <textarea
              v-model="formSlangArti"
              rows="2"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-medium text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              placeholder="Jelaskan arti dan makna istilah ini..."
              required
            ></textarea>
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Contoh Penggunaan Kalimat *</label>
            <Input v-model="formSlangContoh" placeholder='Contoh: "Ayo ngopi nang giras rek!"' required />
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0D0D0D]">
            <Button type="button" variant="outline" size="sm" @click="isSlangModalOpen = false">Batal</Button>
            <Button type="submit" variant="primary" size="sm">Simpan Slang</Button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL 4: CREATE / EDIT DIREKTORI KOMUNITAS               -->
    <!-- ======================================================== -->
    <div v-if="isKomunitasModalOpen" class="fixed inset-0 z-50 bg-[#0D0D0D]/60 flex items-center justify-center p-4">
      <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] w-full max-w-md p-6 shadow-[8px_8px_0px_#0D0D0D] space-y-4">
        <div class="flex items-center justify-between border-b-2 border-[#0D0D0D] pb-3">
          <div>
            <Badge variant="green">DIREKTORI KOLEKTIF</Badge>
            <h3 class="text-xl font-black uppercase text-[#0D0D0D] mt-1">
              {{ isEditKomunitasMode ? 'Edit Komunitas' : 'Tambah Komunitas' }}
            </h3>
          </div>
          <button @click="isKomunitasModalOpen = false" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 cursor-pointer">✕</button>
        </div>

        <form @submit.prevent="saveKomunitas" class="space-y-3">
          <div>
            <label class="block text-xs font-black uppercase mb-1">Nama Komunitas *</label>
            <Input v-model="formKomunitasNama" placeholder="Contoh: Surabaya Street Art Collective" required />
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Kategori Komunitas *</label>
            <select
              v-model="formKomunitasKategori"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2 font-bold text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
            >
              <option value="Kolektif Seni & Mural">Kolektif Seni & Mural</option>
              <option value="Skena Musik Independen">Skena Musik Independen</option>
              <option value="Zine & Literasi Jalanan">Zine & Literasi Jalanan</option>
              <option value="Arsip Kuliner & Warkop Giras">Arsip Kuliner & Warkop Giras</option>
              <option value="Olahraga & Skateboard">Olahraga & Skateboard</option>
              <option value="Komunitas Pemuda Umum">Komunitas Pemuda Umum</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Deskripsi Singkat *</label>
            <textarea
              v-model="formKomunitasDeskripsi"
              rows="3"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-medium text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              required
            ></textarea>
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Kontak / Media Sosial</label>
            <Input v-model="formKomunitasKontak" placeholder="Contoh: @arekzine / 081234567890" />
          </div>

          <div>
            <label class="block text-xs font-black uppercase mb-1">Wilayah Basis (Opsional)</label>
            <select
              v-model="formKomunitasWilayahId"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2 font-bold text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
            >
              <option :value="null">Seluruh Surabaya</option>
              <option :value="1">BARAT</option>
              <option :value="2">TIMUR</option>
              <option :value="3">SELATAN</option>
              <option :value="4">UTARA</option>
              <option :value="5">PUSAT</option>
            </select>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0D0D0D]">
            <Button type="button" variant="outline" size="sm" @click="isKomunitasModalOpen = false">Batal</Button>
            <Button type="submit" variant="primary" size="sm">Simpan Komunitas</Button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL KONFIRMASI HAPUS (BOLD NEUBRUTALISM CARD)          -->
    <!-- Menggantikan dialog confirm bawaan browser               -->
    <!-- ======================================================== -->
    <div
      v-if="deleteModal.isOpen"
      class="fixed inset-0 z-50 bg-[#0D0D0D]/75 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="closeDeleteModal"
    >
      <div
        class="border-4 border-[#0D0D0D] bg-white w-full max-w-md shadow-[8px_8px_0px_#0D0D0D] relative animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      >
        <!-- Top bar with alert style -->
        <div class="bg-[#FF3B3B] text-white p-3.5 border-b-3 border-[#0D0D0D] flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="bg-[#0D0D0D] text-white font-mono font-black text-[11px] px-2 py-0.5 border border-white">
              PERINGATAN
            </span>
            <span class="font-mono text-xs uppercase tracking-wider font-bold">
              {{ deleteModal.itemType }}
            </span>
          </div>
          <button
            type="button"
            @click="closeDeleteModal"
            class="text-white hover:text-black font-black text-xl px-2 cursor-pointer leading-none transition-colors"
            :disabled="deleteModal.loading"
            title="Tutup dialog"
          >
            ✕
          </button>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <h3 class="text-lg sm:text-xl font-black uppercase text-[#0D0D0D] leading-tight">
              {{ deleteModal.title }}
            </h3>
            <p class="text-xs font-mono text-neutral-600 mt-1">
              Konfirmasi tindakan penghapusan data secara permanen.
            </p>
          </div>

          <!-- Highlight item box -->
          <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] p-3.5 shadow-[3px_3px_0px_#0D0D0D]">
            <span class="text-[10px] font-black uppercase text-neutral-500 block mb-1">
              Item yang akan dihapus:
            </span>
            <p class="font-black text-base text-[#0D0D0D] break-words">
              {{ deleteModal.itemName }}
            </p>
          </div>

          <!-- Warning text -->
          <div class="border-2 border-[#FF3B3B] bg-red-50 p-3 text-xs font-mono text-[#FF3B3B] font-bold leading-relaxed">
            ! {{ deleteModal.warningText }}
          </div>

          <!-- Action buttons -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t-2 border-[#0D0D0D]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="deleteModal.loading"
              @click="closeDeleteModal"
            >
              Batal
            </Button>
            <button
              type="button"
              :disabled="deleteModal.loading"
              @click="runConfirmedDelete"
              class="border-3 border-[#0D0D0D] bg-[#FF3B3B] text-white font-black text-xs sm:text-sm px-4 py-2 shadow-[4px_4px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#0D0D0D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#0D0D0D] transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <span v-if="deleteModal.loading" class="animate-pulse">Menghapus...</span>
              <span v-else>✕ Ya, Hapus Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
.custom-cultural-marker-wrap,
.custom-sejarah-marker-wrap {
  background: transparent !important;
  border: none !important;
}

.sgza-pin-budaya,
.sgza-pin-sejarah {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}

.sgza-pin-budaya .sgza-pin-head {
  background-color: #00C566;
  border: 2.5px solid #0D0D0D;
  box-shadow: 3px 3px 0px #0D0D0D;
  width: 34px;
  height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 1.5px 1px 2px;
  box-sizing: border-box;
}

.sgza-pin-sejarah .sgza-pin-head {
  background-color: #FFE500;
  border: 2.5px solid #0D0D0D;
  box-shadow: 3px 3px 0px #0D0D0D;
  width: 34px;
  height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 1.5px 1px 2px;
  box-sizing: border-box;
}

.sgza-pin-budaya .sgza-pin-label {
  background-color: #0D0D0D;
  color: #00C566;
  font-family: monospace;
  font-size: 6.5px;
  font-weight: 900;
  line-height: 1;
  padding: 1px 2px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}

.sgza-pin-sejarah .sgza-pin-label {
  background-color: #0D0D0D;
  color: #FFE500;
  font-family: monospace;
  font-size: 6.5px;
  font-weight: 900;
  line-height: 1;
  padding: 1px 2px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}

.sgza-pin-budaya .sgza-pin-icon,
.sgza-pin-sejarah .sgza-pin-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}

.sgza-pin-budaya .sgza-pin-pointer,
.sgza-pin-sejarah .sgza-pin-pointer {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #0D0D0D;
  margin-top: -1px;
  filter: drop-shadow(2px 1px 0px rgba(13, 13, 13, 0.8));
}

.sgza-pin-budaya:hover,
.sgza-pin-sejarah:hover {
  transform: translateY(-3px) scale(1.1);
  z-index: 9999 !important;
}
</style>
