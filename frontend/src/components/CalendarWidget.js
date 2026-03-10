import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, eachWeekOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { APPOINTMENT_STATES } from '../utils/mockData';

const VIEW_TYPES = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am to 7pm

export const CalendarWidget = ({ appointments = [], onAppointmentClick, onDateChange }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');

  const navigate = (direction) => {
    if (view === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const getDateRange = () => {
    if (view === 'day') {
      return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`;
    } else {
      return format(currentDate, "MMMM yyyy", { locale: es });
    }
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const monthWeeks = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    return weeks.map(weekStart => eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(weekStart, { weekStartsOn: 1 })
    }));
  }, [currentDate]);

  const getAppointmentsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(apt => apt.fecha === dateStr);
  };

  const getAppointmentStyle = (apt) => {
    const baseStyle = APPOINTMENT_STATES[apt.estado]?.color || 'bg-slate-100 text-slate-700';
    return cn(
      "rounded-md px-2 py-1 text-xs font-medium truncate cursor-pointer hover:opacity-80 transition-opacity border-l-4",
      baseStyle
    );
  };

  const renderDayView = () => (
    <div className="space-y-1 max-h-[500px] overflow-y-auto">
      {HOURS.map(hour => {
        const hourAppointments = getAppointmentsForDate(currentDate).filter(apt => {
          const aptHour = parseInt(apt.hora_inicio.split(':')[0]);
          return aptHour === hour;
        });
        
        return (
          <div key={hour} className="flex gap-2 min-h-[60px] border-b border-border/50 py-1">
            <div className="w-16 text-xs text-muted-foreground pt-1 flex-shrink-0">
              {`${hour}:00`}
            </div>
            <div className="flex-1 space-y-1">
              {hourAppointments.map(apt => (
                <div
                  key={apt.id}
                  className={getAppointmentStyle(apt)}
                  style={{ borderLeftColor: apt.doctor_color }}
                  onClick={() => onAppointmentClick?.(apt)}
                  data-testid={`appointment-${apt.id}`}
                >
                  <div className="font-semibold">{apt.paciente_nombre}</div>
                  <div className="flex items-center gap-1 text-[10px] opacity-80">
                    <Clock className="h-3 w-3" />
                    {apt.hora_inicio} - {apt.hora_fin}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div
              key={day.toISOString()}
              className={cn(
                "text-center py-2 rounded-lg",
                isSameDay(day, new Date()) && "bg-primary/10"
              )}
            >
              <div className="text-xs text-muted-foreground uppercase">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div className={cn(
                "text-lg font-semibold",
                isSameDay(day, new Date()) && "text-primary"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        
        {/* Time Grid */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-7 gap-1 min-h-[50px]">
              {weekDays.map(day => {
                const dayAppointments = getAppointmentsForDate(day).filter(apt => {
                  const aptHour = parseInt(apt.hora_inicio.split(':')[0]);
                  return aptHour === hour;
                });
                
                return (
                  <div
                    key={day.toISOString()}
                    className="border border-border/30 rounded p-1 bg-muted/20"
                  >
                    {dayAppointments.map(apt => (
                      <div
                        key={apt.id}
                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                        style={{ 
                          backgroundColor: `${apt.doctor_color}20`,
                          borderLeft: `3px solid ${apt.doctor_color}`,
                        }}
                        onClick={() => onAppointmentClick?.(apt)}
                        title={`${apt.paciente_nombre} - ${apt.motivo}`}
                        data-testid={`appointment-${apt.id}`}
                      >
                        {apt.paciente_nombre?.split(' ')[0]}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => (
    <div>
      {/* Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="text-center py-2 text-xs font-medium text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>
      
      {/* Weeks */}
      <div className="space-y-1">
        {monthWeeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1">
            {week.map(day => {
              const dayAppointments = getAppointmentsForDate(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[80px] p-1 rounded-lg border border-border/30",
                    !isCurrentMonth && "opacity-40",
                    isToday && "bg-primary/5 border-primary/30"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isToday && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayAppointments.slice(0, 3).map(apt => (
                      <div
                        key={apt.id}
                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer"
                        style={{ 
                          backgroundColor: `${apt.doctor_color}20`,
                          color: apt.doctor_color,
                        }}
                        onClick={() => onAppointmentClick?.(apt)}
                        data-testid={`appointment-${apt.id}`}
                      >
                        {apt.hora_inicio} {apt.paciente_nombre?.split(' ')[0]}
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayAppointments.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="bg-card border border-border/50 shadow-sm" data-testid="calendar-widget">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl font-semibold">Calendario</CardTitle>
          
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-muted rounded-lg p-1">
              {Object.entries(VIEW_TYPES).map(([key, label]) => (
                <Button
                  key={key}
                  variant={view === key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView(key)}
                  className="text-xs px-3"
                  data-testid={`view-${key}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="icon" onClick={() => navigate('prev')} data-testid="calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize">{getDateRange()}</span>
          <Button variant="outline" size="icon" onClick={() => navigate('next')} data-testid="calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(APPOINTMENT_STATES).map(([key, { label, color }]) => (
            <Badge key={key} variant="outline" className={cn("text-xs", color)}>
              {label}
            </Badge>
          ))}
        </div>
        
        {view === 'day' && renderDayView()}
        {view === 'week' && renderWeekView()}
        {view === 'month' && renderMonthView()}
      </CardContent>
    </Card>
  );
};
