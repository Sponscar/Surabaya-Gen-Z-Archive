import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { User } from '../../../entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User | undefined = request.user;

    if (!user || !user.isAdmin) {
      throw new ForbiddenException(
        'Akses ditolak: Operasi ini membutuhkan hak akses Administrator / Validator SGZA.',
      );
    }

    return true;
  }
}

