import * as crypto from 'crypto';

/**
 * Utility enkripsi AES-256-CBC untuk kepatuhan UU PDP (Pelindungan Data Pribadi).
 * Digunakan untuk enkripsi NIK dan path/data sensitif KTP.
 */
export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly IV_LENGTH = 16; // 16 bytes for AES

  private static getKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
    // Gunakan SHA-256 agar selalu menghasilkan 32 byte key yang valid
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Enkripsi teks polos menjadi format `iv_hex:encrypted_hex`
   */
  static encrypt(plainText: string): string {
    if (!plainText) return plainText;
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.getKey(), iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Dekripsi format `iv_hex:encrypted_hex` kembali ke teks polos
   */
  static decrypt(cipherText: string): string {
    if (!cipherText || !cipherText.includes(':')) return cipherText;
    const [ivHex, encryptedHex] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.getKey(), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

