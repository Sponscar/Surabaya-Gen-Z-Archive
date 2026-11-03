import { StatusAkun } from '@sgza/shared';

/**
 * State machine transisi status akun user.
 *
 * PENDING  → VERIFIED  (admin approve)
 * PENDING  → REJECTED  (admin reject)
 * REJECTED → PENDING   (user ajukan ulang)
 * VERIFIED → (terminal — tidak bisa diubah)
 */
export const TRANSISI_USER: Record<StatusAkun, StatusAkun[]> = {
  [StatusAkun.PENDING]:  [StatusAkun.VERIFIED, StatusAkun.REJECTED],
  [StatusAkun.VERIFIED]: [],
  [StatusAkun.REJECTED]: [StatusAkun.PENDING],
};

/**
 * Validasi transisi status user secara standalone (tanpa entity).
 * Digunakan di unit test atau service sebelum memanggil entity.ubahStatus().
 */
export function isTransisiUserValid(
  dari: StatusAkun,
  ke: StatusAkun,
): boolean {
  return TRANSISI_USER[dari].includes(ke);
}

