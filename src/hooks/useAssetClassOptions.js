// src/hooks/useAssetClassOptions.js
import { useEffect, useState } from 'react';
import { supabase, TABLES } from '../services/supabase';

export function useAssetClassOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from(TABLES.ASSET_CLASSES)
          .select('id, name')
          .order('group_name')
          .order('sort_order');
        if (error) throw error;
        if (isMounted) setOptions(data || []);
      } catch (e) {
        if (isMounted) setError(e.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  return { options, loading, error };
}

