import { Controller, Get, Module } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

@Controller('slang')
export class SlangController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  async findAll() {
    return this.em.getConnection().execute('SELECT id, istilah, arti, contoh, kategori, created_at AS "createdAt" FROM "slang" ORDER BY id ASC;');
  }
}

@Module({
  controllers: [SlangController],
})
export class SlangModule {}

