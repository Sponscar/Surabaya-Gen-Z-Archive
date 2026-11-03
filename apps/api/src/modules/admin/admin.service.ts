import {
  Injectable,
  NotFoundException,
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

  /**
   * Mengambil daftar user untuk verifikasi validator (default: status PENDING)
   */
  async getUsers(status?: StatusAkun) {
    const filter = status ? { status } : {};
    const users = await this.userRepo.find(filter, {
      orderBy: { createdAt: 'DESC' },
    });

    return users.map((u) => {
      let ktpUrl: string | null = null;
      if (u.ktpPathEncrypted) {
        const decryptedPath = CryptoUtil.decrypt(u.ktpPathEncrypted);
        ktpUrl = `/api/uploads/ktp/${path.basename(decryptedPath)}`;
      }

      return {
        id: u.id,
        email: u.email,
        namaLengkap: u.namaLengkap,
        nikDecrypted: CryptoUtil.decrypt(u.nikEncrypted),
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
   * Ubah status verifikasi akun user (menggunakan State Machine di User entity)
   */
  async updateUserStatus(userId: number, targetStatus: StatusAkun, adminId: number) {
    const user = await this.userRepo.findOne({ id: userId });
    if (!user) throw new NotFoundException(`User id=${userId} tidak ditemukan`);

    // Validasi & transisi status via State Machine di Entity
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
   * Mengambil daftar titik budaya untuk kurasi/review admin (default: PENDING_REVIEW)
   */
  async getTitikBudaya(status?: StatusTitik) {
    let sql = `
      SELECT 
        tb.id,
        tb.judul,
        tb.deskripsi,
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
   * Ubah status kurasi titik budaya (menggunakan State Machine di TitikBudaya entity)
   */
  async updateTitikStatus(titikId: number, targetStatus: StatusTitik, adminId: number) {
    const titik = await this.titikRepo.findOne({ id: titikId });
    if (!titik) throw new NotFoundException(`Titik budaya id=${titikId} tidak ditemukan`);

    // Validasi & transisi status via State Machine di Entity
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
}

