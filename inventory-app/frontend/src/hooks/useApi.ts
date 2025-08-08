import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  showSuccessMessage?: boolean;
  showErrorMessage?: boolean;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction(...args);
      setData(result);
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }

      if (options.showSuccessMessage) {
        console.log('Success:', result);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || err.message
        : 'Ha ocurrido un error inesperado';
      
      setError(errorMessage);
      
      if (options.onError) {
        options.onError(err);
      }

      if (options.showErrorMessage) {
        console.error('Error:', errorMessage);
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

export default useApi;