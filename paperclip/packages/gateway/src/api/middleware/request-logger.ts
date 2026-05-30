import { randomUUID } from 'node:crypto';

declare global {
  interface Request {
    correlationId?: string;
  }
}

export interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  correlationId: string;
}

export type RequestLogFn = (entry: RequestLogEntry) => void;

const defaultLogFn: RequestLogFn = (entry) => {
  console.log(
    `[API] ${entry.method} ${entry.path} ${entry.status} ${entry.durationMs}ms`,
  );
};

export function requestLogger(logFn: RequestLogFn = defaultLogFn) {
  return async (
    request: Request,
    next: (request: Request) => Promise<Response>,
  ): Promise<Response> => {
    const correlationId = randomUUID();
    request.correlationId = correlationId;

    const url = new URL(request.url);
    const path = url.pathname;
    const start = Date.now();

    const response = await next(request);

    const durationMs = Date.now() - start;

    logFn({
      method: request.method,
      path,
      status: response.status,
      durationMs,
      correlationId,
    });

    response.headers.set('X-Correlation-Id', correlationId);
    return response;
  };
}
