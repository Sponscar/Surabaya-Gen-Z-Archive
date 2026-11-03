import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateTitikStatusDto } from './dto/update-titik-status.dto';
import { StatusAkun, StatusTitik } from '@sgza/shared';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /api/admin/users?status=PENDING
   * Mengambil daftar user (default status PENDING jika tidak ada filter)
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
   * GET /api/admin/titik-budaya?status=PENDING_REVIEW
   * Mengambil daftar titik budaya untuk dikurasi
   */
  @Get('titik-budaya')
  async getTitikBudaya(@Query('status') status?: StatusTitik) {
    return this.adminService.getTitikBudaya(status);
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
}

