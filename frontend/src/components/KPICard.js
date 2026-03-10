import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const KPICard = ({ title, value, subtitle, icon: Icon, trend, trendValue, className }) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-rose-500" />;
    return <Minus className="h-4 w-4 text-slate-500" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend === 'up') return 'text-emerald-600';
    if (trend === 'down') return 'text-rose-600';
    return 'text-slate-500';
  };

  return (
    <Card className={cn("bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200", className)} data-testid={`kpi-${title?.toLowerCase().replace(/\s/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor())}>
              {getTrendIcon()}
              <span>{trendValue}</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
