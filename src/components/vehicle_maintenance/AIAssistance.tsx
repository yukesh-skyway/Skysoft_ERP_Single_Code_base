import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Wrench,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  Zap,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import { buildApiUrl, API_ENDPOINTS, apiFetch } from "../../config/api";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Defect {
  id: number;
  vrlid: number;
  vehicle_nickname: string;
  repair_code_category_name: string;
  repair_desc: string;
  defect_status: string;
  defect_source: string;
  issue_type: string;
  notes: string;
  created_date: string;
  logged_on:Date;
}

// Siri-like AI Orb Animation Component
const AIOrb = ({ isAnimating = false }: { isAnimating?: boolean }) => {
  return (
    <div className="relative flex size-9 items-center justify-center">
      {/* Outer glow rings */}
      {isAnimating && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-md"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 opacity-20 blur-lg"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3,
            }}
          />
        </>
      )}
      
      {/* Core orb with gradient animation */}
      <motion.div
        className="relative z-10 flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg"
        animate={isAnimating ? {
          background: [
            "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
            "linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)",
            "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 50%, #ec4899 100%)",
            "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
          ],
          scale: isAnimating ? [1, 1.05, 1] : 1,
        } : {}}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Sparkles className="size-5 text-white" />
      </motion.div>
    </div>
  );
};

// Format message content with markdown-like styling
const FormattedMessage = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith('## ')) {
          return <h3 key={idx} className="font-semibold text-base mt-3 mb-1 text-gray-900">{line.slice(3)}</h3>;
        }
        if (line.startsWith('### ')) {
          return <h4 key={idx} className="font-semibold text-sm mt-2 mb-1 text-gray-800">{line.slice(4)}</h4>;
        }
        
        // Bold text
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={idx} className="font-semibold text-gray-900">{line.slice(2, -2)}</p>;
        }
        
        // Bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={idx} className="flex gap-2 ml-4">
              <span className="text-blue-600 mt-1">•</span>
              <span className="flex-1">{line.trim().slice(2)}</span>
            </div>
          );
        }
        
        // Numbered lists
        if (/^\d+\.\s/.test(line.trim())) {
          const match = line.trim().match(/^(\d+)\.\s(.+)/);
          if (match) {
            return (
              <div key={idx} className="flex gap-2 ml-4">
                <span className="font-semibold text-blue-600 min-w-5">{match[1]}.</span>
                <span className="flex-1">{match[2]}</span>
              </div>
            );
          }
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <div key={idx} className="h-1" />;
        }
        
        // Regular text
        return <p key={idx} className="leading-relaxed">{line}</p>;
      })}
    </div>
  );
};

// Message bubble component
const MessageBubble = ({ message }: { message: Message }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div
      className={`flex gap-3 group ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      {message.role === "assistant" && (
        <AIOrb />
      )}

      <div className="flex flex-col max-w-3xl">
        <div
          className={`rounded-2xl px-5 py-4 ${
            message.role === "user"
              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg"
              : "bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          }`}
        >
          {message.role === "assistant" ? (
            <div className="text-sm text-gray-800">
              <FormattedMessage content={message.content} />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>
        
        <div className={`flex items-center gap-2 mt-1.5 px-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
          <span className="text-xs text-gray-400">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          
          {message.role === "assistant" && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
              title="Copy message"
            >
              {copied ? (
                <Check className="size-3 text-green-600" />
              ) : (
                <Copy className="size-3 text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {message.role === "user" && (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-600 to-gray-700 shadow-lg">
          <User className="size-5 text-white" />
        </div>
      )}
    </div>
  );
};

export function AIAssistance() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loadingDefects, setLoadingDefects] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Memoized statistics
  const stats = useMemo(() => ({
    total: defects.length,
    open: defects.filter(d => d.defect_status === "Open").length,
    critical: defects.filter(d => d.issue_type === "Critical").length,
  }), [defects]);

  useEffect(() => {
    fetchDefects();
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "👋 Hello! I'm your AI Fleet Maintenance Assistant powered by Gemini 2.5 Flash.\n\nI can help you:\n- Analyze defects and prioritize repairs\n- Identify patterns in vehicle issues\n- Recommend maintenance strategies\n- Estimate urgency levels\n- Suggest cost-effective solutions\n\nHow can I assist you today?",
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchDefects = async () => {
    setLoadingDefects(true);
    try {
      const isFigmaMake = window.location.hostname.includes("figma.site");

      if (isFigmaMake) {
        console.log("🎨 Running in Figma Make - Using mock defect data");
        const mockDefects: Defect[] = [
          {
            id: 1,
            vrlid: 101,
            vehicle_nickname: "VAN-001",
            repair_code_category_name: "Engine",
            repair_desc: "Engine overheating issue",
            defect_status: "Open",
            defect_source: "Motive",
            issue_type: "Critical",
            notes: "Needs immediate attention",
            created_date: "2025-01-15",
          },
          {
            id: 2,
            vrlid: 102,
            vehicle_nickname: "VAN-002",
            repair_code_category_name: "Brakes",
            repair_desc: "Brake pad wear",
            defect_status: "Open",
            defect_source: "Skysoft",
            issue_type: "Medium",
            notes: "Replace brake pads",
            created_date: "2025-01-16",
          },
          {
            id: 3,
            vrlid: 103,
            vehicle_nickname: "VAN-001",
            repair_code_category_name: "Transmission",
            repair_desc: "Transmission fluid leak",
            defect_status: "Open",
            defect_source: "Motive",
            issue_type: "Critical",
            notes: "Fluid leak detected",
            created_date: "2025-01-17",
          },
          {
            id: 4,
            vrlid: 104,
            vehicle_nickname: "VAN-003",
            repair_code_category_name: "Electrical",
            repair_desc: "Battery warning light",
            defect_status: "Open",
            defect_source: "Skysoft",
            issue_type: "Low",
            notes: "Check battery voltage",
            created_date: "2025-01-18",
          },
          {
            id: 5,
            vrlid: 105,
            vehicle_nickname: "VAN-002",
            repair_code_category_name: "Suspension",
            repair_desc: "Worn shock absorbers",
            defect_status: "Open",
            defect_source: "Motive",
            issue_type: "Medium",
            notes: "Replace front shocks",
            created_date: "2025-01-19",
          },
        ];
        setDefects(mockDefects);
        console.log(`✅ Loaded ${mockDefects.length} mock defects for AI context`);
        toast.info("Running in preview mode with sample data");
        return;
      }

      // Fetch ALL Open defects (no pagination limit)
      const data = await apiFetch(`${API_ENDPOINTS.defects.base}?defect_status=Open&per_page=9999`);
      if (data.success) {
        setDefects(data.data || []);
        console.log(`✅ Loaded ${data.data?.length || 0} Open defects for AI context`);
      }
    } catch (error) {
      console.error("Error fetching defects:", error);
      const isFigmaMake = window.location.hostname.includes("figma.site");
      if (isFigmaMake) {
        toast.error("Preview mode: Cannot connect to production API from Figma Make");
      } else {
        toast.error("Failed to load defects data");
      }
    } finally {
      setLoadingDefects(false);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
 const defectContext = {
  total_open_defects: defects.length,
  defects: defects.map((d) => ({
    vehicle: d.vehicle_nickname,
    status: d.defect_status,
    notes: d.notes,
    source: d.defect_source,
    logged_on: d.logged_on,
  })),
};
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCwMuqaN1Rw8TzYkZKcIwNcrIKgcBCMjhA";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
body: JSON.stringify({
  contents: [
    {
      parts: [
        {
          text: `You are an AI Fleet Maintenance Assistant for Skysoft.

You are analyzing ${defects.length} open defects from the fleet management system.

Fleet Data:
${JSON.stringify(defectContext, null, 2)}

User question: ${userMessage.content}

IMPORTANT - Auto-detect the defect category by reading the notes field and inferring what type of issue it is.
For example:
- "light is not working" → Electrical
- "battery replacement" → Electrical
- "brake pad wear" → Brakes
- "AC inspection" → AC/HVAC
- "emergency exit" → Body/Interior
- "transmission fluid leak" → Transmission
- "engine overheating" → Engine

Use these categories: Engine | Brakes | Electrical | Transmission | Suspension | AC/HVAC | Body/Interior | General

When responding:
- Read each defect's notes and assign it a category automatically
- Group and summarize defects by detected category
- Reference specific vehicle nicknames (e.g., "Vehicle 9608")
- Flag vehicles with multiple open defects as high priority
- Use ## for main headings, ### for subheadings
- Use **bold** for key points and bullet points for lists
- Use numbered lists for step-by-step recommendations
- Be specific and actionable, not generic`,
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 1500,
  },
}),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to get AI response");
      }

      const aiResponse =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't generate a response.";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      toast.error("Failed to get AI response. Please check your API key.");

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please make sure the GEMINI_API_KEY is configured correctly.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, defects]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "👋 Hello! I'm your AI Fleet Maintenance Assistant powered by Gemini 2.5 Flash.\n\nI can help you:\n- Analyze defects and prioritize repairs\n- Identify patterns in vehicle issues\n- Recommend maintenance strategies\n- Estimate urgency levels\n- Suggest cost-effective solutions\n\nHow can I assist you today?",
        timestamp: new Date(),
      },
    ]);
    toast.success("Chat cleared");
  };

  const suggestedPrompts = [
    {
      icon: AlertCircle,
      text: "What are the most critical defects I should address first?",
      color: "text-red-500"
    },
    {
      icon: Wrench,
      text: "Which vehicles need the most attention?",
      color: "text-blue-500"
    },
    {
      icon: TrendingUp,
      text: "Are there any patterns in recent defects?",
      color: "text-purple-500"
    },
    {
      icon: Zap,
      text: "Suggest a maintenance plan for this week",
      color: "text-orange-500"
    },
  ];

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-4 py-4 shadow-sm sticky top-0 z-10 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AIOrb />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 truncate sm:text-xl">
                AI Maintenance Assistant
              </h1>
              <p className="text-xs text-gray-500 truncate sm:text-sm">
                Powered by Gemini 2.5 • {stats.total} defects
              </p>
            </div>
          </div>
          
          {messages.length > 1 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 sm:gap-2 sm:px-3 sm:text-sm"
            >
              <Trash2 className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {!loadingDefects && (
        <div className="border-b bg-white">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors sm:px-6"
          >
            <div className="flex gap-3 sm:gap-6">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="size-2 rounded-full bg-red-500"></div>
                <span className="text-xs font-medium text-gray-700 sm:text-sm">
                  {stats.open} Open
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="size-2 rounded-full bg-orange-500"></div>
                <span className="text-xs font-medium text-gray-700 sm:text-sm">
                  {stats.critical} Critical
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="size-2 rounded-full bg-blue-500"></div>
                <span className="text-xs font-medium text-gray-700 sm:text-sm">
                  {stats.total} Total
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchDefects();
                }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 sm:text-sm"
              >
                <RefreshCw className="size-3 sm:size-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <ChevronDown
                className={`size-4 text-gray-400 transition-transform ${showStats ? 'rotate-180' : ''}`}
              />
            </div>
          </button>
          
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 pt-1 grid grid-cols-3 gap-2 sm:gap-4 sm:px-6">
                  <div className="bg-white rounded-lg p-2.5 border-2 border-red-100 shadow-sm sm:p-3">
                    <div className="flex items-center gap-1.5 mb-1 sm:gap-2">
                      <AlertCircle className="size-3.5 text-red-600 sm:size-4" />
                      <span className="text-[10px] font-medium text-red-900 sm:text-xs">Open</span>
                    </div>
                    <p className="text-xl font-bold text-red-700 sm:text-2xl">{stats.open}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-2.5 border-2 border-orange-100 shadow-sm sm:p-3">
                    <div className="flex items-center gap-1.5 mb-1 sm:gap-2">
                      <TrendingUp className="size-3.5 text-orange-600 sm:size-4" />
                      <span className="text-[10px] font-medium text-orange-900 sm:text-xs">Critical</span>
                    </div>
                    <p className="text-xl font-bold text-orange-700 sm:text-2xl">{stats.critical}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-2.5 border-2 border-blue-100 shadow-sm sm:p-3">
                    <div className="flex items-center gap-1.5 mb-1 sm:gap-2">
                      <Wrench className="size-3.5 text-blue-600 sm:size-4" />
                      <span className="text-[10px] font-medium text-blue-900 sm:text-xs">Total</span>
                    </div>
                    <p className="text-xl font-bold text-blue-700 sm:text-2xl">{stats.total}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth sm:px-6 sm:py-6">
        <div className="mx-auto max-w-4xl">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="mb-4 sm:mb-6"
              >
                <MessageBubble message={message} />
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 mb-4"
            >
              <AIOrb isAnimating={true} />
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-gray-200 sm:px-5 sm:py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="size-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">AI is analyzing...</span>
                  <div className="flex gap-1">
                    <div className="size-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                    <div className="size-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="size-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 1 && !loading && (
        <div className="border-t bg-white px-4 py-3 sm:px-6 sm:py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 sm:mb-3 sm:text-xs">
            Quick Actions
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            {suggestedPrompts.map((prompt, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setInput(prompt.text)}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-xs text-gray-700 transition-all hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 sm:px-4 sm:py-3 sm:text-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-start gap-2 sm:gap-3">
                  <prompt.icon className={`size-4 shrink-0 ${prompt.color} mt-0.5 sm:size-5`} />
                  <span className="leading-snug">{prompt.text}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t bg-white px-4 py-3 shadow-lg sm:px-6 sm:py-4">
        <div className="mx-auto max-w-4xl">
          <div className="relative flex gap-2 sm:gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about defects, maintenance planning, priorities..."
              className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-all placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400 sm:px-4 sm:py-3"
              rows={1}
              disabled={loading}
              style={{ minHeight: '44px', maxHeight: '160px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/35 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-sm disabled:translate-y-0 sm:size-12"
            >
              {loading ? (
                <Loader2 className="size-4.5 animate-spin sm:size-5" />
              ) : (
                <Send className="size-4.5 sm:size-5" />
              )}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-2 sm:text-xs sm:gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono sm:px-1.5 sm:text-[10px]">Enter</kbd>
              <span className="hidden sm:inline">to send,</span>
              <span className="sm:hidden">send</span>
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">Shift+Enter</kbd>
              new line
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
