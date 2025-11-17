/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download } from "lucide-react";

type CallSession = {
  callId: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  duration: number;
  transcript: Array<{ role: string; content: string; timestamp: string; sentiment?: 'positive' | 'neutral' | 'negative'; sentimentScore?: number }>;
  nudgesShown: Array<any>;
  leadScoreHistory: Array<{ score: number; timestamp: string; reason?: string }>;
  finalLeadScore: number;
  initialLeadScore: number;
  customerData: { firstName: string; lastName: string; zipcode: string; phone: string };
  overallSentiment: { positive: number; neutral: number; negative: number; averageScore: number };
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

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const url = callId 
          ? `http://localhost:3001/api/call/session/${callId}`
          : 'http://localhost:3001/api/call/latest';
        
        let resp: Response | null = null;
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
        } else if (resp.status === 404) {
          // No call session found - this is expected if no calls have been made yet
          // Silently handle 404 - don't log as error
          setSession(null);
        } else {
          console.error('Failed to load call session:', resp.status);
          setSession(null);
        }
      } catch (error) {
        // Silently handle errors - don't spam console
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [callId]);

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
          <div>
            <h1 className="text-3xl font-bold">Call Dashboard</h1>
            <p className="text-muted-foreground mt-1">Detailed analytics and insights from your call</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>

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
            <CardTitle>Nudges Shown</CardTitle>
            <CardDescription>All nudges displayed during the call</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {session.nudgesShown.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No nudges were shown during this call</p>
              ) : (
                session.nudgesShown.map((nudge, index) => (
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
          <CardDescription>Complete conversation with sentiment highlights</CardDescription>
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
          {session.transcript.map((turn: any, index: number) => {
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
          })}
        </div>
      </CardContent>
    </Card>

      </div>
    </div>
  );
}

