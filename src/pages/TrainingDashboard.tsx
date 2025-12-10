import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Award,
  BookOpenCheck,
  Clock,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { CallHistoryItem } from '@/utils/mockCallData';

type ServiceStat = { name: string; count: number };
type SentimentBreakdown = { positive: number; neutral: number; negative: number };

type AggregatedStats = {
  totalCalls: number;
  bookedCalls: number;
  lostCalls: number;
  conversionRate: number;
  avgLeadScore: number;
  avgDuration: number;
  avgSentiment: number;
  leadScoreTrend: number;
  sentimentBreakdown: SentimentBreakdown;
  topServices: ServiceStat[];
  recentCalls: CallHistoryItem[];
};

type AiAction = { title: string; detail: string };
type AiSummary = {
  strengths: string[];
  growthAreas: string[];
  actionPlan: AiAction[];
  coachingNarrative: string;
};

type QuartileInfo = {
  rank: number | null;
  label: string;
  percentile: number;
  totalAgents: number;
};

type DistributionEntry = {
  name: string;
  totalCalls: number;
  conversionRate: number;
  avgLeadScore: number;
  avgDuration: number;
};

type TrainingInsights = {
  agentName: string;
  agentStats: AggregatedStats;
  peerBenchmarks: AggregatedStats;
  overallStats: AggregatedStats;
  quartileInfo: QuartileInfo;
  aiSummary: AiSummary;
  csrDistribution: DistributionEntry[];
  recentCalls: CallHistoryItem[];
};

export default function TrainingDashboard() {
  const [insights, setInsights] = useState<TrainingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'csr' | 'manager'>('csr');
  const [selectedAgent, setSelectedAgent] = useState('Current Agent');

  const fetchInsights = useCallback(async (agent: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `http://localhost:3001/api/training/insights?csr=${encodeURIComponent(agent)}`
      );
      if (!resp.ok) {
        throw new Error('Unable to load training insights');
      }
      const data: TrainingInsights = await resp.json();
      setInsights(data);
      setSelectedAgent(data.agentName || agent);
    } catch (err) {
      console.error('[Training] Failed to load insights', err);
      setError('Unable to load training insights. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights(selectedAgent);
  }, [selectedAgent, fetchInsights]);

  const handleViewModeChange = (value: string) => {
    if (value === 'csr' || value === 'manager') {
      setViewMode(value);
    }
  };

  const handleAgentChange = (value: string) => {
    setSelectedAgent(value);
  };

  const handleRetry = () => {
    fetchInsights(selectedAgent);
  };

  const formatPercentage = (value?: number) => {
    if (!Number.isFinite(value)) return '--';
    return `${value!.toFixed(1)}%`;
  };

  const formatLeadScore = (value?: number) => {
    if (!Number.isFinite(value)) return '--';
    return `${value!.toFixed(1)}/10`;
  };

  const formatDuration = (seconds?: number) => {
    if (!Number.isFinite(seconds)) return '--';
    const mins = Math.floor((seconds as number) / 60);
    const secs = Math.max(0, Math.round((seconds as number) % 60));
    return `${mins}m ${secs}s`;
  };

  const renderList = (items: string[], fallback: string) => {
    if (!items.length) {
      return <p className="text-muted-foreground text-sm">{fallback}</p>;
    }
    return (
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        {items.map((item, idx) => (
          <li key={`${item}-${idx}`}>{item}</li>
        ))}
      </ul>
    );
  };

  const quartileBadgeColor = useMemo(() => {
    if (!insights?.quartileInfo.rank) return 'bg-slate-600';
    switch (insights.quartileInfo.rank) {
      case 1:
        return 'bg-emerald-500';
      case 2:
        return 'bg-sky-500';
      case 3:
        return 'bg-amber-500';
      default:
        return 'bg-rose-500';
    }
  }, [insights]);

  const sortedDistribution = useMemo(
    () => (insights ? [...insights.csrDistribution].sort((a, b) => b.conversionRate - a.conversionRate) : []),
    [insights]
  );

  const quartileBuckets = useMemo(() => {
    if (!sortedDistribution.length || !insights) {
      return [];
    }

    const total = sortedDistribution.length;
    const labels = ['Top 25%', 'Upper-middle', 'Lower-middle', 'Bottom 25%'];
    const descriptions = [
      'Elite performers',
      'Above average',
      'Developing consistency',
      'Needs coaching focus',
    ];

    return sortedDistribution.reduce<Array<{
      label: string;
      description: string;
      agents: DistributionEntry[];
    }>>((buckets, agent, index) => {
      const quartileIndex = Math.min(3, Math.floor(((index + 1) / total) * 4) - 1);
      const safeIndex = quartileIndex < 0 ? 0 : quartileIndex;
      if (!buckets[safeIndex]) {
        buckets[safeIndex] = {
          label: labels[safeIndex],
          description: descriptions[safeIndex],
          agents: [],
        };
      }
      buckets[safeIndex].agents.push(agent);
      return buckets;
    }, Array.from({ length: 4 }, (_, i) => ({
      label: labels[i],
      description: descriptions[i],
      agents: [],
    })));
  }, [sortedDistribution, insights]);

  const recentCalls =
    insights?.recentCalls?.length
      ? insights.recentCalls
      : insights?.agentStats?.recentCalls ?? [];

  const availableAgents = useMemo(() => {
    if (!insights) return ['Current Agent'];
    const names = insights.csrDistribution.map((entry) => entry.name);
    if (!names.includes('Current Agent')) {
      names.unshift('Current Agent');
    }
    return Array.from(new Set(names));
  }, [insights]);

  const showManagerSections = viewMode === 'manager';
  const showCsrSections = viewMode === 'csr';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading personalized training insights...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <RefreshCw className="h-4 w-4" />
                Training insights unavailable
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {error || 'Something went wrong while fetching your training dashboard.'}
              </p>
              <Button onClick={handleRetry} variant="default" className="w-full">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { agentStats, peerBenchmarks, overallStats, quartileInfo, aiSummary, agentName } =
    insights;

  const comparison = {
    conversionDelta: agentStats.conversionRate - peerBenchmarks.conversionRate,
    leadScoreDelta: agentStats.avgLeadScore - peerBenchmarks.avgLeadScore,
    durationDelta: agentStats.avgDuration - peerBenchmarks.avgDuration,
  };

  const sentimentTotal =
    agentStats.sentimentBreakdown.positive +
    agentStats.sentimentBreakdown.neutral +
    agentStats.sentimentBreakdown.negative || 1;

  const nextQuartileLabel =
    quartileInfo.rank && quartileInfo.rank > 1
      ? `Target Q${quartileInfo.rank - 1} to move up`
      : 'Sustain your elite performance';

  const peerInsights: string[] = [];
  if (Number.isFinite(comparison.conversionDelta) && comparison.conversionDelta < 0) {
    peerInsights.push(
      `Top agents convert ${(peerBenchmarks.conversionRate - agentStats.conversionRate).toFixed(1)}% more conversations. Double down on closing techniques earlier in the call.`
    );
  }
  if (Number.isFinite(comparison.leadScoreDelta) && comparison.leadScoreDelta < 0) {
    peerInsights.push(
      `Average lead scores trail the benchmark by ${Math.abs(comparison.leadScoreDelta).toFixed(
        1
      )} pts. Probe for urgency and budget clues sooner.`
    );
  }
  if (Number.isFinite(comparison.durationDelta) && comparison.durationDelta > 0) {
    peerInsights.push(
      `Calls run ${comparison.durationDelta.toFixed(
        0
      )}s longer than peers. Streamline qualification to stay concise.`
    );
  }
  if (!peerInsights.length) {
    peerInsights.push('You are tracking with team averages. Maintain momentum and reinforce best practices.');
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-7xl mx-auto p-6 space-y-6 pb-16">
        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase text-muted-foreground">Viewing as</span>
              <Select value={viewMode} onValueChange={handleViewModeChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csr">CSR Agent</SelectItem>
                  <SelectItem value="manager">Manager / Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase text-muted-foreground">CSR profile</span>
              <Select value={selectedAgent} onValueChange={handleAgentChange}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select CSR" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((agent) => (
                    <SelectItem key={agent} value={agent}>
                      {agent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none text-white shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a0000] via-[#8b1e00] to-[#ff5e00]" />
          <CardContent className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <Badge className={`${quartileBadgeColor} text-white uppercase tracking-wider`}>
                  {quartileInfo.label || 'Performance insights'}
                </Badge>
                <div>
                  <p className="text-sm uppercase tracking-wide text-white/70">
                    Training dashboard
                  </p>
                  <h1 className="text-3xl md:text-4xl font-bold">Great work, {agentName}!</h1>
                  <p className="text-white/80 mt-2 text-sm md:text-base">
                    Review how the latest calls stack up against team benchmarks, see where you
                    fall across quartiles, and act on AI-powered coaching takeaways.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-white/90">
                  <div>
                    <p className="text-xs uppercase text-white/60">Percentile</p>
                    <p className="text-lg font-semibold">
                      {quartileInfo.percentile.toFixed(0)}%
                    </p>
                  </div>
                  <Separator orientation="vertical" className="hidden md:block bg-white/40" />
                  <div>
                    <p className="text-xs uppercase text-white/60">Agents evaluated</p>
                    <p className="text-lg font-semibold">{quartileInfo.totalAgents}</p>
                  </div>
                  <Separator orientation="vertical" className="hidden md:block bg-white/40" />
                  <div>
                    <p className="text-xs uppercase text-white/60">Recent bookings</p>
                    <p className="text-lg font-semibold">{agentStats.bookedCalls}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 md:w-72 space-y-4">
                <div>
                  <p className="text-xs uppercase text-white/60">Quartile position</p>
                  <p className="text-3xl font-semibold">
                    {quartileInfo.rank ? `Q${quartileInfo.rank}` : '--'}
                  </p>
                </div>
                <Progress
                  value={quartileInfo.percentile}
                  className="bg-white/20"
                />
                <p className="text-xs text-white/70">
                  You're outperforming {quartileInfo.percentile.toFixed(0)}% of tracked CSR peers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Conversion rate"
            icon={TrendingUp}
            value={formatPercentage(agentStats.conversionRate)}
            delta={comparison.conversionDelta}
            footer="vs team average"
          />
          <StatCard
            title="Avg lead score"
            icon={Award}
            value={formatLeadScore(agentStats.avgLeadScore)}
            delta={comparison.leadScoreDelta}
            footer="vs team average"
          />
          <StatCard
            title="Avg duration"
            icon={Clock}
            value={formatDuration(agentStats.avgDuration)}
            delta={-comparison.durationDelta}
            footer="Shorter is better"
            deltaSuffix=" faster"
          />
          <StatCard
            title="Sentiment index"
            icon={Sparkles}
            value={`${agentStats.avgSentiment.toFixed(0)}%`}
            footer="Weighted positive sentiment"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Peer benchmark</CardTitle>
                <p className="text-muted-foreground text-sm">
                  How you compare to the broader CSR cohort
                </p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3.5 w-3.5" />
                {insights.csrDistribution.length} teammates
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {sortedDistribution.slice(0, 5).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Not enough peer data yet. Complete more calls to unlock team positioning.
                </p>
              ) : (
                <div className="space-y-4">
                  {sortedDistribution.slice(0, 5).map((entry) => {
                    const isAgent = entry.name === agentName;
                    return (
                      <div key={entry.name} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{entry.name}</p>
                            {isAgent && (
                              <Badge variant="default" className="gap-1 text-xs">
                                <Sparkles className="h-3 w-3" /> You
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {formatPercentage(entry.conversionRate)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(entry.conversionRate, 100)}
                          className={isAgent ? 'h-2 bg-primary/20' : 'h-2'}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top services discussed</CardTitle>
              <p className="text-muted-foreground text-sm">
                Highlights across your last few calls
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentStats.topServices.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No service mix yet—complete more calls to see breakdowns.
                </p>
              ) : (
                agentStats.topServices.map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{service.count}</Badge>
                      <p className="font-medium text-sm">{service.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(service.count / agentStats.totalCalls * 100 || 0).toFixed(0)}%
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {showManagerSections ? (
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Quartile placement</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Where every CSR stacks up by conversion rate
                </p>
              </div>
              <Badge variant="outline" className="gap-1">
                <Users className="h-3.5 w-3.5" />
                {sortedDistribution.length} agents tracked
              </Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {quartileBuckets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Need more historical calls to unlock quartile placement visuals.
                </p>
              ) : (
                quartileBuckets.map((bucket, bucketIdx) => (
                  <div
                    key={bucket.label}
                    className={`rounded-xl border p-4 space-y-3 ${
                      bucketIdx === (quartileInfo.rank ? quartileInfo.rank - 1 : -1)
                        ? 'bg-primary/5 border-primary/40'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{bucket.label}</p>
                        <p className="text-xs text-muted-foreground">{bucket.description}</p>
                      </div>
                      <Badge variant="secondary">{bucket.agents.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {bucket.agents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No agents yet</p>
                      ) : (
                        bucket.agents.map((agent) => {
                          const isCurrent = agent.name === agentName;
                          return (
                            <div
                              key={`${bucket.label}-${agent.name}`}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                                isCurrent ? 'border-primary bg-primary/10' : 'border-border'
                              }`}
                            >
                              <div className="flex items-center gap-2 text-sm">
                                {isCurrent && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                                <span className="font-medium">{agent.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {agent.conversionRate.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your quartile journey</CardTitle>
              <p className="text-muted-foreground text-sm">
                {nextQuartileLabel}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">
                  You currently sit in <span className="font-semibold">{quartileInfo.label}</span>. Focus on
                  the areas below to climb the leaderboard.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">What top quartile reps do differently</p>
                {renderList(peerInsights, 'Stay consistent with the playbook to remain competitive.')}
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Action ideas</p>
                {renderList(
                  aiSummary.actionPlan.map((plan) => `${plan.title}: ${plan.detail}`),
                  'Complete a few more calls to unlock tailored actions.'
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>AI coaching summary</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Powered by your latest transcript data
                </p>
              </div>
              <Badge variant="outline" className="gap-1">
                <BookOpenCheck className="h-3.5 w-3.5" />
                GPT-4o mini
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-semibold mb-2">Strengths</p>
                {renderList(aiSummary.strengths, 'Complete a few more calls to unlock strengths.')}
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Growth opportunities</p>
                {renderList(
                  aiSummary.growthAreas,
                  'Insights will appear after we analyze more calls.'
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Action plan</CardTitle>
              <p className="text-muted-foreground text-sm">
                Concrete steps to take on your next call
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiSummary.actionPlan.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Keep engaging customers—actionable steps will show up shortly.
                </p>
              ) : (
                aiSummary.actionPlan.map((item, idx) => (
                  <div
                    key={`${item.title}-${idx}`}
                    className="rounded-lg border p-4 space-y-1"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                ))
              )}
              <Separator />
              <p className="text-sm text-muted-foreground italic">
                {aiSummary.coachingNarrative}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Recent call snapshots</CardTitle>
              <p className="text-muted-foreground text-sm">
                Blend of real sessions and historical exemplars
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              <Target className="h-3.5 w-3.5" />
              {agentStats.totalCalls} total analyzed
            </Badge>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No calls recorded yet. Complete your first call to unlock detailed reviews.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Lead score</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls.slice(0, 6).map((call) => (
                      <TableRow key={call.callId}>
                        <TableCell>
                          <p className="font-medium text-sm">{call.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(call.date).toLocaleString()}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className="text-xs"
                            variant={
                              call.conversionStatus === 'booked'
                                ? 'default'
                                : call.conversionStatus === 'converted'
                                ? 'secondary'
                                : call.conversionStatus === 'lost'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {call.conversionStatus.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {call.finalLeadScore.toFixed(1)}
                            </span>
                            {call.leadScoreChange !== 0 && (
                              <Badge
                                variant={call.leadScoreChange > 0 ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {call.leadScoreChange > 0 ? '+' : ''}
                                {call.leadScoreChange.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {call.sentiment.overall.charAt(0).toUpperCase() +
                            call.sentiment.overall.slice(1)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(call.duration)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: number;
  deltaSuffix?: string;
  footer?: string;
};

function StatCard({ title, value, icon: Icon, delta, deltaSuffix = '', footer }: StatCardProps) {
  const showDelta = Number.isFinite(delta) && delta !== 0;
  const deltaLabel = delta ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${deltaSuffix}` : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {footer && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            {footer}
            {showDelta && (
              <span
                className={`font-semibold ${
                  (delta ?? 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {deltaLabel}
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
