import { IsEnum, IsNotEmpty } from 'class-validator';
import { StatusTitik } from '@sgza/shared';

export class UpdateTitikStatusDto {
  @IsEnum(StatusTitik, {
    message: 'Status titik harus berupa PENDING_REVIEW, APPROVED, atau REJECTED',
  })
  @IsNotEmpty({ message: 'Status wajib diisi' })
  status!: StatusTitik;
}

