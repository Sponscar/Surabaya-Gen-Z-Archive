<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import L from 'leaflet'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import type { TitikBudaya, Wilayah } from '@sgza/shared'
import { SURABAYA_WILAYAH_GEO, SURABAYA_BOUNDS, getWilayahStyle, type WilayahGeo } from '@/lib/surabaya-geo'

const authStore = useAuthStore()
const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: L.Map | null = null
let wilayahLayerGroup: L.LayerGroup | null = null
let culturalMarkersLayer: L.LayerGroup | null = null
let tempMarker: L.Marker | null = null

const culturalPoints = ref<TitikBudaya[]>([])
const wilayahList = ref<Wilayah[]>([])
const loading = ref(true)
const apiError = ref(false)

// Selected region filter key (BARAT, TIMUR, etc. or null = all)
const selectedWilayahKey = ref<string | null>(null)
const wilayahIdMap = ref<Record<string, string>>({})

const filteredCulturalPoints = computed(() => {
  if (!selectedWilayahKey.value) return culturalPoints.value
  const targetId = wilayahIdMap.value[selectedWilayahKey.value]
  if (!targetId) return culturalPoints.value
  return culturalPoints.value.filter((p) => p.wilayahId === targetId)
})

// Modal State
const isModalOpen = ref(false)
const isSubmitting = ref(false)
const submitSuccessMsg = ref<string | null>(null)
const submitErrorMsg = ref<string | null>(null)

// Form Fields
const formJudul = ref('')
const formDeskripsi = ref('')
const formSlang = ref('')
const formWilayahId = ref('')
const formLat = ref<number | null>(null)
const formLng = ref<number | null>(null)
const formFoto = ref<File | null>(null)
const fotoPreview = ref<string | null>(null)

function createCulturalIcon() {
  return L.divIcon({
    className: 'custom-cultural-marker',
    html: `
      <div style="
        background-color: #00C566;
        border: 2px solid #0D0D0D;
        box-shadow: 2px 2px 0px #0D0D0D;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        cursor: pointer;
        transform: rotate(2deg);
      "><span style="font-weight: 900; font-size: 12px; color: #0D0D0D;">B</span></div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function initMap() {
  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(mapInstance)

  wilayahLayerGroup = L.layerGroup().addTo(mapInstance)
  culturalMarkersLayer = L.layerGroup().addTo(mapInstance)

  // Otomatis langsung fokus ke seluruh wilayah Surabaya
  mapInstance.fitBounds(SURABAYA_BOUNDS, { padding: [15, 15] })

  // Langsung render 5 wilayah Surabaya sejak awal
  renderWilayahPolygons()

  // Map Click Listener
  mapInstance.on('click', (e: L.LeafletMouseEvent) => {
    if (!authStore.isVerified) {
      if (!authStore.isAuthenticated) {
        submitErrorMsg.value = 'Silakan masuk atau daftar terlebih dahulu untuk berkontribusi.'
      } else {
        submitErrorMsg.value = 'Akun Anda berstatus PENDING. Tunggu verifikasi admin sebelum mengarsipkan.'
      }
      return
    }

    formLat.value = parseFloat(e.latlng.lat.toFixed(6))
    formLng.value = parseFloat(e.latlng.lng.toFixed(6))

    if (tempMarker) {
      tempMarker.setLatLng(e.latlng)
    } else {
      tempMarker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: 'temp-marker',
          html: `<div style="background-color: #FF3B3B; border: 2px solid #0D0D0D; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px;">+</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(mapInstance!)
    }

    // Auto-select first wilayah if none selected
    if (!formWilayahId.value && wilayahList.value.length > 0) {
      formWilayahId.value = wilayahList.value[0].id
    }

    isModalOpen.value = true
  })
}

function renderCulturalMarkers() {
  if (!culturalMarkersLayer) return
  culturalMarkersLayer.clearLayers()

  filteredCulturalPoints.value.forEach((point) => {
    if (typeof point.lat !== 'number' || typeof point.lng !== 'number') return

    const marker = L.marker([point.lat, point.lng], {
      icon: createCulturalIcon(),
    })

    const photoHtml = point.fotoPath
      ? `<div style="margin-bottom: 8px; border: 2px solid #0D0D0D; overflow: hidden; max-height: 120px;">
           <img src="/api/uploads/titik/${point.fotoPath}" alt="${point.judul}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
         </div>`
      : ''

    const slangHtml = point.slangTerkait
      ? `<div style="margin: 4px 0;"><span style="background-color: #FFE500; border: 1px solid #0D0D0D; font-weight: 800; font-size: 10px; padding: 2px 6px;">SLANG: ${point.slangTerkait}</span></div>`
      : ''

    const popupHtml = `
      <div style="font-family: inherit; padding: 4px; max-width: 260px;">
        ${photoHtml}
        <span style="background-color: #00C566; color: #0D0D0D; font-size: 10px; font-weight: 800; padding: 2px 6px; border: 1px solid #0D0D0D; text-transform: uppercase;">
          BUDAYA GEN-Z
        </span>
        <h4 style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 6px 0 4px; color: #0D0D0D;">
          ${point.judul}
        </h4>
        <p style="font-size: 11px; font-weight: 500; color: #333; line-height: 1.3; margin: 0 0 6px;">
          ${point.deskripsi}
        </p>
        ${slangHtml}
        <div style="font-family: monospace; font-size: 10px; font-weight: 700; color: #666; margin-top: 6px; border-top: 1px solid #ccc; padding-top: 4px;">
          ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}
        </div>
      </div>
    `

    marker.bindPopup(popupHtml, { className: 'nb-leaflet-popup' })
    culturalMarkersLayer?.addLayer(marker)
  })
}

function renderWilayahPolygons() {
  if (!wilayahLayerGroup) return
  wilayahLayerGroup.clearLayers()

  SURABAYA_WILAYAH_GEO.forEach((geo: WilayahGeo) => {
    const isSelected = selectedWilayahKey.value === geo.key
    const style = getWilayahStyle(geo.key, isSelected)

    const polygonLayer = L.geoJSON(geo.geojson as any, {
      style: {
        ...style,
        color: '#0D0D0D',
        weight: isSelected ? 2.5 : 1.5,
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => selectRegion(geo.key))
        if (feature.properties?.kecamatan) {
          layer.bindTooltip(`Kec. ${feature.properties.kecamatan} (${geo.label})`, {
            sticky: true,
            className: 'nb-leaflet-tooltip',
          })
        }
        layer.on('mouseover', (e: any) => {
          e.target.setStyle({ fillOpacity: isSelected ? 0.75 : 0.55, weight: 2.5 })
        })
        layer.on('mouseout', (e: any) => {
          e.target.setStyle({ fillOpacity: isSelected ? 0.65 : 0.40, weight: isSelected ? 2.5 : 1.5 })
        })
      },
    })

    const labelMarker = L.marker(geo.center, {
      icon: L.divIcon({
        className: 'wilayah-label-icon-map',
        html: `<div style="
          background-color: ${isSelected ? geo.fillColor : 'rgba(255,255,255,0.92)'};
          border: 2px solid #0D0D0D;
          box-shadow: 2px 2px 0px #0D0D0D;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
          color: #0D0D0D;
          pointer-events: none;
        ">${geo.label.replace('Surabaya ', '')}</div>`,
        iconAnchor: [45, 12],
      }),
      interactive: false,
      zIndexOffset: 1000,
    })

    wilayahLayerGroup?.addLayer(polygonLayer)
    wilayahLayerGroup?.addLayer(labelMarker)
  })
}

function selectRegion(key: string | null) {
  selectedWilayahKey.value = key
  renderWilayahPolygons()
  renderCulturalMarkers()

  if (key && mapInstance) {
    const geo = SURABAYA_WILAYAH_GEO.find((g) => g.key === key)
    if (geo) {
      const geoLayer = L.geoJSON(geo.geojson as any)
      mapInstance.fitBounds(geoLayer.getBounds(), { padding: [30, 30] })
    }
  } else if (mapInstance) {
    mapInstance.fitBounds(SURABAYA_BOUNDS, { padding: [15, 15] })
  }
}

function buildWilayahIdMap(apiWilayahList: Wilayah[]) {
  const map: Record<string, string> = {}
  apiWilayahList.forEach((w) => {
    const key = w.nama.split(' ').pop()?.toUpperCase() ?? ''
    if (key) map[key] = w.id
  })
  wilayahIdMap.value = map
}

function handleFotoChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    formFoto.value = target.files[0]
    fotoPreview.value = URL.createObjectURL(target.files[0])
  }
}

function removeFoto() {
  formFoto.value = null
  fotoPreview.value = null
}

function closeModal() {
  isModalOpen.value = false
  if (tempMarker && mapInstance) {
    mapInstance.removeLayer(tempMarker)
    tempMarker = null
  }
  formJudul.value = ''
  formDeskripsi.value = ''
  formSlang.value = ''
  formFoto.value = null
  fotoPreview.value = null
  submitErrorMsg.value = null
}

async function submitTitik() {
  if (!formJudul.value || !formDeskripsi.value || !formWilayahId.value || formLat.value === null || formLng.value === null) {
    submitErrorMsg.value = 'Harap isi semua kolom wajib.'
    return
  }

  isSubmitting.value = true
  submitErrorMsg.value = null

  try {
    const formData = new FormData()
    formData.append('judul', formJudul.value)
    formData.append('deskripsi', formDeskripsi.value)
    if (formSlang.value) formData.append('slangTerkait', formSlang.value)
    formData.append('wilayahId', formWilayahId.value)
    formData.append('lat', formLat.value.toString())
    formData.append('lng', formLng.value.toString())
    if (formFoto.value) {
      formData.append('foto', formFoto.value)
    }

    await api.post('/titik-budaya', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    submitSuccessMsg.value = 'Titik budaya berhasil didaftarkan! Menunggu kurasi admin sebelum tampil di peta.'
    closeModal()
  } catch (err: any) {
    submitErrorMsg.value = err.response?.data?.message || 'Gagal menyimpan titik budaya. Periksa data kembali.'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  initMap()

  try {
    const [resPoints, resWilayah] = await Promise.all([
      api.get<TitikBudaya[]>('/titik-budaya'),
      api.get<Wilayah[]>('/wilayah'),
    ])
    culturalPoints.value = resPoints.data
    wilayahList.value = resWilayah.data
    buildWilayahIdMap(resWilayah.data)
    renderCulturalMarkers()
  } catch (err) {
    apiError.value = true
    console.warn('Gagal mengambil titik budaya / backend belum aktif:', err)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <div class="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
    <!-- API Offline Notification -->
    <div v-if="apiError" class="border-3 border-[#0D0D0D] bg-[#FFE500] p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="px-2 py-1 bg-[#0D0D0D] text-[#FFE500] font-black text-xs border border-[#0D0D0D]">INFO</span>
        <div>
          <span class="font-extrabold text-sm block">Server API Backend Belum Berjalan</span>
          <span class="text-xs font-medium text-neutral-800">
            Peta wilayah tetap aktif. Untuk memuat arsip titik budaya warga & fitur kurasi, jalankan <code class="bg-[#0D0D0D] text-[#FFE500] px-1.5 py-0.5 font-mono text-[11px] font-bold">npm run dev</code> di terminal.
          </span>
        </div>
      </div>
      <button @click="apiError = false" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 text-xs hover:bg-[#FF3B3B] hover:text-white cursor-pointer">✕</button>
    </div>

    <!-- Notifications / Banners -->
    <div v-if="submitSuccessMsg" class="border-3 border-[#0D0D0D] bg-[#00C566] text-[#0D0D0D] p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 bg-[#0D0D0D] text-[#00C566] font-black text-xs border border-[#0D0D0D]">OK</span>
        <span class="font-extrabold text-sm">{{ submitSuccessMsg }}</span>
      </div>
      <button @click="submitSuccessMsg = null" class="font-black px-2 py-0.5 border-2 border-[#0D0D0D] bg-white text-xs">✕</button>
    </div>

    <!-- Auth State Alert -->
    <div v-if="!authStore.isAuthenticated" class="border-3 border-[#0D0D0D] bg-[#FFE500] p-4 shadow-[4px_4px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="px-2 py-1 bg-[#0D0D0D] text-[#FFE500] font-black text-xs border border-[#0D0D0D]">INFO</span>
        <div>
          <span class="font-extrabold text-sm block">Mau mengarsipkan tongkrongan atau karya budaya Gen-Z?</span>
          <span class="text-xs font-medium text-neutral-800">Daftar sebagai Everyday Ethnographer terverifikasi untuk mulai menambahkan titik di peta.</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <RouterLink to="/login">
          <Button variant="outline" size="sm">MASUK</Button>
        </RouterLink>
        <RouterLink to="/register">
          <Button variant="black" size="sm">DAFTAR KTP</Button>
        </RouterLink>
      </div>
    </div>
    <div v-else-if="!authStore.isVerified" class="border-3 border-[#0D0D0D] bg-[#FFE500] p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center gap-3">
      <span class="px-2 py-1 bg-[#0D0D0D] text-[#FFE500] font-black text-xs border border-[#0D0D0D]">STATUS</span>
      <div>
        <span class="font-extrabold text-sm block">Status Akun: PENDING VERIFIKASI</span>
        <span class="text-xs font-medium text-neutral-800">Dokumen KTP Anda sedang dalam proses kurasi oleh tim admin SGZA. Anda dapat menjelajahi peta, namun belum bisa menambah titik.</span>
      </div>
    </div>
    <div v-else class="border-3 border-[#0D0D0D] bg-[#00C566] p-3 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Badge variant="black">ETNOGRAFER TERVERIFIKASI</Badge>
        <span class="text-xs font-bold text-[#0D0D0D]">Klik di mana saja pada peta untuk menandai dan mengarsipkan titik budaya baru!</span>
      </div>
    </div>

    <!-- Header & Stats Bar -->
    <div class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_#0D0D0D] flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Badge variant="green">CROWDSOURCED ARCHIVE</Badge>
            <Badge variant="yellow">{{ culturalPoints.length }} TITIK TERSETUJUI</Badge>
          </div>
          <h1 class="text-3xl font-black uppercase text-[#0D0D0D]">Peta Budaya Arek Suroboyo</h1>
          <p class="text-sm font-medium text-neutral-600">
            Kolektif arsip tongkrongan, mural, warung giras legendaris, dan ruang kreatif pemuda Surabaya.
          </p>
        </div>
      </div>

      <!-- Wilayah Filter Buttons -->
      <div class="flex flex-wrap items-center gap-2 pt-1 border-t-2 border-dashed border-[#0D0D0D]">
        <span class="text-xs font-black uppercase tracking-wider text-neutral-500 mr-1">FILTER WILAYAH:</span>
        <Button
          :variant="selectedWilayahKey === null ? 'primary' : 'outline'"
          size="sm"
          @click="selectRegion(null)"
        >
          SEMUA <span v-if="culturalPoints.length > 0">({{ culturalPoints.length }})</span>
        </Button>
        <button
          v-for="geo in SURABAYA_WILAYAH_GEO"
          :key="geo.key"
          @click="selectRegion(geo.key)"
          :style="{
            backgroundColor: selectedWilayahKey === geo.key ? geo.fillColor : 'white',
          }"
          class="px-3 py-1.5 border-3 border-[#0D0D0D] font-black text-xs uppercase tracking-wide shadow-[3px_3px_0px_#0D0D0D] transition-all duration-150 cursor-pointer select-none hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#0D0D0D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#0D0D0D] flex items-center"
        >
          <span class="inline-block w-2.5 h-2.5 mr-1.5 border border-[#0D0D0D]" :style="{ backgroundColor: geo.fillColor }"></span>
          {{ geo.label.replace('Surabaya ', '') }}
          <span v-if="selectedWilayahKey === geo.key" class="ml-1">({{ filteredCulturalPoints.length }})</span>
        </button>
      </div>
    </div>

    <!-- Map Container -->
    <div class="border-3 border-[#0D0D0D] bg-white p-2 shadow-[6px_6px_0px_#0D0D0D] relative">
      <div ref="mapContainer" class="w-full h-[600px] z-0"></div>
    </div>

    <!-- Neubrutalism Modal: Tambah Titik Budaya -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 bg-[#0D0D0D]/60 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] w-full max-w-lg p-6 shadow-[8px_8px_0px_#0D0D0D] space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b-2 border-[#0D0D0D] pb-3">
          <div>
            <Badge variant="black">INPUT ARSIP BUDAYA</Badge>
            <h3 class="text-xl font-black uppercase text-[#0D0D0D] mt-1">Tambah Titik Budaya Baru</h3>
          </div>
          <button @click="closeModal" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 hover:bg-[#FF3B3B] hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div v-if="submitErrorMsg" class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white p-3 text-xs font-bold shadow-[2px_2px_0px_#0D0D0D] flex items-center gap-2">
          <span class="w-4 h-4 bg-white text-[#FF3B3B] font-black text-[10px] flex items-center justify-center">!</span>
          <span>{{ submitErrorMsg }}</span>
        </div>

        <form @submit.prevent="submitTitik" class="space-y-4">
          <!-- Coordinates Info -->
          <div class="border-2 border-[#0D0D0D] bg-[#FFE500] p-2.5 flex items-center justify-between text-xs font-mono font-bold">
            <span>KOORDINAT:</span>
            <span>Lat: {{ formLat }}, Lng: {{ formLng }}</span>
          </div>

          <!-- Wilayah -->
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Wilayah Surabaya <span class="text-[#FF3B3B]">*</span></label>
            <select
              v-model="formWilayahId"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-bold text-sm shadow-[2px_2px_0px_#0D0D0D] outline-none"
            >
              <option v-for="w in wilayahList" :key="w.id" :value="w.id">{{ w.nama }}</option>
            </select>
          </div>

          <!-- Judul -->
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Nama / Judul Titik Budaya <span class="text-[#FF3B3B]">*</span></label>
            <Input v-model="formJudul" placeholder="Contoh: Warkop Giras Mbak Sri / Spot Mural Kenjeran" required />
          </div>

          <!-- Deskripsi -->
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Deskripsi Naratif <span class="text-[#FF3B3B]">*</span></label>
            <textarea
              v-model="formDeskripsi"
              rows="3"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-medium text-sm shadow-[2px_2px_0px_#0D0D0D] outline-none"
              placeholder="Ceritakan latar belakang, mengapa tempat ini berharga bagi arek muda Surabaya..."
              required
            ></textarea>
          </div>

          <!-- Slang Terkait -->
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Slang / Dialek Terkait (Opsional)</label>
            <Input v-model="formSlang" placeholder="Contoh: Cuk, Giras, Mbois, Cangkrukan" />
          </div>

          <!-- Upload Foto -->
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Foto Dokumentasi</label>
            <input
              id="titik-foto-upload"
              type="file"
              accept="image/*"
              @change="handleFotoChange"
              class="sr-only"
            />
            <label
              for="titik-foto-upload"
              class="border-3 border-dashed border-[#0D0D0D] bg-white hover:bg-[#FFFBF0] p-4 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-[4px_4px_0px_#0D0D0D] transition-all flex flex-col items-center justify-center gap-2 cursor-pointer select-none text-center"
            >
              <span class="inline-block px-3 py-1 bg-[#0D0D0D] text-[#FFE500] text-xs font-black uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D]">
                {{ formFoto ? 'GANTI FOTO' : 'PILIH FOTO DOKUMENTASI ➔' }}
              </span>
              <p class="text-xs font-bold text-neutral-600">
                <span v-if="formFoto" class="text-[#00C566] font-black">✓ {{ formFoto.name }} ({{ (formFoto.size / 1024).toFixed(0) }} KB)</span>
                <span v-else>Klik untuk memilih file gambar (JPG, PNG)</span>
              </p>
            </label>
            <div v-if="fotoPreview" class="mt-2 border-2 border-[#0D0D0D] p-2 bg-white space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black uppercase text-neutral-600">PREVIEW FOTO</span>
                <button
                  type="button"
                  @click="removeFoto"
                  class="text-[10px] font-black uppercase bg-[#FF3B3B] text-white px-2 py-0.5 border border-[#0D0D0D] hover:bg-[#e03030] cursor-pointer"
                >
                  ✕ Hapus
                </button>
              </div>
              <div class="border border-[#0D0D0D] overflow-hidden max-h-44 bg-neutral-100 flex items-center justify-center">
                <img :src="fotoPreview" alt="Preview Foto" class="max-h-40 w-auto object-contain" />
              </div>
            </div>
          </div>

          <!-- Audio Sprint 2 Placeholder -->
          <div class="border-2 border-dashed border-[#0D0D0D] p-2.5 bg-neutral-100 flex items-center justify-between text-neutral-500">
            <span class="text-xs font-bold">Rekaman Audio Dialek Suroboyoan</span>
            <Badge variant="black" class="text-[9px]">SPRINT 2</Badge>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0D0D0D]">
            <Button type="button" variant="outline" size="sm" @click="closeModal">Batal</Button>
            <Button type="submit" variant="primary" size="sm" :disabled="isSubmitting">
              {{ isSubmitting ? 'Mengirim...' : 'Kirim untuk Kurasi ➔' }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style>
.nb-leaflet-popup .leaflet-popup-content-wrapper {
  border: 3px solid #0D0D0D !important;
  border-radius: 0px !important;
  box-shadow: 4px 4px 0px #0D0D0D !important;
  background-color: #FFFBF0 !important;
  padding: 4px;
}
.nb-leaflet-popup .leaflet-popup-tip {
  background-color: #0D0D0D !important;
}
.nb-leaflet-tooltip {
  border: 2px solid #0D0D0D !important;
  border-radius: 0px !important;
  box-shadow: 2px 2px 0px #0D0D0D !important;
  background-color: #FFFBF0 !important;
  color: #0D0D0D !important;
  font-weight: 800 !important;
  font-size: 11px !important;
  padding: 3px 6px !important;
  text-transform: uppercase !important;
}
.wilayah-label-icon-map {
  pointer-events: none !important;
}
</style>
