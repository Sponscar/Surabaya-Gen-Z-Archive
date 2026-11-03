<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import { api } from '@/lib/api'

// Use string literals instead of enum to avoid ESM/CJS runtime issues
type JenisInstansiValue = 'Perguruan Tinggi' | 'Sekolah' | 'Komunitas' | 'Lainnya'
const JENIS_INSTANSI = {
  PERGURUAN_TINGGI: 'Perguruan Tinggi' as JenisInstansiValue,
  SEKOLAH: 'Sekolah' as JenisInstansiValue,
  KOMUNITAS: 'Komunitas' as JenisInstansiValue,
  LAINNYA: 'Lainnya' as JenisInstansiValue,
}

const currentStep = ref(1)
const isSubmitting = ref(false)
const isSuccess = ref(false)
const errorMsg = ref<string | null>(null)

// Step 1: Akun
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// Step 2: Identitas Warga Surabaya
const namaLengkap = ref('')
const nik = ref('')
const alamat = ref('')
const whatsapp = ref('')

// Step 3: Instansi
const jenisInstansi = ref<JenisInstansiValue>(JENIS_INSTANSI.PERGURUAN_TINGGI)
const instansiPerguruanTinggi = ref({ namaKampus: '', fakultas: '', jurusan: '', nim: '' })
const instansiSekolah = ref({ namaSekolah: '', kelas: '', nisn: '' })
const instansiKomunitas = ref({ namaKomunitas: '', peran: '', mediaSosial: '' })
const instansiLainnya = ref({ namaLembaga: '', deskripsi: '' })

// Step 4: KTP & UU PDP
const fotoKtp = ref<File | null>(null)
const fotoKtpPreview = ref<string | null>(null)
const pdpConsent = ref(false)

// Validations
const isSurabayaNik = computed(() => {
  return /^(3578|3574)\d{12}$/.test(nik.value)
})

const nikWarning = computed(() => {
  if (nik.value.length >= 4 && !nik.value.startsWith('3578') && !nik.value.startsWith('3574')) {
    return 'NIK bukan domisili Kota Surabaya (harus diawali 3578 atau 3574).'
  }
  if (nik.value.length > 0 && nik.value.length !== 16) {
    return `Panjang NIK harus tepat 16 digit (${nik.value.length}/16).`
  }
  return null
})

const isDragging = ref(false)

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    fotoKtp.value = target.files[0]
    fotoKtpPreview.value = URL.createObjectURL(target.files[0])
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0]
    fotoKtp.value = file
    fotoKtpPreview.value = URL.createObjectURL(file)
  }
}

function removeKtp() {
  fotoKtp.value = null
  fotoKtpPreview.value = null
}

function nextStep() {
  errorMsg.value = null

  if (currentStep.value === 1) {
    if (!email.value || !password.value) {
      errorMsg.value = 'Harap lengkapi email dan password.'
      return
    }
    if (password.value.length < 8) {
      errorMsg.value = 'Password minimal 8 karakter.'
      return
    }
    if (password.value !== confirmPassword.value) {
      errorMsg.value = 'Konfirmasi password tidak cocok.'
      return
    }
  } else if (currentStep.value === 2) {
    if (!namaLengkap.value || !nik.value || !alamat.value || !whatsapp.value) {
      errorMsg.value = 'Harap isi semua kolom identitas.'
      return
    }
    if (!isSurabayaNik.value) {
      errorMsg.value = 'NIK harus berdomisili Kota Surabaya (diawali 3578 / 3574).'
      return
    }
  }

  currentStep.value++
}

function prevStep() {
  errorMsg.value = null
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

async function handleRegister() {
  if (!fotoKtp.value) {
    errorMsg.value = 'Wajib mengunggah foto KTP untuk verifikasi.'
    return
  }
  if (!pdpConsent.value) {
    errorMsg.value = 'Anda harus menyetujui pernyataan persetujuan pemrosesan data (UU PDP).'
    return
  }

  isSubmitting.value = true
  errorMsg.value = null

  try {
    const formData = new FormData()
    formData.append('email', email.value)
    formData.append('password', password.value)
    formData.append('namaLengkap', namaLengkap.value)
    formData.append('nik', nik.value)
    formData.append('alamatLengkap', alamat.value)
    formData.append('alamat', alamat.value)
    formData.append('whatsapp', whatsapp.value)
    formData.append('jenisInstansi', jenisInstansi.value)

    let detailPayload: Record<string, any> = {}
    if (jenisInstansi.value === JENIS_INSTANSI.PERGURUAN_TINGGI) {
      detailPayload = {
        namaPT: instansiPerguruanTinggi.value.namaKampus,
        namaKampus: instansiPerguruanTinggi.value.namaKampus,
        fakultas: instansiPerguruanTinggi.value.fakultas,
        jurusan: instansiPerguruanTinggi.value.jurusan,
        nim: instansiPerguruanTinggi.value.nim,
      }
    } else if (jenisInstansi.value === JENIS_INSTANSI.SEKOLAH) {
      detailPayload = {
        namaSekolah: instansiSekolah.value.namaSekolah,
        kelas: instansiSekolah.value.kelas,
        nisn: instansiSekolah.value.nisn,
      }
    } else if (jenisInstansi.value === JENIS_INSTANSI.KOMUNITAS) {
      detailPayload = {
        namaKomunitas: instansiKomunitas.value.namaKomunitas,
        peran: instansiKomunitas.value.peran,
        mediaSosial: instansiKomunitas.value.mediaSosial,
      }
    } else {
      detailPayload = {
        namaLembaga: instansiLainnya.value.namaLembaga,
        deskripsi: instansiLainnya.value.deskripsi || instansiLainnya.value.namaLembaga,
      }
    }

    formData.append('instansiDetail', JSON.stringify(detailPayload))
    formData.append('ktp', fotoKtp.value)
    formData.append('fotoKtp', fotoKtp.value)

    await api.post('/auth/register', formData)

    isSuccess.value = true
  } catch (err: any) {
    if (Array.isArray(err.response?.data?.message)) {
      errorMsg.value = err.response.data.message.join('. ')
    } else {
      errorMsg.value = err.response?.data?.message || 'Registrasi gagal. Mohon periksa kembali input Anda.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="py-12 px-4 sm:px-6 max-w-2xl mx-auto space-y-8">
    <!-- Success Screen -->
    <div v-if="isSuccess" class="border-3 border-[#0D0D0D] bg-white p-8 shadow-[8px_8px_0px_#0D0D0D] space-y-6 text-center">
      <div class="inline-block px-6 py-3 bg-[#FFE500] border-3 border-[#0D0D0D] font-black text-2xl shadow-[4px_4px_0px_#0D0D0D]">
        SUKSES
      </div>
      <Badge variant="green" class="text-sm">PENDAFTARAN BERHASIL</Badge>
      <h2 class="text-3xl font-black uppercase text-[#0D0D0D]">Mbois, Rek! Akun Terdaftar</h2>
      <p class="text-sm font-medium text-neutral-700 leading-relaxed">
        Data KTP dan domisili Surabaya Anda telah diamankan dengan enkripsi AES-256 (Kepatuhan UU PDP). Akun Anda saat ini berstatus <strong class="bg-[#FFE500] px-1 border border-[#0D0D0D]">PENDING</strong> menunggu kurasi verifikator SGZA maksimal 1x24 jam.
      </p>
      <div class="pt-4 flex justify-center gap-4">
        <RouterLink to="/login">
          <Button variant="primary" size="lg">MASUK KE AKUN ➔</Button>
        </RouterLink>
        <RouterLink to="/sejarah">
          <Button variant="outline" size="lg">JELAJAHI SEJARAH</Button>
        </RouterLink>
      </div>
    </div>

    <!-- Registration Wizard -->
    <div v-else class="border-3 border-[#0D0D0D] bg-white p-6 sm:p-8 shadow-[8px_8px_0px_#0D0D0D] space-y-6">
      <!-- Header -->
      <div class="border-b-3 border-[#0D0D0D] pb-4">
        <div class="flex items-center justify-between mb-2">
          <Badge variant="yellow">ETNOGRAFER REGISTRATION</Badge>
          <span class="font-black text-xs font-mono">LANGKAH {{ currentStep }} / 4</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-black uppercase text-[#0D0D0D]">Daftar Kontributor SGZA</h1>
        <p class="text-xs font-medium text-neutral-600 mt-1">
          Hanya untuk pemuda & warga berdomisili Surabaya dengan KTP resmi.
        </p>
      </div>

      <!-- Step Progress Bar -->
      <div class="grid grid-cols-4 gap-2">
        <div
          v-for="s in 4"
          :key="s"
          :class="[
            'h-2.5 border-2 border-[#0D0D0D] transition-colors',
            s <= currentStep ? 'bg-[#FFE500]' : 'bg-neutral-200'
          ]"
        ></div>
      </div>

      <!-- Error Message -->
      <div v-if="errorMsg" class="border-2 border-[#0D0D0D] bg-[#FF3B3B] text-white p-3 text-xs font-bold shadow-[2px_2px_0px_#0D0D0D] flex items-center gap-2">
        <span class="w-4 h-4 bg-white text-[#FF3B3B] font-black text-[10px] flex items-center justify-center">!</span>
        <span>{{ errorMsg }}</span>
      </div>

      <!-- STEP 1: Akun -->
      <div v-if="currentStep === 1" class="space-y-4">
        <div class="font-extrabold text-sm uppercase bg-[#FFFBF0] p-2 border-2 border-[#0D0D0D]">
          Langkah 1: Kredensial Akun
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Email <span class="text-[#FF3B3B]">*</span></label>
          <Input v-model="email" type="email" placeholder="nama@domain.com" required />
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Password (Min. 8 Karakter) <span class="text-[#FF3B3B]">*</span></label>
          <div class="relative">
            <Input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="pr-12"
              required
            />
            <button
              type="button"
              tabindex="-1"
              @pointerdown.prevent="showPassword = !showPassword"
              @click.prevent
              class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 border-2 border-[#0D0D0D] bg-[#FFE500] hover:bg-[#ffe81a] text-[#0D0D0D] shadow-[1px_1px_0px_#0D0D0D] active:shadow-none flex items-center justify-center cursor-pointer select-none transition-colors duration-75"
              :title="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              aria-label="Toggle password visibility"
            >
              <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Konfirmasi Password <span class="text-[#FF3B3B]">*</span></label>
          <div class="relative">
            <Input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="pr-12"
              required
            />
            <button
              type="button"
              tabindex="-1"
              @pointerdown.prevent="showConfirmPassword = !showConfirmPassword"
              @click.prevent
              class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 border-2 border-[#0D0D0D] bg-[#FFE500] hover:bg-[#ffe81a] text-[#0D0D0D] shadow-[1px_1px_0px_#0D0D0D] active:shadow-none flex items-center justify-center cursor-pointer select-none transition-colors duration-75"
              :title="showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              aria-label="Toggle confirm password visibility"
            >
              <svg v-if="showConfirmPassword" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- STEP 2: Identitas Warga Surabaya -->
      <div v-else-if="currentStep === 2" class="space-y-4">
        <div class="font-extrabold text-sm uppercase bg-[#FFFBF0] p-2 border-2 border-[#0D0D0D]">
          Langkah 2: Verifikasi Domisili Surabaya
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Nama Lengkap Sesuai KTP <span class="text-[#FF3B3B]">*</span></label>
          <Input v-model="namaLengkap" placeholder="Contoh: Budi Santoso" required />
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Nomor Induk Kependudukan (NIK) <span class="text-[#FF3B3B]">*</span></label>
          <Input v-model="nik" maxlength="16" placeholder="3578xxxxxxxxxxxx" required />
          <div v-if="nikWarning" class="text-[11px] font-bold text-[#FF3B3B] mt-1">
            [X] {{ nikWarning }}
          </div>
          <div v-else-if="isSurabayaNik" class="text-[11px] font-bold text-[#00C566] mt-1">
            ✓ NIK teridentifikasi resmi Kota Surabaya.
          </div>
          <div class="text-[10px] text-neutral-500 font-medium">
            * Wajib diawali 3578 atau 3574 (Kode Resmi Kemendagri untuk Kota Surabaya).
          </div>
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Alamat Domisili di Surabaya <span class="text-[#FF3B3B]">*</span></label>
          <Input v-model="alamat" placeholder="Jl. Gubeng Pojok No. 12, Surabaya" required />
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Nomor WhatsApp Aktif <span class="text-[#FF3B3B]">*</span></label>
          <Input v-model="whatsapp" placeholder="08xxxxxxxxxx" required />
        </div>
      </div>

      <!-- STEP 3: Instansi & Komunitas -->
      <div v-else-if="currentStep === 3" class="space-y-4">
        <div class="font-extrabold text-sm uppercase bg-[#FFFBF0] p-2 border-2 border-[#0D0D0D]">
          Langkah 3: Afiliasi Instansi / Komunitas
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-black uppercase">Kategori Instansi <span class="text-[#FF3B3B]">*</span></label>
          <select
            v-model="jenisInstansi"
            class="border-3 border-[#0D0D0D] bg-white w-full p-2.5 font-bold text-sm shadow-[2px_2px_0px_#0D0D0D] outline-none"
          >
            <option :value="JENIS_INSTANSI.PERGURUAN_TINGGI">Perguruan Tinggi (Mahasiswa)</option>
            <option :value="JENIS_INSTANSI.SEKOLAH">Sekolah Menengah (Siswa SMA/SMK)</option>
            <option :value="JENIS_INSTANSI.KOMUNITAS">Komunitas / Kolektif Seni / Pemuda</option>
            <option :value="JENIS_INSTANSI.LAINNYA">Lainnya</option>
          </select>
        </div>

        <!-- Dynamic Form: Perguruan Tinggi -->
        <div v-if="jenisInstansi === JENIS_INSTANSI.PERGURUAN_TINGGI" class="space-y-3 p-3 border-2 border-[#0D0D0D] bg-[#FFFBF0]">
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Nama Kampus</label>
            <Input v-model="instansiPerguruanTinggi.namaKampus" placeholder="Contoh: UNAIR, ITS, UNESA, UPN, dll." />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="block text-xs font-black uppercase">Fakultas</label>
              <Input v-model="instansiPerguruanTinggi.fakultas" placeholder="FIB / FISIP / FT" />
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-black uppercase">Jurusan</label>
              <Input v-model="instansiPerguruanTinggi.jurusan" placeholder="Ilmu Sejarah / DKV" />
            </div>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">NIM</label>
            <Input v-model="instansiPerguruanTinggi.nim" placeholder="Nomor Induk Mahasiswa" />
          </div>
        </div>

        <!-- Dynamic Form: Sekolah -->
        <div v-else-if="jenisInstansi === JENIS_INSTANSI.SEKOLAH" class="space-y-3 p-3 border-2 border-[#0D0D0D] bg-[#FFFBF0]">
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Nama Sekolah</label>
            <Input v-model="instansiSekolah.namaSekolah" placeholder="Contoh: SMAN 5 Surabaya" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="block text-xs font-black uppercase">Kelas</label>
              <Input v-model="instansiSekolah.kelas" placeholder="XI MIPA 2" />
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-black uppercase">NISN</label>
              <Input v-model="instansiSekolah.nisn" placeholder="Nomor Induk Siswa Nasional" />
            </div>
          </div>
        </div>

        <!-- Dynamic Form: Komunitas -->
        <div v-else-if="jenisInstansi === JENIS_INSTANSI.KOMUNITAS" class="space-y-3 p-3 border-2 border-[#0D0D0D] bg-[#FFFBF0]">
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Nama Komunitas</label>
            <Input v-model="instansiKomunitas.namaKomunitas" placeholder="Contoh: Kolektif Arek Mural" />
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Peran / Posisi</label>
            <Input v-model="instansiKomunitas.peran" placeholder="Pengarsip / Koordinator" />
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Link Instagram / Media Sosial</label>
            <Input v-model="instansiKomunitas.mediaSosial" placeholder="@komunitas_surabaya" />
          </div>
        </div>

        <!-- Dynamic Form: Lainnya -->
        <div v-else class="space-y-3 p-3 border-2 border-[#0D0D0D] bg-[#FFFBF0]">
          <div class="space-y-1">
            <label class="block text-xs font-black uppercase">Nama Lembaga / Keterangan</label>
            <Input v-model="instansiLainnya.namaLembaga" placeholder="Nama organisasi atau inisiatif mandiri" />
          </div>
        </div>
      </div>

      <!-- STEP 4: KTP & Kepatuhan UU PDP -->
      <div v-else-if="currentStep === 4" class="space-y-5">
        <div class="font-extrabold text-sm uppercase bg-[#FFFBF0] p-2 border-2 border-[#0D0D0D]">
          Langkah 4: Unggah KTP & Persetujuan UU PDP
        </div>

        <div class="border-2 border-[#0D0D0D] bg-[#FFE500] p-4 text-xs font-bold space-y-1 shadow-[3px_3px_0px_#0D0D0D]">
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.5 bg-[#0D0D0D] text-[#FFE500] font-black text-[10px] border border-[#0D0D0D]">AES-256</span>
            <span class="uppercase font-black">Kepatuhan UU Perlindungan Data Pribadi (UU PDP):</span>
          </div>
          <p class="font-medium text-neutral-800">
            Foto KTP dan NIK Anda dienkripsi menggunakan algoritma AES-256 tingkat perbankan. Data ini hanya dapat diakses oleh kurator terotorisasi untuk validasi domisili dan tidak akan dipublikasikan.
          </p>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-black uppercase">Foto KTP Asli Surabaya <span class="text-[#FF3B3B]">*</span></label>
          
          <input
            id="ktp-upload"
            type="file"
            accept="image/*"
            @change="handleFileChange"
            class="sr-only"
          />

          <!-- Custom Neubrutalism Upload Box -->
          <label
            for="ktp-upload"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            :class="[
              'border-3 border-dashed border-[#0D0D0D] p-6 shadow-[3px_3px_0px_#0D0D0D] hover:shadow-[5px_5px_0px_#0D0D0D] transition-all flex flex-col items-center justify-center gap-2 cursor-pointer select-none text-center',
              isDragging ? 'bg-[#FFE500]' : 'bg-white hover:bg-[#FFFBF0]'
            ]"
          >
            <div class="w-12 h-12 bg-[#FFE500] border-2 border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D] flex items-center justify-center font-black text-sm text-[#0D0D0D]">
              KTP
            </div>
            <div class="space-y-1">
              <span class="inline-block px-4 py-2 bg-[#0D0D0D] text-[#FFE500] text-xs font-black uppercase tracking-wider border-2 border-[#0D0D0D] shadow-[2px_2px_0px_#0D0D0D] cursor-pointer hover:bg-neutral-800 transition-colors">
                {{ fotoKtp ? 'GANTI FOTO KTP' : 'PILIH FOTO KTP SURABAYA ➔' }}
              </span>
              <p class="text-xs font-bold text-neutral-600 mt-2">
                <span v-if="fotoKtp" class="text-[#00C566] font-black">✓ {{ fotoKtp.name }} ({{ (fotoKtp.size / 1024).toFixed(0) }} KB)</span>
                <span v-else>Klik tombol atau seret (drag & drop) gambar KTP ke sini</span>
              </p>
              <p class="text-[10px] text-neutral-500 font-medium">Format: JPG, JPEG, PNG (Maksimal 5MB)</p>
            </div>
          </label>

          <!-- Preview KTP -->
          <div v-if="fotoKtpPreview" class="border-3 border-[#0D0D0D] p-3 bg-white shadow-[4px_4px_0px_#0D0D0D] space-y-2">
            <div class="flex items-center justify-between border-b-2 border-[#0D0D0D] pb-2">
              <span class="text-xs font-black uppercase text-[#0D0D0D] flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-[#00C566] inline-block border border-[#0D0D0D]"></span>
                PREVIEW DOKUMEN KTP
              </span>
              <button
                type="button"
                @click="removeKtp"
                class="text-[11px] font-black uppercase bg-[#FF3B3B] text-white px-2.5 py-0.5 border-2 border-[#0D0D0D] shadow-[1px_1px_0px_#0D0D0D] hover:bg-[#e03030] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
              >
                ✕ Hapus
              </button>
            </div>
            <div class="border-2 border-[#0D0D0D] overflow-hidden max-h-56 bg-neutral-100 flex items-center justify-center p-2">
              <img :src="fotoKtpPreview" alt="Preview KTP" class="max-h-52 w-auto object-contain" />
            </div>
          </div>
        </div>

        <label class="flex items-start gap-3 p-3 border-2 border-[#0D0D0D] bg-white cursor-pointer shadow-[2px_2px_0px_#0D0D0D]">
          <input type="checkbox" v-model="pdpConsent" class="mt-1 w-4 h-4 accent-[#0D0D0D]" />
          <span class="text-xs font-bold text-neutral-800">
            Saya menyatakan bahwa data yang saya kirimkan adalah benar, dan saya menyetujui pemrosesan data untuk verifikasi etnografer SGZA sesuai ketentuan UU PDP.
          </span>
        </label>
      </div>

      <!-- Action Navigation -->
      <div class="flex items-center justify-between pt-4 border-t-2 border-[#0D0D0D]">
        <Button
          v-if="currentStep > 1"
          type="button"
          variant="outline"
          size="sm"
          @click="prevStep"
        >
          ← Sebelumnya
        </Button>
        <div v-else></div>

        <Button
          v-if="currentStep < 4"
          type="button"
          variant="black"
          size="sm"
          @click="nextStep"
        >
          Selanjutnya →
        </Button>
        <Button
          v-else
          type="button"
          variant="primary"
          size="sm"
          :disabled="isSubmitting"
          @click="handleRegister"
        >
          {{ isSubmitting ? 'Mengenkripsi & Mengirim...' : 'Kirim Pendaftaran ➔' }}
        </Button>
      </div>
    </div>
  </div>
</template>
