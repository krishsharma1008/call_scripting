import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Filter } from 'lucide-react';

export type FilterOptions = {
  sentiment: 'all' | 'positive' | 'neutral' | 'negative';
  nudgeType: 'all' | 'upsell' | 'cross_sell' | 'tip';
  service: string;
};

type FilterBarProps = {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableServices: string[];
  activeFilterCount: number;
};

export function FilterBar({
  filters,
  onFiltersChange,
  availableServices,
  activeFilterCount,
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleReset = () => {
    onFiltersChange({
      sentiment: 'all',
      nudgeType: 'all',
      service: 'all',
    });
  };

  const updateFilter = <K extends keyof FilterOptions>(
    key: K,
    value: FilterOptions[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Filters</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8"
            >
              <X className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8"
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sentiment Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Sentiment
            </label>
            <Select
              value={filters.sentiment}
              onValueChange={(value) =>
                updateFilter('sentiment', value as FilterOptions['sentiment'])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Sentiments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Positive
                  </span>
                </SelectItem>
                <SelectItem value="neutral">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Neutral
                  </span>
                </SelectItem>
                <SelectItem value="negative">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Negative
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nudge Type Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Nudge Type
            </label>
            <Select
              value={filters.nudgeType}
              onValueChange={(value) =>
                updateFilter('nudgeType', value as FilterOptions['nudgeType'])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Nudges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Nudges</SelectItem>
                <SelectItem value="upsell">
                  <span className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                      UPSELL
                    </span>
                  </span>
                </SelectItem>
                <SelectItem value="cross_sell">
                  <span className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                      CROSS-SELL
                    </span>
                  </span>
                </SelectItem>
                <SelectItem value="tip">
                  <span className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                      TIP
                    </span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Service Discussed
            </label>
            <Select
              value={filters.service}
              onValueChange={(value) => updateFilter('service', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {availableServices.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {filters.sentiment !== 'all' && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => updateFilter('sentiment', 'all')}
            >
              Sentiment: {filters.sentiment}
              <X className="w-3 h-3" />
            </Badge>
          )}
          {filters.nudgeType !== 'all' && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => updateFilter('nudgeType', 'all')}
            >
              Nudge: {filters.nudgeType.replace('_', ' ')}
              <X className="w-3 h-3" />
            </Badge>
          )}
          {filters.service !== 'all' && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => updateFilter('service', 'all')}
            >
              Service: {filters.service}
              <X className="w-3 h-3" />
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}

