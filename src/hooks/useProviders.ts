import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { authFetch } from '../lib/api';
import { useAuth } from '../context';
/**
 * Define la estructura de los datos de los proveedores que se reciben de la API.
 */
interface ProvidersData {
  models: string[];
  default: string;
  apiKeyProviders: Record<string, string[]>;
  }

/**
 * Hook para obtener y gestionar la información de los proveedores de modelos desde el leia-runner.
 */
export const useProviders = () => {
  const {token} = useAuth();
    const [providersData, setProvidersData] = useState<ProvidersData>({models: [], default: '', apiKeyProviders: {}});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const { res, data } = await authFetch(`${import.meta.env.VITE_APP_DESIGNER_BACKEND}/api/v1/runner/models`, token);

      if (!res.ok) {
        const msg = data?.message || res.statusText || `Error fetching providers: ${res.status}`;
        throw new Error(msg);
      }
      console.log('Datos recibidos de la API:', data);
      setProvidersData(data as ProvidersData);
      console.log('Proveedores cargados:', providersData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load providers";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [token]);
    useEffect(() => {
    fetchProviders();
    }, [fetchProviders]);

    const apiKeysProviderSet = useMemo(() => {
        if (!providersData || !providersData.apiKeyProviders) return [];
        return Object.keys(providersData.apiKeyProviders);
    },[providersData]);


    return {
    models: providersData?.models || [],
    defaultModel: providersData?.default || '',
    apiKeyProvidersMapped: providersData?.apiKeyProviders || {},
    apiKeysProviderSet: apiKeysProviderSet,
    isLoading,
    error,
    refetch: fetchProviders,
  };
};
