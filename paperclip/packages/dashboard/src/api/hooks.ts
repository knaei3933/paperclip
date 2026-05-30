import { useEffect, useRef, useState, useCallback } from 'react';

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number = 15_000,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const errorCountRef = useRef(0);

  const poll = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
      errorCountRef.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      errorCountRef.current++;
    }
  }, [fetchFn]);

  useEffect(() => {
    poll(); // initial fetch
    intervalRef.current = setInterval(() => {
      // Exponential backoff on consecutive errors: 15s -> 30s -> 60s -> 120s max
      if (errorCountRef.current > 0) {
        const backoff = Math.min(intervalMs * Math.pow(2, errorCountRef.current - 1), 120_000);
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(poll, backoff);
        return;
      }
      poll();
    }, intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [poll, intervalMs]);

  return { data, error };
}
