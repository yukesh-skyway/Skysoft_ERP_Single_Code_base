import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  CURRENT_USER_ENDPOINT,
  LOGIN_URL,
  LOGOUT_URL,
} from "../config/urls";

// ============================================
// 🎨 FIGMA DEVELOPMENT MODE
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
// 💻 LOCAL DEVELOPMENT MODE
// ============================================
const isLocalDevelopment = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

const FIGMA_DEV_USER = {
  id: 295,
  username: "Yukesh Vinayagan",
  email: "yukesh@skysoft.com",
  role: "1,2,3,4",
  roles: [
    { role_id: "1", role_name: "Admin" },
    { role_id: "2", role_name: "Manager" },
    { role_id: "3", role_name: "Mechanic" },
    { role_id: "4", role_name: "Driver" }
  ]
};

interface Role {
  role_id: string;
  role_name: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  roles?: Role[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionExpired: boolean;
  sessionRedirectUrl: string;
  checkSession: () => Promise<void>;
  logout: () => void;
  markSessionExpired: (redirectUrl?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// 🔒 SESSION EXPIRED SCREEN
// ============================================
const SessionExpiredScreen: React.FC<{ redirectUrl: string }> = ({ redirectUrl }) => {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = redirectUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [redirectUrl]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* Glow orb */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        textAlign: 'center',
        maxWidth: '440px',
        padding: '48px 40px',
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '20px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {/* Lock icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
          border: '1px solid rgba(99,102,241,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 28px',
          fontSize: '32px',
        }}>
          🔒
        </div>

        <h1 style={{
          color: '#f1f5f9',
          fontSize: '24px',
          fontWeight: 700,
          margin: '0 0 10px',
          letterSpacing: '-0.5px',
        }}>
          Session Expired
        </h1>

        <p style={{
          color: '#94a3b8',
          fontSize: '15px',
          lineHeight: 1.6,
          margin: '0 0 32px',
        }}>
          Your session has expired or you are not authorized to access this page.
          Please log in again to continue.
        </p>

        {/* Countdown bar */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 8px' }}>
            Redirecting to login in
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              flex: 1,
              height: '4px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                width: `${(countdown / 10) * 100}%`,
                transition: 'width 1s linear',
              }} />
            </div>
            <span style={{ color: '#a5b4fc', fontSize: '14px', fontWeight: 600, minWidth: '20px' }}>
              {countdown}s
            </span>
          </div>
        </div>

        <button
          onClick={() => { window.location.href = redirectUrl; }}
          style={{
            width: '100%',
            padding: '13px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.2px',
            boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Login Again →
        </button>

        <p style={{
          marginTop: '20px',
          color: '#334155',
          fontSize: '12px',
        }}>
          Skysoft Fleet Maintenance Module
        </p>
      </div>
    </div>
  );
};

// ============================================
// 🛡️ AUTH PROVIDER
// ============================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [sessionRedirectUrl, setSessionRedirectUrl] = useState<string>(LOGIN_URL);

  // ============================================
  // 🔒 markSessionExpired
  // useCallback so it's stable — safe to use inside
  // useEffect deps without causing infinite loops
  // ============================================
  const markSessionExpired = useCallback((redirectUrl?: string) => {
    setUser(null);
    setSessionRedirectUrl(redirectUrl || LOGIN_URL);
    setIsSessionExpired(true);
  }, []);

  // Keep a ref so the fetch interceptor always calls the
  // latest version without needing to re-install itself
  const markExpiredRef = useRef(markSessionExpired);
  useEffect(() => {
    markExpiredRef.current = markSessionExpired;
  }, [markSessionExpired]);

  // ============================================
  // 🌐 GLOBAL FETCH INTERCEPTOR
  // Installed once. Uses ref so it always has the
  // latest markSessionExpired without re-installing.
  // ============================================
  const interceptorInstalled = useRef(false);
const isAuthReady = useRef(false);

useEffect(() => {
  if (isRunningInFigma() || isLocalDevelopment()) return;
  if (interceptorInstalled.current) return;
  interceptorInstalled.current = true;

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (response.status === 401) {
      // ⏳ Ignore 401s until initial session check is complete
      if (!isAuthReady.current) {
        console.warn('⏳ 401 ignored — session check not ready yet');
        return response;
      }

      const cloned = response.clone();
      try {
        const data = await cloned.json();
        markExpiredRef.current(data?.redirect || LOGIN_URL);
      } catch {
        markExpiredRef.current(LOGIN_URL);
      }
    }

    return response;
  };

  return () => {
    window.fetch = originalFetch;
    interceptorInstalled.current = false;
  };
}, []);

  // ============================================
  // ⏱️ BACKGROUND SESSION POLLER
  // Silently pings every 1s so the screen appears
  // automatically when user logs out elsewhere —
  // no page refresh, no user action needed.
  // Uses a ref for isSessionExpired to avoid
  // re-creating the interval on every state change.
  // ============================================
  const isExpiredRef = useRef(isSessionExpired);
useEffect(() => {
  if (isRunningInFigma() || isLocalDevelopment()) return;

  // ⏳ Wait until session check is done and user is confirmed
  if (isLoading || !user) return;

  const POLL_INTERVAL = 1_000;

  const poll = async () => {
    if (isExpiredRef.current) return;

    try {
      const response = await fetch(CURRENT_USER_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 401) {
        const data = await response.json().catch(() => ({}));
        markExpiredRef.current(data?.redirect || LOGIN_URL);
      }
    } catch {
      // Network/server down — ServerRestarting handles this
    }
  };

  const interval = setInterval(poll, POLL_INTERVAL);
  return () => clearInterval(interval);
}, [isLoading, user]); // ← only starts after user is confirmed

  // ============================================
  // 🔄 CHECK SESSION
  // ============================================
  const checkSession = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(CURRENT_USER_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Session data received:', data);
        if (data.success && data.user) {
          console.log('👤 User authenticated:', data.user.username);
          setUser(data.user);
        } else {
          console.warn('⚠️ No user in response');
          setUser(null);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Session check failed:', errorData);
        setUser(null);

        if (response.status === 401) {
          console.log('🔒 Session invalid — showing expired screen');
          markSessionExpired(errorData?.redirect || LOGIN_URL);
        }
      }
    } catch (error) {
      console.error("❌ Session check failed with error:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
      isAuthReady.current = true; // ← add this
      console.log("✨ Session check complete");
    }
  };

  const logout = () => {
    setUser(null);
    window.location.href = LOGOUT_URL;
  };

  // Check session on mount
  useEffect(() => {
    const figmaMode = isRunningInFigma();
    const devMode = isLocalDevelopment();

    if (figmaMode || devMode) {
      console.log(figmaMode ? '🎨 FIGMA MODE' : '💻 LOCAL DEV MODE', '- Using hardcoded session');
      setUser(FIGMA_DEV_USER);
      setIsLoading(false);
    } else {
      console.log('🌐 PRODUCTION MODE - Checking real session');
      checkSession();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isSessionExpired,
        sessionRedirectUrl,
        checkSession,
        logout,
        markSessionExpired,
      }}
    >
      {/* 🔒 SESSION EXPIRED — blocks entire screen */}
      {isSessionExpired && (
        <SessionExpiredScreen redirectUrl={sessionRedirectUrl} />
      )}

      {/* Render children regardless so state is preserved under the overlay */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};