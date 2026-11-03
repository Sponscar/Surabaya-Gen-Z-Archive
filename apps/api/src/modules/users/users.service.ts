import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { User } from '../../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
  ) {}

  async getMe(userId: number) {
    const user = await this.userRepo.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    return {
      id: user.id,
      email: user.email,
      namaLengkap: user.namaLengkap,
      alamatLengkap: user.alamatLengkap,
      whatsapp: user.whatsapp,
      jenisInstansi: user.jenisInstansi,
      instansiDetail: user.instansiDetail,
      status: user.status,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      verifiedAt: user.verifiedAt,
    };
  }
}

