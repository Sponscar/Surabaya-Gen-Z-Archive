// ============================================================
// @sgza/shared — Titik types
// ============================================================

import type { GeoJSONPoint } from './wilayah';
import type { UserPublic } from './user';

export enum StatusTitik {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED       = 'APPROVED',
  REJECTED       = 'REJECTED',
}

export interface TitikSejarah {
  id: string;
  wilayahId: string;
  namaLokasi: string;
  deskripsi: string;
  alamat?: string;
  fotoUrl?: string;
  kategori?: string;
  lat?: number;
  lng?: number;
  geojson?: GeoJSONPoint | null;
  koordinat?: GeoJSONPoint;
}

export interface TitikBudaya {
  id: string;
  user?: UserPublic;
  wilayahId: string;
  judul: string;
  deskripsi?: string;
  alamat?: string;
  fotoPath?: string;
  audioPath?: string;
  slangTerkait?: string;
  lat?: number;
  lng?: number;
  geojson?: GeoJSONPoint | null;
  koordinat?: GeoJSONPoint;
  status: StatusTitik;
  createdAt: string;
  kategori?: string;
}

export interface TitikBudayaPublic extends Omit<TitikBudaya, 'status'> {
  status: StatusTitik.APPROVED;
}

// DTO untuk form tambah titik budaya (frontend → backend)
export interface CreateTitikBudayaPayload {
  judul: string;
  deskripsi?: string;
  alamat?: string;
  slangTerkait?: string;
  lat: number;
  lng: number;
  wilayahId: string;
}

