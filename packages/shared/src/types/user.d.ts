export declare enum JenisInstansi {
    PERGURUAN_TINGGI = "Perguruan Tinggi",
    SEKOLAH = "Sekolah",
    KOMUNITAS = "Komunitas",
    LAINNYA = "Lainnya"
}
export declare enum StatusAkun {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED"
}
export interface InstansiDetail {
    namaPT?: string;
    nim?: string;
    namaSekolah?: string;
    kelas?: string;
    namaKomunitas?: string;
    deskripsi?: string;
}
export interface User {
    id: number;
    email: string;
    namaLengkap: string;
    nik: string;
    alamatLengkap: string;
    whatsapp: string;
    jenisInstansi: JenisInstansi;
    instansiDetail: InstansiDetail;
    ktpPath: string;
    status: StatusAkun;
    isAdmin: boolean;
    createdAt: Date;
    verifiedAt?: Date;
    verifiedBy?: number;
}
export interface UserPublic {
    id: number;
    namaLengkap: string;
    jenisInstansi: JenisInstansi;
    status: StatusAkun;
}
