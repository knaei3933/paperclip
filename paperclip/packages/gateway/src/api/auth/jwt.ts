import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

export interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
  jti?: string;
}

const JWT_HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export function signToken(payload: Omit<JwtPayload, 'iat'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = { ...payload, iat: now };
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = createHmac('sha256', getSecret()).update(`${JWT_HEADER}.${payloadB64}`).digest('base64url');
  return `${JWT_HEADER}.${payloadB64}.${signature}`;
}

export function verifyToken(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payloadB64, signature] = parts;
  if (header !== JWT_HEADER) return null;

  const expectedSig = createHmac('sha256', getSecret()).update(`${header}.${payloadB64}`).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload: JwtPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateAccessToken(userId: string, role: string = 'user'): string {
  const expiresIn = parseInt(process.env.JWT_ACCESS_EXPIRY ?? '900', 10);
  return signToken({
    sub: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    type: 'access',
  });
}

export function generateRefreshToken(userId: string, role: string = 'user'): { token: string; jti: string } {
  const jti = randomBytes(16).toString('hex');
  const expiresIn = parseInt(process.env.JWT_REFRESH_EXPIRY ?? '604800', 10);
  const token = signToken({
    sub: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    type: 'refresh',
    jti,
  });
  return { token, jti };
}

// In-memory refresh token store (sufficient for single-instance)
const refreshTokens = new Map<string, { userId: string; role: string; expiresAt: number }>();

export function storeRefreshToken(jti: string, userId: string, role: string, ttlSeconds: number): void {
  refreshTokens.set(jti, { userId, role, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function consumeRefreshToken(jti: string): { userId: string; role: string } | null {
  const entry = refreshTokens.get(jti);
  if (!entry) return null;
  refreshTokens.delete(jti); // One-time use
  if (Date.now() > entry.expiresAt) return null;
  return { userId: entry.userId, role: entry.role };
}

export function pruneExpiredTokens(): void {
  const now = Date.now();
  for (const [jti, entry] of refreshTokens) {
    if (now > entry.expiresAt) refreshTokens.delete(jti);
  }
}

// Auto-prune every 10 minutes
setInterval(pruneExpiredTokens, 10 * 60 * 1000).unref();
