import { Outlet } from "react-router";
import { TopNav } from "./TopNav";
import { MessageCenter } from "./MessageCenter";

/**
 * ========================================
 * 🎨 LAYOUT COMPONENT
 * ========================================
 * 
 * This component wraps all routes and provides:
 * - TopNav (navigation bar with menu items)
 * - Main content area (Outlet for route components)
 * - MessageCenter (AI assistant chat)
 * 
 * The <Outlet /> component is where React Router
 * renders the current route's component.
 */

export function Layout() {
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
