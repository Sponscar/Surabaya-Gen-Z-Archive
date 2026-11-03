import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/postgresql';
import { TitikBudaya } from '../../entities/titik-budaya.entity';
import { Wilayah } from '../../entities/wilayah.entity';
import { User } from '../../entities/user.entity';
import { CreateTitikBudayaDto } from './dto/create-titik-budaya.dto';
import { StatusTitik } from '@sgza/shared';

@Injectable()
export class TitikBudayaService {
  constructor(
    @InjectRepository(TitikBudaya)
    private readonly titikRepo: EntityRepository<TitikBudaya>,
    @InjectRepository(Wilayah)
    private readonly wilayahRepo: EntityRepository<Wilayah>,
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
    private readonly em: EntityManager,
  ) {}

  /**
   * Tambah titik budaya baru (khusus user VERIFIED)
   * Status awal selalu PENDING_REVIEW sampai disetujui admin.
   */
  async create(userId: number, dto: CreateTitikBudayaDto, fotoFilename: string) {
    const user = await this.userRepo.findOne({ id: userId });
    if (!user) throw new NotFoundException('Pengguna tidak ditemukan');

    const wilayah = await this.wilayahRepo.findOne({ id: dto.wilayahId });
    if (!wilayah) throw new NotFoundException('Wilayah tidak ditemukan');

    // Simpan ke DB menggunakan fungsi spatial PostGIS ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    const result = await this.em.getConnection().execute(
      `
      INSERT INTO "titik_budaya" (
        "user_id", "wilayah_id", "judul", "deskripsi", "alamat", "foto_path", 
        "slang_terkait", "koordinat", "status", "created_at"
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, NOW()
      ) RETURNING id, judul, status, created_at;
      `,
      [
        user.id,
        wilayah.id,
        dto.judul.trim(),
        dto.deskripsi?.trim() || null,
        dto.alamat?.trim() || null,
        `/api/uploads/titik/${fotoFilename}`,
        dto.slangTerkait?.trim() || null,
        dto.lng,
        dto.lat,
        StatusTitik.PENDING_REVIEW,
      ],
    );

    return {
      message: 'Titik budaya berhasil dikirim! Menunggu kurasi & approval validator SGZA sebelum tampil di peta publik.',
      data: result[0],
    };
  }

  /**
   * Ambil semua titik budaya yang sudah APPROVED untuk ditampilkan di peta publik
   */
  async findApproved(wilayahId?: number) {
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
        ST_X(tb.koordinat) AS "lng",
        ST_Y(tb.koordinat) AS "lat",
        ST_AsGeoJSON(tb.koordinat)::json AS "geojson",
        json_build_object(
          'id', w.id,
          'nama', w.nama
        ) AS "wilayah",
        json_build_object(
          'id', u.id,
          'namaLengkap', u.nama_lengkap,
          'jenisInstansi', u.jenis_instansi
        ) AS "user"
      FROM "titik_budaya" tb
      JOIN "wilayah" w ON w.id = tb.wilayah_id
      JOIN "users" u ON u.id = tb.user_id
      WHERE tb.status = ?
    `;

    const params: any[] = [StatusTitik.APPROVED];

    if (wilayahId) {
      sql += ' AND tb.wilayah_id = ?';
      params.push(wilayahId);
    }

    sql += ' ORDER BY tb.created_at DESC;';

    return this.em.getConnection().execute(sql, params);
  }

  /**
   * Detail titik budaya
   */
  async findOne(id: number) {
    const result = await this.em.getConnection().execute(
      `
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
        ST_X(tb.koordinat) AS "lng",
        ST_Y(tb.koordinat) AS "lat",
        ST_AsGeoJSON(tb.koordinat)::json AS "geojson",
        w.nama AS "namaWilayah",
        u.nama_lengkap AS "namaAuthor"
      FROM "titik_budaya" tb
      JOIN "wilayah" w ON w.id = tb.wilayah_id
      JOIN "users" u ON u.id = tb.user_id
      WHERE tb.id = ?;
      `,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Titik budaya id=${id} tidak ditemukan`);
    }

    return result[0];
  }
}

