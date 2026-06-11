import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { API_BASE_URL } from '../../config/api';
import {
  Menu,
  X,
  Bus,
  Wrench,
  ClipboardList,
  FileText,
  Calendar,
  History,
  Settings,
  MapPin,
  MessageSquare,
  Shield,
  ScrollText,
  ChevronDown,
  Home,
  Database,
  AlertTriangle,
  Store,
  CreditCard,
  ArrowLeft,
  Zap,
  Sparkles,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useCapabilities } from "../../contexts/CapabilitiesContext";

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [fleetManageOpen, setFleetManageOpen] = useState(false);
  const [repairOrderOpen, setRepairOrderOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const maintenanceDropdownRef = useRef<HTMLDivElement>(null);
  const fleetDropdownRef = useRef<HTMLDivElement>(null);
  const repairOrderDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // User and capabilities hooks must be at the top level
  const { user, logout, isLoading } = useAuth();
  const capabilities = useCapabilities();

  // Helper function to check if a route is active
  const isActive = (path: string) => {
    // Check if we're in production (dev.strategyit.ca)
    const isProduction = window.location.hostname === "dev.strategyit.ca";

    if (path === "/" || path === "comprehensive-dashboard") {
      if (isProduction) {
        return (
          location.pathname === "/vehicle_maintenance_module" ||
          location.pathname === "/vehicle_maintenance_module/comprehensive-dashboard"
        );
      }
      return (
        location.pathname === "/" || location.pathname === "/comprehensive-dashboard"
      );
    }

    if (isProduction) {
      return location.pathname === `/vehicle_maintenance_module/${path}`;
    }
    return location.pathname === `/${path}`;
  };

  // Debug: Log user state
  useEffect(() => {
    console.log("🎭 TopNav - User state:", { user, isLoading });
  }, [user, isLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        maintenanceDropdownRef.current &&
        !maintenanceDropdownRef.current.contains(
          event.target as Node,
        )
      ) {
        setMaintenanceOpen(false);
      }
      if (
        fleetDropdownRef.current &&
        !fleetDropdownRef.current.contains(event.target as Node)
      ) {
        setFleetManageOpen(false);
      }
      if (
        repairOrderDropdownRef.current &&
        !repairOrderDropdownRef.current.contains(
          event.target as Node,
        )
      ) {
        setRepairOrderOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
  }, []);

  const maintenanceItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Wrench,
    },
    {
      id: "manage-repair-code-categories",
      label: "Repair Code Categories",
      icon: ClipboardList,
    },
    {
      id: "interval-config",
      label: "Interval Settings",
      icon: Settings,
    },
    {
      id: "maintenance-setup",
      label: "Configuration Setup",
      icon: Database,
    },
    {
      id: "maintenance-schedule",
      label: "Maintenance Schedule",
      icon: Calendar,
    },
    {
      id: "maintenance-history",
      label: "Maintenance History",
      icon: History,
    },
  ];

  const fleetManageItems = [
    {
      id: "fleet-management",
      label: "Fleet Management",
      icon: Bus,
    },
  ];

  const repairOrderItems = [
    {
      id: "ro-dashboard",
      label: "RO Dashboard",
      icon: Wrench,
    },
    {
      id: "manage-defects",
      label: "Manage All Defects",
      icon: AlertTriangle,
    },
    { id: "repair-orders", label: "Manage RO", icon: FileText },
    {
      id: "manage-vendors",
      label: "Manage Vendors",
      icon: Store,
    },
    {
      id: "manage-payment-methods",
      label: "Payment Methods",
      icon: CreditCard,
    },
  ];

  const handleMaintenanceItemClick = (id: string) => {
    setMaintenanceOpen(false);
    setMobileMenuOpen(false);
    navigate(id); // Changed from `/${id}` to relative path
  };

  const handleFleetManageItemClick = (id: string) => {
    setFleetManageOpen(false);
    setMobileMenuOpen(false);
    navigate(id); // Changed from `/${id}` to relative path
  };

  const handleRepairOrderItemClick = (id: string) => {
    setRepairOrderOpen(false);
    setMobileMenuOpen(false);
    navigate(id); // Changed from `/${id}` to relative path
  };

  const handleNavigationClick = (screen: string) => {
    setMobileMenuOpen(false);
    navigate(screen); // Changed from `/${screen}` to relative path
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              onMouseEnter={() => setLogoHovered(true)}
              onMouseLeave={() => setLogoHovered(false)}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-all duration-300 ease-in-out cursor-pointer group overflow-hidden relative"
              title="Go to Home Page"
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <Wrench
                  className={`w-5 h-5 sm:w-6 sm:h-6 text-white absolute transition-all duration-300 ease-in-out ${
                    logoHovered
                      ? "opacity-0 scale-75 rotate-90"
                      : "opacity-100 scale-100 rotate-0"
                  }`}
                />
                <ArrowLeft
                  className={`w-5 h-5 sm:w-6 sm:h-6 text-white absolute transition-all duration-300 ease-in-out ${
                    logoHovered
                      ? "opacity-100 scale-100 translate-x-0"
                      : "opacity-0 scale-75 translate-x-2"
                  }`}
                />
              </div>
            </button>
            {(() => {
  const url = API_BASE_URL.toLowerCase();
  let env = '';
  let bg = '';
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    env = 'LOCAL';
    bg = 'linear-gradient(to right, #f50bbb, #a3a2aa)';
  } else if (url.includes('dev.')) {
    env = 'DEV';
    bg = 'linear-gradient(to right, #f97316, #ef4444)';
  } else if (url.includes('uat.')) {
    env = 'UAT';
    bg = 'linear-gradient(to right, #a855f7, #4f46e5)';
  }
  if (!env) return null;
  return (
    <span
      style={{ background: bg }}
      className="flex items-center gap-0.5 px-1.5 py-0.5 text-white rounded-full text-[10px] font-bold shadow-lg"
    >
      {env}
    </span>
  );
})()}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1 flex-1 ml-8">
            {/* Comprehensive Dashboard Button */}
            <button
              onClick={() =>
                handleNavigationClick(
                  "comprehensive-dashboard"
                )
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive("comprehensive-dashboard")
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </button>

            {/* Repair Order Dropdown */}
            <div
              className="relative"
              ref={repairOrderDropdownRef}
            >
              <button
                onClick={() =>
                  setRepairOrderOpen(!repairOrderOpen)
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  repairOrderItems.some(
                    (item) => isActive(item.id),
                  )
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">Repair Order</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${repairOrderOpen ? "rotate-180" : ""}`}
                />
              </button>

              {repairOrderOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-[100]">
                  <div className="py-2">
                    {repairOrderItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={item.id}
                          onClick={() => {
                            setRepairOrderOpen(false);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive(item.id)
                              ? "bg-blue-50 text-blue-600"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Fleet Manage Dropdown */}
            <div className="relative" ref={fleetDropdownRef}>
              <button
                onClick={() =>
                  setFleetManageOpen(!fleetManageOpen)
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  fleetManageItems.some(
                    (item) => isActive(item.id),
                  )
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Bus className="w-4 h-4" />
                <span className="text-sm">Fleets</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${fleetManageOpen ? "rotate-180" : ""}`}
                />
              </button>

              {fleetManageOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-[100]">
                  <div className="py-2">
                    {fleetManageItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={item.id}
                          onClick={() => {
                            setFleetManageOpen(false);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive(item.id)
                              ? "bg-blue-50 text-blue-600"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Maintenance Dropdown */}
            <div
              className="relative"
              ref={maintenanceDropdownRef}
            >
              <button
                onClick={() =>
                  setMaintenanceOpen(!maintenanceOpen)
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  maintenanceItems.some(
                    (item) => isActive(item.id),
                  )
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span className="text-sm">Maintenance</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${maintenanceOpen ? "rotate-180" : ""}`}
                />
              </button>

              {maintenanceOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-[100]">
                  <div className="py-2">
                    {maintenanceItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={item.id}
                          onClick={() => {
                            setMaintenanceOpen(false);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive(item.id)
                              ? "bg-blue-50 text-blue-600"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Preventive Maintenance with AI Badge */}
            <button
              onClick={() =>
                handleNavigationClick(
                  "preventive-maintenance",
                )
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive("preventive-maintenance")
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm">
                Preventive Maintenance
              </span>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-[10px] shadow-lg ml-1">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            </button>

            <button
              onClick={() =>
                handleNavigationClick("activity-logs")
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive("activity-logs")
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <ScrollText className="w-4 h-4" />
              <span className="text-sm">Logs</span>
            </button>
 <button
              onClick={() =>
                handleNavigationClick("ai-assistance")
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive("ai-assistance")
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">AI Assistant</span>
            </button>
            {/* HIDDEN: Access Control menu */}
            {/* Only show Access Control for Admin users */}
            {/* {capabilities.isAdmin && (
              <button
                onClick={() =>
                  handleNavigationClick("user-access-control")
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  location.hash === "#user-access-control"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm">Access Control</span>
              </button>
            )} */}
          </div>

          {/* User Menu (Desktop) */}
          <div className="hidden lg:flex items-center gap-2 ml-4">
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
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">
                      {user.username?.charAt(0).toUpperCase() ||
                        "U"}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-gray-700">
                      {user.username}
                    </div>
                    {/* Display role badges */}
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {user.roles && user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role.role_id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 border border-blue-200"
                          >
                            {role.role_name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">
                          {user.role}
                        </span>
                      )}
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
                        <div className="text-sm">
                          {user.username}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          {user.email}
                        </div>
                        {/* Display role badges in dropdown */}
                        <div className="flex flex-wrap gap-1">
                          {user.roles &&
                          user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <span
                                key={role.role_id}
                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 border border-blue-200"
                              >
                                {role.role_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">
                              {user.role}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleNavigationClick("user-profile");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span>Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-xs text-amber-600">
                  ⚠️ Not authenticated
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-2 max-h-[calc(100vh-64px)] overflow-y-auto">
            {/* Dashboard */}
            <div className="mt-2">
              <button
                onClick={() =>
                  handleNavigationClick(
                    "comprehensive-dashboard",
                  )
                }
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("comprehensive-dashboard")
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Home className="w-5 h-5" />
                <span className="text-sm">Dashboard</span>
              </button>
            </div>

            {/* Repair Order Section */}
            <div className="mt-4">
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">
                Repair Order
              </div>
              {repairOrderItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      handleRepairOrderItemClick(item.id)
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.id)
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fleet Manage Section */}
            <div className="mt-4">
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">
                Fleets
              </div>
              {fleetManageItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    to={item.id}
                    onClick={() => {
                      setFleetManageOpen(false);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.id)
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Maintenance Section */}
            <div className="mt-4">
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">
                Maintenance
              </div>
              {maintenanceItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      handleMaintenanceItemClick(item.id)
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.id)
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Other Items */}
            <div className="mt-4 space-y-1 pb-4">
              {/* Preventive Maintenance with AI Badge */}
              <button
                onClick={() =>
                  handleNavigationClick(
                    "preventive-maintenance",
                  )
                }
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
                  isActive("preventive-maintenance")
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Zap className="w-5 h-5" />
                <span className="text-sm">
                  Preventive Maintenance
                </span>
                <span className="ml-auto flex items-center gap-0.5 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-[10px] shadow-lg">
                  <Sparkles className="w-2.5 h-2.5" />
                  AI
                </span>
              </button>

              <button
                onClick={() =>
                  handleNavigationClick("activity-logs")
                }
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("activity-logs")
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ScrollText className="w-5 h-5" />
                <span className="text-sm">Logs</span>
              </button>
    <button
              onClick={() =>
                handleNavigationClick("ai-assistance")
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive("ai-assistance")
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">AI Assistant</span>
            </button>
              {/* HIDDEN: Access Control menu (mobile) */}
              {/* Only show Access Control for Admin users */}
              {/* {capabilities.isAdmin && (
                <button
                  onClick={() =>
                    handleNavigationClick("user-access-control")
                  }
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    location.hash === "#user-access-control"
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-sm">Access Control</span>
                </button>
              )} */}
            </div>

            {/* User Profile and Logout */}
            <div className="mt-4 space-y-1 pb-4">
              <button
                onClick={() => handleNavigationClick("user-profile")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("user-profile")
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-sm">Profile</span>
              </button>

              <button
                onClick={logout}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive("logout")
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}