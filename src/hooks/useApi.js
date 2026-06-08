import { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export function useApi(url, options = {}) {
  const { immediate = true, method = 'get', body = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (overrideBody) => {
    setLoading(true);
    setError(null);
    try {
      const response = method === 'get'
        ? await api.get(url)
        : await api[method](url, overrideBody ?? body);
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url, method, body]);

  useEffect(() => {
    if (immediate && method === 'get') {
      execute();
    }
  }, [url]);

  return { data, loading, error, execute, setData };
}
