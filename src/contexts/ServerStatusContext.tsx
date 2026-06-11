/**
 * Server Status Context - 24/7 Background Health Monitoring
 * Continuously checks if backend server is running (regardless of user authentication)
 * Skysoft Fleet Maintenance Module
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config/urls';

interface ServerStatusContextType {
  isServerDown: boolean;
  lastHealthCheck: Date | null;
  retryConnection: () => void;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

export const useServerStatus = () => {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error('useServerStatus must be used within ServerStatusProvider');
  }
  return context;
};

interface ServerStatusProviderProps {
  children: React.ReactNode;
}

// ============================================
// 🎨 FIGMA DEVELOPMENT MODE DETECTOR
// ============================================
const isRunningInFigma = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const inIframe = window.self !== window.top;
    if (inIframe) {
      try {
        const parentOrigin = document.referrer;
        return parentOrigin.includes('figma.com');
      } catch (e) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
};

// ============================================
// 💻 LOCAL DEVELOPMENT MODE DETECTOR
// ============================================
const isLocalDevelopment = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

export const ServerStatusProvider: React.FC<ServerStatusProviderProps> = ({ children }) => {
  const [isServerDown, setIsServerDown]       = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

  // ✅ FIX 1: Use a ref for consecutive failures so the callback always
  //    reads the current value — not a stale closure snapshot.
  const consecutiveFailuresRef = useRef(0);

  const [inFigma]    = useState(isRunningInFigma());
  const [inLocalDev] = useState(isLocalDevelopment());

  /**
   * Health check function.
   *
   * Key changes vs the original:
   *  - consecutiveFailures is now a ref (no stale-closure bug)
   *  - useCallback has an empty dependency array so the function
   *    reference is stable — no cascade of new intervals
   */
  const checkServerHealth = useCallback(async () => {
    const healthUrl = `${API_BASE_URL}/health`;

    try {
      const controller = new AbortController();
      // ✅ FIX 2: 8 second timeout — gives the server room when DevTools
      //    opens and causes a momentary CPU/network spike.
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('❌ Health check failed: HTTP', response.status);
        consecutiveFailuresRef.current += 1;
        // ✅ FIX 3: Read from ref — always current, never stale
        if (consecutiveFailuresRef.current >= 3) {
          setIsServerDown(true);
        }
        setLastHealthCheck(new Date());
        return;
      }

      const data = await response.json();

      if (data && data.success === true && data.message) {
        // ✅ Successful response — reset everything
        consecutiveFailuresRef.current = 0;
        setIsServerDown(false);
        setLastHealthCheck(new Date());
      } else {
        console.error('❌ Health check failed: Invalid response format', data);
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 3) {
          setIsServerDown(true);
        }
        setLastHealthCheck(new Date());
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('❌ Health check timeout');
      } else if (error instanceof SyntaxError) {
        console.error('❌ Health check failed: Server returned non-JSON');
      } else {
        console.error('❌ Health check failed:', error.message);
      }

      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3) {
        setIsServerDown(true);
      }
      setLastHealthCheck(new Date());
    }
  // ✅ FIX 4: Empty dependency array — function reference never changes,
  //    so the useEffect interval below is created exactly once.
  }, []);

  const retryConnection = useCallback(() => {
    console.log('🔄 Manual retry initiated...');
    consecutiveFailuresRef.current = 0; // reset failures on manual retry
    checkServerHealth();
  }, [checkServerHealth]);

  useEffect(() => {
    if (inFigma) {
      console.log('🎨 Running in Figma - Server health monitoring DISABLED');
      return;
    }
    if (inLocalDev) {
      console.log('💻 Running in Local Development - Server health monitoring DISABLED');
      return;
    }

    // Initial check immediately on mount
    checkServerHealth();

    // ✅ FIX 5: 30 second interval instead of 1 second.
    //    1-second polling is extremely aggressive — it means opening
    //    DevTools (which spikes CPU for ~500ms) almost guarantees 3
    //    consecutive failures and triggers the overlay every time.
    //    30 seconds is plenty for detecting a real server outage.
    const intervalId = setInterval(checkServerHealth, 30_000);

    return () => clearInterval(intervalId);

  // ✅ Stable dependency — checkServerHealth never changes (empty deps above)
  }, [checkServerHealth, inFigma, inLocalDev]);

  return (
    <ServerStatusContext.Provider value={{ isServerDown, lastHealthCheck, retryConnection }}>
      {children}
    </ServerStatusContext.Provider>
  );
};