import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context';
import { ApiKey } from '../models/ApiKeys';
import { toast } from 'react-toastify';

export const useApiKeys = () => {
  const { user, token } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    if (!user || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_APP_DESIGNER_BACKEND}/api/v1/users/apikeys`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) throw new Error("Error fetching API Keys");

      const data = await response.json();
      setApiKeys(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load API Keys";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);


  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  return {
    apiKeys,
    setApiKeys,
    isLoading,
    error,
    refetch: fetchApiKeys
  };
};