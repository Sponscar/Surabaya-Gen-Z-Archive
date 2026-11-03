import { Migration } from '@mikro-orm/migrations';

/**
 * Migration001 — Initial Schema SGZA
 * Membuat tabel: users, wilayah, titik_sejarah, titik_budaya
 * Mengaktifkan ekstensi PostGIS untuk support geometry columns.
 */
export class Migration001_InitSchema extends Migration {
  async up(): Promise<void> {
    // Aktifkan PostGIS
    this.addSql(`CREATE EXTENSION IF NOT EXISTS postgis;`);

    // ── Tabel users ─────────────────────────────────────────────────────────
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"                  SERIAL PRIMARY KEY,
        "email"               VARCHAR(255) NOT NULL UNIQUE,
        "password_hash"       VARCHAR(255) NOT NULL,
        "nama_lengkap"        VARCHAR(255) NOT NULL,
        "nik_encrypted"       TEXT NOT NULL,
        "alamat_lengkap"      TEXT NOT NULL,
        "whatsapp"            VARCHAR(20) NOT NULL,
        "jenis_instansi"      VARCHAR(50) NOT NULL,
        "instansi_detail"     JSONB,
        "ktp_path_encrypted"  TEXT,
        "status"              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "is_admin"            BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at"          TIMESTAMP NOT NULL DEFAULT NOW(),
        "verified_at"         TIMESTAMP,
        "verified_by_id"      INTEGER REFERENCES "users"("id")
      );
    `);

    // ── Tabel wilayah ────────────────────────────────────────────────────────
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "wilayah" (
        "id"      SERIAL PRIMARY KEY,
        "nama"    VARCHAR(20) NOT NULL UNIQUE,
        "polygon" geometry(Polygon, 4326) NOT NULL
      );
    `);
    this.addSql(`
      CREATE INDEX idx_wilayah_polygon
      ON wilayah USING GIST (polygon);
    `);

    // ── Tabel titik_sejarah ──────────────────────────────────────────────────
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "titik_sejarah" (
        "id"           SERIAL PRIMARY KEY,
        "wilayah_id"   INTEGER NOT NULL REFERENCES "wilayah"("id"),
        "nama_lokasi"  VARCHAR(255) NOT NULL,
        "deskripsi"    TEXT NOT NULL,
        "koordinat"    geometry(Point, 4326) NOT NULL,
        "foto_url"     TEXT
      );
    `);
    this.addSql(`
      CREATE INDEX idx_titik_sejarah_koordinat
      ON titik_sejarah USING GIST (koordinat);
    `);

    // ── Tabel titik_budaya ───────────────────────────────────────────────────
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "titik_budaya" (
        "id"               SERIAL PRIMARY KEY,
        "user_id"          INTEGER NOT NULL REFERENCES "users"("id"),
        "wilayah_id"       INTEGER NOT NULL REFERENCES "wilayah"("id"),
        "judul"            VARCHAR(255) NOT NULL,
        "deskripsi"        TEXT,
        "foto_path"        TEXT NOT NULL,
        "audio_path"       TEXT,
        "slang_terkait"    VARCHAR(100),
        "koordinat"        geometry(Point, 4326) NOT NULL,
        "status"           VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
        "created_at"       TIMESTAMP NOT NULL DEFAULT NOW(),
        "reviewed_at"      TIMESTAMP,
        "reviewed_by_id"   INTEGER REFERENCES "users"("id")
      );
    `);
    this.addSql(`
      CREATE INDEX idx_titik_budaya_koordinat
      ON titik_budaya USING GIST (koordinat);
    `);
    this.addSql(`
      CREATE INDEX idx_titik_budaya_status
      ON titik_budaya ("status");
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "titik_budaya" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "titik_sejarah" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "wilayah" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "users" CASCADE;`);
  }
}

