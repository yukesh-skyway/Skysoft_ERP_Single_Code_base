import { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User,
  Sparkles,
  HelpCircle,
  Minimize2
} from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function MessageCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! 👋 I\'m your AI Fleet Management Assistant. I can help you navigate the system, explain features, and answer questions about vehicle maintenance, repair orders, fleet tracking, and more. How can I assist you today?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const quickActions = [
    { label: 'How to add a vehicle?', query: 'How do I add a new vehicle to the fleet?' },
    { label: 'Track fleet location', query: 'How can I track my fleet in real-time?' },
    { label: 'Schedule maintenance', query: 'How do I schedule maintenance for vehicles?' },
    { label: 'Create repair order', query: 'How do I create a repair order?' },
  ];

  const getAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    // ========================================
    // DASHBOARD & ANALYTICS
    // ========================================
    
    if (lowerMessage.includes('dashboard') || lowerMessage.includes('overview') || lowerMessage.includes('kpi')) {
      return 'Access comprehensive data visualization:\n\n**Comprehensive Dashboard:**\n• Real-time KPIs and fleet metrics\n• Fleet health overview with status indicators\n• Upcoming maintenance alerts and schedules\n• Cost trends and budget analysis\n• Interactive charts powered by Recharts\n• Quick access to critical actions\n\n**RO Dashboard:**\n• Repair Order status tracking\n• Pending vs Completed ROs\n• Vendor performance metrics\n• Cost analysis by category\n\nNavigate to **Dashboard** in the top menu to view all analytics!';
    }

    // ========================================
    // FLEET MANAGEMENT
    // ========================================

    // Fleet Profile & Adding Vehicles
    if (lowerMessage.includes('add') && (lowerMessage.includes('vehicle') || lowerMessage.includes('fleet'))) {
      return 'To add a new vehicle:\n\n1. Navigate to **Fleets → Fleet Profile**\n2. Click the "Add New Vehicle" button\n3. Fill in vehicle details:\n   • Chassis Number & VIN\n   • Registration & License Plate\n   • Vehicle Type & Model\n   • Mileage & Engine Specs\n4. Upload vehicle images if needed\n5. Click "Save" to add to fleet\n\nYou can also:\n• Edit existing vehicles\n• View vehicle service history\n• Track maintenance schedules\n• Integrate with Motive API for live GPS tracking';
    }

    // Fleet Tracker
    if (lowerMessage.includes('track') || lowerMessage.includes('location') || lowerMessage.includes('gps') || lowerMessage.includes('real-time') || lowerMessage.includes('fleet tracker')) {
      return 'To track your fleet in real-time:\n\n1. Go to **Fleets → Fleet Tracker**\n2. View all vehicles on the interactive map\n3. Use the sidebar to filter vehicles by:\n   • Status (Active, Idle, In Maintenance)\n   • Vehicle Type\n   • Driver Assignment\n4. Click on any vehicle marker to see:\n   • Live GPS coordinates\n   • Current speed and direction\n   • Driver information\n   • Last update timestamp\n5. Use zoom controls to adjust map view\n\n**Features:**\n• Live vehicle locations synced with Motive API\n• Status indicators (Active, Idle, Maintenance, Out of Service)\n• Driver assignments and schedules\n• Vehicle route history\n• Real-time push notifications';
    }

    // Fleet Management
    if (lowerMessage.includes('fleet management') || lowerMessage.includes('manage fleet')) {
      return 'Fleet Management Hub:\n\n1. Navigate to **Fleets → Fleet Management**\n2. Features available:\n   • View all vehicles with status cards\n   • Filter by vehicle type, status, location\n   • Quick actions: View Details, Schedule Maintenance, Create RO\n   • Live odometer sync from Motive API\n   • Maintenance schedule overview\n   • Service history tracking\n\n**Quick Actions:**\n• Click "Schedule Maintenance" to set up preventive services\n• Click "View Details" for comprehensive vehicle information\n• Access Fleet Maintenance Matrix for configuration\n\nThe system integrates with Motive for live KM/mileage tracking!';
    }

    // Fleet Collections & Types
    if (lowerMessage.includes('collection') || lowerMessage.includes('fleet type') || lowerMessage.includes('sub-collection')) {
      return 'Organize your fleet:\n\n**Fleet Collections:**\n1. Go to **Fleets → Fleet Collections**\n2. Create logical groupings (e.g., "City Buses", "School Buses")\n3. Assign vehicles to collections\n\n**Fleet Sub-Collections:**\n1. Access **Fleets → Fleet Sub-Collections**\n2. Create sub-groups within collections (e.g., "Route 1", "Route 2")\n\n**Fleet Types:**\n1. Navigate to **Fleets → Fleet Types**\n2. Define vehicle categories (Bus, Van, Truck, etc.)\n3. Set maintenance templates per type\n\nThese help organize maintenance schedules, reporting, and resource allocation!';
    }

    // Fleet Availability
    if (lowerMessage.includes('availability') || lowerMessage.includes('booking') || lowerMessage.includes('reserve') || lowerMessage.includes('schedule vehicle')) {
      return 'Fleet Availability Management:\n\n1. Access **Fleets → Fleet Availability**\n2. View hourly scheduling grid for all vehicles\n3. Features:\n   • Check vehicle status across time slots\n   • Color-coded availability indicators\n   • Create bookings by clicking time slots\n   • Assign drivers and set trip details\n   • Block time for maintenance windows\n   • Conflict detection & warnings\n\n**Status Indicators:**\n• 🟢 Available\n• 🔵 Booked\n• 🟡 Maintenance\n• 🔴 Out of Service\n\nReal-time availability with drag-and-drop scheduling!';
    }

    // ========================================
    // MAINTENANCE MANAGEMENT
    // ========================================

    // Maintenance Scheduling
    if (lowerMessage.includes('maintenance') && (lowerMessage.includes('schedule') || lowerMessage.includes('plan'))) {
      return 'To schedule vehicle maintenance:\n\n1. Navigate to **Maintenance → Maintenance Schedule**\n2. Click "New Schedule" button\n3. Select the vehicle from your fleet\n4. Choose maintenance type:\n   • Preventive Maintenance\n   • Routine Service\n   • Safety Inspection\n   • Component Replacement\n5. Set interval configuration:\n   • Mileage-based (e.g., every 5,000 km)\n   • Time-based (e.g., every 6 months)\n   • Engine hours\n6. Assign technician or vendor\n7. Save the schedule\n\nThe system automatically creates ROs when intervals are reached!';
    }

    // Scheduled Configurations Settings (Interval Config)
    if (lowerMessage.includes('interval') || lowerMessage.includes('config') || lowerMessage.includes('scheduled configuration')) {
      return 'Scheduled Configurations Settings:\n\n1. Access **Maintenance → Scheduled Configurations Settings**\n2. Create maintenance templates based on:\n   • Mileage intervals (km or miles)\n   • Time intervals (days, weeks, months)\n   • Engine hours\n   • Custom triggers\n3. Configure different intervals for:\n   • Oil changes\n   • Brake inspections\n   • Tire rotations\n   • Annual inspections\n4. Set automatic reminders and alerts\n5. Apply templates to vehicle types\n\n**Example:** "Oil Change every 5,000 km OR 6 months, whichever comes first"\n\nThe system tracks all intervals and notifies you automatically!';
    }

    // Maintenance Data Setup (Fleet Maintenance Matrix)
    if (lowerMessage.includes('maintenance data') || lowerMessage.includes('maintenance matrix') || lowerMessage.includes('setup maintenance')) {
      return 'Fleet Maintenance Matrix Data Setup:\n\n1. Navigate to **Maintenance → Maintenance Data Setup**\n2. Features:\n   • Configure scheduled maintenance for each vehicle\n   • Set current odometer readings\n   • Define next service due dates\n   • Link to interval configurations\n   • Bulk import/export capabilities\n3. Integration:\n   • Syncs with Motive API for live odometer\n   • Auto-calculates next service dates\n   • Triggers RO creation when due\n\n**Column Configuration:**\n• Vehicle details (Unit #, VIN, Type)\n• Current KM (live from Motive)\n• Last service date & KM\n• Next service due date & KM\n• Configuration template applied\n\nData flows to Maintenance Schedule and RO creation!';
    }

    // Maintenance History
    if (lowerMessage.includes('maintenance history') || lowerMessage.includes('service history')) {
      return 'View comprehensive maintenance records:\n\n1. Go to **Maintenance → Maintenance History**\n2. Features available:\n   • Complete service history per vehicle\n   • Filter by date range, vehicle, service type\n   • View completed maintenance items\n   • Associated RO references\n   • Cost tracking per service\n   • Technician/vendor assignments\n   • Parts used and labor hours\n\n**Data Sources:**\n• Completed scheduled maintenance from ROs\n• Pulled from `repair_purchase_order_repairs` table\n• Status: "Completed" or "Repair_Not_Required"\n• Item Type: "SCHEDULED_MAINTENANCE"\n\nExport reports for compliance and auditing!';
    }

    // ========================================
    // REPAIR ORDERS & DEFECTS
    // ========================================

    // Repair Orders
    if (lowerMessage.includes('repair order') || lowerMessage.includes('ro') || lowerMessage.includes('work order')) {
      return 'To create a repair order:\n\n1. Go to **Repair Order → Manage RO**\n2. Click "Create New RO" button\n3. Fill in details:\n   • Select vehicle with defect\n   • Add defect IDs (auto-populated if from Manage Defects)\n   • Choose vendor (defaults to "SM Autocare Ltd")\n   • Set repair priority (Critical, High, Medium, Low)\n   • Add estimated repair amount (optional)\n   • Requested by (defaults to current user)\n   • Due date and notes\n4. Add repair items:\n   • Defect repairs\n   • Scheduled maintenance tasks\n   • Parts required\n5. Submit the repair order\n\n**Track RO Status:**\n• View from **RO Dashboard**\n• Monitor from **Manage RO** table\n• Check defect status in **Manage Defects**\n\nIntegrates with Motive API for defect synchronization!';
    }

    // Defect Logging & Management
    if (lowerMessage.includes('defect') || lowerMessage.includes('issue') || lowerMessage.includes('problem') || lowerMessage.includes('manage defect')) {
      return 'To log and manage vehicle defects:\n\n1. Navigate to **Repair Order → Manage Defects**\n2. Features available:\n   • Log new defects manually\n   • Auto-import from Motive inspections\n   • View all defects with live status\n   • Filter by: Status, Source, Vehicle, Severity\n   • Merge duplicate defects\n   • Manager approval workflow\n   • Create RO from defects\n   • View linked RO details\n\n**Defect Sources:**\n• **Skysoft:** Manually logged in system\n• **Motive:** Auto-imported from driver inspections\n\n**Approval Workflow:**\n1. Defect logged → "Pending" status\n2. Manager reviews → Approves/Rejects\n3. Approved → Ready for RO creation\n4. RO created → "In Progress"\n5. RO completed → "Completed"\n6. Motive defects → Sync back to Motive API\n\n**Special Features:**\n• Defect merging for duplicates\n• Reopened defect tracking\n• Motive API bi-directional sync\n• Image attachments\n• Severity classification';
    }

    // ========================================
    // VENDOR & PAYMENT MANAGEMENT
    // ========================================

    // Vendor Management
    if (lowerMessage.includes('vendor') || lowerMessage.includes('supplier') || lowerMessage.includes('workshop')) {
      return 'Managing vendors:\n\n1. Go to **Repair Order → Manage Vendors**\n2. Features:\n   • Add new vendors/service providers\n   • Edit vendor details (name, contact, address)\n   • Track vendor performance\n   • View RO history per vendor\n   • Deactivate/reactivate vendors\n\n**Vendor Assignment:**\n• Vendors are assigned when creating ROs\n• Default vendor: "SM Autocare Ltd"\n• Can assign in-house technicians\n• Track costs per vendor\n\n**Integration:**\n• Vendor data used in RO creation\n• Performance metrics in RO Dashboard\n• Cost analysis by vendor\n\nContact your system administrator for vendor API configurations!';
    }

    // Payment Methods
    if (lowerMessage.includes('payment') || lowerMessage.includes('invoice') || lowerMessage.includes('billing')) {
      return 'Manage payment methods:\n\n1. Navigate to **Repair Order → Manage Payment Methods**\n2. Features:\n   • Add payment methods (Cash, Credit Card, Bank Transfer, etc.)\n   • Edit payment terms\n   • Track payment history per RO\n   • Link invoices to ROs\n   • Generate payment reports\n\n**Payment Processing:**\n• Assign payment method during RO creation\n• Track pending vs paid invoices\n• Vendor payment tracking\n• Export financial reports\n\nIntegrates with accounting systems for invoice management!';
    }

    // Repair Code Categories
    if (lowerMessage.includes('repair code') || lowerMessage.includes('category')) {
      return 'Manage repair code categories:\n\n1. Go to **Repair Order → Manage Repair Code Categories**\n2. Features:\n   • Define repair categories (Engine, Brakes, Electrical, HVAC, etc.)\n   • Create sub-categories\n   • Set default cost estimates\n   • Track labor hours per category\n   • Organize defects by type\n\n**Usage:**\n• Categories used in defect logging\n• Help filter and report on repair types\n• Cost analysis by category\n• Preventive maintenance planning\n\nStandardizes repair documentation across the fleet!';
    }

    // ========================================
    // AI & PREVENTIVE MAINTENANCE
    // ========================================

    if (lowerMessage.includes('preventive') || lowerMessage.includes('ai') || lowerMessage.includes('predict')) {
      return 'AI-Powered Preventive Maintenance:\n\n1. Navigate to **Preventive Maintenance** (AI badge)\n2. Unlock the premium feature if needed\n3. View AI predictions for:\n   • Upcoming maintenance needs\n   • Component failure probability\n   • Optimal service intervals\n   • Cost optimization recommendations\n   • Fleet health trends\n\n**AI Analysis:**\n• Historical maintenance data\n• Usage patterns and mileage\n• Vehicle age and condition\n• Seasonal trends\n• Vendor performance\n\n**Benefits:**\n• Prevent unexpected breakdowns\n• Reduce maintenance costs\n• Optimize service schedules\n• Extend vehicle lifespan\n• Improve fleet uptime\n\nThe AI continuously learns from your fleet data to improve predictions!';
    }

    // ========================================
    // REPORTS & LOGS
    // ========================================

    // Activity Logs
    if (lowerMessage.includes('log') || lowerMessage.includes('history') || lowerMessage.includes('audit') || lowerMessage.includes('activity')) {
      return 'View activity logs:\n\n1. Navigate to **Logs** in the top menu\n2. Filter by:\n   • Date range (YYYY-MM-DD format)\n   • Activity type (Create, Update, Delete)\n   • User/Employee\n   • Vehicle\n   • Module (Maintenance, Fleet, RO, Defects)\n3. View detailed audit trail:\n   • Who performed the action\n   • When it occurred\n   • What changed (before/after)\n   • IP address and browser info\n4. Export logs for compliance reporting\n\n**Tracked Activities:**\n• Vehicle additions/modifications\n• RO creation/completion\n• Defect logging/approval\n• Maintenance scheduling\n• User logins\n• API calls (Motive sync)\n\nComplete transparency for compliance and auditing!';
    }

    // ========================================
    // NAVIGATION & GENERAL HELP
    // ========================================

    // General Navigation
    if (lowerMessage.includes('navigate') || lowerMessage.includes('find') || lowerMessage.includes('where') || lowerMessage.includes('menu')) {
      return 'Navigation Guide:\n\n**Main Menu Sections:**\n\n📊 **Dashboard**\n   • Comprehensive Dashboard - KPIs and metrics\n   • RO Dashboard - Repair order tracking\n\n🚌 **Fleets**\n   • Fleet Profile - Add/edit vehicles\n   • Fleet Management - Manage entire fleet\n   • Fleet Tracker - Live GPS tracking\n   • Fleet Availability - Booking system\n   • Fleet Collections - Organize groups\n   • Fleet Sub-Collections - Sub-groups\n   • Fleet Types - Vehicle categories\n\n🔧 **Maintenance**\n   • Maintenance Schedule - Plan services\n   • Scheduled Configurations Settings - Interval templates\n   • Maintenance Data Setup - Fleet maintenance matrix\n   • Maintenance History - Service records\n\n📝 **Repair Order**\n   • Manage RO - Create and track ROs\n   • Manage Defects - Defect logging and approval\n   • Manage Vendors - Service providers\n   • Manage Payment Methods - Billing\n   • Manage Repair Code Categories - Repair types\n\n🤖 **Preventive Maintenance**\n   • AI-powered predictions\n\n📋 **Logs**\n   • Activity Logs - Audit trail\n\nClick any menu to access its features!';
    }

    // System Features
    if (lowerMessage.includes('feature') || lowerMessage.includes('capability') || lowerMessage.includes('what can')) {
      return 'Skysoft Vehicle Maintenance Module - Complete Feature List:\n\n✅ **Fleet Management**\n• Vehicle profiles with full specs\n• Live GPS tracking (Motive API)\n• Fleet organization (collections, types)\n• Availability booking system\n• Real-time odometer sync\n\n✅ **Maintenance Management**\n• Scheduled maintenance templates\n• Interval-based triggers (mileage/time)\n• Fleet maintenance matrix\n• Service history tracking\n• Automatic RO generation\n\n✅ **Repair Orders**\n• Complete RO workflow\n• Multi-defect RO creation\n• Vendor assignment\n• Status tracking (Pending → In Progress → Completed)\n• Payment processing\n\n✅ **Defect Management**\n• Manual defect logging\n• Motive inspection auto-import\n• Manager approval workflow\n• Defect merging\n• Bi-directional Motive API sync\n\n✅ **Integrations**\n• Motive API (GPS, odometer, inspections)\n• Twilio OTP authentication\n• PHP session management\n• Real-time push notifications\n\n✅ **Reporting & Analytics**\n• Comprehensive dashboards\n• Activity audit logs\n• Cost analysis\n• Performance metrics\n\n✅ **AI Features**\n• Predictive maintenance\n• Failure probability analysis\n• Cost optimization\n\nAsk about any specific feature for more details!';
    }

    // Motive Integration
    if (lowerMessage.includes('motive') || lowerMessage.includes('integration') || lowerMessage.includes('api sync')) {
      return 'Motive API Integration:\n\n**Features Synced from Motive:**\n\n1. **Live Vehicle Data:**\n   • Current GPS location\n   • Real-time odometer (KM)\n   • Vehicle status\n   • Driver assignments\n\n2. **Inspection & Defects:**\n   • Auto-import driver inspection reports\n   • Defect detection from DVIRs\n   • Defect images and descriptions\n   • Driver signatures\n\n3. **Bi-Directional Sync:**\n   • Defects imported from Motive → Skysoft\n   • Approved defects → Create RO in Skysoft\n   • RO completed → Update Motive inspection status\n   • Mechanic notes synced back to Motive\n\n**How It Works:**\n• System polls Motive API for updates\n• New inspections auto-create defects\n• Manager approves defects in Skysoft\n• Completion syncs back to Motive\n• Status changes reflected in both systems\n\n**Configuration:**\n• MOTIVE_API_KEY required in environment\n• Webhook support for real-time updates\n• Logs stored in `/app-log/motive/`\n\nSeamless integration for complete fleet visibility!';
    }

    // Default response
    return 'I can help you with:\n\n**📊 DASHBOARDS**\n• Comprehensive Dashboard - Fleet KPIs\n• RO Dashboard - Repair order metrics\n\n**🚌 FLEET MANAGEMENT**\n• Fleet Profile - Add/edit vehicles\n• Fleet Tracker - Live GPS tracking\n• Fleet Availability - Booking system\n• Fleet Collections & Types\n\n**🔧 MAINTENANCE**\n• Maintenance Schedule - Plan services\n• Interval Configurations - Templates\n• Maintenance Data Setup - Matrix\n• Maintenance History - Records\n\n**📝 REPAIR ORDERS & DEFECTS**\n• Manage RO - Create and track\n• Manage Defects - Log and approve\n• Vendor Management\n• Payment Methods\n\n**🤖 AI FEATURES**\n• Preventive Maintenance predictions\n\n**📋 REPORTS & LOGS**\n• Activity Logs - Audit trail\n\n**🔗 INTEGRATIONS**\n• Motive API - GPS, odometer, inspections\n• Twilio OTP - Authentication\n\nPlease ask a specific question or click a quick action button below!';
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI thinking delay
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getAIResponse(inputValue),
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleQuickAction = (query: string) => {
    setInputValue(query);
    setTimeout(() => handleSend(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 group hover:scale-110"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
        <div className="absolute -top-12 right-0 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          AI Assistant
        </div>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
      isMinimized ? 'w-80' : 'w-96'
    }`}>
      <div className={`bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col ${
        isMinimized ? 'h-16' : 'h-[600px]'
      } transition-all duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white">AI Fleet Assistant</h3>
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              </div>
              <p className="text-xs text-blue-100">Always here to help</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user'
                      ? 'bg-blue-600'
                      : 'bg-gradient-to-br from-purple-500 to-blue-600'
                  }`}>
                    {message.sender === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={`flex-1 ${
                    message.sender === 'user' ? 'flex justify-end' : ''
                  }`}>
                    <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      message.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
                      <p className={`text-[10px] mt-1 ${
                        message.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-600">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {messages.length === 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-gray-600">Quick Actions:</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action.query)}
                      className="text-left text-xs px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about fleet management..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Powered by AI • Press Enter to send
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}