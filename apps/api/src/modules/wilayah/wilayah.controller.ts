import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { WilayahService } from './wilayah.service';

@Controller('wilayah')
export class WilayahController {
  constructor(private readonly wilayahService: WilayahService) {}

  /** GET /api/wilayah — Semua wilayah + polygon (public) */
  @Get()
  findAll() {
    return this.wilayahService.findAll();
  }

  /** GET /api/wilayah/:id — Detail wilayah (public) */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.wilayahService.findOne(id);
  }
}

