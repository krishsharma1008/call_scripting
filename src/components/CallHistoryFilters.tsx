import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Search, X, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export type TimeRange = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'custom';
export type ConversionStatusFilter = 'all' | 'booked' | 'converted' | 'lost' | 'in_progress';
export type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative';

export type CallHistoryFilters = {
  timeRange: TimeRange;
  customDateRange?: { from: Date | undefined; to: Date | undefined };
  employee: string;
  conversionStatus: ConversionStatusFilter;
  sentiment: SentimentFilter;
  leadScoreRange: [number, number];
  searchQuery: string;
};

type CallHistoryFiltersProps = {
  filters: CallHistoryFilters;
  onFiltersChange: (filters: CallHistoryFilters) => void;
  availableEmployees: string[];
  activeFilterCount: number;
};

export function CallHistoryFiltersComponent({
  filters,
  onFiltersChange,
  availableEmployees,
  activeFilterCount
}: CallHistoryFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReset = () => {
    onFiltersChange({
      timeRange: 'last_7_days',
      employee: 'all',
      conversionStatus: 'all',
      sentiment: 'all',
      leadScoreRange: [0, 10],
      searchQuery: ''
    });
  };

  const updateFilter = <K extends keyof CallHistoryFilters>(
    key: K,
    value: CallHistoryFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Top row with search and quick filters */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by customer name or phone..."
                  value={filters.searchQuery}
                  onChange={(e) => updateFilter('searchQuery', e.target.value)}
                  className="pl-9 pr-9"
                />
                {filters.searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => updateFilter('searchQuery', '')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Time Range */}
            <div className="min-w-[180px]">
              <Label htmlFor="timeRange">Time Range</Label>
              <Select
                value={filters.timeRange}
                onValueChange={(value) => updateFilter('timeRange', value as TimeRange)}
              >
                <SelectTrigger id="timeRange" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                  <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range (shown when custom is selected) */}
            {filters.timeRange === 'custom' && (
              <div className="min-w-[250px]">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-1.5',
                        !filters.customDateRange?.from && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.customDateRange?.from ? (
                        filters.customDateRange.to ? (
                          <>
                            {format(filters.customDateRange.from, 'LLL dd, y')} -{' '}
                            {format(filters.customDateRange.to, 'LLL dd, y')}
                          </>
                        ) : (
                          format(filters.customDateRange.from, 'LLL dd, y')
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={filters.customDateRange?.from}
                      selected={{
                        from: filters.customDateRange?.from,
                        to: filters.customDateRange?.to,
                      }}
                      onSelect={(range) => {
                        updateFilter('customDateRange', {
                          from: range?.from,
                          to: range?.to,
                        });
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Expand/Collapse More Filters */}
            <Button
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              {isExpanded ? 'Hide' : 'More'} Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* Reset Button */}
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={handleReset} className="gap-2">
                <X className="w-4 h-4" />
                Reset
              </Button>
            )}
          </div>

          {/* Expanded filters section */}
          {isExpanded && (
            <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Employee/CSR Filter */}
              <div>
                <Label htmlFor="employee">Employee/CSR</Label>
                <Select
                  value={filters.employee}
                  onValueChange={(value) => updateFilter('employee', value)}
                >
                  <SelectTrigger id="employee" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {availableEmployees.map((emp) => (
                      <SelectItem key={emp} value={emp}>
                        {emp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conversion Status */}
              <div>
                <Label htmlFor="conversionStatus">Conversion Status</Label>
                <Select
                  value={filters.conversionStatus}
                  onValueChange={(value) => updateFilter('conversionStatus', value as ConversionStatusFilter)}
                >
                  <SelectTrigger id="conversionStatus" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sentiment */}
              <div>
                <Label htmlFor="sentiment">Sentiment</Label>
                <Select
                  value={filters.sentiment}
                  onValueChange={(value) => updateFilter('sentiment', value as SentimentFilter)}
                >
                  <SelectTrigger id="sentiment" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sentiments</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lead Score Range */}
              <div>
                <Label htmlFor="leadScore">
                  Lead Score: {filters.leadScoreRange[0].toFixed(1)} - {filters.leadScoreRange[1].toFixed(1)}
                </Label>
                <div className="mt-3">
                  <Slider
                    id="leadScore"
                    min={0}
                    max={10}
                    step={0.5}
                    value={filters.leadScoreRange}
                    onValueChange={(value) => updateFilter('leadScoreRange', value as [number, number])}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active filters display */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {filters.timeRange !== 'last_7_days' && (
                <Badge variant="secondary" className="gap-1">
                  Time: {filters.timeRange.replace('_', ' ')}
                  <button
                    onClick={() => updateFilter('timeRange', 'last_7_days')}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {filters.employee !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  CSR: {filters.employee}
                  <button
                    onClick={() => updateFilter('employee', 'all')}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {filters.conversionStatus !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Status: {filters.conversionStatus}
                  <button
                    onClick={() => updateFilter('conversionStatus', 'all')}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {filters.sentiment !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Sentiment: {filters.sentiment}
                  <button
                    onClick={() => updateFilter('sentiment', 'all')}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {(filters.leadScoreRange[0] !== 0 || filters.leadScoreRange[1] !== 10) && (
                <Badge variant="secondary" className="gap-1">
                  Score: {filters.leadScoreRange[0]}-{filters.leadScoreRange[1]}
                  <button
                    onClick={() => updateFilter('leadScoreRange', [0, 10])}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


