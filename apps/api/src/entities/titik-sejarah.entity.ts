import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Rel,
} from '@mikro-orm/core';
import { Wilayah } from './wilayah.entity';

/**
 * TitikSejarah — data historis Surabaya yang di-seed manual oleh tim.
 * Read-only untuk semua user; hanya admin yang bisa mengedit via DB langsung.
 */
@Entity({ tableName: 'titik_sejarah' })
export class TitikSejarah {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Wilayah)
  wilayah!: Rel<Wilayah>;

  @Property()
  namaLokasi!: string;

  @Property({ type: 'text' })
  deskripsi!: string;

  /**
   * PostGIS geometry Point — koordinat historis.
   * Format GeoJSON: { type: 'Point', coordinates: [lng, lat] }
   */
  @Property({ type: 'text', columnType: 'geometry(Point, 4326)' })
  koordinat!: string;

  /** Opsional — URL foto / gambar historis */
  @Property({ nullable: true })
  fotoUrl?: string;
}

