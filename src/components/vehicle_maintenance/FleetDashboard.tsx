// src/components/FleetDashboard.tsx
import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const MCP = "http://localhost:3001";

const COLORS = ["#2563eb", "#64748b", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// ─── Types ────────────────────────────────────────────────────
interface DashboardData {
  summary: { total: number; active: number; inactive: number; with_wheelchair: number; without_wheelchair: number };
  by_vehicle_type: { name: string; count: number; active: number; inactive: number }[];
  by_status: { name: string; value: number }[];
  by_configuration: { name: string; count: number }[];
  recent_vehicles: { id: number; nickname: string; number: string; type: string; status: string }[];
}

interface Message { role: "user" | "assistant"; text: string }

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={{
      background: "#1e293b", borderRadius: "12px", padding: "20px",
      borderLeft: `4px solid ${color}`, flex: 1, minWidth: "140px"
    }}>
      <div style={{ fontSize: "28px", marginBottom: "4px" }}>{icon}</div>
      <div style={{ fontSize: "32px", fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function FleetDashboard() {
  const [data, setData]           = useState<DashboardData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [report, setReport]       = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTopic, setReportTopic]     = useState("");
  const [messages, setMessages]   = useState<Message[]>([
    { role: "assistant", text: "👋 Hi! Ask me anything about your fleet!" }
  ]);
  const [input, setInput]         = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch dashboard on load
  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const res  = await fetch(`${MCP}/dashboard`);
      const json = await res.json();
      setData(json.data);
    } catch {
      console.error("Failed to fetch dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateReport() {
    if (!reportTopic.trim()) return;
    setReportLoading(true);
    setReport("");
    try {
      const res  = await fetch(`${MCP}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: reportTopic }),
      });
      const json = await res.json();
      setReport(json.report);
    } catch {
      setReport("❌ Failed to generate report.");
    } finally {
      setReportLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || chatLoading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);
    try {
      const res  = await fetch(`${MCP}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const json = await res.json();
      setMessages(prev => [...prev, { role: "assistant", text: json.reply ?? "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "❌ Could not reach AI server." }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f172a", color: "#fff", fontFamily: "sans-serif", overflow: "hidden" }}>

      {/* ── LEFT PANEL (Dashboard) ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>🚌 Fleet Dashboard</h1>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>AI-powered · Live data</p>
          </div>
          <button
            onClick={fetchDashboard}
            style={{ padding: "8px 16px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
          >
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>⏳</div>
            <div>Gemini is analyzing your fleet data...</div>
          </div>
        ) : data && (
          <>
            {/* Stat Cards */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <StatCard label="Total Vehicles"    value={data.summary.total}            color="#2563eb" icon="🚌" />
              <StatCard label="Active"            value={data.summary.active}           color="#10b981" icon="✅" />
              <StatCard label="Inactive"          value={data.summary.inactive}         color="#ef4444" icon="🔴" />
              <StatCard label="Wheelchair Access" value={data.summary.with_wheelchair}  color="#f59e0b" icon="♿" />
            </div>

            {/* Charts Row */}
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>

              {/* Bar Chart - By Vehicle Type */}
              <div style={{ flex: 2, minWidth: "300px", background: "#1e293b", borderRadius: "12px", padding: "20px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "#94a3b8" }}>📊 Vehicles by Type</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.by_vehicle_type} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }} />
                    <Bar dataKey="active"   fill="#10b981" name="Active"   radius={[4,4,0,0]} />
                    <Bar dataKey="inactive" fill="#ef4444" name="Inactive" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart - Active vs Inactive */}
              <div style={{ flex: 1, minWidth: "220px", background: "#1e293b", borderRadius: "12px", padding: "20px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "#94a3b8" }}>🥧 Status Split</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.by_status} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                      {data.by_status.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }} />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Vehicles Table */}
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "#94a3b8" }}>🚗 Recent Vehicles</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ color: "#64748b", borderBottom: "1px solid #334155" }}>
                    <th style={{ textAlign: "left", padding: "8px" }}>ID</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Nickname</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Number</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_vehicles.map((v) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "10px 8px", color: "#64748b" }}>#{v.id}</td>
                      <td style={{ padding: "10px 8px" }}>{v.nickname}</td>
                      <td style={{ padding: "10px 8px", color: "#94a3b8" }}>{v.number}</td>
                      <td style={{ padding: "10px 8px", color: "#94a3b8" }}>{v.type}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                          background: v.status === "Active" ? "#064e3b" : "#450a0a",
                          color: v.status === "Active" ? "#10b981" : "#ef4444",
                        }}>{v.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AI Report Generator */}
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "#94a3b8" }}>📝 AI Report Generator</h3>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <input
                  value={reportTopic}
                  onChange={e => setReportTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerateReport()}
                  placeholder='e.g. "Fleet health summary" or "Inactive vehicles analysis"'
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: "8px",
                    border: "1px solid #334155", background: "#0f172a",
                    color: "#fff", fontSize: "13px", outline: "none",
                  }}
                />
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  style={{
                    padding: "10px 18px", background: "#2563eb", color: "#fff",
                    border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
                    opacity: reportLoading ? 0.6 : 1,
                  }}
                >
                  {reportLoading ? "⏳ Generating..." : "Generate"}
                </button>
              </div>
              {report && (
                <pre style={{
                  background: "#0f172a", padding: "16px", borderRadius: "8px",
                  fontSize: "13px", lineHeight: "1.7", whiteSpace: "pre-wrap",
                  color: "#e2e8f0", border: "1px solid #334155", margin: 0,
                }}>
                  {report}
                </pre>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT PANEL (AI Chat) ── */}
      <div style={{
        width: "360px", borderLeft: "1px solid #1e293b",
        display: "flex", flexDirection: "column", background: "#0f172a"
      }}>
        {/* Chat Header */}
        <div style={{ padding: "20px", borderBottom: "1px solid #1e293b", background: "#1e40af" }}>
          <div style={{ fontWeight: 700, fontSize: "15px" }}>🤖 Fleet AI Chat</div>
          <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "2px" }}>Powered by Gemini 2.5 Flash</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#2563eb" : "#1e293b",
              color: "#fff", maxWidth: "88%", padding: "10px 13px",
              borderRadius: "10px", fontSize: "13px", lineHeight: "1.6",
            }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>
                {msg.text}
              </pre>
            </div>
          ))}
          {chatLoading && (
            <div style={{ alignSelf: "flex-start", background: "#1e293b", color: "#64748b", padding: "10px 13px", borderRadius: "10px", fontSize: "13px" }}>
              🤖 Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Chat Input */}
        <div style={{ padding: "12px", borderTop: "1px solid #1e293b", display: "flex", gap: "8px" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask about your fleet..."
            disabled={chatLoading}
            style={{
              flex: 1, padding: "10px 13px", borderRadius: "8px",
              border: "1px solid #334155", background: "#1e293b",
              color: "#fff", fontSize: "13px", outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={chatLoading}
            style={{
              padding: "10px 14px", background: "#2563eb", color: "#fff",
              border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600,
            }}
          >
            {chatLoading ? "..." : "➤"}
          </button>
        </div>
      </div>
    </div>
  );
}