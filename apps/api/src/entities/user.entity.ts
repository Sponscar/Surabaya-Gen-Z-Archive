import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  ManyToOne,
  Rel,
} from '@mikro-orm/core';
import { BadRequestException } from '@nestjs/common';
import { StatusAkun, JenisInstansi } from '@sgza/shared';
import { TRANSISI_USER } from '../common/state-machine/user-transitions';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  email!: string;

  @Property()
  passwordHash!: string;

  @Property()
  namaLengkap!: string;

  /**
   * NIK dienkripsi AES-256 sebelum disimpan.
   * Untuk verifikasi domisili, parse dilakukan SEBELUM enkripsi saat registrasi.
   */
  @Property()
  nikEncrypted!: string;

  @Property({ type: 'text' })
  alamatLengkap!: string;

  @Property()
  whatsapp!: string;

  @Enum(() => JenisInstansi)
  jenisInstansi!: JenisInstansi;

  /**
   * instansiDetail disimpan sebagai JSONB — field dinamis sesuai jenisInstansi.
   * Factory mini yang melakukan normalisasi di AuthService.
   */
  @Property({ type: 'json', nullable: true })
  instansiDetail?: Record<string, string>;

  /**
   * Path file foto KTP terenkripsi AES-256.
   * Akses hanya lewat endpoint admin yang dilindungi guard.
   */
  @Property({ nullable: true })
  ktpPathEncrypted?: string;

  @Enum(() => StatusAkun)
  status: StatusAkun = StatusAkun.PENDING;

  @Property({ default: false })
  isAdmin: boolean = false;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ nullable: true })
  verifiedAt?: Date;

  @Property({ nullable: true })
  verifiedById?: number;

  // ─── State Machine ───────────────────────────────────────────────────────
  /**
   * Transisi status akun. Transisi ilegal langsung throw BadRequestException.
   * Rule:  PENDING  → VERIFIED | REJECTED
   *        REJECTED → PENDING  (ajukan ulang)
   *        VERIFIED → (tidak bisa diubah)
   */
  ubahStatus(target: StatusAkun, adminId?: number): void {
    const allowed = TRANSISI_USER[this.status];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transisi status tidak valid: ${this.status} → ${target}`,
      );
    }
    this.status = target;
    if (target === StatusAkun.VERIFIED) {
      this.verifiedAt = new Date();
      this.verifiedById = adminId;
    }
  }
}

