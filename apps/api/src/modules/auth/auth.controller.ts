import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Pastikan direktori uploads/ktp ada
const KTP_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/ktp');
if (!fs.existsSync(KTP_UPLOAD_DIR)) {
  fs.mkdirSync(KTP_UPLOAD_DIR, { recursive: true });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Menerima multipart/form-data dengan field form + file KTP ('ktp')
   */
  @Post('register')
  @UseInterceptors(
    FileInterceptor('ktp', {
      storage: diskStorage({
        destination: KTP_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `ktp-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // Maksimal 5MB
      },
      fileFilter: (_req, file, cb) => {
        const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMime.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Format foto KTP harus berupa JPG, PNG, atau WebP',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async register(
    @Body() dto: RegisterDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Foto KTP wajib diunggah untuk verifikasi domisili');
    }

    return this.authService.register(dto, file.path);
  }

  /**
   * POST /api/auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}

