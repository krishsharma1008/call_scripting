import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { useCustomer } from "@/contexts/CustomerContext";
import { useEffect, useState, useRef } from "react";

type TranscriptTurn = {
  role: "user" | "assistant";
  content: string;
};

type Nudge = {
  id: string;
  sid?: string;
  type: "upsell" | "cross_sell" | "tip";
  title: string;
  body: string;
  priority: 1 | 2 | 3;
  timestamp?: string;
};

type LeadScoreData = {
  score: number | null;
  baseScore: number | null;
  adjustments: Array<{ delta: number; reason: string; timestamp: string }>;
};

type Appointment = {
  id: string;
  date: string;
  timeSlot: string;
  service: string;
  status: "pending" | "past" | "cancelled";
  customerPhone: string;
  notes?: string;
};

type AppointmentCounts = {
  pending: number;
  past: number;
  cancelled: number;
};

export const CustomerSidebar = () => {
  const { customerData } = useCustomer();
  const hasCustomerData = customerData.firstName || customerData.lastName;
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [leadScore, setLeadScore] = useState<LeadScoreData | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    "pending" | "past" | "cancelled"
  >("pending");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentCounts, setAppointmentCounts] = useState<AppointmentCounts>(
    { pending: 0, past: 0, cancelled: 0 }
  );
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // const isActiveTab = (s: "pending" | "past" | "cancelled") =>
  // activeFilter === s;

  // Fetch transcript from server
  useEffect(() => {
    const fetchTranscript = async () => {
      try {
        const response = await fetch(
          "http://localhost:3001/api/transcript/latest"
        );
        if (response.ok) {
          const data = await response.json();
          if (data.transcript && Array.isArray(data.transcript)) {
            setTranscript(data.transcript);
          }
        }
      } catch (error) {
        console.error("Failed to fetch transcript:", error);
      }
    };

    // Initial fetch
    fetchTranscript();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchTranscript, 2000);

    return () => clearInterval(interval);
  }, []);

  // Track which nudges we've already ACKed to avoid re-ACKing
  const ackedNudgeSids = useRef<Set<string>>(new Set());

  // Fetch nudges from server
  useEffect(() => {
    const fetchNudges = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/nudges/latest");
        if (response.ok) {
          const data = await response.json();
          if (data.nudges && Array.isArray(data.nudges)) {
            // Update nudges with all received nudges (server manages deduplication)
            setNudges((prev) => {
              const existingSids = new Set(
                prev.map((n) => n.sid).filter(Boolean)
              );
              const existingTitles = new Set(
                prev.map((n) => n.title.toLowerCase())
              );
              const now = new Date().toISOString();

              // Map all nudges from server, preserving existing ones
              const allNudges = new Map<string, Nudge>();

              // Keep existing nudges (they persist even after server removes them)
              prev.forEach((n) => {
                const key = n.sid || n.title.toLowerCase();
                if (key) allNudges.set(key, n);
              });

              // Add new nudges from server
              const newNudgeSids: string[] = [];
              data.nudges.forEach((n: Nudge) => {
                const key = n.sid || n.title.toLowerCase();
                if (key && !allNudges.has(key)) {
                  allNudges.set(key, { ...n, timestamp: n.timestamp || now });
                  if (n.sid) {
                    newNudgeSids.push(n.sid);
                  }
                }
              });

              // ACK new nudges we haven't seen before
              if (newNudgeSids.length > 0) {
                const toAck = newNudgeSids.filter(
                  (sid) => !ackedNudgeSids.current.has(sid)
                );
                if (toAck.length > 0) {
                  // Mark as ACKed
                  toAck.forEach((sid) => ackedNudgeSids.current.add(sid));

                  // Send ACK request
                  fetch("http://localhost:3001/api/nudges/ack", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sids: toAck }),
                  }).catch((err) => {
                    console.error("Failed to ACK nudges:", err);
                  });
                }
              }

              // Convert back to array, sorted by timestamp (newest first)
              const nudgesArray = Array.from(allNudges.values());
              nudgesArray.sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeB - timeA;
              });

              return nudgesArray;
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch nudges:", error);
      }
    };

    // Initial fetch
    fetchNudges();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchNudges, 2000);

    return () => clearInterval(interval);
  }, []);

  // Fetch lead score from server
  useEffect(() => {
    const fetchLeadScore = async () => {
      try {
        const response = await fetch(
          "http://localhost:3001/api/lead-score/current"
        );
        if (response.ok) {
          const data = await response.json();
          if (data.score !== null && data.score !== undefined) {
            setPreviousScore(leadScore?.score ?? null);
            setLeadScore(data);
          } else {
            // If no score exists but we have a phone number, calculate initial score
            if (customerData.phone) {
              try {
                const calcResponse = await fetch(
                  "http://localhost:3001/api/lead-score/calculate",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone: customerData.phone }),
                  }
                );
                if (calcResponse.ok) {
                  const calcData = await calcResponse.json();
                  setLeadScore({
                    score: calcData.score,
                    baseScore: calcData.score,
                    adjustments: [],
                  });
                }
              } catch (error) {
                console.error("Failed to calculate initial lead score:", error);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch lead score:", error);
      }
    };

    // Initial fetch
    fetchLeadScore();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchLeadScore, 2000);

    return () => clearInterval(interval);
  }, [customerData.phone, leadScore?.score]);

  // Fetch appointments from server
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!customerData.phone) {
        setAppointments([]);
        setAppointmentCounts({ pending: 0, past: 0, cancelled: 0 });
        return;
      }

      setLoadingAppointments(true);
      try {
        const response = await fetch(
          `http://localhost:3001/api/appointments?phone=${encodeURIComponent(
            customerData.phone
          )}&status=${activeFilter}`
        );
        if (response.ok) {
          const data = await response.json();
          setAppointments(data.appointments || []);
          setAppointmentCounts(
            data.counts || { pending: 0, past: 0, cancelled: 0 }
          );
        }
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
        setAppointments([]);
      } finally {
        setLoadingAppointments(false);
      }
    };

    fetchAppointments();
  }, [customerData.phone, activeFilter]);

  // Auto-scroll transcript container to bottom only if user is near bottom
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;

    // Check if user is near bottom (within 100px)
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;

    // Only auto-scroll if user is already near the bottom
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [transcript]);
  const BLUE = "hsl(220,90%,56%)"; // just for readability in comments

  const isActiveTab = (s: "pending" | "past" | "cancelled") =>
    activeFilter === s;

  return (
    <aside className="w-[28rem] bg-card border-l p-6 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <span className="text-muted-foreground">👤</span>
            Customer Details
          </h2>
          {hasCustomerData ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <p className="font-medium text-lg">
                  {customerData.firstName} {customerData.lastName}
                </p>
                {leadScore && leadScore.score !== null && (
                  <div
                    className={`text-2xl font-bold px-3 py-1 rounded-lg ${
                      leadScore.score >= 7
                        ? "text-green-600 bg-green-50"
                        : leadScore.score >= 4
                        ? "text-yellow-600 bg-yellow-50"
                        : "text-red-600 bg-red-50"
                    }`}
                  >
                    {leadScore.score.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>📞 {customerData.phone}</p>
                <p>📍 Zipcode: {customerData.zipcode}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-brand-orange text-muted-foreground">
              No customer data available
            </p>
          )}
          <Button
            variant="link"
            className="text-xs p-0 h-auto text-primary mt-2"
          >
            EDIT
          </Button>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">📅</span>
            Appointments
          </h3>
          {/* <div className="flex gap-2 mb-4">
            <Button 
              // variant={activeFilter === 'pending' ? 'default' : 'ghost'} 
              variant="ghost"
              size="sm" 
    //           className="flex-1 text-xs     border-2 border-primary
    // text-primary
    // bg-transparent
    // hover:bg-primary/10
    // transition-all duration-200"
        className={`flex-1 text-xs border rounded-md transition-colors
      ${isActiveTab('pending')
        ? 'text-primary border-primary bg-primary/10 font-semibold'
        : 'text-muted-foreground border-border '}
    `}
              onClick={() => setActiveFilter('pending')}
            >
              PENDING {appointmentCounts.pending > 0 && `(${appointmentCounts.pending})`}
            </Button>
            <Button 
              variant={activeFilter === 'past' ? 'default' : 'ghost'} 
              size="sm" 
              className="flex-1 text-xs     border-2 border-primary
    text-primary
    bg-transparent
    hover:bg-primary/10
    transition-all duration-200"
              onClick={() => setActiveFilter('past')}
            >
              PAST {appointmentCounts.past > 0 && `(${appointmentCounts.past})`}
            </Button>
            <Button 
              variant={activeFilter === 'cancelled' ? 'default' : 'ghost'} 
              size="sm" 
              className="flex-1 text-xs     border-2 border-primary
    text-primary
    bg-transparent
    hover:bg-primary/10
    transition-all duration-200"
              onClick={() => setActiveFilter('cancelled')}
            >
              CANCELLED {appointmentCounts.cancelled > 0 && `(${appointmentCounts.cancelled})`}
            </Button>
          </div> */}

          <div className="flex gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 text-xs border rounded-md transition-colors !bg-transparent
      ${
        isActiveTab("pending")
          ? "text-[hsl(220,90%,56%)] border-[hsl(220,90%,56%)] bg-[hsl(220,90%,56%)]/10 font-semibold"
          : "text-muted-foreground border-border hover:!bg-[hsl(220,90%,56%)]/10 hover:!text-[hsl(220,90%,56%)]"
      }
    `}
              onClick={() => setActiveFilter("pending")}
            >
              PENDING{" "}
              {appointmentCounts.pending > 0 &&
                `(${appointmentCounts.pending})`}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 text-xs border rounded-md transition-colors !bg-transparent
      ${
        isActiveTab("past")
          ? "text-[hsl(221,90%,56%)] border-[hsl(221,90%,56%)] bg-[hsl(220,90%,56%)]/10 font-semibold"
          : "text-muted-foreground border-border hover:!bg-[hsl(220,90%,56%)]/10 hover:!text-[hsl(220,90%,56%)]"
      }
    `}
              onClick={() => setActiveFilter("past")}
            >
              PAST {appointmentCounts.past > 0 && `(${appointmentCounts.past})`}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 text-xs border rounded-md transition-colors !bg-transparent
      ${
        isActiveTab("cancelled")
          ? "text-[hsla(221, 90%, 56%, 1.00)] border-[hsl(220,90%,56%)] bg-[hsl(220,90%,56%)]/10 font-semibold"
          : "text-muted-foreground border-border hover:!bg-[hsl(220,90%,56%)]/10 hover:!text-[hsl(220,90%,56%)]"
      }
    `}
              onClick={() => setActiveFilter("cancelled")}
            >
              CANCELLED{" "}
              {appointmentCounts.cancelled > 0 &&
                `(${appointmentCounts.cancelled})`}
            </Button>
          </div>

          {!customerData.phone ? (
            <p className="text-sm text-center py-4 text-brand-orange">
              Select a customer to view appointments
            </p>
          ) : loadingAppointments ? (
            <p className="text-sm text-center py-4 text-brand-orange">
              Loading appointments...
            </p>
          ) : appointments.length === 0 ? (
            <p className="text-sm text-brand-orange text-center py-4">
              No {activeFilter} appointments found
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {appointments.map((appointment) => {
                const appointmentDate = new Date(appointment.date);
                const formattedDate = appointmentDate.toLocaleDateString(
                  "en-US",
                  {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }
                );

                const statusCardColors = {
                  pending: "bg-blue-50 border-blue-200",
                  past: "bg-green-50 border-green-200",
                  cancelled: "bg-red-50 border-red-200",
                };

                const statusBadgeColors = {
                  pending: "bg-blue-100 text-blue-700",
                  past: "bg-green-100 text-green-700",
                  cancelled: "bg-red-100 text-red-700",
                };

                return (
                  <div
                    key={appointment.id}
                    className={`border rounded-lg p-3 ${
                      statusCardColors[appointment.status]
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1 text-foreground">
                          {formattedDate}
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">
                          {appointment.timeSlot}
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {appointment.service}
                        </div>
                      </div>
                      <div
                        className={`text-xs px-2 py-1 rounded uppercase font-medium ${
                          statusBadgeColors[appointment.status]
                        }`}
                      >
                        {appointment.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">💡</span>
            Nudges
          </h3>
          <div className="border rounded-lg bg-muted/30 h-[300px] overflow-y-auto p-4 space-y-3">
            {nudges.length === 0 ? (
              <p className="text-sm text-center py-8 text-brand-orange">
                No nudges available yet
              </p>
            ) : (
              nudges.map((nudge) => {
                const colorClass =
                  nudge.type === "upsell"
                    ? "bg-primary/10 border-primary/30"
                    : nudge.type === "cross_sell"
                    ? "bg-accent/10 border-accent/30"
                    : "bg-secondary/10 border-secondary/30";

                // Badge color classes based on type - distinct colors for each
                const badgeColorClass =
                  nudge.type === "upsell"
                    ? "text-blue-600 font-semibold"
                    : nudge.type === "cross_sell"
                    ? "text-orange-600 font-semibold"
                    : "text-green-600 font-semibold";

                // Format timestamp
                const formatTimestamp = (timestamp?: string) => {
                  if (!timestamp) return "";
                  const date = new Date(timestamp);
                  const now = new Date();
                  const diffMs = now.getTime() - date.getTime();
                  const diffMins = Math.floor(diffMs / 60000);

                  if (diffMins < 1) return "Just now";
                  if (diffMins < 60) return `${diffMins}m ago`;
                  const diffHours = Math.floor(diffMins / 60);
                  if (diffHours < 24) return `${diffHours}h ago`;
                  return date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                };

                return (
                  <div
                    key={nudge.sid || nudge.id}
                    className={`rounded-lg border p-3 ${colorClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div
                            className={`text-xs uppercase tracking-wide ${badgeColorClass}`}
                          >
                            {nudge.type.replace("_", " ")}
                          </div>
                          {nudge.timestamp && (
                            <div className="text-xs text-muted-foreground">
                              {formatTimestamp(nudge.timestamp)}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-semibold leading-tight mb-1">
                          {nudge.title}
                        </div>
                        <div className="text-sm text-foreground/90">
                          {nudge.body}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">💬</span>
            Conversation Transcript
          </h3>
          <div
            ref={transcriptContainerRef}
            className="border rounded-lg bg-muted/30 h-[400px] overflow-y-auto p-4 space-y-3"
          >
            {transcript.length === 0 ? (
              <p className="text-sm text-center py-8 text-brand-orange">
                No conversation transcript yet
              </p>
            ) : (
              transcript.map((turn, index) => (
                <div
                  key={index}
                  className={`flex ${
                    turn.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      turn.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="font-medium text-xs mb-1 opacity-70">
                      {turn.role === "user" ? "CSR" : "Customer"}
                    </div>
                    <div>{turn.content}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </aside>
  );
};
