import { useState, useEffect } from 'react';
import { fetchFleetKpis, type FleetKpi } from '../services/dashboardService';

interface UseFleetDashboardResult {
  kpi:     FleetKpi | null;
  loading: boolean;
  error:   string | null;
  refetch: () => void;
}

export function useFleetDashboard(): UseFleetDashboardResult {
  const [kpi,     setKpi]     = useState<FleetKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFleetKpis()
      .then(data  => { if (!cancelled) setKpi(data); })
      .catch(err  => { if (!cancelled) setError(err.message); })
      .finally(()  => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tick]);

  return {
    kpi,
    loading,
    error,
    refetch: () => setTick(t => t + 1),
  };
}
