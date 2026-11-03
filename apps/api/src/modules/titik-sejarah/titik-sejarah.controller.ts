import { Controller, Get, Query, ParseIntPipe, Optional } from '@nestjs/common';
import { TitikSejarahService } from './titik-sejarah.service';

@Controller('titik-sejarah')
export class TitikSejarahController {
  constructor(private readonly service: TitikSejarahService) {}

  /**
   * GET /api/titik-sejarah          → semua titik sejarah (public)
   * GET /api/titik-sejarah?wilayahId=1 → filter per wilayah
   */
  @Get()
  findAll(@Query('wilayahId') wilayahId?: string) {
    const id = wilayahId ? parseInt(wilayahId, 10) : undefined;
    return this.service.findAll(id);
  }
}

