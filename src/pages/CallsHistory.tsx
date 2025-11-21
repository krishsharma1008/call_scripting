import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { CallHistoryFiltersComponent, CallHistoryFilters } from '@/components/CallHistoryFilters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CallHistoryItem, getMockCallData } from '@/utils/mockCallData';
import {
  TrendingUp,
  TrendingDown,
  Phone,
  Users,
  Target,
  Clock,
  Award,
  Activity,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { subDays, isAfter, isBefore, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';

export default function CallsHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [filters, setFilters] = useState<CallHistoryFilters>({
    timeRange: 'last_7_days',
    employee: 'all',
    conversionStatus: 'all',
    sentiment: 'all',
    leadScoreRange: [0, 10],
    searchQuery: ''
  });

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/call/history');
        if (response.ok) {
          const data = await response.json();
          setCalls(data.calls || []);
        } else {
          // Fallback to mock data if API fails
          setCalls(getMockCallData());
        }
      } catch (error) {
        console.error('Failed to fetch call history:', error);
        // Fallback to mock data
        setCalls(getMockCallData());
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, []);

  // Filter calls based on active filters
  const filteredCalls = useMemo(() => {
    let filtered = [...calls];

    // Time range filter
    const now = new Date();
    if (filters.timeRange !== 'custom') {
      filtered = filtered.filter((call) => {
        const callDate = new Date(call.date);
        
        switch (filters.timeRange) {
          case 'today':
            return isToday(callDate);
          case 'yesterday':
            return isYesterday(callDate);
          case 'last_7_days':
            return isAfter(callDate, subDays(now, 7));
          case 'last_30_days':
            return isAfter(callDate, subDays(now, 30));
          default:
            return true;
        }
      });
    } else if (filters.customDateRange?.from) {
      filtered = filtered.filter((call) => {
        const callDate = new Date(call.date);
        const from = startOfDay(filters.customDateRange!.from!);
        const to = filters.customDateRange?.to
          ? endOfDay(filters.customDateRange.to)
          : endOfDay(filters.customDateRange!.from!);
        
        return isAfter(callDate, from) && isBefore(callDate, to);
      });
    }

    // Employee filter
    if (filters.employee !== 'all') {
      filtered = filtered.filter((call) => call.csrName === filters.employee);
    }

    // Conversion status filter
    if (filters.conversionStatus !== 'all') {
      filtered = filtered.filter((call) => call.conversionStatus === filters.conversionStatus);
    }

    // Sentiment filter
    if (filters.sentiment !== 'all') {
      filtered = filtered.filter((call) => call.sentiment.overall === filters.sentiment);
    }

    // Lead score range filter
    filtered = filtered.filter(
      (call) =>
        call.finalLeadScore >= filters.leadScoreRange[0] &&
        call.finalLeadScore <= filters.leadScoreRange[1]
    );

    // Search query filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (call) =>
          call.customerName.toLowerCase().includes(query) ||
          call.customerPhone.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [calls, filters]);

  // Calculate metrics for summary cards
  const metrics = useMemo(() => {
    const totalCalls = filteredCalls.length;
    const activeCalls = filteredCalls.filter((c) => c.isActive).length;
    const bookedCalls = filteredCalls.filter(
      (c) => c.conversionStatus === 'booked' || c.conversionStatus === 'converted'
    ).length;
    const conversionRate = totalCalls > 0 ? (bookedCalls / totalCalls) * 100 : 0;
    
    const avgLeadScore =
      totalCalls > 0
        ? filteredCalls.reduce((sum, call) => sum + call.finalLeadScore, 0) / totalCalls
        : 0;
    
    const avgDuration =
      totalCalls > 0
        ? filteredCalls.reduce((sum, call) => sum + call.duration, 0) / totalCalls
        : 0;

    // Find top performing CSR
    const csrPerformance: Record<string, { conversions: number; total: number; avgScore: number; totalScore: number }> = {};
    filteredCalls.forEach((call) => {
      if (!csrPerformance[call.csrName]) {
        csrPerformance[call.csrName] = { conversions: 0, total: 0, avgScore: 0, totalScore: 0 };
      }
      csrPerformance[call.csrName].total++;
      csrPerformance[call.csrName].totalScore += call.finalLeadScore;
      if (call.conversionStatus === 'booked' || call.conversionStatus === 'converted') {
        csrPerformance[call.csrName].conversions++;
      }
    });

    let topCSR = { name: 'N/A', rate: 0 };
    Object.entries(csrPerformance).forEach(([name, stats]) => {
      stats.avgScore = stats.totalScore / stats.total;
      const rate = stats.total > 0 ? (stats.conversions / stats.total) * 100 : 0;
      if (rate > topCSR.rate) {
        topCSR = { name, rate };
      }
    });

    return {
      totalCalls,
      activeCalls,
      conversionRate,
      avgLeadScore,
      avgDuration,
      topCSR
    };
  }, [filteredCalls]);

  const availableEmployees = useMemo(() => {
    const employees = new Set(calls.map((call) => call.csrName));
    return Array.from(employees).sort();
  }, [calls]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.timeRange !== 'last_7_days') count++;
    if (filters.employee !== 'all') count++;
    if (filters.conversionStatus !== 'all') count++;
    if (filters.sentiment !== 'all') count++;
    if (filters.leadScoreRange[0] !== 0 || filters.leadScoreRange[1] !== 10) count++;
    return count;
  }, [filters]);

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

  const getConversionBadgeColor = (status: string) => {
    switch (status) {
      case 'booked':
        return 'bg-green-500 hover:bg-green-600';
      case 'converted':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'lost':
        return 'bg-red-500 hover:bg-red-600';
      case 'in_progress':
        return 'bg-yellow-500 hover:bg-yellow-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getLeadScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-600 font-bold';
    if (score >= 4) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading call history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Call History</h1>
            <p className="text-muted-foreground mt-1">
              Complete overview of all calls with performance metrics
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Total Calls */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.activeCalls > 0 ? `${metrics.activeCalls} active` : 'No active calls'}
              </p>
            </CardContent>
          </Card>

          {/* Conversion Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics.conversionRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {metrics.conversionRate >= 50 ? (
                  <>
                    <TrendingUp className="w-3 h-3" /> Above target
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-3 h-3" /> Below target
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Average Lead Score */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getLeadScoreColor(metrics.avgLeadScore)}`}>
                {metrics.avgLeadScore.toFixed(1)}/10
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.avgLeadScore >= 7 ? 'Excellent' : metrics.avgLeadScore >= 5 ? 'Good' : 'Needs improvement'}
              </p>
            </CardContent>
          </Card>

          {/* Average Duration */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(Math.floor(metrics.avgDuration))}</div>
              <p className="text-xs text-muted-foreground mt-1">Per call</p>
            </CardContent>
          </Card>

          {/* Top Performing CSR */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold truncate">{metrics.topCSR.name}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.topCSR.rate.toFixed(0)}% conversion
              </p>
            </CardContent>
          </Card>

          {/* Active Calls */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.activeCalls > 0 ? 'In progress' : 'All completed'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <CallHistoryFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          availableEmployees={availableEmployees}
          activeFilterCount={activeFilterCount}
        />

        {/* Calls Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Calls</CardTitle>
            <CardDescription>
              {filteredCalls.length === calls.length
                ? `Showing all ${calls.length} calls`
                : `Showing ${filteredCalls.length} of ${calls.length} calls`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCalls.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No calls found matching your filters</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setFilters({
                    timeRange: 'last_7_days',
                    employee: 'all',
                    conversionStatus: 'all',
                    sentiment: 'all',
                    leadScoreRange: [0, 10],
                    searchQuery: ''
                  })}
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>CSR</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lead Score</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead className="w-[300px]">Summary</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.map((call, index) => (
                      <TableRow
                        key={call.callId}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                          call.isRealData
                            ? 'bg-blue-50 border-l-4 border-l-blue-500'
                            : index === 0 && calls[0]?.isRealData
                            ? 'bg-blue-50 border-l-4 border-l-blue-500'
                            : ''
                        }`}
                        onClick={() => navigate(`/dashboard/${call.callId}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {call.customerName}
                                {call.isRealData && (
                                  <Badge variant="secondary" className="gap-1 text-xs">
                                    <Sparkles className="w-3 h-3" /> Live Call
                                  </Badge>
                                )}
                                {index === 0 && calls[0]?.isRealData && !call.isRealData && (
                                  <Badge variant="outline" className="text-xs">Most Recent</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {call.customerPhone}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{call.csrName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(call.date)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{formatDuration(call.duration)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getConversionBadgeColor(call.conversionStatus)}>
                            {call.conversionStatus.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${getLeadScoreColor(call.finalLeadScore)}`}>
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
                        <TableCell>
                          <div className={`text-sm font-medium ${getSentimentColor(call.sentiment.overall)}`}>
                            {call.sentiment.overall.charAt(0).toUpperCase() + call.sentiment.overall.slice(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(call.sentiment.averageScore * 100).toFixed(0)}%
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {call.servicesDiscussed.slice(0, 2).map((service, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                            {call.servicesDiscussed.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{call.servicesDiscussed.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {call.summary}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="gap-1">
                            View <ChevronRight className="w-4 h-4" />
                          </Button>
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


