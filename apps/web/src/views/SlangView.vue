<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import { RouterLink } from 'vue-router'
import { api } from '@/lib/api'

interface SlangItem {
  id?: number
  istilah?: string
  term?: string
  arti: string
  contoh: string
  kategori?: string
}

const defaultSlangs: SlangItem[] = [
  { istilah: 'Giras', arti: 'Warung kopi khas Surabaya dengan suasana akrab dan harga terjangkau.', contoh: 'Ayo ngopi nang giras cedek kampus!', kategori: 'Kuliner' },
  { istilah: 'Mbois', arti: 'Keren, gaya, atau memukau dalam dialek arek Surabaya.', contoh: 'Sepatumu mbois pol rek!', kategori: 'Ekspresi' },
  { istilah: 'Cangkruk', arti: 'Duduk berkumpul bersama kawan untuk ngobrol santai tanpa batasan waktu.', contoh: 'Bengi iki cangkruk nang Taman Bungkul yoh.', kategori: 'Tongkrongan' },
  { istilah: 'Rek', arti: 'Panggilan akrab untuk kawan atau kelompok orang di Surabaya (singkatan arek).', contoh: 'Piye kabare rek?', kategori: 'Sapaan' },
]

const slangs = ref<SlangItem[]>(defaultSlangs)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.get<SlangItem[]>('/slang')
    if (res.data && res.data.length > 0) {
      slangs.value = res.data
    }
  } catch {
    slangs.value = defaultSlangs
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="py-10 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
    <div class="border-3 border-[#0D0D0D] bg-[#FFE500] p-8 shadow-[6px_6px_0px_#0D0D0D] space-y-4">
      <div class="flex items-center gap-2">
        <Badge variant="black">DIALEK AREK</Badge>
        <Badge variant="green">{{ slangs.length }} ISTILAH TERARSIP</Badge>
      </div>
      <h1 class="text-3xl sm:text-5xl font-black uppercase text-[#0D0D0D]">Kamus Slang Suroboyoan</h1>
      <p class="font-bold text-neutral-800 max-w-2xl text-sm sm:text-base">
        Glosarium dialek, idiom jalanan, dan semantik bahasa tongkrongan arek muda Surabaya. Terintegrasi langsung dengan kurasi titik budaya warga.
      </p>
    </div>

    <!-- Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="s in slangs"
        :key="s.id || s.istilah || s.term"
        class="border-3 border-[#0D0D0D] bg-white p-5 shadow-[4px_4px_0px_#0D0D0D] space-y-2 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0px_#0D0D0D]"
      >
        <div class="flex items-center justify-between">
          <span class="text-2xl font-black uppercase text-[#0D0D0D]">{{ s.istilah || s.term }}</span>
          <Badge variant="yellow" class="text-[10px]">{{ s.kategori || 'ARSIP DIALEK' }}</Badge>
        </div>
        <p class="text-xs font-medium text-neutral-700">{{ s.arti }}</p>
        <div class="p-2 bg-[#FFFBF0] border border-[#0D0D0D] text-xs font-mono font-bold text-[#0D0D0D]">
          "{{ s.contoh }}"
        </div>
      </div>
    </div>

    <div class="border-3 border-dashed border-[#0D0D0D] p-6 text-center bg-white space-y-3">
      <h3 class="text-lg font-black uppercase">Ingin mengarsipkan istilah slang di titik budaya Anda?</h3>
      <p class="text-xs font-medium text-neutral-600">
        Anda dapat menyematkan slang terkait ketika mendaftarkan titik budaya di Peta Budaya.
      </p>
      <RouterLink to="/map">
        <Button variant="black" size="sm">Buka Peta Budaya ➔</Button>
      </RouterLink>
    </div>
  </div>
</template>
