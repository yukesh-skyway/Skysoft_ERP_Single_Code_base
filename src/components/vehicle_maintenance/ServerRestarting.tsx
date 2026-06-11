/**
 * Server Restarting Overlay Component
 * Full-screen blocking overlay when server is down
 * Prevents all user actions to avoid duplicate data issues
 * Skysoft Fleet Maintenance Module
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useServerStatus } from '../../contexts/ServerStatusContext';

export const ServerRestarting: React.FC = () => {
  const { isServerDown, lastHealthCheck, retryConnection } = useServerStatus();
  const [countdown, setCountdown] = useState(60);
  const [isRetrying, setIsRetrying] = useState(false);

  /**
   * Countdown timer (60 seconds)
   * Resets when server status changes
   */
  useEffect(() => {
    if (!isServerDown) {
      setCountdown(60);
      return;
    }

    // Start countdown from 60 seconds
    setCountdown(60);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto-retry after countdown reaches 0
          console.log('⏰ Auto-retry triggered after 60 seconds');
          retryConnection();
          return 60; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isServerDown, retryConnection]);

  /**
   * Manual retry handler
   */
  const handleRetryNow = () => {
    setIsRetrying(true);
    retryConnection();
    
    // Reset retry state after 2 seconds
    setTimeout(() => {
      setIsRetrying(false);
    }, 2000);
  };

  // Don't render if server is running
  if (!isServerDown) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          padding: '48px',
          maxWidth: '600px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Warning Icon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            <AlertTriangle size={48} color="#ffffff" strokeWidth={2.5} />
          </div>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '16px',
            letterSpacing: '-0.02em',
          }}
        >
          Server is Restarting
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: '18px',
            color: '#94a3b8',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          The backend server is currently unavailable. This is temporary and usually
          resolves within a minute. All your work is safe.
        </p>

        {/* Countdown Display */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              color: '#64748b',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '600',
            }}
          >
            Auto-retry in
          </div>
          <div
            style={{
              fontSize: '48px',
              fontWeight: '700',
              color: '#3b82f6',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {countdown}s
          </div>
        </div>

        {/* Retry Button */}
        <button
          onClick={handleRetryNow}
          disabled={isRetrying}
          style={{
            backgroundColor: isRetrying ? '#64748b' : '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '16px 32px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isRetrying ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            transform: isRetrying ? 'scale(0.98)' : 'scale(1)',
            opacity: isRetrying ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isRetrying) {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRetrying) {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          <RefreshCw
            size={20}
            style={{
              animation: isRetrying ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {isRetrying ? 'Checking...' : 'Retry Now'}
        </button>

        {/* Last Check Time */}
        {lastHealthCheck && (
          <div
            style={{
              marginTop: '24px',
              fontSize: '14px',
              color: '#64748b',
            }}
          >
            Last checked: {lastHealthCheck.toLocaleTimeString()}
          </div>
        )}

        {/* Help Text */}
        <div
          style={{
            marginTop: '32px',
            padding: '16px',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: '1.5',
              margin: 0,
            }}
          >
            <strong style={{ color: '#ffffff' }}>What's happening?</strong>
            <br />
            The server may be restarting for maintenance or experiencing temporary
            issues. This overlay prevents you from accidentally creating duplicate
            records. Please wait for the connection to restore automatically.
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
