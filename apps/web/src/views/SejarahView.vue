<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import L from 'leaflet'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { api } from '@/lib/api'
import type { TitikSejarah } from '@sgza/shared'
import { SURABAYA_WILAYAH_GEO, SURABAYA_BOUNDS, getWilayahStyle, type WilayahGeo } from '@/lib/surabaya-geo'

const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: L.Map | null = null
let wilayahLayerGroup: L.LayerGroup | null = null
let markersLayerGroup: L.LayerGroup | null = null

const allTitikSejarah = ref<TitikSejarah[]>([])
const selectedWilayahKey = ref<string | null>(null)
const selectedTitik = ref<TitikSejarah | null>(null)
const loading = ref(true)
const apiError = ref(false)

// Map API wilayah ID for filtering — keyed by NamaWilayah key
const wilayahIdMap = ref<Record<string, string>>({})

const filteredTitik = computed(() => {
  if (!selectedWilayahKey.value) return allTitikSejarah.value
  const targetId = wilayahIdMap.value[selectedWilayahKey.value]
  if (!targetId) return allTitikSejarah.value
  return allTitikSejarah.value.filter((t) => t.wilayahId === targetId)
})

// Marker icon generator for Neubrutalism
function createCustomIcon(_kategori: string) {
  return L.divIcon({
    className: 'custom-nb-marker',
    html: `
      <div style="
        background-color: #FFE500;
        border: 2px solid #0D0D0D;
        box-shadow: 2px 2px 0px #0D0D0D;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 14px;
        cursor: pointer;
        transform: rotate(-3deg);
      ">🏛️</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
  markersLayerGroup = L.layerGroup().addTo(mapInstance)

  // Otomatis langsung fokus ke seluruh wilayah Surabaya tanpa perlu klik
  mapInstance.fitBounds(SURABAYA_BOUNDS, { padding: [15, 15] })

  // Langsung tampilkan 5 wilayah Surabaya sejak awal
  renderWilayahPolygons()
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
        layer.on('click', () => {
          selectWilayah(geo.key)
        })
        if (feature.properties?.kecamatan) {
          layer.bindTooltip(`Kec. ${feature.properties.kecamatan} (${geo.label})`, {
            sticky: true,
            className: 'nb-leaflet-tooltip',
          })
        }
        layer.on('mouseover', (e: any) => {
          e.target.setStyle({
            fillOpacity: isSelected ? 0.75 : 0.55,
            weight: 2.5,
          })
        })
        layer.on('mouseout', (e: any) => {
          e.target.setStyle({
            fillOpacity: isSelected ? 0.65 : 0.40,
            weight: isSelected ? 2.5 : 1.5,
          })
        })
      },
    })

    // Label di titik pusat wilayah
    const labelMarker = L.marker(geo.center, {
      icon: L.divIcon({
        className: 'wilayah-label-icon',
        html: `<div style="
          background-color: ${isSelected ? geo.fillColor : 'rgba(255,255,255,0.92)'};
          border: 2px solid #0D0D0D;
          box-shadow: 2px 2px 0px #0D0D0D;
          padding: 2px 8px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
          color: #0D0D0D;
          pointer-events: none;
        ">${geo.emoji} ${geo.label.replace('Surabaya ', '')}</div>`,
        iconAnchor: [45, 12],
      }),
      interactive: false,
      zIndexOffset: 1000,
    })

    wilayahLayerGroup?.addLayer(polygonLayer)
    wilayahLayerGroup?.addLayer(labelMarker)
  })
}

function renderMarkers() {
  if (!markersLayerGroup || !mapInstance) return
  markersLayerGroup.clearLayers()

  filteredTitik.value.forEach((titik) => {
    if (typeof titik.lat !== 'number' || typeof titik.lng !== 'number') return

    const marker = L.marker([titik.lat, titik.lng], {
      icon: createCustomIcon(titik.kategori),
    })

    const popupContent = `
      <div style="font-family: inherit; padding: 4px; max-width: 240px;">
        <span style="display: inline-block; background-color: #0D0D0D; color: #FFE500; font-size: 10px; font-weight: 800; padding: 2px 6px; border: 1px solid #0D0D0D; text-transform: uppercase;">
          ${titik.kategori}
        </span>
        <h4 style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 6px 0 4px; color: #0D0D0D;">
          ${titik.namaLokasi}
        </h4>
        <p style="font-size: 11px; font-weight: 500; color: #333; line-height: 1.3; margin: 0 0 6px;">
          ${titik.deskripsi}
        </p>
        <span style="font-family: monospace; font-size: 10px; font-weight: 700; color: #666;">
          📍 ${titik.lat.toFixed(4)}, ${titik.lng.toFixed(4)}
        </span>
      </div>
    `

    marker.bindPopup(popupContent, {
      className: 'nb-leaflet-popup',
    })

    marker.on('click', () => {
      selectedTitik.value = titik
    })

    markersLayerGroup?.addLayer(marker)
  })
}

function selectWilayah(key: string | null) {
  selectedWilayahKey.value = key
  renderWilayahPolygons()
  renderMarkers()

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

function focusTitik(titik: TitikSejarah) {
  selectedTitik.value = titik
  if (mapInstance && typeof titik.lat === 'number' && typeof titik.lng === 'number') {
    mapInstance.flyTo([titik.lat, titik.lng], 15, { duration: 1 })
    markersLayerGroup?.eachLayer((layer: any) => {
      if (layer.getLatLng && layer.getLatLng().lat === titik.lat && layer.getLatLng().lng === titik.lng) {
        layer.openPopup()
      }
    })
  }
}

// Build a map of wilayah key -> wilayah ID from API data
function buildWilayahIdMap(apiWilayahList: Array<{ id: string; nama: string }>) {
  const map: Record<string, string> = {}
  apiWilayahList.forEach((w) => {
    // Match by upper-cased last word: "Surabaya Barat" -> "BARAT"
    const key = w.nama.split(' ').pop()?.toUpperCase() ?? ''
    if (key) map[key] = w.id
  })
  wilayahIdMap.value = map
}

onMounted(async () => {
  initMap()

  try {
    const [resWilayah, resTitik] = await Promise.all([
      api.get<Array<{ id: string; nama: string }>>('/wilayah'),
      api.get<TitikSejarah[]>('/titik-sejarah'),
    ])

    buildWilayahIdMap(resWilayah.data)
    allTitikSejarah.value = resTitik.data
    renderMarkers()
  } catch (err) {
    apiError.value = true
    console.warn('Backend API belum aktif / gagal dimuat:', err)
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
  <div class="py-8 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
    <!-- API Offline Notification -->
    <div v-if="apiError" class="border-3 border-[#0D0D0D] bg-[#FFE500] p-4 shadow-[4px_4px_0px_#0D0D0D] flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl">⚡</span>
        <div>
          <span class="font-extrabold text-sm block">Server API Backend Belum Berjalan</span>
          <span class="text-xs font-medium text-neutral-800">
            Peta wilayah tetap aktif. Untuk memuat titik historis & fitur crowdsource, jalankan <code class="bg-[#0D0D0D] text-[#FFE500] px-1.5 py-0.5 font-mono text-[11px] font-bold">npm run dev</code> di terminal.
          </span>
        </div>
      </div>
      <button @click="apiError = false" class="border-2 border-[#0D0D0D] bg-white font-black px-2 py-0.5 text-xs hover:bg-[#FF3B3B] hover:text-white cursor-pointer">✕</button>
    </div>

    <!-- Header -->
    <div class="border-3 border-[#0D0D0D] bg-white p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Badge variant="black">JANGKAR HISTORIS</Badge>
          <Badge variant="yellow">5 WILAYAH SURABAYA</Badge>
        </div>
        <h1 class="text-3xl font-black uppercase text-[#0D0D0D]">Peta Sejarah Kota</h1>
        <p class="text-sm font-medium text-neutral-600">
          Telusuri titik memori kolektif yang membentuk lanskap sosiokultural arek Surabaya dari masa ke masa.
        </p>
      </div>

      <!-- Wilayah Filter Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <Button
          :variant="selectedWilayahKey === null ? 'primary' : 'outline'"
          size="sm"
          @click="selectWilayah(null)"
        >
          SEMUA <span v-if="allTitikSejarah.length > 0">({{ allTitikSejarah.length }})</span>
        </Button>
        <button
          v-for="geo in SURABAYA_WILAYAH_GEO"
          :key="geo.key"
          @click="selectWilayah(geo.key)"
          :style="{
            backgroundColor: selectedWilayahKey === geo.key ? geo.fillColor : 'white',
          }"
          class="px-3 py-1.5 border-3 border-[#0D0D0D] font-black text-xs uppercase tracking-wide shadow-[3px_3px_0px_#0D0D0D] transition-all duration-150 cursor-pointer select-none hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#0D0D0D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#0D0D0D]"
        >
          {{ geo.emoji }} {{ geo.label.replace('Surabaya ', '') }}
          <span v-if="selectedWilayahKey === geo.key" class="ml-1 text-[#0D0D0D]">({{ filteredTitik.length }})</span>
        </button>
      </div>
    </div>

    <!-- Wilayah Legend Bar -->
    <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] p-3 shadow-[4px_4px_0px_#0D0D0D] flex flex-wrap items-center gap-3">
      <span class="text-xs font-black uppercase tracking-wider text-neutral-500 mr-1">LEGENDA WILAYAH:</span>
      <div
        v-for="geo in SURABAYA_WILAYAH_GEO"
        :key="geo.key"
        class="flex items-center gap-1.5"
      >
        <span
          :style="{ backgroundColor: geo.fillColor, borderColor: geo.color }"
          class="inline-block w-4 h-4 border-2 shadow-[1px_1px_0px_#0D0D0D]"
        ></span>
        <span class="text-xs font-bold uppercase">{{ geo.label.replace('Surabaya ', '') }}</span>
      </div>
    </div>

    <!-- Main Map + List Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Leaflet Map Container (2 Cols) -->
      <div class="lg:col-span-2 border-3 border-[#0D0D0D] bg-white p-2 shadow-[6px_6px_0px_#0D0D0D] flex flex-col">
        <div class="flex items-center justify-between px-3 py-2 border-b-2 border-[#0D0D0D] mb-2 bg-[#FFFBF0]">
          <span class="text-xs font-black uppercase tracking-wider">PETA INTERAKTIF KOTA</span>
          <span class="text-xs font-bold text-neutral-500">Klik wilayah / pin untuk info detail</span>
        </div>
        <div ref="mapContainer" class="w-full h-[520px] z-0"></div>
      </div>

      <!-- Historical Points List (1 Col) -->
      <div class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[6px_6px_0px_#0D0D0D] flex flex-col h-[600px]">
        <div class="pb-3 border-b-2 border-[#0D0D0D] mb-3 flex items-center justify-between">
          <div>
            <h3 class="text-base font-black uppercase">Daftar Titik Historis</h3>
            <span class="text-xs font-bold text-neutral-500">{{ filteredTitik.length }} lokasi ditemukan</span>
          </div>
          <Badge variant="green">{{ selectedWilayahKey ? 'TERFILTER' : 'LENGKAP' }}</Badge>
        </div>

        <div class="overflow-y-auto space-y-3 pr-1 flex-1">
          <div
            v-for="titik in filteredTitik"
            :key="titik.id"
            @click="focusTitik(titik)"
            :class="[
              'p-3 border-2 border-[#0D0D0D] cursor-pointer transition-all',
              selectedTitik?.id === titik.id
                ? 'bg-[#FFE500] shadow-[3px_3px_0px_#0D0D0D] translate-x-1'
                : 'bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#0D0D0D]'
            ]"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-black uppercase bg-[#0D0D0D] text-white px-1.5 py-0.5">
                {{ titik.kategori }}
              </span>
              <span class="text-[10px] font-mono font-bold text-neutral-500">
                📍 {{ titik.lat?.toFixed(3) }}, {{ titik.lng?.toFixed(3) }}
              </span>
            </div>
            <h4 class="font-extrabold text-sm uppercase text-[#0D0D0D]">{{ titik.namaLokasi }}</h4>
            <p class="text-xs font-medium text-neutral-700 line-clamp-2 mt-1">{{ titik.deskripsi }}</p>
          </div>

          <div v-if="loading" class="text-center py-8">
            <span class="text-xs font-black uppercase animate-pulse">Memuat data historis...</span>
          </div>
          <div v-else-if="filteredTitik.length === 0" class="text-center py-8 border-2 border-dashed border-[#0D0D0D]">
            <span class="text-xs font-black uppercase text-neutral-500">Tidak ada titik untuk wilayah ini</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Neubrutalism Leaflet Popup custom override */
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
.wilayah-label-icon {
  pointer-events: none !important;
}
</style>
