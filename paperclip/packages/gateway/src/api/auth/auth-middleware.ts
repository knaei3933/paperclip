import { verifyToken, type JwtPayload } from './jwt.js';

export interface AuthResult {
  authenticated: boolean;
  payload?: JwtPayload;
  error?: string;
}

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/telegram/webhook',
  '/api/auth/login',
  '/api/auth/refresh',
  '/mcp/sse',
  '/mcp/rpc',
]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export function authenticateRequest(request: Request): AuthResult {
  // If JWT_SECRET is not set, fall back to legacy Bearer token mode
  if (!process.env.JWT_SECRET) {
    return authenticateLegacy(request);
  }

  const url = new URL(request.url);
  if (isPublicPath(url.pathname)) {
    return { authenticated: true };
  }

  const header = request.headers.get('authorization');
  if (!header) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }

  if (!header.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Invalid Authorization scheme' };
  }

  const token = header.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }

  if (payload.type !== 'access') {
    return { authenticated: false, error: 'Refresh tokens cannot be used for API access' };
  }

  return { authenticated: true, payload };
}

function authenticateLegacy(request: Request): AuthResult {
  const authToken = process.env.API_AUTH_TOKEN;
  if (!authToken) {
    return { authenticated: true };
  }

  const url = new URL(request.url);
  if (isPublicPath(url.pathname)) {
    return { authenticated: true };
  }

  const header = request.headers.get('authorization');
  if (header !== `Bearer ${authToken}`) {
    return { authenticated: false, error: 'Unauthorized' };
  }

  return { authenticated: true };
}
