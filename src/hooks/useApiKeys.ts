import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context';
import { ApiKey, ApiKeyFormData } from '../models/ApiKeys';
import { toast } from 'react-toastify';
import { authFetch } from '../lib/api';

interface ApiKeyFormError extends Error {
  validationErrors?: Record<string, string>;
}

export const useApiKeys = () => {
  const { user, token } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  const fetchApiKeys = useCallback(async () => {
    if (!user || !token) return;
    setIsLoading(true);
    setError(null);

    try {
      const { res, data } = await authFetch(`${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys`, token);
      if (!res.ok) {
        const msg = data?.message || res.statusText || 'Error fetching API Keys';
        throw new Error(msg);
      }
      setApiKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load API Keys";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  const saveKey = async (url: string, method: string, payload: ApiKeyFormData) => {
    const { res, data } = await authFetch(url, token, { method, body: JSON.stringify(payload) });
    if (!res.ok) {
      const error: ApiKeyFormError = new Error(data?.message || res.statusText|| `HTTP ${res.status}`);
      if (data.validationErrors) {
        error.validationErrors = data.validationErrors;
      }
      throw error;
    }
    const savedKey: ApiKey = data as ApiKey;
    console.log("Saved key:", savedKey);
    setApiKeys((prev) => {
      if (method === "POST") {
        return [...prev, savedKey];
      } else {
        return prev.map((key) => (key.id === savedKey.id ? savedKey : key));
      }
    });
  };
  const deleteKey = async (url: string, id: string) => {
    const { res, data } = await authFetch(url, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(data?.message || 'Error deleting key');
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };
  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const toggleDefault = useCallback(async (key: ApiKey) => {
    if (!token) {
      const e = new Error('Not authenticated');
      toast.error(e.message);
      throw e;
    }
    const prevSnapshot = apiKeys;
    setSavingIds(s => ({ ...s, [key.id]: true }));

    // optimistic update using functional setter to avoid stale closures
    setApiKeys(current => current.map(k => {
      if (k.id === key.id) return { ...k, isDefault: !k.isDefault };
      if (!key.isDefault) return { ...k, isDefault: false };
      return k;
    }));

    try {
      const url = `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys/manage-default/${key.id}`;
      const { res, data } = await authFetch(url, token, { method: 'PUT' });

      if (!res.ok) {
        const msg = data?.message || res.statusText || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      let updated: ApiKey | null = null;
      let previousDefaultId: string | null = null;
      if (data && data.updatedKey) {
        updated = data.updatedKey as ApiKey;
        previousDefaultId = data.previousDefaultId ?? null;
      } else {
        updated = data as ApiKey;
      }

      if (!updated) {
        throw new Error('Empty response from server');
      }

      setApiKeys(current => current.map(k => {
        if (k.id === updated!.id) return { ...k, ...updated! };
        if (previousDefaultId && k.id === previousDefaultId) return { ...k, isDefault: false };
        if (!previousDefaultId && updated!.isDefault) {
          if (k.id !== updated!.id) return { ...k, isDefault: false };
        }
        return k;
      }));

      setSavingIds(s => { const copy = { ...s }; delete copy[key.id]; return copy; });
      return updated;
    } catch (err) {
      // rollback to the snapshot we took before the optimistic update
      setApiKeys(() => prevSnapshot);
      setSavingIds(s => { const copy = { ...s }; delete copy[key.id]; return copy; });
      const msg = err instanceof Error ? err.message : 'Failed to toggle default';
      toast.error(msg);
      throw err;
    }
  }, [apiKeys, token]);

  const getDefaultKey = useCallback((): ApiKey | null => {
    return apiKeys.find(k => k.isDefault) || null;
  }, [apiKeys]);


  return {
    apiKeys,
    setApiKeys,
    isLoading,
    error,
    refetch: fetchApiKeys,
    toggleDefault,
    savingIds,
    deleteKey,
    saveKey,
    getDefaultKey
  };
};