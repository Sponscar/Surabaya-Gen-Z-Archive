import { StatusTitik } from '@sgza/shared';

/**
 * State machine transisi status titik budaya.
 *
 * PENDING_REVIEW → APPROVED  (admin approve)
 * PENDING_REVIEW → REJECTED  (admin reject)
 * REJECTED       → PENDING_REVIEW (user submit ulang)
 * APPROVED       → (terminal — tidak bisa diubah)
 */
export const TRANSISI_TITIK: Record<StatusTitik, StatusTitik[]> = {
  [StatusTitik.PENDING_REVIEW]: [StatusTitik.APPROVED, StatusTitik.REJECTED],
  [StatusTitik.APPROVED]:       [],
  [StatusTitik.REJECTED]:       [StatusTitik.PENDING_REVIEW],
};

/**
 * Validasi transisi status titik secara standalone.
 */
export function isTransisiTitikValid(
  dari: StatusTitik,
  ke: StatusTitik,
): boolean {
  return TRANSISI_TITIK[dari].includes(ke);
}

