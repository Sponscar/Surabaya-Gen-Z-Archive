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
const selectedPoint = ref<TitikBudaya | null>(null)
const isSidebarOpen = ref(true)
const wilayahIdMap = ref<Record<string, string>>({
  BARAT: '1',
  TIMUR: '2',
  SELATAN: '3',
  UTARA: '4',
  PUSAT: '5',
})

function matchesWilayahPoint(point: any, targetKey: string | null): boolean {
  if (!targetKey) return true
  const upperKey = targetKey.toUpperCase()
  const targetId = wilayahIdMap.value[upperKey]

  // 1. Cek direct wilayahId / wilayah_id / wilayahid
  const directId = point.wilayahId ?? point.wilayah_id ?? point.wilayahid
  if (targetId && directId !== undefined && directId !== null && String(directId) === String(targetId)) {
    return true
  }

  // 2. Cek point.wilayah sebagai objek
  if (point.wilayah && typeof point.wilayah === 'object') {
    if (targetId && point.wilayah.id !== undefined && String(point.wilayah.id) === String(targetId)) {
      return true
    }
    const wName = String(point.wilayah.nama || '').toUpperCase()
    if (wName.includes(upperKey)) return true
  }

  // 3. Cek point.wilayah jika string JSON
  if (typeof point.wilayah === 'string') {
    try {
      const parsed = JSON.parse(point.wilayah)
      if (targetId && parsed.id !== undefined && String(parsed.id) === String(targetId)) return true
      if (String(parsed.nama || '').toUpperCase().includes(upperKey)) return true
    } catch {
      if (point.wilayah.toUpperCase().includes(upperKey)) return true
    }
  }

  // 4. Cek namaWilayah / wilayahNama
  const nameCandidate = String(point.namaWilayah || point.wilayahNama || '').toUpperCase()
  if (nameCandidate && nameCandidate.includes(upperKey)) {
    return true
  }

  // 5. Fallback Geometris: Point-in-polygon berdasarkan koordinat (lat, lng)
  if (typeof point.lat === 'number' && typeof point.lng === 'number') {
    const detectedKey = findWilayahKeyByCoords(point.lat, point.lng)
    if (detectedKey && detectedKey.toUpperCase() === upperKey) {
      return true
    }
  }

  return false
}

const filteredCulturalPoints = computed(() => {
  if (!selectedWilayahKey.value) return culturalPoints.value
  return culturalPoints.value.filter((p) => matchesWilayahPoint(p, selectedWilayahKey.value))
})

function getCountByWilayah(key: string): number {
  return culturalPoints.value.filter((p) => matchesWilayahPoint(p, key)).length
}

// Modal State
const isModalOpen = ref(false)
const isSubmitting = ref(false)
const submitSuccessMsg = ref<string | null>(null)
const submitErrorMsg = ref<string | null>(null)

// Geolocation & Address State
const isGettingLocation = ref(false)
const geoError = ref<string | null>(null)
const isGeocoding = ref(false)
const geocodeError = ref<string | null>(null)
const isSearchingAddress = ref(false)
const addressSearchMsg = ref<string | null>(null)

// Form Fields
const formJudul = ref('')
const formDeskripsi = ref('')
const formAlamat = ref('')
const formSlang = ref('')
const formWilayahId = ref('')
const formLat = ref<number | null>(null)
const formLng = ref<number | null>(null)
const formFoto = ref<File | null>(null)
const fotoPreview = ref<string | null>(null)

function getTitikFotoUrl(path?: string): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/api/uploads/titik/')) return path
  if (path.startsWith('/uploads/titik/')) return `/api${path}`
  if (path.startsWith('/')) return path
  return `/api/uploads/titik/${path}`
}

function createCulturalIcon() {
  return L.divIcon({
    className: 'custom-cultural-marker-wrap',
    html: `
      <div class="sgza-pin-budaya" title="Titik Budaya Arek Suroboyo">
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

    // Auto-select wilayah based on clicked coordinates
    autoDetectAndSetWilayah(formLat.value, formLng.value)

    isModalOpen.value = true
    fetchAddressFromCoords(formLat.value, formLng.value)
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
      ? `<div style="margin-bottom: 8px; border: 2px solid #0D0D0D; overflow: hidden; max-height: 140px; background-color: #f5f5f5;">
           <img src="${getTitikFotoUrl(point.fotoPath)}" alt="${point.judul}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.parentElement.style.display='none';" />
         </div>`
      : ''

    const slangHtml = point.slangTerkait
      ? `<div style="margin: 4px 0;"><span style="background-color: #FFE500; border: 1px solid #0D0D0D; font-weight: 800; font-size: 10px; padding: 2px 6px;">SLANG: ${point.slangTerkait}</span></div>`
      : ''

    const alamatHtml = point.alamat
      ? `<div style="font-size: 11px; font-weight: 600; color: #222; margin: 4px 0 6px; line-height: 1.3;">
           <span style="background-color: #E2E8F0; border: 1px solid #0D0D0D; font-weight: 800; font-size: 9px; padding: 1px 4px; margin-right: 4px;">ALAMAT</span>${point.alamat}
         </div>`
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
        ${alamatHtml}
        ${slangHtml}
        <div style="font-family: monospace; font-size: 10px; font-weight: 700; color: #666; margin-top: 6px; border-top: 1px solid #ccc; padding-top: 4px;">
          ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}
        </div>
      </div>
    `

    marker.bindPopup(popupHtml, { className: 'nb-leaflet-popup' })
    marker.on('click', () => {
      selectedPoint.value = point
    })
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

function isPointInRing(pt: [number, number], ring: number[][]): boolean {
  const x = pt[0], y = pt[1]
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function findWilayahKeyByCoords(lat: number, lng: number): string | null {
  for (const geo of SURABAYA_WILAYAH_GEO) {
    if (!geo.geojson || !geo.geojson.features) continue
    for (const feat of geo.geojson.features) {
      if (!feat.geometry) continue
      if (feat.geometry.type === 'Polygon' && feat.geometry.coordinates?.[0]) {
        if (isPointInRing([lng, lat], feat.geometry.coordinates[0])) {
          return geo.key
        }
      } else if (feat.geometry.type === 'MultiPolygon' && feat.geometry.coordinates) {
        for (const poly of feat.geometry.coordinates) {
          if (poly?.[0] && isPointInRing([lng, lat], poly[0])) {
            return geo.key
          }
        }
      }
    }
  }
  return null
}

function autoDetectAndSetWilayah(lat: number, lng: number) {
  const detectedKey = findWilayahKeyByCoords(lat, lng)
  if (detectedKey && wilayahIdMap.value[detectedKey]) {
    formWilayahId.value = wilayahIdMap.value[detectedKey]
  } else if (!formWilayahId.value && wilayahList.value.length > 0) {
    formWilayahId.value = wilayahList.value[0].id
  }
}

function buildWilayahIdMap(apiWilayahList: Wilayah[]) {
  const map: Record<string, string> = {}
  apiWilayahList.forEach((w) => {
    const key = w.nama.split(' ').pop()?.toUpperCase() ?? ''
    if (key) map[key] = String(w.id)
  })
  wilayahIdMap.value = map
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
  setTimeout(() => {
    mapInstance?.invalidateSize()
  }, 100)
}

function focusCulturalPoint(point: TitikBudaya) {
  selectedPoint.value = point
  if (mapInstance && typeof point.lat === 'number' && typeof point.lng === 'number') {
    const targetLat = point.lat
    const targetLng = point.lng
    mapInstance.flyTo([targetLat, targetLng], 16, { duration: 1 })
    culturalMarkersLayer?.eachLayer((layer: any) => {
      if (layer.getLatLng && Math.abs(layer.getLatLng().lat - targetLat) < 0.0001 && Math.abs(layer.getLatLng().lng - targetLng) < 0.0001) {
        layer.openPopup()
      }
    })
  }
}

async function fetchAddressFromCoords(lat: number, lng: number) {
  isGeocoding.value = true
  geocodeError.value = null
  addressSearchMsg.value = null

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`,
      { headers: { Accept: 'application/json' } },
    )
    if (res.ok) {
      const data = await res.json()
      if (data && data.display_name) {
        formAlamat.value = data.display_name

        // Deteksi wilayah secara cerdas jika cocok dengan daftar wilayah
        const rawText = `${data.display_name} ${data.address?.city_district || ''} ${data.address?.suburb || ''}`.toUpperCase()
        for (const [key, id] of Object.entries(wilayahIdMap.value)) {
          if (rawText.includes(key)) {
            formWilayahId.value = id
            break
          }
        }
      }
    } else {
      geocodeError.value = 'Gagal mendeteksi alamat otomatis dari peta.'
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err)
    geocodeError.value = 'Tidak dapat memuat alamat otomatis (layanan peta sibuk).'
  } finally {
    isGeocoding.value = false
  }
}

async function searchCoordsFromAddress() {
  if (!formAlamat.value.trim()) {
    geocodeError.value = 'Ketik alamat terlebih dahulu untuk mencari titik koordinat.'
    return
  }

  isSearchingAddress.value = true
  geocodeError.value = null
  addressSearchMsg.value = null

  try {
    const query = formAlamat.value.toLowerCase().includes('surabaya')
      ? formAlamat.value
      : `${formAlamat.value}, Surabaya, Jawa Timur`

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
        formLat.value = lat
        formLng.value = lng

        const latlng = L.latLng(lat, lng)
        if (tempMarker) {
          tempMarker.setLatLng(latlng)
        } else if (mapInstance) {
          tempMarker = L.marker(latlng, {
            icon: L.divIcon({
              className: 'temp-marker',
              html: `<div style="background-color: #FF3B3B; border: 2px solid #0D0D0D; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px;">+</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          }).addTo(mapInstance)
        }

        if (mapInstance) {
          mapInstance.setView(latlng, 16)
        }

        addressSearchMsg.value = 'Titik koordinat berhasil disesuaikan dengan alamat!'
      } else {
        geocodeError.value = 'Alamat tidak ditemukan di peta Surabaya. Coba gunakan nama jalan/gedung yang lebih spesifik.'
      }
    } else {
      geocodeError.value = 'Layanan pencarian peta sedang sibuk. Coba lagi.'
    }
  } catch (err) {
    console.warn('Forward geocode error:', err)
    geocodeError.value = 'Gagal mencari koordinat alamat. Periksa koneksi internet.'
  } finally {
    isSearchingAddress.value = false
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    geoError.value = 'Browser Anda tidak mendukung geolokasi.'
    return
  }
  isGettingLocation.value = true
  geoError.value = null

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = parseFloat(position.coords.latitude.toFixed(6))
      const lng = parseFloat(position.coords.longitude.toFixed(6))
      formLat.value = lat
      formLng.value = lng

      // Update / create temp marker on map
      const latlng = L.latLng(lat, lng)
      if (tempMarker) {
        tempMarker.setLatLng(latlng)
      } else {
        tempMarker = L.marker(latlng, {
          icon: L.divIcon({
            className: 'temp-marker',
            html: `<div style="background-color: #FF3B3B; border: 2px solid #0D0D0D; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px;">+</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(mapInstance!)
      }

      if (mapInstance) {
        mapInstance.setView(latlng, 15)
      }

      // Auto-select first wilayah if none selected
      if (!formWilayahId.value && wilayahList.value.length > 0) {
        formWilayahId.value = wilayahList.value[0].id
      }

      isGettingLocation.value = false
      isModalOpen.value = true

      // Ambil dan tampilkan alamat dari lokasi saat ini
      await fetchAddressFromCoords(lat, lng)
    },
    (error) => {
      isGettingLocation.value = false
      if (error.code === error.PERMISSION_DENIED) {
        geoError.value = 'Akses lokasi ditolak. Izinkan akses lokasi di browser Anda.'
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        geoError.value = 'Informasi lokasi tidak tersedia.'
      } else if (error.code === error.TIMEOUT) {
        geoError.value = 'Permintaan lokasi habis waktu. Coba lagi.'
      } else {
        geoError.value = 'Gagal mendapatkan lokasi. Coba lagi.'
      }
    },
    { timeout: 10000, enableHighAccuracy: true },
  )
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
  formAlamat.value = ''
  formSlang.value = ''
  formFoto.value = null
  fotoPreview.value = null
  submitErrorMsg.value = null
  geocodeError.value = null
  addressSearchMsg.value = null
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
    if (formAlamat.value) formData.append('alamat', formAlamat.value)
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
    <div v-else class="border-3 border-[#0D0D0D] bg-[#00C566] p-3 shadow-[4px_4px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Badge variant="black">ETNOGRAFER TERVERIFIKASI</Badge>
        <span class="text-xs font-bold text-[#0D0D0D]">Klik di mana saja pada peta untuk menandai dan mengarsipkan titik budaya baru!</span>
      </div>
      <div class="flex flex-col items-end gap-1">
        <button
          type="button"
          @click="getCurrentLocation"
          :disabled="isGettingLocation"
          class="border-3 border-[#0D0D0D] bg-[#FFE500] text-[#0D0D0D] font-black text-xs uppercase px-3 py-1.5 shadow-[3px_3px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#0D0D0D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#0D0D0D] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          {{ isGettingLocation ? 'Mencari Lokasi...' : 'Gunakan Lokasi Saat Ini' }}
        </button>
        <span v-if="geoError" class="text-[10px] font-bold text-white bg-[#FF3B3B] px-1.5 py-0.5 border border-[#0D0D0D] max-w-[240px] text-right">{{ geoError }}</span>
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
          <span v-if="culturalPoints.length > 0" class="ml-1 font-mono">({{ getCountByWilayah(geo.key) }})</span>
        </button>
      </div>
    </div>

    <!-- Wilayah Legend Bar -->
    <div class="border-3 border-[#0D0D0D] bg-[#FFFBF0] p-3 shadow-[4px_4px_0px_#0D0D0D] flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
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

      <!-- Marker Budaya Preview Badge -->
      <div class="flex items-center gap-2 border-2 border-[#0D0D0D] bg-white px-2.5 py-1 shadow-[2px_2px_0px_#0D0D0D]">
        <div class="w-5 h-5 bg-[#00C566] border border-[#0D0D0D] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z" fill="#0D0D0D"/>
            <circle cx="12" cy="12" r="2.5" fill="#FFE500"/>
          </svg>
        </div>
        <span class="text-xs font-black uppercase tracking-wide text-[#0D0D0D]">PIN TITIK BUDAYA (URBAN KULTUR)</span>
      </div>
    </div>

    <!-- Main Map + List Grid -->
    <div class="grid grid-cols-1 gap-6" :class="isSidebarOpen ? 'lg:grid-cols-3' : 'lg:grid-cols-1'">
      <!-- Leaflet Map Container -->
      <div
        :class="isSidebarOpen ? 'lg:col-span-2' : 'col-span-1'"
        class="border-3 border-[#0D0D0D] bg-white p-2 shadow-[6px_6px_0px_#0D0D0D] flex flex-col transition-all duration-200"
      >
        <div class="flex items-center justify-between px-3 py-2 border-b-2 border-[#0D0D0D] mb-2 bg-[#FFFBF0]">
          <div class="flex items-center gap-2">
            <span class="text-xs font-black uppercase tracking-wider">PETA INTERAKTIF KOTA</span>
            <span class="text-xs font-bold text-neutral-500 hidden sm:inline">• Klik wilayah / pin untuk info detail</span>
          </div>

          <!-- Tombol Hide / Show Daftar Titik -->
          <button
            type="button"
            @click="toggleSidebar"
            class="border-2 border-[#0D0D0D] bg-white hover:bg-[#FFE500] text-[#0D0D0D] font-black text-xs uppercase px-2.5 py-1 shadow-[2px_2px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#0D0D0D] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#0D0D0D] transition-all cursor-pointer flex items-center gap-1.5"
            :title="isSidebarOpen ? 'Sembunyikan panel daftar titik' : 'Tampilkan panel daftar titik'"
          >
            <span class="w-2.5 h-2.5 border border-[#0D0D0D]" :class="isSidebarOpen ? 'bg-[#FF3B3B]' : 'bg-[#00C566]'"></span>
            {{ isSidebarOpen ? 'Sembunyikan Daftar' : 'Tampilkan Daftar' }}
            <span class="text-[10px] font-mono">({{ filteredCulturalPoints.length }})</span>
          </button>
        </div>
        <div ref="mapContainer" class="w-full h-[540px] z-0"></div>
      </div>

      <!-- Cultural Points List (1 Col) -->
      <div
        v-if="isSidebarOpen"
        class="border-3 border-[#0D0D0D] bg-white p-4 shadow-[6px_6px_0px_#0D0D0D] flex flex-col h-[620px]"
      >
        <div class="pb-3 border-b-2 border-[#0D0D0D] mb-3 flex items-center justify-between">
          <div>
            <h3 class="text-base font-black uppercase">Daftar Titik Budaya</h3>
            <span class="text-xs font-bold text-neutral-500">{{ filteredCulturalPoints.length }} lokasi ditemukan</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="green">{{ selectedWilayahKey ? 'TERFILTER' : 'LENGKAP' }}</Badge>
            <button
              type="button"
              @click="toggleSidebar"
              class="border-2 border-[#0D0D0D] bg-white hover:bg-[#FF3B3B] hover:text-white font-black text-xs px-1.5 py-0.5 shadow-[1px_1px_0px_#0D0D0D] transition-colors cursor-pointer"
              title="Sembunyikan panel"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="overflow-y-auto space-y-3 pr-1 flex-1">
          <div
            v-for="point in filteredCulturalPoints"
            :key="point.id"
            @click="focusCulturalPoint(point)"
            :class="[
              'p-3 border-2 border-[#0D0D0D] cursor-pointer transition-all',
              selectedPoint?.id === point.id
                ? 'bg-[#FFE500] shadow-[3px_3px_0px_#0D0D0D] translate-x-1'
                : 'bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#0D0D0D]'
            ]"
          >
            <!-- Thumbnail & Header -->
            <div v-if="point.fotoPath" class="mb-2 border border-[#0D0D0D] overflow-hidden h-28 bg-neutral-100">
              <img
                :src="getTitikFotoUrl(point.fotoPath)"
                :alt="point.judul"
                class="w-full h-full object-cover"
                onerror="this.onerror=null; this.parentElement.style.display='none';"
              />
            </div>

            <div class="flex items-center justify-between mb-1 gap-1">
              <span class="text-[10px] font-black uppercase bg-[#00C566] text-[#0D0D0D] px-1.5 py-0.5 border border-[#0D0D0D]">
                BUDAYA GEN-Z
              </span>
              <span v-if="point.lat && point.lng" class="text-[10px] font-mono font-bold text-neutral-500">
                {{ point.lat.toFixed(3) }}, {{ point.lng.toFixed(3) }}
              </span>
            </div>

            <h4 class="font-extrabold text-sm uppercase text-[#0D0D0D] leading-snug">{{ point.judul }}</h4>

            <div v-if="point.alamat" class="text-[11px] font-medium text-neutral-600 line-clamp-1 mt-1">
              <span class="font-bold text-[#0D0D0D]">Lokasi:</span> {{ point.alamat }}
            </div>

            <p class="text-xs font-medium text-neutral-700 line-clamp-2 mt-1">{{ point.deskripsi }}</p>

            <div v-if="point.slangTerkait" class="mt-2">
              <span class="text-[9px] font-black bg-[#FFE500] border border-[#0D0D0D] px-1.5 py-0.5">
                SLANG: {{ point.slangTerkait }}
              </span>
            </div>
          </div>

          <div v-if="loading" class="text-center py-8">
            <span class="text-xs font-black uppercase animate-pulse">Memuat data budaya...</span>
          </div>
          <div v-else-if="filteredCulturalPoints.length === 0" class="text-center py-8 border-2 border-dashed border-[#0D0D0D] space-y-2 p-3">
            <span class="text-xs font-black uppercase text-neutral-500 block">Tidak ada titik budaya di wilayah ini</span>
            <p class="text-[11px] text-neutral-600 font-medium">Jadilah etnografer pertama yang mengarsipkan tongkrongan atau karya budaya di sini!</p>
          </div>
        </div>
      </div>
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
          <div class="border-2 border-[#0D0D0D] bg-[#FFE500] p-2.5 space-y-2">
            <div class="flex items-center justify-between text-xs font-mono font-bold">
              <span>KOORDINAT:</span>
              <span>Lat: {{ formLat }}, Lng: {{ formLng }}</span>
            </div>
            <div v-if="formAlamat" class="text-[11px] font-semibold text-neutral-900 border-t border-[#0D0D0D]/30 pt-1.5 flex items-start gap-1.5">
              <span class="font-black text-[9px] uppercase bg-[#0D0D0D] text-[#FFE500] px-1.5 py-0.5 border border-[#0D0D0D] shrink-0">LOKASI</span>
              <span class="line-clamp-2 leading-tight">{{ formAlamat }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-[#0D0D0D]/30">
              <span class="text-[10px] font-bold text-[#0D0D0D]/70 uppercase">Atau perbarui dengan GPS Anda:</span>
              <button
                type="button"
                @click="getCurrentLocation"
                :disabled="isGettingLocation"
                class="border-2 border-[#0D0D0D] bg-white text-[#0D0D0D] font-black text-[10px] uppercase px-2.5 py-1 shadow-[2px_2px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#0D0D0D] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#0D0D0D] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {{ isGettingLocation ? 'Mencari...' : 'Lokasi Saat Ini' }}
              </button>
            </div>
            <div v-if="geoError" class="text-[10px] font-bold text-white bg-[#FF3B3B] px-1.5 py-0.5 border border-[#0D0D0D]">{{ geoError }}</div>
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

          <!-- Alamat / Patokan Lokasi -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-black uppercase">
                Alamat / Patokan Lokasi (Opsional)
              </label>
              <span v-if="isGeocoding" class="text-[10px] font-black text-[#0D0D0D] bg-[#FFE500] px-1.5 py-0.5 border border-[#0D0D0D] animate-pulse">
                Mendeteksi Alamat...
              </span>
            </div>
            <textarea
              v-model="formAlamat"
              rows="2"
              class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-medium text-xs shadow-[2px_2px_0px_#0D0D0D] outline-none"
              placeholder="Contoh: Jl. Basuki Rahmat No. 12, Embong Kaliasin, Genteng (atau patokan dekat tempat)"
            ></textarea>
            
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <span class="text-[10px] text-neutral-500 font-medium">
                Alamat otomatis terdeteksi saat pakai GPS / klik peta, atau ketik alamat manual.
              </span>
              <button
                type="button"
                @click="searchCoordsFromAddress"
                :disabled="isSearchingAddress || !formAlamat"
                class="border-2 border-[#0D0D0D] bg-[#FFE500] text-[#0D0D0D] font-black text-[10px] uppercase px-2.5 py-1 shadow-[2px_2px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#0D0D0D] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#0D0D0D] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap self-end sm:self-auto"
                title="Sesuaikan titik koordinat dan marker peta dari alamat yang diketik"
              >
                {{ isSearchingAddress ? 'Mencari...' : 'Cari di Peta ➔' }}
              </button>
            </div>

            <div v-if="addressSearchMsg" class="text-[10px] font-bold text-[#0D0D0D] bg-[#00C566] px-2 py-1 border border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D]">
              {{ addressSearchMsg }}
            </div>
            <div v-if="geocodeError" class="text-[10px] font-bold text-white bg-[#FF3B3B] px-2 py-1 border border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D]">
              {{ geocodeError }}
            </div>
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
/* Custom Budaya Neubrutalism Pin */
.custom-cultural-marker-wrap {
  background: transparent !important;
  border: none !important;
}

.sgza-pin-budaya {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
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
  transition: all 0.15s ease;
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

.sgza-pin-budaya .sgza-pin-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}

.sgza-pin-budaya .sgza-pin-pointer {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #0D0D0D;
  margin-top: -1px;
  filter: drop-shadow(2px 1px 0px rgba(13, 13, 13, 0.8));
  transition: all 0.15s ease;
}

.sgza-pin-budaya:hover {
  transform: translateY(-4px) scale(1.12);
  z-index: 9999 !important;
}

.sgza-pin-budaya:hover .sgza-pin-head {
  background-color: #00E676;
  box-shadow: 4px 4px 0px #0D0D0D;
}

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
