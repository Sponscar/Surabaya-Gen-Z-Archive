<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import { RouterLink } from 'vue-router'
import { api } from '@/lib/api'

interface KomunitasItem {
  id?: number
  nama: string
  kategori: string
  deskripsi: string
  kontak?: string
  wilayahNama?: string
}

const defaultCategories = [
  { nama: 'Kolektif Seni & Mural', kategori: 'Seni', deskripsi: 'Arsip inisiatif grafiti, mural publik, dan seniman visual akar rumput Surabaya.' },
  { nama: 'Skena Musik Independen', kategori: 'Musik', deskripsi: 'Pemetaan ruang gigs alternatif, rilisan fisik kaset, dan band independen Surabaya.' },
  { nama: 'Zine & Literasi Jalanan', kategori: 'Literasi', deskripsi: 'Dokumentasi penerbitan mandiri zine fotokopian, fanzine sepakbola, dan esai pemuda.' },
  { nama: 'Arsip Kuliner & Warkop Giras', kategori: 'Kuliner', deskripsi: 'Rantai warkop tongkrongan pemuda yang menjadi simpul diskusi politik dan sosial.' },
]

const komunitasList = ref<KomunitasItem[]>(defaultCategories)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.get<KomunitasItem[]>('/komunitas')
    if (res.data && res.data.length > 0) {
      komunitasList.value = res.data
    }
  } catch {
    komunitasList.value = defaultCategories
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="py-10 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
    <div class="border-3 border-[#0D0D0D] bg-[#00C566] p-8 shadow-[6px_6px_0px_#0D0D0D] space-y-4">
      <div class="flex items-center gap-2">
        <Badge variant="black">DIREKTORI KOLEKTIF</Badge>
        <Badge variant="yellow">{{ komunitasList.length }} KOLEKTIF TERDAFTAR</Badge>
      </div>
      <h1 class="text-3xl sm:text-5xl font-black uppercase text-[#0D0D0D]">Direktori Komunitas Arek Muda</h1>
      <p class="font-bold text-neutral-900 max-w-2xl text-sm sm:text-base">
        Ruang temu kolektif kreatif, penerbitan zine independen, skena musik, dan komunitas pegiat muda kota Surabaya yang membangun ekosistem kota dari bawah.
      </p>
    </div>

    <!-- Categories Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="c in komunitasList"
        :key="c.id || c.nama"
        class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] space-y-2 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D] flex flex-col justify-between"
      >
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-lg font-black uppercase text-[#0D0D0D]">{{ c.nama }}</span>
            <Badge variant="green" class="text-[10px]">{{ c.kategori }}</Badge>
          </div>
          <p class="text-xs font-medium text-neutral-700">{{ c.deskripsi }}</p>
        </div>

        <div v-if="c.kontak || c.wilayahNama" class="pt-2 border-t border-[#0D0D0D]/20 text-xs font-mono font-bold text-neutral-600 space-y-0.5">
          <div v-if="c.kontak">Kontak: <span class="text-[#0D0D0D]">{{ c.kontak }}</span></div>
          <div v-if="c.wilayahNama">Basis: <span class="text-[#0D0D0D]">{{ c.wilayahNama }}</span></div>
        </div>
      </div>
    </div>

    <div class="border-3 border-[#0D0D0D] p-6 bg-[#FFE500] shadow-[4px_4px_0px_#0D0D0D] flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h3 class="text-lg font-black uppercase">Punya Komunitas di Surabaya?</h3>
        <p class="text-xs font-bold text-neutral-800">Daftarkan diri Anda sebagai perwakilan komunitas pada formulir pendaftaran etnografer.</p>
      </div>
      <RouterLink to="/register">
        <Button variant="black" size="sm">Daftar Komunitas ➔</Button>
      </RouterLink>
    </div>
  </div>
</template>
