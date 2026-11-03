import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
} from '@mikro-orm/core';
import { NamaWilayah } from '@sgza/shared';

/**
 * Wilayah — 5 area Surabaya: BARAT, TIMUR, SELATAN, UTARA, PUSAT.
 * Data diisi via seed, tidak bisa diubah user.
 * Polygon disimpan sebagai geometry(Polygon, 4326) di PostGIS.
 */
@Entity({ tableName: 'wilayah' })
export class Wilayah {
  @PrimaryKey()
  id!: number;

  @Enum(() => NamaWilayah)
  nama!: NamaWilayah;

  /**
   * PostGIS geometry — Polygon.
   * Disimpan sebagai GeoJSON string, dikembalikan sebagai GeoJSON object.
   */
  @Property({ type: 'text', columnType: 'geometry(Polygon, 4326)' })
  polygon!: string;
}

