import { IsEnum, IsNotEmpty } from 'class-validator';
import { StatusAkun } from '@sgza/shared';

export class UpdateUserStatusDto {
  @IsEnum(StatusAkun, {
    message: 'Status akun harus berupa PENDING, VERIFIED, atau REJECTED',
  })
  @IsNotEmpty({ message: 'Status wajib diisi' })
  status!: StatusAkun;
}

