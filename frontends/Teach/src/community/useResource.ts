import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(false); const [loading, setLoading] = useState(!!path);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const id = ++version.current; if (!path) { setData(undefined); setLoading(false); setError(false); return; }
    setLoading(true); setError(false);
    try { const result = await api<T>(path); if (version.current === id) setData(result); }
    catch { if (version.current === id) setError(true); }
    finally { if (version.current === id) setLoading(false); }
  }, [path]);
  useEffect(() => { setData(undefined); void reload(); return () => { version.current++; }; }, [reload]);
  return { data, error, loading, reload, setData };
}
