import { snakeToCamel } from '@paperclip/shared-types';

export function caseTransformMiddleware(): (
  request: Request,
  next: (req: Request) => Promise<Response>
) => Promise<Response> {
  return (request, next) => next(request).then(response => {
    // Only transform JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) return response;
    return response.json().then(data => {
      const transformed = Array.isArray(data)
        ? data.map(item => snakeToCamel(item as Record<string, unknown>))
        : snakeToCamel(data as Record<string, unknown>);
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(transformed), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    });
  });
}
