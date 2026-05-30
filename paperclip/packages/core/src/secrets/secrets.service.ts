import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let masterKey: string | null = null;
let secrets = new Map<string, string>(); // stored as hex-encoded encrypted blobs

function getKey(): Buffer {
  if (!masterKey) {
    masterKey = process.env.SECRETS_MASTER_KEY ?? 'default-dev-key-change-in-production';
  }
  // Derive a 32-byte key from the master key string
  return scryptSync(masterKey, 'paperclip-salt', 32);
}

export function setMasterKey(key: string): void {
  masterKey = key;
}

export function setSecret(name: string, value: string): void {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  // Store as iv:encrypted hex
  const blob = iv.toString('hex') + ':' + encrypted.toString('hex');
  secrets.set(name, blob);
}

export function getSecret(name: string): string | null {
  const blob = secrets.get(name);
  if (!blob) return null;

  try {
    const key = getKey();
    const parts = blob.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');

    // Last 16 bytes are the auth tag
    const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);
    const data = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function deleteSecret(name: string): boolean {
  return secrets.delete(name);
}

export function listSecretNames(): string[] {
  return Array.from(secrets.keys());
}

export function resetSecrets(): void {
  secrets.clear();
  masterKey = null;
}
