/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { FilterBar, FilterOptions } from '@/components/FilterBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Treemap, ComposedChart } from 'recharts';
import { Download, FileText, TrendingUp, MessageSquare, BarChart3, RefreshCw } from "lucide-react";

type ConversationMetrics = {
  talkTimeRatio: {
    csrWordCount: number;
    customerWordCount: number;
    csrPercentage: number;
    customerPercentage: number;
  };
  responseQuality: {
    questionsAnswered: number;
    acknowledgmentCount: number;
    empathyScore: number;
    overallScore: number;
  };
  keyTopics: Array<{ topic: string; frequency: number; category: string }>;
  conversionIndicators: {
    appointmentStatus: 'booked' | 'discussed' | 'not_mentioned';
    pricingDiscussed: boolean;
    pricingAmounts: string[];
    objectionsRaised: Array<{ objection: string; resolved: boolean }>;
    commitmentLevel: 'high' | 'medium' | 'low';
  };
};

type CallSession = {
  callId: string;
  customerPhone: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  transcript: Array<{ role: string; content: string; timestamp: string; sentiment?: 'positive' | 'neutral' | 'negative'; sentimentScore?: number }>;
  nudgesShown: Array<any>;
  leadScoreHistory: Array<{ score: number; timestamp: string; reason?: string }>;
  finalLeadScore: number;
  initialLeadScore: number;
  customerData: { firstName: string; lastName: string; zipcode: string; phone: string };
  overallSentiment: { positive: number; neutral: number; negative: number; averageScore: number };
  servicesDiscussed: string[];
  transcriptSummary: string;
  conversationMetrics: ConversationMetrics | null;
  isActive?: boolean;
};

const COLORS = {
  positive: '#10b981',
  neutral: '#f59e0b',
  negative: '#ef4444',
  scoreHigh: '#10b981',
  scoreMedium: '#f59e0b',
  scoreLow: '#ef4444',
};

export default function CallDashboard() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<CallSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    sentiment: 'all',
    nudgeType: 'all',
    service: 'all',
  });


 const handleDownload = (format: "txt" | "json" = "txt") => {
    let content = "";

    if (format === "json") {
      content = JSON.stringify(session.transcript, null, 2);
    } else {
      content = session.transcript
        .map(
          (turn: any, index: number) =>
            `Turn ${index + 1} (${turn.role === "user" ? "Customer" : "CSR"} - ${turn.sentiment || "neutral"}):\n${turn.content}\n`
        )
        .join("\n");
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transcript.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered data based on active filters
  const filteredTranscript = useMemo(() => {
    if (!session) return [];
    
    return session.transcript.filter((turn) => {
      // Filter by sentiment
      if (filters.sentiment !== 'all' && turn.sentiment !== filters.sentiment) {
        return false;
      }
      return true;
    });
  }, [session, filters.sentiment]);

  const filteredNudges = useMemo(() => {
    if (!session) return [];
    
    return session.nudgesShown.filter((nudge) => {
      // Filter by nudge type
      if (filters.nudgeType !== 'all' && nudge.type !== filters.nudgeType) {
        return false;
      }
      return true;
    });
  }, [session, filters.nudgeType]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sentiment !== 'all') count++;
    if (filters.nudgeType !== 'all') count++;
    if (filters.service !== 'all') count++;
    return count;
  }, [filters]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchSession = async () => {
      try {
        // Priority: 1) Specific callId, 2) Current active call, 3) Latest completed call
        let url = '';
        let resp: Response | null = null;
        
        if (callId) {
          // Fetch specific call by ID
          url = `http://localhost:3001/api/call/session/${callId}`;
        } else {
          // Try to get current active call first
          url = 'http://localhost:3001/api/call/current';
        }
        
        try {
          resp = await fetch(url);
        } catch (fetchError) {
          // Network error - silently handle
          setSession(null);
          setLoading(false);
          return;
        }
        
        if (resp.ok) {
          const data = await resp.json();
          setSession(data);
          
          // If call is active, set up polling for live updates
          if (data.isActive && !pollInterval) {
            console.log('[Dashboard] Call is active, starting live updates...');
            pollInterval = setInterval(() => {
              fetchSession();
            }, 3000); // Poll every 3 seconds
          }
          
          // If call ended (was active, now complete), fetch final data once more
          if (!data.isActive && data.endTime && session?.isActive) {
            console.log('[Dashboard] Call ended, fetching final analytics...');
            // Wait a moment for analysis to complete
            setTimeout(() => {
              fetchSession();
            }, 2000);
          }
        } else if (resp.status === 404 && !callId) {
          // No active call, try to get latest completed call
          try {
            const latestResp = await fetch('http://localhost:3001/api/call/latest');
            if (latestResp.ok) {
              const latestData = await latestResp.json();
              setSession(latestData);
            } else {
              setSession(null);
            }
          } catch {
            setSession(null);
          }
        } else if (resp.status === 404) {
          // Silently handle 404 for specific callId
          setSession(null);
        } else {
          console.error('Failed to load call session:', resp.status);
          setSession(null);
        }
      } catch (error) {
        // Silently handle errors
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    // Cleanup: clear polling interval on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [callId, session?.isActive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground text-brand-orange">Loading call dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2 text-brand-orange">Call session not found</p>
            <Button onClick={() => navigate('/')} 
            className='    border-2 border-primary
    text-primary
    bg-transparent
    hover:bg-primary/10
    transition-all duration-200'  
            >Go to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Prepare lead score chart data
  const leadScoreData = session.leadScoreHistory.map((entry, index) => ({
    time: index + 1,
    score: entry.score,
    reason: entry.reason,
  }));

  // Prepare sentiment over time data
  const sentimentData = session.transcript.map((turn, index) => ({
    turn: index + 1,
    score: (turn.sentimentScore || 0.5) * 100,
    sentiment: turn.sentiment,
  }));

  // Sentiment distribution for pie chart
  const sentimentDistribution = [
    { name: 'Positive', value: session.overallSentiment.positive, color: COLORS.positive },
    { name: 'Neutral', value: session.overallSentiment.neutral, color: COLORS.neutral },
    { name: 'Negative', value: session.overallSentiment.negative, color: COLORS.negative },
  ];

  // Nudge types distribution - initialize all types with 0
  const nudgeTypes = session.nudgesShown.reduce((acc, nudge) => {
    const type = nudge.type === 'upsell' ? 'Upsell' : 
                 nudge.type === 'cross_sell' ? 'Cross-sell' : 'Tip';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {
    'Upsell': 0,
    'Cross-sell': 0,
    'Tip': 0
  } as Record<string, number>);

  // Always show all categories in consistent order
  const nudgeData = [
    { name: 'Upsell', value: nudgeTypes['Upsell'] },
    { name: 'Cross-sell', value: nudgeTypes['Cross-sell'] },
    { name: 'Tip', value: nudgeTypes['Tip'] }
  ];

  const scoreChange = session.finalLeadScore - session.initialLeadScore;
  const scoreColor = session.finalLeadScore >= 7 ? COLORS.scoreHigh : session.finalLeadScore >= 4 ? COLORS.scoreMedium : COLORS.scoreLow;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">Call Dashboard</h1>
                {session.isActive && (
                  <Badge variant="default" className="bg-red-500 animate-pulse">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      LIVE
                    </span>
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {session.isActive 
                  ? 'Live call in progress - updates every 3 seconds' 
                  : 'Detailed analytics and insights from your call'
                }
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>

        {/* Filters */}
        {session && (
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            availableServices={session.servicesDiscussed || []}
            activeFilterCount={activeFilterCount}
          />
        )}

        {/* Call Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Call Summary</CardTitle>
            <CardDescription>Overview of the call session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="text-lg font-semibold">
                  {session.customerData.firstName} {session.customerData.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{session.customerData.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="text-lg font-semibold">{formatDate(session.startTime)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{formatDuration(session.duration)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Final Lead Score</p>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold`} style={{ color: scoreColor }}>
                    {session.finalLeadScore.toFixed(1)}
                  </span>
                  {scoreChange !== 0 && (
                    <Badge variant={scoreChange > 0 ? 'default' : 'destructive'}>
                      {scoreChange > 0 ? '↑' : '↓'} {Math.abs(scoreChange).toFixed(1)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Initial: {session.initialLeadScore.toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transcript Summary */}
        <Card className={`border-l-4 ${session.isActive ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className={`w-5 h-5 ${session.isActive ? 'text-orange-500' : 'text-blue-500'}`} />
                <CardTitle>Call Summary</CardTitle>
              </div>
            </div>
            <CardDescription>
              {session.isActive 
                ? 'Summary will be generated when call ends' 
                : 'AI-generated overview of the conversation'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {session.isActive ? (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-700 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Call in progress... AI analysis will run automatically when the call ends.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed mb-4">
                  {session.transcriptSummary || 'No summary available for this call.'}
                </p>
                
                {session.servicesDiscussed && session.servicesDiscussed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Services Discussed:</p>
                    <div className="flex flex-wrap gap-2">
                      {session.servicesDiscussed.map((service, idx) => (
                        <Badge key={idx} variant="outline" className="bg-blue-50">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Score Progression */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Score Progression</CardTitle>
              <CardDescription>How the lead score changed during the call</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={leadScoreData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" label={{ value: 'Time Point', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, 10]} label={{ value: 'Lead Score', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}/10`, 'Score']}
                    labelFormatter={(label) => `Time Point ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke={scoreColor} 
                    strokeWidth={3}
                    dot={{ fill: scoreColor, r: 5 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sentiment Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Distribution</CardTitle>
              <CardDescription>Overall sentiment breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sentimentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">Average Sentiment Score</p>
                <p className="text-2xl font-bold" style={{ color: COLORS.positive }}>
                  {(session.overallSentiment.averageScore * 100).toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversation Flow Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversation Flow Timeline</CardTitle>
            <CardDescription>Visual journey of the conversation with key moments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={sentimentData}>
                  <defs>
                    <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.positive} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.positive} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="turn" 
                    label={{ value: 'Conversation Progress', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: 'Sentiment Score', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">Turn {data.turn}</p>
                            <p className="text-sm">
                              Sentiment: <span className={`font-medium ${
                                data.sentiment === 'positive' ? 'text-green-600' :
                                data.sentiment === 'negative' ? 'text-red-600' :
                                'text-yellow-600'
                              }`}>
                                {data.sentiment}
                              </span>
                            </p>
                            <p className="text-sm">Score: {data.score.toFixed(1)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke={COLORS.positive}
                    strokeWidth={2}
                    fill="url(#flowGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={COLORS.positive}
                    strokeWidth={3}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const color = 
                        payload.sentiment === 'positive' ? COLORS.positive :
                        payload.sentiment === 'negative' ? COLORS.negative :
                        COLORS.neutral;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              
              {/* Key moments indicators */}
              {session.leadScoreHistory && session.leadScoreHistory.length > 1 && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Key Moments:</p>
                  <div className="flex flex-wrap gap-2">
                    {session.leadScoreHistory.slice(1, 4).map((moment, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {moment.reason}
                      </Badge>
                    ))}
                    {session.nudgesShown.length > 0 && (
                      <Badge variant="outline" className="text-xs bg-blue-50">
                        {session.nudgesShown.length} nudges shown
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Over Time & Nudge Types */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sentiment Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Over Time</CardTitle>
              <CardDescription>Sentiment score throughout the conversation</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={sentimentData}>
                  <defs>
                    <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.positive} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.positive} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="turn" label={{ value: 'Conversation Turn', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, 100]} label={{ value: 'Sentiment Score (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Sentiment']}
                    labelFormatter={(label) => `Turn ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke={COLORS.positive} 
                    fillOpacity={1}
                    fill="url(#colorSentiment)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Nudge Types */}
          <Card>
            <CardHeader>
              <CardTitle>Nudges Used</CardTitle>
              <CardDescription>Distribution of nudge types shown during the call</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nudgeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS.scoreHigh}>
                    {nudgeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.name === 'Upsell' ? '#3b82f6' :
                        entry.name === 'Cross-sell' ? '#f59e0b' :
                        COLORS.scoreHigh
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">Total Nudges Shown</p>
                <p className="text-2xl font-bold">{session.nudgesShown.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Talk Time Ratio & Response Quality */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Talk Time Ratio */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <CardTitle>Talk Time Ratio</CardTitle>
              </div>
              <CardDescription>Balance between CSR and customer speaking</CardDescription>
            </CardHeader>
            <CardContent>
              {session.conversationMetrics?.talkTimeRatio ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">CSR</span>
                    <span className="text-muted-foreground">
                      {session.conversationMetrics.talkTimeRatio.csrPercentage}%
                    </span>
                  </div>
                  <Progress 
                    value={session.conversationMetrics.talkTimeRatio.csrPercentage} 
                    className="h-3"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Customer</span>
                    <span className="text-muted-foreground">
                      {session.conversationMetrics.talkTimeRatio.customerPercentage}%
                    </span>
                  </div>
                  <Progress 
                    value={session.conversationMetrics.talkTimeRatio.customerPercentage} 
                    className="h-3"
                  />
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Analysis</p>
                  <p className="text-sm">
                    {(() => {
                      const csrPct = session.conversationMetrics?.talkTimeRatio.csrPercentage || 50;
                      if (csrPct >= 35 && csrPct <= 45) {
                        return '✓ Excellent balance - Good listening and engagement';
                      } else if (csrPct > 45 && csrPct <= 60) {
                        return '⚠ CSR talking slightly more - Consider more active listening';
                      } else if (csrPct > 60) {
                        return '⚠ CSR dominating conversation - Increase customer engagement';
                      } else {
                        return '⚠ Customer talking significantly more - Provide more guidance';
                      }
                    })()}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">CSR Words</p>
                    <p className="text-lg font-bold">
                      {session.conversationMetrics.talkTimeRatio.csrWordCount}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Customer Words</p>
                    <p className="text-lg font-bold">
                      {session.conversationMetrics.talkTimeRatio.customerWordCount}
                    </p>
                  </div>
                </div>
              </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {session.isActive 
                      ? '⏳ Talk time analysis will be available when call ends' 
                      : 'Talk time analysis unavailable for this call'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Quality */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <CardTitle>Response Quality Metrics</CardTitle>
              </div>
              <CardDescription>CSR performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              {session.conversationMetrics?.responseQuality ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Quality Score</span>
                      <span className="text-2xl font-bold text-green-600">
                        {session.conversationMetrics.responseQuality.overallScore}
                      </span>
                    </div>
                    <Progress 
                      value={session.conversationMetrics.responseQuality.overallScore} 
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 mt-4">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Questions Answered</span>
                        <span className="font-semibold">
                          {session.conversationMetrics.responseQuality.questionsAnswered}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Acknowledgments</span>
                        <span className="font-semibold">
                          {session.conversationMetrics.responseQuality.acknowledgmentCount}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Empathy Score</span>
                        <span className="font-semibold">
                          {session.conversationMetrics.responseQuality.empathyScore}/100
                        </span>
                      </div>
                      <Progress 
                        value={session.conversationMetrics.responseQuality.empathyScore} 
                        className="h-1.5"
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Performance</p>
                    <p className="text-sm">
                      {(() => {
                        const score = session.conversationMetrics.responseQuality.overallScore;
                        if (score >= 80) return '✓ Excellent - High quality customer service';
                        if (score >= 60) return '⚠ Good - Room for improvement in empathy';
                        return '⚠ Needs improvement - Focus on active listening';
                      })()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {session.isActive 
                      ? '⏳ Response quality metrics will be available when call ends' 
                      : 'Response quality analysis unavailable for this call'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Key Topics & Conversion Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Key Topics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                <CardTitle>Key Topics Discussed</CardTitle>
              </div>
              <CardDescription>Main themes from the conversation</CardDescription>
            </CardHeader>
            <CardContent>
              {session.conversationMetrics?.keyTopics && session.conversationMetrics.keyTopics.length > 0 ? (
                <div className="space-y-3">
                  {session.conversationMetrics.keyTopics.slice(0, 7).map((topic, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{topic.topic}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              topic.category === 'services' ? 'bg-blue-50' :
                              topic.category === 'pricing' ? 'bg-green-50' :
                              topic.category === 'scheduling' ? 'bg-purple-50' :
                              'bg-orange-50'
                            }
                          >
                            {topic.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={(topic.frequency / Math.max(...session.conversationMetrics.keyTopics.map(t => t.frequency))) * 100} className="h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {topic.frequency}x
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {session.isActive 
                    ? '⏳ Key topics will be identified when call ends' 
                    : 'No topic data available'
                  }
                </p>
              )}
            </CardContent>
          </Card>

          {/* Conversion Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Indicators</CardTitle>
              <CardDescription>Sales and booking signals</CardDescription>
            </CardHeader>
            <CardContent>
              {session.conversationMetrics?.conversionIndicators ? (
                <div className="space-y-4">
                  {/* Appointment Status */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Appointment Status</span>
                      <Badge 
                        variant={
                          session.conversationMetrics.conversionIndicators.appointmentStatus === 'booked' ? 'default' :
                          session.conversationMetrics.conversionIndicators.appointmentStatus === 'discussed' ? 'secondary' :
                          'outline'
                        }
                        className={
                          session.conversationMetrics.conversionIndicators.appointmentStatus === 'booked' ? 'bg-green-500' :
                          session.conversationMetrics.conversionIndicators.appointmentStatus === 'discussed' ? 'bg-yellow-500' :
                          ''
                        }
                      >
                        {session.conversationMetrics.conversionIndicators.appointmentStatus.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Pricing Discussed */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Pricing Discussed</span>
                      <Badge variant={session.conversationMetrics.conversionIndicators.pricingDiscussed ? 'default' : 'outline'}>
                        {session.conversationMetrics.conversionIndicators.pricingDiscussed ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {session.conversationMetrics.conversionIndicators.pricingAmounts && 
                     session.conversationMetrics.conversionIndicators.pricingAmounts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {session.conversationMetrics.conversionIndicators.pricingAmounts.map((amount, idx) => (
                          <Badge key={idx} variant="secondary" className="font-mono">
                            {amount}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Commitment Level */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Commitment Level</span>
                      <Badge 
                        variant="outline"
                        className={
                          session.conversationMetrics.conversionIndicators.commitmentLevel === 'high' ? 'bg-green-100 text-green-700' :
                          session.conversationMetrics.conversionIndicators.commitmentLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }
                      >
                        {session.conversationMetrics.conversionIndicators.commitmentLevel.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Objections */}
                  {session.conversationMetrics.conversionIndicators.objectionsRaised && 
                   session.conversationMetrics.conversionIndicators.objectionsRaised.length > 0 && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm font-medium mb-2">Objections Raised</p>
                      <div className="space-y-2">
                        {session.conversationMetrics.conversionIndicators.objectionsRaised.map((obj, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <Badge 
                              variant="outline" 
                              className={obj.resolved ? 'bg-green-50' : 'bg-red-50'}
                            >
                              {obj.resolved ? '✓' : '✗'}
                            </Badge>
                            <span className="flex-1">{obj.objection}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {session.isActive 
                      ? '⏳ Conversion metrics will be analyzed when call ends' 
                      : 'Conversion metrics unavailable for this call'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Key Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
            <CardDescription>Important metrics and takeaways</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Turns</p>
                <p className="text-3xl font-bold">{session.transcript.length}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Positive Sentiment</p>
                <p className="text-3xl font-bold" style={{ color: COLORS.positive }}>
                  {session.overallSentiment.positive}
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Score Change</p>
                <p className={`text-3xl font-bold ${scoreChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {scoreChange >= 0 ? '+' : ''}{scoreChange.toFixed(1)}
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Avg Turn Time</p>
                <p className="text-3xl font-bold">
                  {session.transcript.length > 0 
                    ? formatDuration(Math.floor(session.duration / session.transcript.length))
                    : '0s'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nudges List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Nudges Shown</CardTitle>
                <CardDescription>
                  {filters.nudgeType !== 'all' 
                    ? `Filtered nudges: ${filteredNudges.length} of ${session.nudgesShown.length}` 
                    : `All nudges displayed during the call`
                  }
                </CardDescription>
              </div>
              {filters.nudgeType !== 'all' && (
                <Badge variant="secondary">
                  {filteredNudges.length} shown
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredNudges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {filters.nudgeType !== 'all' 
                    ? `No ${filters.nudgeType.replace('_', ' ')} nudges found` 
                    : 'No nudges were shown during this call'
                  }
                </p>
              ) : (
                filteredNudges.map((nudge, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            nudge.type === 'upsell' ? 'default' :
                            nudge.type === 'cross_sell' ? 'secondary' :
                            'outline'
                          }
                          className={
                            nudge.type === 'upsell' ? 'bg-blue-500' :
                            nudge.type === 'cross_sell' ? 'bg-orange-500' :
                            'bg-green-500'
                          }
                        >
                          {nudge.type === 'upsell' ? 'UPSELL' : nudge.type === 'cross_sell' ? 'CROSS-SELL' : 'TIP'}
                        </Badge>
                        <span className="font-semibold">{nudge.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(nudge.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{nudge.body}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transcript with Sentiment */}
        {/* <Card>
          <CardHeader>
            <CardTitle>Full Transcript</CardTitle>
            <CardDescription>Complete conversation with sentiment highlights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {session.transcript.map((turn, index) => {
                const sentimentColor = 
                  turn.sentiment === 'positive' ? COLORS.positive :
                  turn.sentiment === 'negative' ? COLORS.negative :
                  COLORS.neutral;
                
                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-l-4 ${
                      turn.role === 'user' ? 'bg-muted/30' : 'bg-background'
                    }`}
                    style={{ borderLeftColor: sentimentColor }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {turn.role === 'user' ? 'Customer' : 'CSR'}
                        </Badge>
                        {turn.sentiment && (
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: sentimentColor,
                              color: sentimentColor 
                            }}
                          >
                            {turn.sentiment.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Turn {index + 1}
                      </span>
                    </div>
                    <p className="text-sm">{turn.content}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card> */}

    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Full Transcript</CardTitle>
          <CardDescription>
            {filters.sentiment !== 'all' 
              ? `Filtered transcript: ${filteredTranscript.length} of ${session.transcript.length} turns` 
              : 'Complete conversation with sentiment highlights'
            }
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDownload("txt")}>
            <Download className="w-4 h-4 mr-2" /> Download TXT
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload("json")}>
            <Download className="w-4 h-4 mr-2" /> Download JSON
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {filteredTranscript.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {filters.sentiment !== 'all' 
                ? `No ${filters.sentiment} sentiment turns found` 
                : 'No transcript available'
              }
            </p>
          ) : (
            filteredTranscript.map((turn: any, index: number) => {
            const sentimentColor =
              turn.sentiment === "positive"
                ? COLORS.positive
                : turn.sentiment === "negative"
                ? COLORS.negative
                : COLORS.neutral;

            return (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  turn.role === "user" ? "bg-muted/30" : "bg-background"
                }`}
                style={{ borderLeftColor: sentimentColor }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {turn.role === "user" ? "Customer" : "CSR"}
                    </Badge>
                    {turn.sentiment && (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: sentimentColor,
                          color: sentimentColor,
                        }}
                      >
                        {turn.sentiment.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Turn {index + 1}
                  </span>
                </div>
                <p className="text-sm">{turn.content}</p>
              </div>
            );
          }))}
        </div>
      </CardContent>
    </Card>

      </div>
    </div>
  );
}

