// ============================================================
// @sgza/shared — Wilayah types
// ============================================================

export enum NamaWilayah {
  BARAT   = 'BARAT',
  TIMUR   = 'TIMUR',
  SELATAN = 'SELATAN',
  UTARA   = 'UTARA',
  PUSAT   = 'PUSAT',
}

export interface Wilayah {
  id: string;
  nama: string;
  deskripsi?: string;
  geojson?: GeoJSONPolygon | null;
  polygon?: GeoJSONPolygon;
}

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

