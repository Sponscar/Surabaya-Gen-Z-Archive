import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Rel,
  Enum,
} from '@mikro-orm/core';
import { BadRequestException } from '@nestjs/common';
import { StatusTitik } from '@sgza/shared';
import { User } from './user.entity';
import { Wilayah } from './wilayah.entity';
import { TRANSISI_TITIK } from '../common/state-machine/titik-transitions';

/**
 * TitikBudaya — data crowdsourced dari user VERIFIED.
 * Hanya tampil di peta setelah admin APPROVE (status = APPROVED).
 */
@Entity({ tableName: 'titik_budaya' })
export class TitikBudaya {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => User)
  user!: Rel<User>;

  @ManyToOne(() => Wilayah)
  wilayah!: Rel<Wilayah>;

  @Property()
  judul!: string;

  @Property({ type: 'text', nullable: true })
  deskripsi?: string;

  /** Path foto wajib — disimpan di disk, serve lewat /uploads/titik/:filename */
  @Property()
  fotoPath!: string;

  /** Path audio opsional — Sprint 1 = dummy/nullable */
  @Property({ nullable: true })
  audioPath?: string;

  @Property({ nullable: true })
  slangTerkait?: string;

  /**
   * PostGIS geometry Point — koordinat titik budaya.
   * Auto-fill dari klik peta di frontend.
   */
  @Property({ type: 'text', columnType: 'geometry(Point, 4326)' })
  koordinat!: string;

  @Enum(() => StatusTitik)
  status: StatusTitik = StatusTitik.PENDING_REVIEW;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ nullable: true })
  reviewedAt?: Date;

  @Property({ nullable: true })
  reviewedById?: number;

  // ─── State Machine ───────────────────────────────────────────────────────
  /**
   * Transisi status titik budaya. Transisi ilegal throw BadRequestException.
   * Rule:  PENDING_REVIEW → APPROVED | REJECTED
   *        REJECTED       → PENDING_REVIEW (submit ulang)
   *        APPROVED       → (tidak bisa diubah)
   */
  ubahStatus(target: StatusTitik, adminId?: number): void {
    const allowed = TRANSISI_TITIK[this.status];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transisi status tidak valid: ${this.status} → ${target}`,
      );
    }
    this.status = target;
    this.reviewedAt = new Date();
    this.reviewedById = adminId;
  }
}

