// ============================================================
// @sgza/shared — User types
// Digunakan oleh apps/web dan apps/api
// ============================================================

export enum JenisInstansi {
  PERGURUAN_TINGGI = 'Perguruan Tinggi',
  SEKOLAH          = 'Sekolah',
  KOMUNITAS        = 'Komunitas',
  LAINNYA          = 'Lainnya',
}

export enum StatusAkun {
  PENDING  = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface InstansiDetail {
  // Perguruan Tinggi
  namaPT?: string;
  nim?: string;
  // Sekolah
  namaSekolah?: string;
  kelas?: string;
  // Komunitas
  namaKomunitas?: string;
  // Lainnya
  deskripsi?: string;
}

export interface User {
  id: number;
  email: string;
  namaLengkap: string;
  nik: string; // terenkripsi di DB, di sini sudah plain untuk display admin
  alamatLengkap: string;
  whatsapp: string;
  jenisInstansi: JenisInstansi;
  instansiDetail: InstansiDetail;
  ktpPath: string;
  status: StatusAkun;
  isAdmin: boolean;
  createdAt: Date;
  verifiedAt?: Date;
  verifiedBy?: number; // admin user id
}

export interface UserPublic {
  id: number;
  namaLengkap: string;
  jenisInstansi: JenisInstansi;
  status: StatusAkun;
}

