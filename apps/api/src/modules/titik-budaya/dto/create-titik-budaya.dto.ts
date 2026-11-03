import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTitikBudayaDto {
  @IsString()
  @IsNotEmpty({ message: 'Judul titik budaya wajib diisi' })
  @MinLength(3, { message: 'Judul minimal 3 karakter' })
  judul!: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;

  @IsString()
  @IsOptional()
  alamat?: string;

  @IsString()
  @IsOptional()
  slangTerkait?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Wilayah ID harus berupa angka' })
  @IsNotEmpty({ message: 'Wilayah wajib dipilih' })
  wilayahId!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude harus berupa angka koordinat' })
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude harus berupa angka koordinat' })
  @Min(-180)
  @Max(180)
  lng!: number;
}

