/**
 * ============================================
 * 🔧 VEHICLE MAINTENANCE LAYOUT
 * ============================================
 * File: src/layouts/VmLayout.tsx
 *
 * Wraps all /vehicle_maintenance_module/* routes.
 * Extracted from the original src/components/Layout.tsx
 * — zero changes to existing behavior.
 *
 * Contains:
 *  - TopNav  (VM sidebar navigation)
 *  - Outlet  (React Router child page renders here)
 *  - MessageCenter (AI assistant)
 */

import { Outlet } from "react-router";
import { TopNav } from "../components/vehicle_maintenance/TopNav";
import { MessageCenter } from "../components/vehicle_maintenance/MessageCenter";

export function VmLayout() {
  return (
    <>
      <TopNav />
      <main className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4">
        <Outlet />
      </main>
      <MessageCenter />
    </>
  );
}
