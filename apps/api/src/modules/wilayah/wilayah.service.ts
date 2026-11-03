import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

@Injectable()
export class WilayahService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Mengambil semua wilayah beserta polygon GeoJSON
   */
  async findAll() {
    return this.em.getConnection().execute(`
      SELECT 
        id, 
        nama, 
        ST_AsGeoJSON(polygon)::json AS "polygon"
      FROM "wilayah"
      ORDER BY id ASC;
    `);
  }

  /**
   * Detail wilayah
   */
  async findOne(id: number) {
    const res = await this.em.getConnection().execute(
      `
      SELECT 
        id, 
        nama, 
        ST_AsGeoJSON(polygon)::json AS "polygon"
      FROM "wilayah"
      WHERE id = ?;
      `,
      [id],
    );

    if (!res || res.length === 0) {
      throw new NotFoundException(`Wilayah id=${id} tidak ditemukan`);
    }

    return res[0];
  }
}
