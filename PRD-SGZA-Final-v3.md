# Product Requirements Document (PRD) — FINAL v3.0

# SGZA: Surabaya Gen-Z Archive

| | |
|---|---|
| **Versi** | 3.0 (Final — Sprint 1 / MVP, **deadline 3 November 2026**) |
| **Tanggal** | 2 November 2026 |
| **Status** | [OK] Approved — Siap Development |

---

## 1. Ringkasan Produk

SGZA (Surabaya Gen-Z Archive) adalah repositori digital berbasis partisipasi publik (*crowdsourced archiving*) yang memposisikan Gen Z Surabaya sebagai **Everyday Ethnographer** — peneliti budaya sehari-hari, bukan sekadar penikmat budaya. Platform ini mengarsipkan budaya Gen Z Surabaya (karya, titik budaya, slang) dalam satu platform, di tengah dokumentasi sejarah kota yang selama ini didominasi narasi kolonial dan tradisi klasik.

**Tagline internal:** *Anak muda bukan objek penelitian, tapi pelaku pengarsipan.*

### Isu yang Dipecahkan
1. Tidak ada wadah digital untuk budaya Gen Z Surabaya (slang, titik budaya, karya).
2. Sejarah kota yang terdokumentasi masih berpusat pada narasi kolonial & klasik.
3. Potensi Gen Z sebagai pewaris dan peneliti budayanya sendiri belum disalurkan.

---

## 2. Tech Stack (Final, Disepakati)

| Lapisan | Teknologi | Alasan |
|---------|-----------|--------|
| Frontend | **Vue 3 + Vite + TypeScript** | Sesuai brief; TS untuk type safety end-to-end |
| Backend | **NestJS (TypeScript)** | Struktur modular, integrasi resmi MikroORM, decorator auth guard, scalable |
| Database | **PostgreSQL + PostGIS** | Penyimpanan & query koordinat (wajib untuk fitur peta) |
| ORM | **MikroORM** (`@mikro-orm/nestjs`) | Sesuai brief; paket resmi untuk NestJS |
| Map (fitur utama) | **OpenStreetMap** — tiles, Nominatim (geocoding), Overpass API (POI & boundary) | Gratis, sesuai brief |
| Auth | JWT (access + refresh token), bcrypt | Standar, aman |
| Storage file | Local disk / S3-compatible (foto KTP & foto titik) | Foto KTP dienkripsi at-rest |
| Map library (frontend) | **Leaflet** | Cepat untuk Sprint 1, upgradeable ke MapLibre GL |
| Monorepo tool | **pnpm workspaces + Turborepo** | Shared types antara web & api, satu command dev |

> [OK] **Keputusan final:** TypeScript end-to-end. NestJS + MikroORM + PostGIS. Monorepo dengan shared types package.

> [PERINGATAN] **Compliance (UU PDP):** Foto KTP & NIK disimpan terenkripsi, akses admin-only, persetujuan eksplisit user saat registrasi, kebijakan retensi.

---

## 3. Arsitektur & Design Pattern

### 3.1 Arsitektur: **Clean Architecture Lite**

Full clean architecture **ditolak** (terlalu berat untuk MVP 1 hari). Yang dipakai:
- Controller NestJS **tipis** → cuma terima HTTP, delegasi ke service/use-case
- **Service = use case** (aturan bisnis di sini)
- **Repository tipis** di atas MikroORM (controller tidak pernah sentuh EntityManager)
- Module CRUD sederhana (wilayah, titik-sejarah read-only) → struktur NestJS standar saja

### 3.2 Monorepo Structure

```
sgza/
├── apps/
│   ├── web/                    # Vue 3 + Vite + TS (Brutalism UI)
│   └── api/                    # NestJS + MikroORM + PostGIS
├── packages/
│   └── shared/                 # types dipakai web + api
│       ├── types/user.ts       # User, JenisInstansi, StatusAkun
│       └── types/titik.ts      # TitikBudaya, StatusTitik
├── package.json                # workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

### 3.3 Design Pattern — Sprint 1 (HANYA 4, Realistis utk Deadline)

| # | Pattern | Status | Untuk apa | Estimasi |
|---|---------|--------|-----------|----------|
| 1 | **DTO + ValidationPipe** | Built-in NestJS | Validasi form registrasi (NIK 16 digit, enum instansi, dll) + titik budaya | 30 mnt |
| 2 | **Repository tipis** | Built-in MikroORM | Semua akses DB terpusat, controller bersih | 20 mnt |
| 3 | **State Machine mini** | Custom (~20 baris) | Transisi status `PENDING → VERIFIED/REJECTED` (user) & `PENDING_REVIEW → APPROVED/REJECTED` (titik). Mencegah transisi ilegal | 45 mnt |
| 4 | **Factory mini** | Custom | Normalisasi field dinamis registrasi (frontend kirim `instansiDetail` ter-normalisasi, factory mapping ke entity) | 30 mnt |

**State machine (inti kode custom):**
```typescript
const TRANSISI_USER: Record<StatusAkun, StatusAkun[]> = {
  PENDING:  ['VERIFIED', 'REJECTED'],
  VERIFIED: [],
  REJECTED: ['PENDING'], // bisa ajukan ulang
};

// di entity User:
ubahStatus(target: StatusAkun) {
  if (!TRANSISI_USER[this.status].includes(target)) {
    throw new BadRequestException(`Transisi ${this.status} → ${target} tidak valid`);
  }
  this.status = target;
}
```

### 3.4 Pattern yang DITUNDA ke Sprint 2

| Pattern | Alasan ditunda |
|---------|----------------|
| Observer / Event-driven (`@nestjs/event-emitter`) | Notifikasi WA/email masih manual oleh admin di Sprint 1 |
| Strategy (geocoding) | Sprint 1 cukup parse NIK (kode `35.74` = Surabaya); Nominatim di Sprint 2 |
| Adapter OSM | Frontend Leaflet konsumsi OSM langsung; backend belum sentuh Nominatim di Sprint 1 |
| Full clean architecture layering | Struktur NestJS standar sudah cukup untuk Sprint 1 |

---

## 4. Tujuan Sprint 1 (MVP — Deadline 3 November 2026)

| No | Tujuan | Indikator Keberhasilan |
|----|--------|------------------------|
| 1 | Halaman Home, Sejarah, Map berjalan | 3 halaman MVP live |
| 2 | Registrasi dengan verifikasi domisili Surabaya + validasi admin | ≥90% registrasi selesai; ≥70% pending→verified ≤3 hari |
| 3 | User verified dapat menambahkan titik budaya di peta | ≥20 titik crowdsourced (approved) |

### Out of Scope Sprint 1
- Halaman Slang & Komunitas → **dummy** ("Coming Soon")
- Glosarium slang, pelatihan etnografi, audio wawancara real → Sprint 2
- Notifikasi otomatis (WA/email) → manual oleh admin dulu
- Geocoding otomatis → parse NIK manual sebagai filter domisili Sprint 1

---

## 5. Persona

1. **Gen Z Surabaya (User Utama):** ±17–27 th, warga Surabaya, memahami slang lokal & titik budaya kota.
2. **Admin/Validator:** memverifikasi KTP & mengaktifkan akun; menyetujui titik budaya.
3. **Visitor (read-only):** pengunjung non-login; hanya melihat Home, Sejarah, Map, halaman dummy.

---

## 6. Probis Fitur

### 6.1 Registrasi & Login
1. Halaman Register → user mengisi: email, password, nama lengkap (sesuai KTP), **NIK**, alamat lengkap, no. WhatsApp, **jenis instansi** (`Perguruan Tinggi` / `Sekolah` / `Komunitas` / `Lainnya`), **field dinamis** sesuai pilihan (dinormalisasi frontend menjadi `instansiDetail`), upload foto KTP.
2. Sistem cek domisili: **parse NIK** (kode wilayah `35.74` = Kota Surabaya). **User di luar Surabaya ditolak.**
3. Akun berstatus `PENDING` → **belum bisa** pakai fitur utama.
4. Admin validasi di dashboard → ubah status `VERIFIED` / `REJECTED` (lewat state machine — transisi ilegal ditolak).
5. User login → akses penuh (tambah titik di Map Page). Login menghasilkan JWT.

### 6.2 Halaman Sejarah
1. Map menampilkan wilayah: **Barat, Timur, Selatan, Utara**.
2. Klik wilayah → map **zoom in** ke area tersebut.
3. Muncul **titik koordinat sejarah** → klik → **pop-up penjelasan singkat** (judul + deskripsi).
4. Read-only untuk semua pengunjung.
5. **Data Sprint 1:** seed manual oleh tim.

### 6.3 Halaman Map (Fitur Utama)
1. Semua user melihat peta + titik budaya approved.
2. **User verified:** klik di peta → marker + **form pop-up**: foto (wajib), audio (opsional — dummy), slang terkait, deskripsi, koordinat (auto). Submit → status `PENDING_REVIEW` → tampil setelah **admin approve**.
3. User non-login/pending: hanya melihat.

### 6.4 Halaman Slang & Komunitas (Dummy)
Muncul di navbar, konten "Coming Soon — Sprint 2". Routing & struktur disiapkan.

### 6.5 Halaman Home
Hero "Everyday Ethnographer", cuplikan peta, jumlah titik, CTA "Jadi Etnografer Warga", highlight titik budaya terbaru.

---

## 7. Desain

### 7.1 Sistem Desain: BoldKit Neubrutalism
**Library:** [BoldKit](https://boldkit.dev) — komponen neubrutalism untuk Vue 3, berbasis shadcn-vue registry + Tailwind CSS.

**Prinsip visual:**
- Border tebal **3px solid hitam** pada semua komponen
- Hard-offset shadow **`4px 4px 0px #000`** (no blur)
- Warna aksen flat & saturated: **kuning `#FFE500`**, merah `#FF3B3B`, hijau `#00C566`
- Background putih/cream `#FFFBF0` sebagai base
- Typography: sans-serif bold, high contrast, anti-dekoratif
- Layout grid tegas, anti-standar, hover playful (translate effect)

**Representasi jiwa Gen Z yang edgy & melawan estetika arsip kolonial.**

### 7.2 Setup BoldKit di Monorepo
```bash
# Di apps/web — inisialisasi shadcn-vue dulu, lalu daftarkan registry BoldKit
# components.json
{
  "registries": {
    "@boldkit": "https://boldkit.dev/r/vue/{name}.json"
  }
}

# Install komponen per kebutuhan halaman
npx shadcn-vue@latest add @boldkit/button
npx shadcn-vue@latest add @boldkit/card
npx shadcn-vue@latest add @boldkit/input
npx shadcn-vue@latest add @boldkit/badge
npx shadcn-vue@latest add @boldkit/select
```

### 7.3 Mapping Komponen BoldKit per Halaman

| Halaman | Komponen BoldKit |
|---------|-----------------|
| Home | `card`, `button`, `badge` |
| Sejarah | `badge`, custom popup (styled manual) |
| Map | `button`, form popup (styled manual + Leaflet) |
| Register | `input`, `select`, `button`, `form` |
| Login | `input`, `button` |
| Admin Dashboard | `table`, `button`, `badge` |
| Slang/Komunitas (dummy) | `card` (coming soon placeholder) |

> [PERINGATAN] Tailwind CSS **wajib** dikonfigurasi di `apps/web`. Komponen BoldKit di-copy ke dalam project (bukan external dependency) sehingga mudah dikustomisasi sesuai kebutuhan SGZA.

---

## 8. Routing (Frontend)

```
/               → HomePage        /register  → RegisterPage (multi-step)
/sejarah        → SejarahPage     /login     → LoginPage
/map            → MapPage         /admin     → Dashboard verifikasi & approval
/slang          → SlangPage (DUMMY)
/komunitas      → KomunitasPage (DUMMY)
```

## 9. Modul Backend (NestJS)

```
src/modules/
├── auth/            # register, login, JWT, guard status VERIFIED
├── users/           # profil user
├── wilayah/         # seed polygon Barat/Timur/Selatan/Utara (CRUD standar)
├── titik-sejarah/   # read-only, seed (CRUD standar)
├── titik-budaya/    # CRUD crowdsourced + review (state machine + factory)
├── uploads/         # foto KTP (enkripsi) & foto titik
└── admin/           # dashboard verifikasi user & approval titik
```

---

## 10. Skema Database (Sprint 1)

```
users
- id (PK), email, password_hash, nama_lengkap, nik (encrypted),
  alamat_lengkap, whatsapp, jenis_instansi, instansi_detail,
  ktp_path (encrypted), status (PENDING | VERIFIED | REJECTED),
  created_at, verified_at, verified_by

wilayah (seed)
- id, nama (BARAT | TIMUR | SELATAN | UTARA), polygon (geometry)

titik_sejarah (seed, read-only)
- id, wilayah_id (FK), nama_lokasi, deskripsi, koordinat (geometry Point)

titik_budaya (crowdsourced)
- id, user_id (FK), wilayah_id (FK), judul, deskripsi, foto_path,
  audio_path (nullable), slang_terkait (nullable),
  koordinat (geometry Point),
  status (PENDING_REVIEW | APPROVED | REJECTED), created_at
```

**Entity MikroORM (titik budaya):**
```typescript
@Entity()
export class TitikBudaya {
  @PrimaryKey() id!: number;
  @ManyToOne(() => User) user!: User;
  @ManyToOne(() => Wilayah) wilayah!: Wilayah;
  @Property() judul!: string;
  @Property({ type: 'text', nullable: true }) deskripsi?: string;
  @Property() fotoPath!: string;
  @Property({ nullable: true }) audioPath?: string;
  @Property({ nullable: true }) slangTerkait?: string;
  @Property({ type: 'point', spatial: true }) koordinat!: Point;
  @Enum(() => StatusTitik) status: StatusTitik = StatusTitik.PENDING_REVIEW;
  @Property({ onCreate: () => new Date() }) createdAt!: Date;

  ubahStatus(target: StatusTitik) {
    // state machine: transisi ilegal ditolak
    const valid = TRANSISI_TITIK[this.status].includes(target);
    if (!valid) throw new BadRequestException('Transisi status tidak valid');
    this.status = target;
  }
}
```

---

## 11. Checklist Kerja Sprint 1 (Deadline 3 November)

```
[x]  1. Setup monorepo (pnpm + turbo) + NestJS + MikroORM + PostGIS (SELESAI)
[x]  2. packages/shared: types User, JenisInstansi, StatusAkun, TitikBudaya (SELESAI)
[x]  3. DTO + ValidationPipe global (register, login, titik)          (SELESAI)
[x]  4. User entity + repository + auth (JWT, bcrypt)                  (SELESAI)
[x]  5. State machine status user (TRANSISI_USER)                      (SELESAI)
[x]  6. Registrasi flow: factory + upload KTP + parse NIK Surabaya     (SELESAI)
[x]  7. Login + guard cek status VERIFIED                              (SELESAI)
[x]  8. Titik sejarah seed + endpoint GET                              (SELESAI)
[x]  9. Titik budaya: POST (verified only) + GET approved              (SELESAI)
[x] 10. State machine titik (TRANSISI_TITIK)                           (SELESAI)
[x] 11. Frontend scaffold + BoldKit Neubrutalism + Routing 8 halaman   (SELESAI)
[x] 12. Halaman Slang & Komunitas dummy                                (SELESAI)
```

---

## 12. API Peta (OpenStreetMap)

| Kebutuhan | API | Sprint |
|-----------|-----|--------|
| Basemap | OSM tile server | 1 (frontend Leaflet) |
| Filter domisili | Parse NIK (`35.74`) | 1 (backend) |
| Geocoding alamat | Nominatim | 2 (bantuan verifikasi) |
| POI sejarah / boundary | Overpass / Geofabrik | 2 (perkaya seed) |

[PERINGATAN] Rate limit Nominatim (~1 req/detik) → cache; produksi besar → self-host.

---

## 13. Metrik Keberhasilan Sprint 1

- ≥90% registrasi selesai hingga submit KTP.
- ≥70% user pending → verified oleh admin dalam 3 hari.
- ≥20 titik budaya crowdsourced (approved).
- 0 insiden kebocoran data KTP.

---

## 14. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Penyalahgunaan KTP (UU PDP) | Enkripsi at-rest, akses admin-only, persetujuan eksplisit, retensi policy |
| Titik spam / tidak akurat | Review flow admin; foto + deskripsi wajib |
| Verifikasi manual membebani admin | Batch review; notifikasi otomatis (Sprint 2) |
| Deadline ketat | Scope dipangkas: hanya 4 pattern, dummy page untuk Slang/Komunitas |

---

## 15. Keputusan Produk Final [OK]

1. Backend: **NestJS + TypeScript**; Full TS end-to-end (Vue TS).
2. Arsitektur: **Clean Architecture Lite** + monorepo (pnpm + Turborepo, shared types).
3. Pattern Sprint 1: **hanya 4** — DTO+Validation, Repository, State Machine mini, Factory mini.
4. Titik budaya tampil **setelah approve admin**.
5. Audio wawancara Sprint 1 = dummy.
6. User luar Surabaya **tidak bisa daftar** (filter NIK), boleh browsing read-only.
7. Bahasa UI: Indonesia.

---

*PRD Final v3.0 SGZA — disetujui untuk development Sprint 1 (deadline 3 November 2026).*
