import { EntityManager } from '@mikro-orm/postgresql';
import { Seeder } from '@mikro-orm/seeder';
import { Wilayah } from '../../entities/wilayah.entity';
import { TitikSejarah } from '../../entities/titik-sejarah.entity';
import { User } from '../../entities/user.entity';
import { NamaWilayah, StatusAkun, JenisInstansi } from '@sgza/shared';
import * as bcrypt from 'bcrypt';

/**
 * DatabaseSeeder — seed awal Sprint 1:
 * 1. Admin user
 * 2. 4 wilayah Surabaya (polygon approximate)
 * 3. Titik sejarah (≥5 per wilayah)
 */
export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.seedAdmin(em);
    const wilayah = await this.seedWilayah(em);
    await this.seedTitikSejarah(em, wilayah);
    await em.flush();
    console.log('✅ Seed selesai.');
  }

  // ── Admin User ─────────────────────────────────────────────────────────────
  private async seedAdmin(em: EntityManager): Promise<void> {
    const existing = await em.findOne(User, { email: 'admin@sgza.id' });
    if (existing) return;

    const admin = em.create(User, {
      email: 'admin@sgza.id',
      passwordHash: await bcrypt.hash('Admin@SGZA2026!', 12),
      namaLengkap: 'Admin SGZA',
      nikEncrypted: 'ADMIN_NO_NIK',
      alamatLengkap: 'Surabaya',
      whatsapp: '081200000000',
      jenisInstansi: JenisInstansi.LAINNYA,
      status: StatusAkun.VERIFIED,
      isAdmin: true,
      createdAt: new Date(),
    });
    em.persist(admin);
    console.log('👤 Admin user seeded: admin@sgza.id');
  }

  // ── Wilayah ────────────────────────────────────────────────────────────────
  private async seedWilayah(em: EntityManager): Promise<Record<NamaWilayah, Wilayah>> {
    const existing = await em.findOne(Wilayah, { nama: NamaWilayah.BARAT });
    if (existing) {
      const all = await em.find(Wilayah, {});
      return Object.fromEntries(all.map((w) => [w.nama, w])) as Record<NamaWilayah, Wilayah>;
    }

    // Polygon approximate Surabaya per wilayah (WGS84 / SRID 4326)
    // Format: ST_GeomFromGeoJSON
    const wilayahData: Array<{ nama: NamaWilayah; polygon: string }> = [
      {
        nama: NamaWilayah.BARAT,
        // Surabaya Barat — approximate bounding polygon
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [112.6200, -7.2400],
            [112.6900, -7.2400],
            [112.6900, -7.3100],
            [112.6200, -7.3100],
            [112.6200, -7.2400],
          ]],
        }),
      },
      {
        nama: NamaWilayah.TIMUR,
        // Surabaya Timur — approximate
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [112.7500, -7.2600],
            [112.8200, -7.2600],
            [112.8200, -7.3300],
            [112.7500, -7.3300],
            [112.7500, -7.2600],
          ]],
        }),
      },
      {
        nama: NamaWilayah.SELATAN,
        // Surabaya Selatan — approximate
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [112.7000, -7.3100],
            [112.7700, -7.3100],
            [112.7700, -7.3800],
            [112.7000, -7.3800],
            [112.7000, -7.3100],
          ]],
        }),
      },
      {
        nama: NamaWilayah.UTARA,
        // Surabaya Utara — approximate
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [112.7000, -7.1800],
            [112.7700, -7.1800],
            [112.7700, -7.2500],
            [112.7000, -7.2500],
            [112.7000, -7.1800],
          ]],
        }),
      },
    ];

    const map: Partial<Record<NamaWilayah, Wilayah>> = {};
    for (const data of wilayahData) {
      const w = em.create(Wilayah, {
        nama: data.nama,
        polygon: data.polygon,
      });
      em.persist(w);
      map[data.nama] = w;
      console.log(`🗺️  Wilayah ${data.nama} seeded`);
    }
    return map as Record<NamaWilayah, Wilayah>;
  }

  // ── Titik Sejarah ──────────────────────────────────────────────────────────
  private async seedTitikSejarah(
    em: EntityManager,
    wilayah: Record<NamaWilayah, Wilayah>,
  ): Promise<void> {
    const existing = await em.count(TitikSejarah, {});
    if (existing > 0) return;

    const titikData: Array<{
      wilayah: NamaWilayah;
      namaLokasi: string;
      deskripsi: string;
      lat: number;
      lng: number;
    }> = [
      // ── UTARA ──────────────────────────────────────────────────────────────
      {
        wilayah: NamaWilayah.UTARA,
        namaLokasi: 'Monumen Kapal Selam (Monkasel)',
        deskripsi:
          'Kapal selam KRI Pasopati 410 yang dijadikan museum dan monumen. Simbol perjuangan TNI AL dan kebanggan warga Surabaya.',
        lat: -7.2467, lng: 112.7406,
      },
      {
        wilayah: NamaWilayah.UTARA,
        namaLokasi: 'Pelabuhan Tanjung Perak',
        deskripsi:
          'Pelabuhan terbesar kedua di Indonesia. Sejak era Kolonial Belanda menjadi pintu gerbang perdagangan Jawa Timur.',
        lat: -7.2000, lng: 112.7300,
      },
      {
        wilayah: NamaWilayah.UTARA,
        namaLokasi: 'Kampung Arab Ampel',
        deskripsi:
          'Kawasan bersejarah komunitas Arab-Muslim di Surabaya sejak abad ke-15. Pusat penyebaran Islam di Jawa Timur.',
        lat: -7.2200, lng: 112.7450,
      },
      {
        wilayah: NamaWilayah.UTARA,
        namaLokasi: 'Makam Sunan Ampel',
        deskripsi:
          'Makam salah satu Wali Songo — Raden Rahmat (Sunan Ampel). Destinasi ziarah terpenting di Surabaya.',
        lat: -7.2190, lng: 112.7441,
      },
      {
        wilayah: NamaWilayah.UTARA,
        namaLokasi: 'Jembatan Merah',
        deskripsi:
          'Jembatan bersejarah era kolonial Belanda. Lokasi pertempuran heroik arek-arek Suroboyo melawan NICA 1945.',
        lat: -7.2316, lng: 112.7372,
      },

      // ── BARAT ──────────────────────────────────────────────────────────────
      {
        wilayah: NamaWilayah.BARAT,
        namaLokasi: 'Masjid Cheng Ho',
        deskripsi:
          'Masjid bergaya arsitektur Tionghoa. Dibangun untuk mengenang kontribusi Laksamana Cheng Ho dalam sejarah Nusantara.',
        lat: -7.2753, lng: 112.6876,
      },
      {
        wilayah: NamaWilayah.BARAT,
        namaLokasi: 'Taman Bungkul',
        deskripsi:
          'Ruang terbuka hijau ikonik. Di sini terdapat makam Ki Ageng Bungkul, tokoh penyebar Islam abad ke-15 di Surabaya.',
        lat: -7.2948, lng: 112.7387,
      },
      {
        wilayah: NamaWilayah.BARAT,
        namaLokasi: 'Sentra Ikan Bulak',
        deskripsi:
          'Kawasan wisata kuliner dan budaya nelayan Surabaya di Pantai Kenjeran. Spot budaya pesisir Gen Z masa kini.',
        lat: -7.2261, lng: 112.8013,
      },
      {
        wilayah: NamaWilayah.BARAT,
        namaLokasi: 'Wisma Permai (De Simpangsche Club)',
        deskripsi:
          'Bekas klub sosial era kolonial Belanda, kini menjadi gedung bersejarah di kawasan Surabaya Pusat.',
        lat: -7.2575, lng: 112.7400,
      },
      {
        wilayah: NamaWilayah.BARAT,
        namaLokasi: 'Gedung Grahadi',
        deskripsi:
          'Kantor Gubernur Jawa Timur. Dibangun era Belanda abad ke-19 dengan arsitektur neo-klasik Eropa.',
        lat: -7.2612, lng: 112.7419,
      },

      // ── TIMUR ──────────────────────────────────────────────────────────────
      {
        wilayah: NamaWilayah.TIMUR,
        namaLokasi: 'Pantai Kenjeran',
        deskripsi:
          'Pantai bersejarah dan wisata rakyat Surabaya Timur. Spot ikonik budaya pesisir arek Suroboyo.',
        lat: -7.2283, lng: 112.8010,
      },
      {
        wilayah: NamaWilayah.TIMUR,
        namaLokasi: 'Klenteng Sanggar Agung',
        deskripsi:
          'Klenteng megah di tepi laut Kenjeran. Simbol keberagaman budaya Tionghoa-Jawa di Surabaya Timur.',
        lat: -7.2260, lng: 112.8044,
      },
      {
        wilayah: NamaWilayah.TIMUR,
        namaLokasi: 'ITS (Institut Teknologi Sepuluh Nopember)',
        deskripsi:
          'Kampus teknik legendaris Surabaya. Berdiri sejak 1957, melahirkan generasi penerus inovasi nasional.',
        lat: -7.2805, lng: 112.7948,
      },
      {
        wilayah: NamaWilayah.TIMUR,
        namaLokasi: 'Universitas Airlangga (Kampus C)',
        deskripsi:
          'Kampus tertua dan bergengsi di Surabaya. Berdiri 1954, pusat intelektual Jawa Timur.',
        lat: -7.2815, lng: 112.7958,
      },
      {
        wilayah: NamaWilayah.TIMUR,
        namaLokasi: 'Cagar Budaya Kampung Nelayan Bulak',
        deskripsi:
          'Kampung nelayan tradisional yang masih mempertahankan budaya maritim asli Surabaya Timur.',
        lat: -7.2340, lng: 112.8060,
      },

      // ── SELATAN ────────────────────────────────────────────────────────────
      {
        wilayah: NamaWilayah.SELATAN,
        namaLokasi: 'Museum Sepuluh Nopember',
        deskripsi:
          'Museum yang mengabadikan sejarah pertempuran 10 November 1945. Tugu Pahlawan berdiri megah di depannya.',
        lat: -7.2462, lng: 112.7376,
      },
      {
        wilayah: NamaWilayah.SELATAN,
        namaLokasi: 'Tugu Pahlawan',
        deskripsi:
          'Monumen setinggi 40,45 m simbol perlawanan arek-arek Suroboyo. Titik pusat identitas kota Surabaya.',
        lat: -7.2462, lng: 112.7374,
      },
      {
        wilayah: NamaWilayah.SELATAN,
        namaLokasi: 'Kebun Binatang Surabaya (KBS)',
        deskripsi:
          'Salah satu kebun binatang tertua di Asia Tenggara. Berdiri 1916, menjadi ruang publik bersejarah keluarga Surabaya.',
        lat: -7.3063, lng: 112.7378,
      },
      {
        wilayah: NamaWilayah.SELATAN,
        namaLokasi: 'Universitas Negeri Surabaya (Unesa)',
        deskripsi:
          'Pusat pendidikan dan budaya seni Surabaya Selatan. Sering jadi lokasi pertunjukan seni Gen Z lokal.',
        lat: -7.3558, lng: 112.6510,
      },
      {
        wilayah: NamaWilayah.SELATAN,
        namaLokasi: 'Pasar Wonokromo',
        deskripsi:
          'Pasar rakyat legendaris Surabaya. Pusat ekonomi rakyat dan budaya kuliner lokal sejak era kolonial.',
        lat: -7.3018, lng: 112.7310,
      },
    ];

    for (const data of titikData) {
      const titik = em.create(TitikSejarah, {
        wilayah: wilayah[data.wilayah],
        namaLokasi: data.namaLokasi,
        deskripsi: data.deskripsi,
        koordinat: JSON.stringify({
          type: 'Point',
          coordinates: [data.lng, data.lat],
        }),
      });
      em.persist(titik);
    }
    console.log(`📍 ${titikData.length} titik sejarah seeded`);
  }
}
