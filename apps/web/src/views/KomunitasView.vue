<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import { RouterLink } from 'vue-router'

const categories = [
  { nama: 'Kolektif Seni & Mural', desc: 'Arsip inisiatif grafiti, mural publik, dan seniman visual akar rumput Surabaya.' },
  { nama: 'Skena Musik Independen', desc: 'Pemetaan ruang gigs alternatif, rilisan fisik kaset, dan band independen Surabaya.' },
  { nama: 'Zine & Literasi Jalanan', desc: 'Dokumentasi penerbitan mandiri zine fotokopian, fanzine sepakbola, dan esai pemuda.' },
  { nama: 'Arsip Kuliner & Warkop Giras', desc: 'Rantai warkop tongkrongan pemuda yang menjadi simpul diskusi politik dan sosial.' },
]
</script>

<template>
  <div class="py-10 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
    <div class="border-3 border-[#0D0D0D] bg-[#00C566] p-8 shadow-[6px_6px_0px_#0D0D0D] space-y-4">
      <div class="flex items-center gap-2">
        <Badge variant="black">COMING SOON — SPRINT 2</Badge>
        <Badge variant="yellow">DIREKTORI KOLEKTIF</Badge>
      </div>
      <h1 class="text-3xl sm:text-5xl font-black uppercase text-[#0D0D0D]">Direktori Komunitas Arek Muda</h1>
      <p class="font-bold text-neutral-900 max-w-2xl text-sm sm:text-base">
        Ruang temu kolektif kreatif, penerbitan zine independen, skena musik, dan komunitas pegiat muda kota Surabaya yang membangun ekosistem kota dari bawah.
      </p>
    </div>

    <!-- Categories Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="c in categories"
        :key="c.nama"
        class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] space-y-2 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]"
      >
        <div class="flex items-center justify-between">
          <span class="text-lg font-black uppercase text-[#0D0D0D]">{{ c.nama }}</span>
          <Badge variant="green" class="text-[10px]">SPRINT 2</Badge>
        </div>
        <p class="text-xs font-medium text-neutral-700">{{ c.desc }}</p>
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
