/**
 * ============================================
 * 🚧 LINE RUN — COMING SOON PLACEHOLDER
 * ============================================
 * File: src/components/shared/LrComingSoon.tsx
 *
 * Temporary placeholder shown on all LR routes
 * until Phase 3 copies the real LR components in.
 * Remove and replace route by route in Phase 3.
 */

export function LrComingSoon() {
  const path = typeof window !== "undefined"
    ? window.location.pathname
    : "";

  const pageName = path
    .replace("/line_run_module/", "")
    .replace("/line_run_module", "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase()) || "Dashboard";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200
                      flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {pageName}
        </h2>
        <p className="text-sm text-gray-500 max-w-sm">
          This page is being migrated into the unified platform.
          It will be available in Phase 3 of the integration.
        </p>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50
                      border border-amber-200 rounded-lg">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-xs text-amber-700 font-medium">
          Phase 3 — Line Run frontend integration pending
        </span>
      </div>
    </div>
  );
}
