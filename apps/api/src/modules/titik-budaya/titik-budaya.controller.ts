import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { TitikBudayaService } from './titik-budaya.service';
import { CreateTitikBudayaDto } from './dto/create-titik-budaya.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../auth/guards/verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

// Direktori upload foto titik budaya
const TITIK_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/titik');
if (!fs.existsSync(TITIK_UPLOAD_DIR)) {
  fs.mkdirSync(TITIK_UPLOAD_DIR, { recursive: true });
}

@Controller('titik-budaya')
export class TitikBudayaController {
  constructor(private readonly service: TitikBudayaService) {}

  /**
   * POST /api/titik-budaya
   * Wajib login dan berstatus VERIFIED.
   * Menerima multipart/form-data: field DTO + file foto ('foto').
   */
  @Post()
  @UseGuards(JwtAuthGuard, VerifiedGuard)
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: TITIK_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `titik-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (_req, file, cb) => {
        const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMime.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Format foto harus berupa file gambar (JPG, PNG, atau WebP)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateTitikBudayaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Foto titik budaya wajib diunggah');
    }

    return this.service.create(user.id, dto, file.filename);
  }

  /**
   * GET /api/titik-budaya
   * Publik — hanya menampilkan titik budaya yang berstatus APPROVED.
   * Bisa difilter: /api/titik-budaya?wilayahId=1
   */
  @Get()
  async findApproved(@Query('wilayahId') wilayahId?: string) {
    const id = wilayahId ? parseInt(wilayahId, 10) : undefined;
    return this.service.findApproved(id);
  }

  /**
   * GET /api/titik-budaya/:id
   * Detail titik budaya
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}

