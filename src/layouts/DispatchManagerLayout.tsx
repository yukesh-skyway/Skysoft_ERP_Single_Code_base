import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Outlet } from "react-router";
import {
  Menu,
  X,
  Calendar,
  LayoutDashboard,
  Truck,
  BarChart3,
  ChevronDown,
  User,
  LogOut,
  ArrowLeft,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function DispatchManagerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [arrowHovered, setArrowHovered] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, logout, isLoading } = useAuth();

  // Helper function to check if a route is active
  const isActive = (path: string) => {
    const currentPath = location.pathname;
    const basePath = "/dispatch_manager";
    
    if (path === "dashboard" || path === "/") {
      return currentPath === basePath || currentPath === `${basePath}/dashboard`;
    }
    return currentPath === `${basePath}/${path}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { id: "dispatch-chart", label: "Dispatch Chart", icon: Calendar },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "trips", label: "Manage Trips", icon: Truck },
    { id: "booking-statistics", label: "Booking Statistics", icon: BarChart3 },
  ];

  const handleNavigation = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Branding with Arrow Button */}
            <div className="flex items-center gap-3">
              {/* Arrow Back Button */}
              <button
                onClick={() => {
                  window.location.href = "/";
                }}
                onMouseEnter={() => setArrowHovered(true)}
                onMouseLeave={() => setArrowHovered(false)}
                className="group relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all duration-200"
                title="Back to Modules"
              >
                <ArrowLeft
                  className={`w-5 h-5 text-gray-500 transition-all duration-200 ${
                    arrowHovered ? "-translate-x-0.5 text-indigo-600" : ""
                  }`}
                />
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-200"></div>

              {/* Branding */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-none">Dispatch Manager</p>
                  <p className="text-xs text-gray-400 leading-none mt-0.5">Operations & Dispatch</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive(item.id)
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* User Menu (Desktop) */}
            <div className="hidden lg:flex items-center gap-2">
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="space-y-1">
                    <div className="w-20 h-3 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-16 h-2 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ) : user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.username?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-gray-700 font-medium">
                        {user.username}
                      </div>
                      <div className="text-xs text-gray-500">
                        Dispatch Manager
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-[100]">
                      <div className="py-2">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <div className="text-sm font-medium text-gray-900">
                            {user.username}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {user.email}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigate("/account");
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span>My Account</span>
                        </button>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-xs text-amber-600">⚠️ Not authenticated</div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-2 max-h-[calc(100vh-64px)] overflow-y-auto">
              {/* Navigation Items */}
              <div className="mt-2 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive(item.id)
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-4"></div>

              {/* User Info (Mobile) */}
              {user && (
                <div className="mt-2">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg mb-2">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.username?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate("/account");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-5 h-5" />
                    <span className="text-sm">My Account</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm">Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
    <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}