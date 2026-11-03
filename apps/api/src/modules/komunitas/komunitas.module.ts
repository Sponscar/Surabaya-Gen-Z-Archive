import { Controller, Get, Module } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

@Controller('komunitas')
export class KomunitasController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  async findAll() {
    return this.em.getConnection().execute(`
      SELECT 
        k.id, k.nama, k.kategori, k.deskripsi, k.kontak,
        k.wilayah_id AS "wilayahId", w.nama AS "wilayahNama",
        k.created_at AS "createdAt"
      FROM "komunitas" k
      LEFT JOIN "wilayah" w ON w.id = k.wilayah_id
      ORDER BY k.id ASC;
    `);
  }
}

@Module({
  controllers: [KomunitasController],
})
export class KomunitasModule {}

