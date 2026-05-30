export interface ErrorResponseBody {
  error: string;
  message: string;
  requestId: string;
}

export interface ErrorHandlerOptions {
  isDev?: boolean;
}

export function errorHandler(options: ErrorHandlerOptions = {}) {
  const isDev = options.isDev ?? (process.env['NODE_ENV'] !== 'production');

  return (
    err: unknown,
    requestId: string,
  ): Response => {
    const message =
      err instanceof Error ? err.message : 'Internal server error';

    if (isDev && err instanceof Error && err.stack) {
      console.error(`[API Error] requestId=${requestId}`, err.stack);
    } else {
      console.error(
        `[API Error] requestId=${requestId} ${message}`,
      );
    }

    const body: ErrorResponseBody = {
      error: isDev
        ? (err instanceof Error ? err.constructor.name : 'Error')
        : 'InternalError',
      message: isDev ? message : 'Internal server error',
      requestId,
    };

    return Response.json(body, { status: 500 });
  };
}
