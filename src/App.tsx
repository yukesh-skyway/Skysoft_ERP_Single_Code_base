import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthContext";
import { CapabilitiesProvider } from "./contexts/CapabilitiesContext";
import { ServerStatusProvider } from "./contexts/ServerStatusContext";
import { ServerRestarting } from "./components/vehicle_maintenance/ServerRestarting";
import { Toaster } from "sonner@2.0.3";
import { useEffect } from "react";
// At the top, add the import:

// ============================================
// 🛡️ SUPPRESS FIGMA IFRAME ERRORS
// ============================================
// These errors occur in Figma Make's infrastructure and are harmless
// They happen when the preview iframe reloads before messages complete
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Suppress Figma iframe messaging errors
    if (
      message.includes('IframeMessageAbortError') ||
      message.includes('message port was destroyed') ||
      message.includes('figma_app__react')
    ) {
      return; // Silently ignore these Figma infrastructure errors
    }
    originalError.apply(console, args);
  };
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
        return true; // Assume Figma if in iframe with cross-origin restriction
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
  if (typeof window === "undefined") return false;
  
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

export default function App() {
  // ============================================
  // 🗺️ REACT ROUTER MIGRATION COMPLETE
  // ============================================
  // Previously used state-based navigation (setActiveScreen)
  // Now using URL-based routing for better UX:
  // ✅ Right-click → "Open in new tab" works
  // ✅ Bookmarking specific screens
  // ✅ Direct URL sharing
  // ✅ Browser back/forward buttons
  
  // ============================================
  // 🛡️ GLOBAL ERROR HANDLERS
  // ============================================
  useEffect(() => {
    // Suppress unhandled promise rejections from Figma infrastructure
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.toString() || '';
      if (
        message.includes('IframeMessageAbortError') ||
        message.includes('message port was destroyed') ||
        message.includes('figma_app__react')
      ) {
        event.preventDefault(); // Prevent error from showing
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Detect environment modes
  const figmaMode = isRunningInFigma();
  const devMode = isLocalDevelopment();
  
  return (
    <AuthProvider>
      <CapabilitiesProvider>
        <ServerStatusProvider>
          {/* 🚨 SERVER DOWN OVERLAY - Blocks all user actions when server is unavailable */}
          <ServerRestarting />
          
          <div className="flex flex-col h-screen bg-gray-50">
            {/* 🎨 DEVELOPMENT MODE INDICATOR - Shows in both Figma and Localhost */}
            {(figmaMode || devMode) && (
              <div className={`${
                figmaMode 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600" 
                  : "bg-gradient-to-r from-blue-600 to-cyan-600"
              } text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2 shadow-lg`}>
                <span className="text-lg">🎨</span>
                <span className="font-semibold">
                  {figmaMode ? "FIGMA DEVELOPMENT MODE" : "LOCAL DEVELOPMENT MODE"}
                </span>
                <span className="opacity-90">|</span>
                <span className="opacity-90">Logged in as: <strong>Yukesh Vinayagan</strong></span>
                <span className="opacity-75 text-xs">(User ID: 295)</span>
              </div>
            )}
            
            {/* 🗺️ REACT ROUTER - Renders components based on URL */}
            <RouterProvider router={router} />
            
            <Toaster position="top-right" richColors closeButton />
          </div>
        </ServerStatusProvider>
      </CapabilitiesProvider>
    </AuthProvider>
  );
}