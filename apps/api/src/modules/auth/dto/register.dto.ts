import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { JenisInstansi } from '@sgza/shared';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email wajib diisi' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi sesuai KTP' })
  namaLengkap!: string;

  /**
   * NIK harus tepat 16 digit angka.
   */
  @IsString()
  @Length(16, 16, { message: 'NIK harus tepat 16 digit angka' })
  @Matches(/^\d{16}$/, { message: 'NIK hanya boleh berisi angka' })
  nik!: string;

  @IsOptional()
  @IsString()
  alamatLengkap?: string;

  @IsOptional()
  @IsString()
  alamat?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nomor WhatsApp wajib diisi' })
  @Matches(/^[0-9+]{9,16}$/, { message: 'Nomor WhatsApp tidak valid' })
  whatsapp!: string;

  @IsEnum(JenisInstansi, { message: 'Jenis instansi tidak valid' })
  jenisInstansi!: JenisInstansi;

  /**
   * Data detail instansi (string JSON dari form-data multipart, dinormalisasi oleh Factory).
   */
  @IsOptional()
  instansiDetail?: string | Record<string, string>;

  @IsOptional()
  pdpConsent?: boolean | string;
}

