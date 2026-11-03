import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

@Injectable()
export class TitikSejarahService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Mengambil semua titik sejarah lengkap dengan lat, lng, dan GeoJSON
   * Dapat difilter per wilayahId
   */
  async findAll(wilayahId?: number) {
    let sql = `
      SELECT 
        ts.id,
        ts.nama_lokasi AS "namaLokasi",
        ts.deskripsi,
        ts.foto_url AS "fotoUrl",
        ST_X(ts.koordinat) AS "lng",
        ST_Y(ts.koordinat) AS "lat",
        ST_AsGeoJSON(ts.koordinat)::json AS "geojson",
        json_build_object(
          'id', w.id,
          'nama', w.nama
        ) AS "wilayah"
      FROM "titik_sejarah" ts
      JOIN "wilayah" w ON w.id = ts.wilayah_id
    `;

    const params: any[] = [];
    if (wilayahId) {
      sql += ' WHERE ts.wilayah_id = ?';
      params.push(wilayahId);
    }

    sql += ' ORDER BY ts.id ASC;';

    return this.em.getConnection().execute(sql, params);
  }
}
