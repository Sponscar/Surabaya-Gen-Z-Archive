import { ForbiddenException } from '@nestjs/common';
import { JenisInstansi } from '@sgza/shared';
import { RegisterDto } from '../dto/register.dto';
import { CryptoUtil } from '../../../common/crypto/crypto.util';

export class UserFactory {
  /**
   * Cek apakah NIK terdaftar sebagai domisili Kota Surabaya.
   * Kode BPS / Kemendagri Kota Surabaya: 3578 (atau 3574 pada beberapa kode wilayah administratif lama).
   */
  static isDomisiliSurabaya(nik: string): boolean {
    const cleanNik = (nik || '').replace(/\D/g, '');
    return cleanNik.startsWith('3578') || cleanNik.startsWith('3574');
  }

  /**
   * Normalisasi instansiDetail berdasarkan JenisInstansi yang dipilih user.
   */
  static normalizeInstansiDetail(
    jenis: JenisInstansi,
    rawDetail?: string | Record<string, string>,
  ): Record<string, string> {
    if (!rawDetail) return {};

    let detail: Record<string, string> = {};
    if (typeof rawDetail === 'string') {
      try {
        detail = JSON.parse(rawDetail);
      } catch {
        detail = { deskripsi: rawDetail };
      }
    } else {
      detail = { ...rawDetail };
    }

    switch (jenis) {
      case JenisInstansi.PERGURUAN_TINGGI:
        return {
          namaPT: (detail.namaPT || detail.nama || '').trim(),
          nim: (detail.nim || '').trim(),
        };

      case JenisInstansi.SEKOLAH:
        return {
          namaSekolah: (detail.namaSekolah || detail.nama || '').trim(),
          kelas: (detail.kelas || '').trim(),
        };

      case JenisInstansi.KOMUNITAS:
        return {
          namaKomunitas: (detail.namaKomunitas || detail.nama || '').trim(),
        };

      case JenisInstansi.LAINNYA:
      default:
        return {
          deskripsi: (detail.deskripsi || '').trim(),
        };
    }
  }

  /**
   * Menyiapkan data awal pembuatan User entity dari DTO yang masuk.
   * Melakukan validasi domisili NIK, enkripsi NIK, dan normalisasi instansi.
   */
  static prepareRegistrationData(
    dto: RegisterDto,
    passwordHash: string,
    ktpFilePath?: string,
  ) {
    if (!this.isDomisiliSurabaya(dto.nik)) {
      throw new ForbiddenException(
        'Pendaftaran khusus warga ber-KTP/NIK Kota Surabaya (Kode 35.78 / 35.74). User di luar Surabaya tidak diperkenankan mendaftar.',
      );
    }

    const normalizedDetail = this.normalizeInstansiDetail(
      dto.jenisInstansi,
      dto.instansiDetail,
    );

    return {
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      namaLengkap: dto.namaLengkap.trim(),
      nikEncrypted: CryptoUtil.encrypt(dto.nik.trim()),
      alamatLengkap: dto.alamatLengkap.trim(),
      whatsapp: dto.whatsapp.trim(),
      jenisInstansi: dto.jenisInstansi,
      instansiDetail: normalizedDetail,
      ktpPathEncrypted: ktpFilePath ? CryptoUtil.encrypt(ktpFilePath) : undefined,
    };
  }
}

