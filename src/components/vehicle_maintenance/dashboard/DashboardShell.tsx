import { useState, useEffect, useCallback } from 'react';
import { Truck, ShieldAlert, ClipboardList, Sparkles, RefreshCw, MapPin, Cloud, Sun, CloudRain, CloudSnow, Wind, Loader2 } from 'lucide-react';
import FleetPanel from './FleetPanel';
import DefectPanel from './DefectPanel';
import RepairPanel from './RepairPanel';

type Tab = 'fleet' | 'defects' | 'repairs';

interface WeatherData {
  temp: number;
  condition: string;
  city: string;
  region: string;
  icon: string;
}

interface TabConfig {
  key: Tab;
  label: string;
  description: string;
  Icon: React.ElementType;
  activeIconBg: string;
  activeIconColor: string;
  activeBorder: string;
  activeDot: string;
  activeText: string;
}

const tabs: TabConfig[] = [
  {
    key: 'fleet',
    label: 'Fleet management',
    description: 'Health & compliance',
    Icon: Truck,
    activeIconBg:    'bg-blue-50',
    activeIconColor: 'text-blue-600',
    activeBorder:    'border-blue-500',
    activeDot:       'bg-blue-500',
    activeText:      'text-blue-500',
  },
  {
    key: 'defects',
    label: 'Defect management',
    description: 'Open & in-progress',
    Icon: ShieldAlert,
    activeIconBg:    'bg-red-50',
    activeIconColor: 'text-red-500',
    activeBorder:    'border-red-400',
    activeDot:       'bg-red-400',
    activeText:      'text-red-400',
  },
  {
    key: 'repairs',
    label: 'Repair orders',
    description: 'Active ROs & labour',
    Icon: ClipboardList,
    activeIconBg:    'bg-amber-50',
    activeIconColor: 'text-amber-600',
    activeBorder:    'border-amber-500',
    activeDot:       'bg-amber-500',
    activeText:      'text-amber-500',
  },
];

function WeatherIcon({ condition, size = 14 }: { condition: string; size?: number }) {
  const c = condition.toLowerCase();
  if (c.includes('snow'))                            return <CloudSnow size={size} color="#93c5fd" />;
  if (c.includes('rain') || c.includes('drizzle'))  return <CloudRain size={size} color="#60a5fa" />;
  if (c.includes('cloud') || c.includes('overcast')) return <Cloud    size={size} color="#cbd5e1" />;
  if (c.includes('wind'))                            return <Wind      size={size} color="#cbd5e1" />;
  return <Sun size={size} color="#fbbf24" />;
}

function useLocalTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      const { latitude: lat, longitude: lon } = pos.coords;

      // Fetch weather + accurate location in parallel
      const [weatherRes, geoRes] = await Promise.all([
        window.fetch(`https://wttr.in/${lat},${lon}?format=j1`),
        window.fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
          headers: { 'Accept-Language': 'en' }
        }),
      ]);

      const weatherData = await weatherRes.json();
      const geoData     = await geoRes.json();

      const current = weatherData.current_condition[0];
      const address = geoData.address || {};

      // Pick the most specific available place name
      const city   = address.city || address.town || address.village || address.county || '';
      const region = address.state || address.province || '';

      setWeather({
        temp:      parseInt(current.temp_C, 10),
        condition: current.weatherDesc[0].value,
        city,
        region,
        icon:      current.weatherDesc[0].value,
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);
  return { weather, loading, refresh: fetchWeather };
}

export default function DashboardShell() {
  const [activeTab, setActiveTab] = useState<Tab>('fleet');
  const time = useLocalTime();
  const { weather, loading, refresh } = useWeather();

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="p-6">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8">

        {/* Left — title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              Comprehensive Fleet Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{ background: '#f5f3ff', color: '#6d28d9', borderColor: '#ede9fe' }}>
              <Sparkles size={10} color="#7c3aed" />
              AI powered
            </span>
            <button
              onClick={() => window.location.reload()}
              title="Refresh page"
              className="inline-flex items-center gap-1 rounded-full border transition-all duration-150 text-xs font-medium px-2 py-0.5"
              style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
            >
              <RefreshCw size={10} color="#64748b" />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Real-time insights across your fleet, defects, and repair operations
          </p>
        </div>

        {/* Right — compact colored widget */}
        <div className="flex items-center gap-1.5 flex-shrink-0">

          {/* Clock — indigo pill */}
          <span
            className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium border"
            style={{ background: '#eef2ff', borderColor: '#c7d2fe', color: '#4f46e5', whiteSpace: 'nowrap' }}
          >
            <span className="font-semibold tabular-nums">{timeStr}</span>
            <span style={{ color: '#818cf8' }}>{dateStr}</span>
          </span>

          {/* Weather — slate pill */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border"
            style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155', whiteSpace: 'nowrap' }}
          >
            {loading ? (
              <Loader2 size={11} color="#94a3b8" className="animate-spin" />
            ) : weather ? (
              <>
                <WeatherIcon condition={weather.icon} size={11} />
                <span className="font-semibold">{weather.temp}°C</span>
                <span style={{ color: '#94a3b8' }}>{weather.condition}</span>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <MapPin size={9} color="#94a3b8" />
                <span style={{ color: '#64748b' }}>{weather.city}, {weather.region}</span>
              </>
            ) : (
              <span style={{ color: '#94a3b8' }}>No location</span>
            )}
          </span>

        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-gray-200 mb-8">
        {tabs.map(t => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`
                group relative flex items-center gap-3 px-5 py-4 text-left
                transition-all duration-200 border-b-2 -mb-px rounded-t-lg
                ${isActive
                  ? `bg-white ${t.activeBorder} shadow-sm`
                  : 'border-transparent bg-transparent hover:bg-gray-50 hover:border-gray-300'
                }
              `}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${isActive ? t.activeIconBg : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                <t.Icon size={18} className={`transition-colors duration-200 ${isActive ? t.activeIconColor : 'text-gray-400 group-hover:text-gray-600'}`} />
              </span>
              <span className="flex flex-col min-w-0">
                <span className={`text-sm font-medium leading-snug transition-colors duration-200 ${isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-800'}`}>
                  {t.label}
                </span>
                <span className={`text-xs leading-snug transition-colors duration-200 ${isActive ? t.activeText : 'text-gray-400'}`}>
                  {t.description}
                </span>
              </span>
              {isActive && (
                <span className={`absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full ${t.activeDot}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Panel Content ──────────────────────────────── */}
      {activeTab === 'fleet'   && <FleetPanel   animationKey={activeTab} />}
      {activeTab === 'defects' && <DefectPanel  animationKey={activeTab} />}
      {activeTab === 'repairs' && <RepairPanel  animationKey={activeTab} />}

    </div>
  );
}