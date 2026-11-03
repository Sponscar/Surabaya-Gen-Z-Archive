<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import { api } from '@/lib/api'
import type { TitikBudaya, TitikSejarah } from '@sgza/shared'
import { SURABAYA_WILAYAH_GEO } from '@/lib/surabaya-geo'

const route = useRoute()

// Stats
const totalBudaya = ref<number>(0)
const totalSejarah = ref<number>(25)
const displayBudaya = ref<number>(0)
const displaySejarah = ref<number>(0)
const displayWilayah = ref<number>(0)

// Data lists
const titikSejarahPreview = ref<TitikSejarah[]>([])
const titikBudayaPreview = ref<TitikBudaya[]>([])
const loading = ref(true)

// Number count-up animation
function runCountUp(target: number, setter: (v: number) => void, duration = 1400) {
  if (target === 0) {
    setter(0)
    return
  }
  const startTime = performance.now()
  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3)
    setter(Math.round(target * ease))
    if (progress < 1) {
      requestAnimationFrame(step)
    } else {
      setter(target)
    }
  }
  requestAnimationFrame(step)
}

// Fallback preview titik sejarah jika API belum menyala
const fallbackSejarah: TitikSejarah[] = [
  {
    id: '1',
    wilayahId: '4',
    namaLokasi: 'Monumen Kapal Selam (Monkasel)',
    deskripsi: 'Kapal selam KRI Pasopati 410 yang dijadikan museum dan monumen. Simbol perjuangan TNI AL dan kebanggan warga Surabaya.',
    kategori: 'BUDAYA KONTEMPORER',
    lat: -7.2467,
    lng: 112.7406,
  },
  {
    id: '2',
    wilayahId: '4',
    namaLokasi: 'Pelabuhan Tanjung Perak',
    deskripsi: 'Pelabuhan terbesar kedua di Indonesia. Sejak era Kolonial Belanda menjadi pintu gerbang perdagangan Jawa Timur.',
    kategori: 'BUDAYA KONTEMPORER',
    lat: -7.2000,
    lng: 112.7300,
  },
  {
    id: '3',
    wilayahId: '4',
    namaLokasi: 'Kampung Arab Ampel',
    deskripsi: 'Kawasan bersejarah komunitas Arab-Muslim di Surabaya sejak abad ke-15. Pusat penyebaran Islam di Jawa Timur.',
    kategori: 'BUDAYA KONTEMPORER',
    lat: -7.2200,
    lng: 112.7450,
  },
]

// Fallback preview slang Suroboyoan
const sampleSlang = [
  { istilah: 'Giras', arti: 'Warung kopi khas Surabaya tempat nongkrong santai pemuda tanpa batas status sosial.', contoh: 'Ayo ngopi nang giras cedek kampus!' },
  { istilah: 'Mbois', arti: 'Keren, stylish, atau berkelas. Pujian otentik arek Suroboyo untuk karya atau penampilan.', contoh: 'Mbois temenan desaine arek-arek SGZA!' },
  { istilah: 'Cangkrukan', arti: 'Tradisi duduk berkumpul santai berjam-jam sambil berdiskusi atau bertukar ide.', contoh: 'Agenda malam minggu iki cangkrukan nang Balai Pemuda.' },
]

// Fallback preview komunitas
const sampleKomunitas = [
  { nama: 'Sub Collective Arts', kategori: 'Seni Rupa & Mural', deskripsi: 'Kolektif muralis muda yang mengaktivasi dinding publik Surabaya menjadi galeri terbuka.' },
  { nama: 'Arek Zine Maker', kategori: 'Literasi Independen', deskripsi: 'Gerakan penerbitan zine cetak swadaya karya pemuda Surabaya seputar musik dan isu lokal.' },
  { nama: 'Giras Skate Society', kategori: 'Urban Sports', deskripsi: 'Komunitas skateboarder lokal yang aktif meramaikan skatepark Taman Bungkul dan Ketabang.' },
]

onMounted(async () => {
  // Start immediate count-up animations for smooth UX
  runCountUp(25, (v) => { displaySejarah.value = v }, 1500)
  runCountUp(5, (v) => { displayWilayah.value = v }, 1000)

  // Handle URL hash scrolling if redirected from another page
  if (route.hash) {
    setTimeout(() => {
      const el = document.querySelector(route.hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 250)
  }

  try {
    const [resBudaya, resSejarah] = await Promise.allSettled([
      api.get<TitikBudaya[]>('/titik-budaya'),
      api.get<TitikSejarah[]>('/titik-sejarah'),
    ])

    if (resBudaya.status === 'fulfilled') {
      totalBudaya.value = resBudaya.value.data.length
      titikBudayaPreview.value = resBudaya.value.data.slice(0, 3)
      runCountUp(totalBudaya.value, (v) => { displayBudaya.value = v }, 1200)
    }

    if (resSejarah.status === 'fulfilled' && resSejarah.value.data.length > 0) {
      totalSejarah.value = resSejarah.value.data.length
      titikSejarahPreview.value = resSejarah.value.data.slice(0, 3)
      runCountUp(totalSejarah.value, (v) => { displaySejarah.value = v }, 1500)
    } else {
      titikSejarahPreview.value = fallbackSejarah
    }
  } catch (err) {
    console.warn('API backend offline, menggunakan data preview lokal:', err)
    titikSejarahPreview.value = fallbackSejarah
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="py-10 px-4 sm:px-6 max-w-7xl mx-auto space-y-16">
    <!-- Top anchor -->
    <div id="top" class="-mt-10"></div>

    <!-- Hero Banner (Neubrutalism Heavy) -->
    <div class="border-3 border-[#0D0D0D] bg-[#FFE500] p-8 sm:p-12 shadow-[8px_8px_0px_#0D0D0D] relative overflow-hidden">
      <div class="max-w-3xl space-y-6 relative z-10">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="red" class="text-xs uppercase tracking-wider">EVERYDAY ETHNOGRAPHER</Badge>
        </div>
        <h1 class="text-4xl sm:text-6xl font-black tracking-tight leading-tight uppercase text-[#0D0D0D]">
          Anak muda bukan objek penelitian, tapi pelaku pengarsipan.
        </h1>
        <p class="text-base sm:text-lg font-bold text-[#0D0D0D]/90">
          Surabaya Gen-Z Archive (SGZA) adalah repositori digital akar rumput untuk mendokumentasikan jejak budaya kontemporer, ruang kreatif, tongkrongan, dan dialek Suroboyoan yang hidup hari ini.
        </p>
        <div class="flex flex-wrap gap-4 pt-4">
          <RouterLink to="/sejarah">
            <Button variant="black" size="lg" class="text-base">🏛️ 25 TITIK SEJARAH</Button>
          </RouterLink>
          <RouterLink to="/map">
            <Button variant="outline" size="lg" class="text-base">📍 JELAJAHI PETA BUDAYA</Button>
          </RouterLink>
          <RouterLink to="/register">
            <Button variant="danger" size="lg" class="text-base">✍️ DAFTAR ETNOGRAFER</Button>
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Live Counter Section (Foto 2: 3 Cards dengan Animasi Angka Masuk) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
      <!-- Card 1: Titik Budaya -->
      <div class="border-3 border-[#0D0D0D] bg-white p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_#0D0D0D] cursor-default">
        <div class="text-4xl sm:text-6xl font-black text-[#0D0D0D] tracking-tight">
          {{ displayBudaya }}
        </div>
        <div class="text-xs sm:text-sm font-black uppercase text-neutral-600 mt-2 tracking-wide">
          Titik Budaya Crowdsourced
        </div>
      </div>

      <!-- Card 2: Titik Sejarah -->
      <div class="border-3 border-[#0D0D0D] bg-[#00C566] p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_#0D0D0D] cursor-default">
        <div class="text-4xl sm:text-6xl font-black text-[#0D0D0D] tracking-tight">
          {{ displaySejarah }}
        </div>
        <div class="text-xs sm:text-sm font-black uppercase text-[#0D0D0D] mt-2 tracking-wide">
          Titik Sejarah Kota
        </div>
      </div>

      <!-- Card 3: Wilayah Surabaya -->
      <div class="border-3 border-[#0D0D0D] bg-[#FFE500] p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_#0D0D0D] cursor-default">
        <div class="text-4xl sm:text-6xl font-black text-[#0D0D0D] tracking-tight">
          {{ displayWilayah }}
        </div>
        <div class="text-xs sm:text-sm font-black uppercase text-[#0D0D0D] mt-2 tracking-wide">
          Wilayah Surabaya
        </div>
      </div>
    </div>

    <!-- 5 Wilayah Surabaya Showcase -->
    <div id="wilayah" class="space-y-6 scroll-mt-24">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-3 border-[#0D0D0D] pb-4">
        <div>
          <Badge variant="black" class="mb-1">BAGIAN WILAYAH KOTA</Badge>
          <h2 class="text-2xl sm:text-3xl font-black uppercase tracking-tight">5 Wilayah Surabaya</h2>
          <p class="text-sm font-bold text-neutral-600">
            Total 31 Kecamatan terarsip secara geografis dan sosiokultural di SGZA.
          </p>
        </div>
        <RouterLink to="/sejarah">
          <Button variant="outline" size="sm">LIHAT PETA LENGKAP ➔</Button>
        </RouterLink>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div
          v-for="geo in SURABAYA_WILAYAH_GEO"
          :key="geo.key"
          class="border-3 border-[#0D0D0D] p-4 shadow-[4px_4px_0px_#0D0D0D] flex flex-col justify-between bg-white hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D] transition-all duration-200"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-2xl">{{ geo.emoji }}</span>
              <span
                :style="{ backgroundColor: geo.fillColor, color: '#0D0D0D' }"
                class="text-[10px] font-black uppercase px-2 py-0.5 border border-[#0D0D0D] shadow-[1px_1px_0px_#0D0D0D]"
              >
                {{ geo.kecamatanList.length }} KEC
              </span>
            </div>
            <h3 class="text-base font-black uppercase text-[#0D0D0D]">
              {{ geo.label }}
            </h3>
            <p class="text-[11px] font-bold text-neutral-600 leading-tight">
              {{ geo.kecamatanList.slice(0, 3).join(', ') }}{{ geo.kecamatanList.length > 3 ? ', dkk.' : '' }}
            </p>
          </div>
          <div class="pt-3 mt-3 border-t-2 border-[#0D0D0D] flex items-center justify-between">
            <span class="text-[10px] font-mono font-bold text-neutral-500">5 Titik Historis</span>
            <RouterLink to="/sejarah" class="text-[11px] font-black uppercase underline hover:text-[#FF3B3B]">
              Eksplorasi ➔
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION: SEJARAH (Foto 1: Ganti nama Highlight Arsip dengan Sejarah) -->
    <div id="sejarah" class="space-y-6 scroll-mt-24">
      <div class="border-3 border-[#0D0D0D] bg-white p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="max-w-2xl">
          <Badge variant="yellow" class="mb-2">SEJARAH</Badge>
          <h2 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0D0D0D]">
            Jangkar Sejarah Kota Pahlawan
          </h2>
          <p class="text-sm font-medium text-neutral-600 mt-1">
            Telusuri 25 titik memori kolektif yang membentuk lanskap historis dan perjuangan arek-arek Suroboyo dari masa kolonial hingga pasca-kemerdekaan.
          </p>
        </div>
        <div>
          <RouterLink to="/sejarah">
            <Button variant="black" size="md">BUKA PETA SEJARAH LENGKAP ➔</Button>
          </RouterLink>
        </div>
      </div>

      <!-- 3 Preview Cards Sejarah (Sesuai Foto 1) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="(point, idx) in (titikSejarahPreview.length > 0 ? titikSejarahPreview : fallbackSejarah)"
          :key="idx"
          class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_#0D0D0D] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_#0D0D0D]"
        >
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <Badge variant="green" class="text-[10px] uppercase font-black">
                {{ point.kategori || 'SEJARAH KOTA' }}
              </Badge>
              <span class="text-xs font-mono font-bold text-neutral-500 truncate">
                {{ point.namaLokasi }}
              </span>
            </div>
            <h3 class="text-lg font-black uppercase text-[#0D0D0D] line-clamp-1">
              {{ point.namaLokasi }}
            </h3>
            <p class="text-xs font-medium text-neutral-700 line-clamp-3 leading-relaxed">
              {{ point.deskripsi }}
            </p>
          </div>
          <div class="pt-4 mt-4 border-t-2 border-[#0D0D0D] flex items-center justify-between">
            <span class="text-[10px] font-mono text-neutral-500 font-bold">
              Lat: {{ point.lat?.toFixed(4) ?? '-7.2467' }}
            </span>
            <RouterLink to="/sejarah">
              <span class="text-xs font-black underline hover:text-[#FF3B3B]">Buka di Peta ➔</span>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION: PETA BUDAYA (Tujuan Scroll dari Navbar PETA BUDAYA) -->
    <div id="peta-budaya" class="space-y-6 scroll-mt-24">
      <div class="border-3 border-[#0D0D0D] bg-[#00C566] p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="max-w-2xl">
          <Badge variant="black" class="mb-2">PETA BUDAYA</Badge>
          <h2 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0D0D0D]">
            Arsip Budaya & Tongkrongan Gen-Z
          </h2>
          <p class="text-sm font-bold text-[#0D0D0D]/90 mt-1">
            Kolektif arsip tongkrongan, mural, warkop giras legendaris, dan ruang kreatif pemuda Surabaya yang didokumentasikan langsung oleh warga terverifikasi.
          </p>
        </div>
        <div>
          <RouterLink to="/map">
            <Button variant="black" size="md">JELAJAHI PETA BUDAYA INTERAKTIF ➔</Button>
          </RouterLink>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] space-y-2 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]">
          <span class="text-2xl">🎨</span>
          <h4 class="font-black uppercase text-base">Spot Seni & Mural Jalanan</h4>
          <p class="text-xs font-medium text-neutral-700">
            Dokumentasi mural urban dan karya seni jalanan karya arek muda yang tersebar di sudut-sudut kota.
          </p>
        </div>
        <div class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] space-y-2 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]">
          <span class="text-2xl">☕</span>
          <h4 class="font-black uppercase text-base">Warkop Giras Legendaris</h4>
          <p class="text-xs font-medium text-neutral-700">
            Jangkar sosial pemuda Surabaya: titik cangkrukan 24 jam dengan kopi kothok dan obrolan hangat.
          </p>
        </div>
        <div class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] space-y-2 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]">
          <span class="text-2xl">📍</span>
          <h4 class="font-black uppercase text-base">Kontribusi Mandiri Warga</h4>
          <p class="text-xs font-medium text-neutral-700">
            Warga ber-KTP Surabaya terverifikasi dapat menandai titik koordinat dan mengunggah foto secara langsung.
          </p>
        </div>
      </div>
    </div>

    <!-- SECTION: SLANG SUROBOYOAN (Tujuan Scroll dari Navbar SLANG) -->
    <div id="slang" class="space-y-6 scroll-mt-24">
      <div class="border-3 border-[#0D0D0D] bg-[#FFE500] p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="max-w-2xl">
          <div class="flex items-center gap-2 mb-2">
            <Badge variant="black">SLANG SUROBOYOAN</Badge>
            <Badge variant="red">SPRINT 2</Badge>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0D0D0D]">
            Kamus Dialek & Slang Arek Suroboyo
          </h2>
          <p class="text-sm font-bold text-[#0D0D0D]/90 mt-1">
            Dokumentasi kekayaan linguistik dan kosakata khas pemuda Surabaya dari masa ke masa.
          </p>
        </div>
        <div>
          <RouterLink to="/slang">
            <Button variant="outline" size="md">BUKA KAMUS SLANG ➔</Button>
          </RouterLink>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="s in sampleSlang"
          :key="s.istilah"
          class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-mono text-xs font-bold text-neutral-500">DIALEK AREK</span>
              <span class="text-[10px] font-black uppercase bg-[#FFE500] px-2 py-0.5 border border-[#0D0D0D]">POPULER</span>
            </div>
            <h4 class="text-2xl font-black uppercase text-[#0D0D0D] mb-1">{{ s.istilah }}</h4>
            <p class="text-xs font-medium text-neutral-700 mb-3">{{ s.arti }}</p>
          </div>
          <div class="p-2.5 bg-[#FFFBF0] border-2 border-[#0D0D0D] text-xs font-bold italic">
            "{{ s.contoh }}"
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION: KOMUNITAS (Tujuan Scroll dari Navbar KOMUNITAS) -->
    <div id="komunitas" class="space-y-6 scroll-mt-24">
      <div class="border-3 border-[#0D0D0D] bg-white p-6 shadow-[5px_5px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="max-w-2xl">
          <div class="flex items-center gap-2 mb-2">
            <Badge variant="black">JARINGAN KOMUNITAS</Badge>
            <Badge variant="red">SPRINT 2</Badge>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0D0D0D]">
            Direktori Komunitas Pemuda Kota
          </h2>
          <p class="text-sm font-medium text-neutral-600 mt-1">
            Wadah kolaborasi kolektif seni independen, pegiat zine, skater, dan komunitas pemuda se-Surabaya.
          </p>
        </div>
        <div>
          <RouterLink to="/komunitas">
            <Button variant="outline" size="md">JELAJAHI KOMUNITAS ➔</Button>
          </RouterLink>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="k in sampleKomunitas"
          :key="k.nama"
          class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]"
        >
          <div>
            <Badge variant="yellow" class="text-[10px] uppercase mb-2">{{ k.kategori }}</Badge>
            <h4 class="text-xl font-black uppercase text-[#0D0D0D] mb-2">{{ k.nama }}</h4>
            <p class="text-xs font-medium text-neutral-700">{{ k.deskripsi }}</p>
          </div>
          <div class="pt-3 mt-3 border-t-2 border-[#0D0D0D]">
            <RouterLink to="/komunitas" class="text-xs font-black uppercase underline hover:text-[#FF3B3B]">
              Detail Komunitas ➔
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Core Pillars / Why SGZA -->
    <div id="pilar" class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 scroll-mt-24">
      <Card variant="white" class="space-y-3">
        <Badge variant="yellow">PILAR 1</Badge>
        <h3 class="text-xl font-black uppercase">Kurasi Partisipatoris</h3>
        <p class="text-sm font-medium text-neutral-700">
          Setiap pemuda Surabaya dapat mengajukan titik tongkrongan, mural, sanggar, atau spot komunitas. Semua diuji dan diverifikasi oleh kurator ahli.
        </p>
      </Card>

      <Card variant="white" class="space-y-3">
        <Badge variant="green">PILAR 2</Badge>
        <h3 class="text-xl font-black uppercase">Jangkar 5 Wilayah Sejarah</h3>
        <p class="text-sm font-medium text-neutral-700">
          Surabaya Barat, Utara, Pusat, Timur, dan Selatan memiliki memori kolektif yang unik. Peta interaktif menghubungkan warisan sejarah dengan dinamika modern.
        </p>
      </Card>

      <Card variant="white" class="space-y-3">
        <Badge variant="red">PILAR 3</Badge>
        <h3 class="text-xl font-black uppercase">Kedaulatan Data Warga</h3>
        <p class="text-sm font-medium text-neutral-700">
          Enkripsi AES-256 melindungi NIK dan KTP pendaftar secara ketat. Validasi domisili NIK 3578/3574 memastikan hanya warga Surabaya yang memvalidasi arsip.
        </p>
      </Card>
    </div>
  </div>
</template>
