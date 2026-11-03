import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/postgresql';
import * as path from 'path';
import { User } from '../../entities/user.entity';
import { TitikBudaya } from '../../entities/titik-budaya.entity';
import { StatusAkun, StatusTitik } from '@sgza/shared';
import { CryptoUtil } from '../../common/crypto/crypto.util';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
    @InjectRepository(TitikBudaya)
    private readonly titikRepo: EntityRepository<TitikBudaya>,
    private readonly em: EntityManager,
  ) {}

  // ==========================================
  // USERS MANAGEMENT
  // ==========================================

  /**
   * Mengambil daftar user (jika status tidak dispesifikasikan, ambil semua user)
   */
  async getUsers(status?: StatusAkun) {
    const filter = status ? { status } : {};
    const users = await this.userRepo.find(filter, {
      orderBy: { createdAt: 'DESC' },
    });

    return users.map((u) => {
      let ktpUrl: string | null = null;
      if (u.ktpPathEncrypted) {
        try {
          const decryptedPath = CryptoUtil.decrypt(u.ktpPathEncrypted);
          ktpUrl = `/api/uploads/ktp/${path.basename(decryptedPath)}`;
        } catch {
          ktpUrl = null;
        }
      }

      let nikDecrypted = u.nikEncrypted;
      try {
        nikDecrypted = CryptoUtil.decrypt(u.nikEncrypted);
      } catch {
        // Fallback jika tidak terenkripsi
      }

      return {
        id: u.id,
        email: u.email,
        namaLengkap: u.namaLengkap,
        nikDecrypted,
        alamatLengkap: u.alamatLengkap,
        whatsapp: u.whatsapp,
        jenisInstansi: u.jenisInstansi,
        instansiDetail: u.instansiDetail,
        ktpUrl,
        status: u.status,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        verifiedAt: u.verifiedAt,
      };
    });
  }

  /**
   * Ubah status verifikasi akun user
   */
  async updateUserStatus(userId: number, targetStatus: StatusAkun, adminId: number) {
    const user = await this.userRepo.findOne({ id: userId });
    if (!user) throw new NotFoundException(`User id=${userId} tidak ditemukan`);

    user.ubahStatus(targetStatus, adminId);
    await this.userRepo.getEntityManager().flush();

    return {
      message: `Status akun ${user.namaLengkap} berhasil diubah menjadi ${user.status}`,
      user: {
        id: user.id,
        email: user.email,
        namaLengkap: user.namaLengkap,
        status: user.status,
        verifiedAt: user.verifiedAt,
      },
    };
  }

  /**
   * Hapus user (Admin tidak boleh menghapus dirinya sendiri)
   */
  async deleteUser(userId: number, currentAdminId: number) {
    if (userId === currentAdminId) {
      throw new BadRequestException('Anda tidak dapat menghapus akun admin Anda sendiri.');
    }
    const user = await this.userRepo.findOne({ id: userId });
    if (!user) throw new NotFoundException(`User id=${userId} tidak ditemukan`);

    // Hapus titik budaya yang terkait user terlebih dahulu
    await this.em.getConnection().execute('DELETE FROM "titik_budaya" WHERE user_id = ?', [userId]);
    await this.em.removeAndFlush(user);

    return { message: `User ${user.namaLengkap} berhasil dihapus.` };
  }

  // ==========================================
  // TITIK BUDAYA CRUD
  // ==========================================

  /**
   * Mengambil daftar titik budaya untuk kurasi/review admin
   */
  async getTitikBudaya(status?: StatusTitik) {
    let sql = `
      SELECT 
        tb.id,
        tb.wilayah_id AS "wilayahId",
        tb.judul,
        tb.deskripsi,
        tb.alamat,
        tb.foto_path AS "fotoPath",
        tb.slang_terkait AS "slangTerkait",
        tb.status,
        tb.created_at AS "createdAt",
        tb.reviewed_at AS "reviewedAt",
        ST_X(tb.koordinat) AS "lng",
        ST_Y(tb.koordinat) AS "lat",
        json_build_object(
          'id', w.id,
          'nama', w.nama
        ) AS "wilayah",
        json_build_object(
          'id', u.id,
          'namaLengkap', u.nama_lengkap,
          'email', u.email
        ) AS "user"
      FROM "titik_budaya" tb
      JOIN "wilayah" w ON w.id = tb.wilayah_id
      JOIN "users" u ON u.id = tb.user_id
    `;

    const params: any[] = [];
    if (status) {
      sql += ' WHERE tb.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY tb.created_at DESC;';

    return this.em.getConnection().execute(sql, params);
  }

  /**
   * Tambah titik budaya baru langsung oleh admin
   */
  async createTitikBudaya(data: any, adminId: number) {
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    const wilayahId = parseInt(data.wilayahId, 10);
    const status = data.status || StatusTitik.APPROVED;

    const result = await this.em.getConnection().execute(
      `
      INSERT INTO "titik_budaya" (
        "user_id", "wilayah_id", "judul", "deskripsi", "alamat", "foto_path", 
        "slang_terkait", "koordinat", "status", "created_at", "reviewed_at", "reviewed_by"
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, NOW(), NOW(), ?
      ) RETURNING id, judul, status;
      `,
      [
        adminId,
        wilayahId,
        data.judul.trim(),
        data.deskripsi?.trim() || null,
        data.alamat?.trim() || null,
        data.fotoPath || null,
        data.slangTerkait?.trim() || null,
        lng,
        lat,
        status,
        adminId,
      ],
    );

    return {
      message: 'Titik budaya berhasil ditambahkan.',
      data: result[0],
    };
  }

  /**
   * Update data titik budaya
   */
  async updateTitikBudaya(id: number, data: any) {
    const titik = await this.titikRepo.findOne({ id });
    if (!titik) throw new NotFoundException(`Titik budaya id=${id} tidak ditemukan`);

    const lat = data.lat !== undefined ? parseFloat(data.lat) : null;
    const lng = data.lng !== undefined ? parseFloat(data.lng) : null;
    const wilayahId = data.wilayahId !== undefined ? parseInt(data.wilayahId, 10) : null;

    let updateCoordSql = '';
    const params: any[] = [
      data.judul?.trim() ?? titik.judul,
      data.deskripsi?.trim() ?? titik.deskripsi,
      data.alamat !== undefined ? data.alamat?.trim() || null : titik.alamat,
      data.slangTerkait !== undefined ? data.slangTerkait?.trim() || null : titik.slangTerkait,
      data.status ?? titik.status,
    ];

    if (data.fotoPath !== undefined) {
      params.push(data.fotoPath);
    }

    if (wilayahId) {
      params.push(wilayahId);
    }

    if (lat !== null && lng !== null) {
      updateCoordSql = ', "koordinat" = ST_SetSRID(ST_MakePoint(?, ?), 4326)';
    }

    let sql = `
      UPDATE "titik_budaya" SET
        "judul" = ?,
        "deskripsi" = ?,
        "alamat" = ?,
        "slang_terkait" = ?,
        "status" = ?
    `;

    if (data.fotoPath !== undefined) {
      sql += ', "foto_path" = ?';
    }
    if (wilayahId) {
      sql += ', "wilayah_id" = ?';
    }
    if (lat !== null && lng !== null) {
      sql += updateCoordSql;
      params.push(lng, lat);
    }

    sql += ' WHERE id = ? RETURNING id, judul, status;';
    params.push(id);

    const result = await this.em.getConnection().execute(sql, params);
    return {
      message: 'Titik budaya berhasil diperbarui.',
      data: result[0],
    };
  }

  /**
   * Hapus titik budaya
   */
  async deleteTitikBudaya(id: number) {
    const result = await this.em.getConnection().execute('DELETE FROM "titik_budaya" WHERE id = ? RETURNING id', [id]);
    if (!result || result.length === 0) {
      throw new NotFoundException(`Titik budaya id=${id} tidak ditemukan`);
    }
    return { message: `Titik budaya id=${id} berhasil dihapus.` };
  }

  /**
   * Ubah status kurasi titik budaya (Approve / Reject cepat)
   */
  async updateTitikStatus(titikId: number, targetStatus: StatusTitik, adminId: number) {
    const titik = await this.titikRepo.findOne({ id: titikId });
    if (!titik) throw new NotFoundException(`Titik budaya id=${titikId} tidak ditemukan`);

    titik.ubahStatus(targetStatus, adminId);
    await this.titikRepo.getEntityManager().flush();

    return {
      message: `Titik budaya '${titik.judul}' berhasil diubah statusnya menjadi ${titik.status}`,
      titik: {
        id: titik.id,
        judul: titik.judul,
        status: titik.status,
        reviewedAt: titik.reviewedAt,
      },
    };
  }

  // ==========================================
  // TITIK SEJARAH CRUD
  // ==========================================

  async getTitikSejarah() {
    const sql = `
      SELECT 
        ts.id,
        ts.wilayah_id AS "wilayahId",
        ts.nama_lokasi AS "namaLokasi",
        ts.deskripsi,
        ts.alamat,
        ts.foto_url AS "fotoUrl",
        ST_X(ts.koordinat) AS "lng",
        ST_Y(ts.koordinat) AS "lat",
        json_build_object(
          'id', w.id,
          'nama', w.nama
        ) AS "wilayah"
      FROM "titik_sejarah" ts
      JOIN "wilayah" w ON w.id = ts.wilayah_id
      ORDER BY ts.id ASC;
    `;
    return this.em.getConnection().execute(sql);
  }

  async createTitikSejarah(data: any) {
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    const wilayahId = parseInt(data.wilayahId, 10);

    const result = await this.em.getConnection().execute(
      `
      INSERT INTO "titik_sejarah" (
        "wilayah_id", "nama_lokasi", "deskripsi", "alamat", "foto_url", "koordinat"
      ) VALUES (
        ?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326)
      ) RETURNING id, nama_lokasi AS "namaLokasi";
      `,
      [
        wilayahId,
        data.namaLokasi.trim(),
        data.deskripsi.trim(),
        data.alamat !== undefined ? data.alamat?.trim() || null : null,
        data.fotoUrl !== undefined ? data.fotoUrl?.trim() || null : null,
        lng,
        lat,
      ],
    );

    return {
      message: 'Titik sejarah berhasil ditambahkan.',
      data: result[0],
    };
  }

  async updateTitikSejarah(id: number, data: any) {
    const lat = data.lat !== undefined ? parseFloat(data.lat) : null;
    const lng = data.lng !== undefined ? parseFloat(data.lng) : null;
    const wilayahId = data.wilayahId !== undefined ? parseInt(data.wilayahId, 10) : null;

    const params: any[] = [
      data.namaLokasi.trim(),
      data.deskripsi.trim(),
    ];

    let sql = `
      UPDATE "titik_sejarah" SET
        "nama_lokasi" = ?,
        "deskripsi" = ?
    `;

    if (data.alamat !== undefined) {
      sql += ', "alamat" = ?';
      params.push(data.alamat?.trim() || null);
    }

    if (data.fotoUrl !== undefined) {
      sql += ', "foto_url" = ?';
      params.push(data.fotoUrl?.trim() || null);
    }

    if (wilayahId) {
      sql += ', "wilayah_id" = ?';
      params.push(wilayahId);
    }

    if (lat !== null && lng !== null) {
      sql += ', "koordinat" = ST_SetSRID(ST_MakePoint(?, ?), 4326)';
      params.push(lng, lat);
    }

    sql += ' WHERE id = ? RETURNING id, nama_lokasi AS "namaLokasi";';
    params.push(id);

    const result = await this.em.getConnection().execute(sql, params);
    if (!result || result.length === 0) {
      throw new NotFoundException(`Titik sejarah id=${id} tidak ditemukan`);
    }

    return {
      message: 'Titik sejarah berhasil diperbarui.',
      data: result[0],
    };
  }

  async deleteTitikSejarah(id: number) {
    const result = await this.em.getConnection().execute('DELETE FROM "titik_sejarah" WHERE id = ? RETURNING id', [id]);
    if (!result || result.length === 0) {
      throw new NotFoundException(`Titik sejarah id=${id} tidak ditemukan`);
    }
    return { message: `Titik sejarah id=${id} berhasil dihapus.` };
  }

  // ==========================================
  // KAMUS SLANG CRUD
  // ==========================================

  async getSlang() {
    const sql = `SELECT id, istilah, arti, contoh, kategori, created_at AS "createdAt" FROM "slang" ORDER BY id ASC;`;
    return this.em.getConnection().execute(sql);
  }

  async createSlang(data: { istilah: string; arti: string; contoh: string; kategori?: string }) {
    const result = await this.em.getConnection().execute(
      `
      INSERT INTO "slang" ("istilah", "arti", "contoh", "kategori", "created_at")
      VALUES (?, ?, ?, ?, NOW())
      RETURNING id, istilah, arti, contoh, kategori;
      `,
      [data.istilah.trim(), data.arti.trim(), data.contoh.trim(), data.kategori?.trim() || 'Umum'],
    );
    return {
      message: 'Slang berhasil ditambahkan.',
      data: result[0],
    };
  }

  async updateSlang(id: number, data: { istilah: string; arti: string; contoh: string; kategori?: string }) {
    const result = await this.em.getConnection().execute(
      `
      UPDATE "slang" SET
        "istilah" = ?,
        "arti" = ?,
        "contoh" = ?,
        "kategori" = ?
      WHERE id = ?
      RETURNING id, istilah, arti, contoh, kategori;
      `,
      [data.istilah.trim(), data.arti.trim(), data.contoh.trim(), data.kategori?.trim() || 'Umum', id],
    );
    if (!result || result.length === 0) {
      throw new NotFoundException(`Slang id=${id} tidak ditemukan`);
    }
    return {
      message: 'Slang berhasil diperbarui.',
      data: result[0],
    };
  }

  async deleteSlang(id: number) {
    const result = await this.em.getConnection().execute('DELETE FROM "slang" WHERE id = ? RETURNING id', [id]);
    if (!result || result.length === 0) {
      throw new NotFoundException(`Slang id=${id} tidak ditemukan`);
    }
    return { message: `Slang id=${id} berhasil dihapus.` };
  }

  // ==========================================
  // KOMUNITAS CRUD
  // ==========================================

  async getKomunitas() {
    const sql = `
      SELECT 
        k.id,
        k.nama,
        k.kategori,
        k.deskripsi,
        k.kontak,
        k.wilayah_id AS "wilayahId",
        w.nama AS "wilayahNama",
        k.created_at AS "createdAt"
      FROM "komunitas" k
      LEFT JOIN "wilayah" w ON w.id = k.wilayah_id
      ORDER BY k.id ASC;
    `;
    return this.em.getConnection().execute(sql);
  }

  async createKomunitas(data: { nama: string; kategori: string; deskripsi: string; kontak?: string; wilayahId?: number }) {
    const wilayahId = data.wilayahId ? parseInt(String(data.wilayahId), 10) : null;
    const result = await this.em.getConnection().execute(
      `
      INSERT INTO "komunitas" ("nama", "kategori", "deskripsi", "kontak", "wilayah_id", "created_at")
      VALUES (?, ?, ?, ?, ?, NOW())
      RETURNING id, nama, kategori;
      `,
      [data.nama.trim(), data.kategori.trim(), data.deskripsi.trim(), data.kontak?.trim() || null, wilayahId],
    );
    return {
      message: 'Komunitas berhasil ditambahkan.',
      data: result[0],
    };
  }

  async updateKomunitas(id: number, data: { nama: string; kategori: string; deskripsi: string; kontak?: string; wilayahId?: number }) {
    const wilayahId = data.wilayahId ? parseInt(String(data.wilayahId), 10) : null;
    const result = await this.em.getConnection().execute(
      `
      UPDATE "komunitas" SET
        "nama" = ?,
        "kategori" = ?,
        "deskripsi" = ?,
        "kontak" = ?,
        "wilayah_id" = ?
      WHERE id = ?
      RETURNING id, nama, kategori;
      `,
      [data.nama.trim(), data.kategori.trim(), data.deskripsi.trim(), data.kontak?.trim() || null, wilayahId, id],
    );
    if (!result || result.length === 0) {
      throw new NotFoundException(`Komunitas id=${id} tidak ditemukan`);
    }
    return {
      message: 'Komunitas berhasil diperbarui.',
      data: result[0],
    };
  }

  async deleteKomunitas(id: number) {
    const result = await this.em.getConnection().execute('DELETE FROM "komunitas" WHERE id = ? RETURNING id', [id]);
    if (!result || result.length === 0) {
      throw new NotFoundException(`Komunitas id=${id} tidak ditemukan`);
    }
    return { message: `Komunitas id=${id} berhasil dihapus.` };
  }
}
