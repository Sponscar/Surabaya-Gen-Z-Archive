import { Migration } from '@mikro-orm/migrations';

/**
 * Migration002 — Menambahkan Wilayah Surabaya Pusat ke Database
 */
export class Migration002_AddWilayahPusat extends Migration {
  async up(): Promise<void> {
    const geojsonPusat = JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [112.718, -7.245],
        [112.720, -7.265],
        [112.738, -7.268],
        [112.755, -7.265],
        [112.762, -7.278],
        [112.760, -7.295],
        [112.752, -7.308],
        [112.740, -7.315],
        [112.725, -7.315],
        [112.718, -7.305],
        [112.718, -7.275],
        [112.718, -7.245],
      ]],
    });

    this.addSql(`
      INSERT INTO "wilayah" ("nama", "polygon")
      SELECT 'PUSAT', ST_SetSRID(ST_GeomFromGeoJSON('${geojsonPusat}'), 4326)
      WHERE NOT EXISTS (SELECT 1 FROM "wilayah" WHERE "nama" = 'PUSAT');
    `);

    // Tambahkan titik sejarah Surabaya Pusat
    this.addSql(`
      DO $$
      DECLARE
        pusat_id INTEGER;
      BEGIN
        SELECT id INTO pusat_id FROM "wilayah" WHERE "nama" = 'PUSAT' LIMIT 1;

        IF pusat_id IS NOT NULL THEN
          -- Cek apakah titik sejarah Pusat sudah ada
          IF NOT EXISTS (SELECT 1 FROM "titik_sejarah" WHERE "wilayah_id" = pusat_id) THEN
            INSERT INTO "titik_sejarah" ("wilayah_id", "nama_lokasi", "deskripsi", "koordinat")
            VALUES
              (pusat_id, 'Tugu Pahlawan', 'Monumen peringatan pertempuran 10 November 1945. Simbol heroisme utama Kota Pahlawan.', ST_SetSRID(ST_MakePoint(112.7374, -7.2462), 4326)),
              (pusat_id, 'Hotel Majapahit (Oranje)', 'Hotel legendaris saksi peristiwa perobekan bendera Belanda merah-putih-biru menjadi merah-putih.', ST_SetSRID(ST_MakePoint(112.7410, -7.2597), 4326)),
              (pusat_id, 'Gedung Grahadi', 'Bangunan kolonial cagar budaya bersejarah tempat pertemuan resmi dan diplomasi Jawa Timur.', ST_SetSRID(ST_MakePoint(112.7419, -7.2612), 4326)),
              (pusat_id, 'Balai Kota Surabaya (Taman Surya)', 'Pusat administrasi kota bergaya kolonial art-deco yang menghadap Taman Surya.', ST_SetSRID(ST_MakePoint(112.7508, -7.2655), 4326)),
              (pusat_id, 'Gedung Siola (Museum Surabaya)', 'Gedung perbelanjaan pertama abad ke-19 era Whiteaway Laidlaw, kini museum cagar budaya dan Mall Pelayanan Publik.', ST_SetSRID(ST_MakePoint(112.7390, -7.2570), 4326));
          END IF;
        END IF;
      END $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DELETE FROM "titik_sejarah" WHERE "wilayah_id" IN (SELECT id FROM "wilayah" WHERE "nama" = 'PUSAT');
      DELETE FROM "wilayah" WHERE "nama" = 'PUSAT';
    `);
  }
}

