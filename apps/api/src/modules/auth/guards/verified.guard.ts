import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { StatusAkun } from '@sgza/shared';
import { User } from '../../../entities/user.entity';

@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Akses ditolak: Autentikasi diperlukan');
    }

    if (user.status !== StatusAkun.VERIFIED) {
      throw new ForbiddenException(
        `Akses terbatas: Status akun Anda saat ini adalah '${user.status}'. Hanya etnografer dengan status '${StatusAkun.VERIFIED}' yang diizinkan menambahkan arsip budaya.`,
      );
    }

    return true;
  }
}

