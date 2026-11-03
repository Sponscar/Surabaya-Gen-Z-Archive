import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateTitikStatusDto } from './dto/update-titik-status.dto';
import { StatusAkun, StatusTitik } from '@sgza/shared';

const TITIK_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/titik');
if (!fs.existsSync(TITIK_UPLOAD_DIR)) {
  fs.mkdirSync(TITIK_UPLOAD_DIR, { recursive: true });
}

const fileUploadOptions = {
  storage: diskStorage({
    destination: TITIK_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `titik-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
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
};

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==========================================
  // USERS MANAGEMENT
  // ==========================================

  /**
   * GET /api/admin/users
   * Mengambil daftar user (opsional filter ?status=PENDING / VERIFIED / REJECTED)
   */
  @Get('users')
  async getUsers(@Query('status') status?: StatusAkun) {
    return this.adminService.getUsers(status);
  }

  /**
   * PATCH /api/admin/users/:id/status
   * Memverifikasi (VERIFIED) atau Menolak (REJECTED) user via State Machine
   */
  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: User,
  ) {
    return this.adminService.updateUserStatus(id, dto.status, admin.id);
  }

  /**
   * DELETE /api/admin/users/:id
   * Hapus user oleh admin
   */
  @Delete('users/:id')
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: User,
  ) {
    return this.adminService.deleteUser(id, admin.id);
  }

  // ==========================================
  // TITIK BUDAYA CRUD
  // ==========================================

  /**
   * GET /api/admin/titik-budaya
   * Mengambil daftar titik budaya untuk kurasi / review
   */
  @Get('titik-budaya')
  async getTitikBudaya(@Query('status') status?: StatusTitik) {
    return this.adminService.getTitikBudaya(status);
  }

  /**
   * POST /api/admin/titik-budaya
   * Tambah titik budaya langsung oleh admin (mendukung upload foto)
   */
  @Post('titik-budaya')
  @UseInterceptors(FileInterceptor('foto', fileUploadOptions))
  async createTitikBudaya(
    @Body() body: any,
    @CurrentUser() admin: User,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      body.fotoPath = file.filename;
    }
    return this.adminService.createTitikBudaya(body, admin.id);
  }

  /**
   * PATCH /api/admin/titik-budaya/:id
   * Edit data titik budaya (mendukung upload foto baru)
   */
  @Patch('titik-budaya/:id')
  @UseInterceptors(FileInterceptor('foto', fileUploadOptions))
  async updateTitikBudaya(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      body.fotoPath = file.filename;
    }
    return this.adminService.updateTitikBudaya(id, body);
  }

  /**
   * DELETE /api/admin/titik-budaya/:id
   * Hapus titik budaya
   */
  @Delete('titik-budaya/:id')
  async deleteTitikBudaya(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteTitikBudaya(id);
  }

  /**
   * PATCH /api/admin/titik-budaya/:id/status
   * Menyetujui (APPROVED) atau Menolak (REJECTED) titik budaya via State Machine
   */
  @Patch('titik-budaya/:id/status')
  async updateTitikStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTitikStatusDto,
    @CurrentUser() admin: User,
  ) {
    return this.adminService.updateTitikStatus(id, dto.status, admin.id);
  }

  // ==========================================
  // TITIK SEJARAH CRUD
  // ==========================================

  @Get('titik-sejarah')
  async getTitikSejarah() {
    return this.adminService.getTitikSejarah();
  }

  @Post('titik-sejarah')
  @UseInterceptors(FileInterceptor('foto', fileUploadOptions))
  async createTitikSejarah(
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      body.fotoUrl = file.filename;
    }
    return this.adminService.createTitikSejarah(body);
  }

  @Patch('titik-sejarah/:id')
  @UseInterceptors(FileInterceptor('foto', fileUploadOptions))
  async updateTitikSejarah(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      body.fotoUrl = file.filename;
    }
    return this.adminService.updateTitikSejarah(id, body);
  }

  @Delete('titik-sejarah/:id')
  async deleteTitikSejarah(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteTitikSejarah(id);
  }

  // ==========================================
  // KAMUS SLANG CRUD
  // ==========================================

  @Get('slang')
  async getSlang() {
    return this.adminService.getSlang();
  }

  @Post('slang')
  async createSlang(@Body() body: any) {
    return this.adminService.createSlang(body);
  }

  @Patch('slang/:id')
  async updateSlang(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateSlang(id, body);
  }

  @Delete('slang/:id')
  async deleteSlang(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteSlang(id);
  }

  // ==========================================
  // KOMUNITAS CRUD
  // ==========================================

  @Get('komunitas')
  async getKomunitas() {
    return this.adminService.getKomunitas();
  }

  @Post('komunitas')
  async createKomunitas(@Body() body: any) {
    return this.adminService.createKomunitas(body);
  }

  @Patch('komunitas/:id')
  async updateKomunitas(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateKomunitas(id, body);
  }

  @Delete('komunitas/:id')
  async deleteKomunitas(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteKomunitas(id);
  }
}
