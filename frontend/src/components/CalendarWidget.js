import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, addDays, subDays,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths, eachWeekOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { API } from '@/lib/api';

// ── Constantes ────────────────────────────────────────────────────────────────
const PX_PER_HOUR = 56; // un poco más compacto que CalendarPage para caber en el dashboard

const timeToMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const VIEW_TYPES = { day: 'Día', week: 'Semana', month: 'Mes' };

// ── Componente principal ───────────────────────────────────────────────────────
export const CalendarWidget = ({ onAppointmentClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView]               = useState('day');
  const [appointments, setAppointments] = useState([]);
  const [clinicConfig, setClinicConfig] = useState({ work_start: 8, work_end: 19 });
  const gridScrollRef = useRef(null);

  // ── Config de la clínica ──────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/config`)
      .then(r => setClinicConfig({
        work_start: r.data.work_start ?? 8,
        work_end:   r.data.work_end   ?? 19,
      }))
      .catch(() => {});
  }, []);

  // ── Carga de citas (todas, filtrado cliente-side igual que CalendarPage) ───
  useEffect(() => {
    axios.get(`${API}/appointments`, { params: { limit: 200 } })
      .then(r => setAppointments(r.data))
      .catch(() => {});
  }, []);

  // ── Scroll al horario actual ──────────────────────────────────────────────
  useEffect(() => {
    if (!gridScrollRef.current) return;
    requestAnimationFrame(() => {
      if (!gridScrollRef.current) return;
      const now = new Date();
      const px = (now.getHours() * 60 + now.getMinutes() - clinicConfig.work_start * 60)
                 * (PX_PER_HOUR / 60);
      gridScrollRef.current.scrollTop = Math.max(0, px - 60);
    });
  }, [clinicConfig.work_start, view]);

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const HOURS = useMemo(
    () => Array.from(
      { length: clinicConfig.work_end - clinicConfig.work_start },
      (_, i) => i + clinicConfig.work_start
    ),
    [clinicConfig.work_start, clinicConfig.work_end]
  );

  const GRID_HEIGHT = (clinicConfig.work_end - clinicConfig.work_start) * PX_PER_HOUR;

  const pxFromWorkStart = (hhmm) =>
    (timeToMin(hhmm) - clinicConfig.work_start * 60) * (PX_PER_HOUR / 60);

  const getAppointmentsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(apt => apt.fecha === dateStr);
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: endOfWeek(currentDate, { weekStartsOn: 1 }) });
  }, [currentDate]);

  const monthWeeks = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end   = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    return weeks.map(ws =>
      eachDayOfInterval({ start: ws, end: endOfWeek(ws, { weekStartsOn: 1 }) })
    );
  }, [currentDate]);

  // ── Navegación ────────────────────────────────────────────────────────────
  const navigate = (dir) => {
    const fwd = dir === 'next';
    if (view === 'day')   setCurrentDate(d => fwd ? addDays(d, 1)    : subDays(d, 1));
    if (view === 'week')  setCurrentDate(d => fwd ? addWeeks(d, 1)   : subWeeks(d, 1));
    if (view === 'month') setCurrentDate(d => fwd ? addMonths(d, 1)  : subMonths(d, 1));
  };

  const getDateLabel = () => {
    if (view === 'day')   return format(currentDate, "EEEE, d 'de' MMMM", { locale: es });
    if (view === 'week') {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentDate,   { weekStartsOn: 1 });
      return `${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: es });
  };

  // ── Sub-componentes de grid ───────────────────────────────────────────────
  const TimeLabels = () => (
    <div className="relative flex-shrink-0 w-14 select-none" style={{ height: GRID_HEIGHT }}>
      {HOURS.map(h => (
        <div key={h}>
          <div
            className="absolute right-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-none"
            style={{ top: Math.max(2, (h - clinicConfig.work_start) * PX_PER_HOUR - 5) }}
          >
            {h}:00
          </div>
          <div
            className="absolute right-2 text-[9px] text-slate-400 dark:text-slate-500 leading-none"
            style={{ top: (h - clinicConfig.work_start) * PX_PER_HOUR + PX_PER_HOUR / 2 - 4 }}
          >
            {h}:30
          </div>
        </div>
      ))}
    </div>
  );

  const TimeGridLines = () => (
    <>
      {HOURS.map(h => {
        const top = (h - clinicConfig.work_start) * PX_PER_HOUR;
        return (
          <div key={h}>
            <div className="absolute w-full border-t border-slate-300 dark:border-slate-500" style={{ top }} />
            <div className="absolute w-full border-t border-slate-200 dark:border-white/10" style={{ top: top + PX_PER_HOUR / 2 }} />
          </div>
        );
      })}
    </>
  );

  const CurrentTimeLine = () => {
    const now = new Date();
    const top = pxFromWorkStart(
      `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
    );
    if (top < 0 || top > GRID_HEIGHT) return null;
    return (
      <div className="absolute w-full z-20 pointer-events-none" style={{ top }}>
        <div className="relative flex items-center">
          <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 flex-shrink-0" />
          <div className="flex-1 h-px bg-rose-500" />
        </div>
      </div>
    );
  };

  const renderApt = (apt) => {
    const top  = pxFromWorkStart(apt.hora_inicio);
    const dur  = apt.hora_fin
      ? timeToMin(apt.hora_fin) - timeToMin(apt.hora_inicio)
      : 30;
    const height = Math.max(18, dur * (PX_PER_HOUR / 60));

    return (
      <div
        key={apt.id}
        className="absolute inset-x-0.5 rounded overflow-hidden cursor-pointer hover:brightness-95 transition-all select-none"
        style={{
          top:             top + 1,
          height:          height - 2,
          backgroundColor: `${apt.doctor_color}22`,
          borderLeft:      `3px solid ${apt.doctor_color}`,
          zIndex:          10,
        }}
        onClick={() => onAppointmentClick?.(apt)}
        title={`${apt.paciente_nombre} · ${apt.hora_inicio}–${apt.hora_fin}`}
      >
        <div
          className="px-1 pt-0.5 text-[10px] font-semibold leading-tight truncate"
          style={{ color: apt.doctor_color }}
        >
          {apt.paciente_nombre?.split(' ')[0]}
        </div>
        {height >= 28 && (
          <div className="px-1 text-[10px] opacity-70 truncate" style={{ color: apt.doctor_color }}>
            {apt.hora_inicio}
          </div>
        )}
      </div>
    );
  };

  // ── Vistas ────────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const dayApts = getAppointmentsForDate(currentDate);
    const isToday = isSameDay(currentDate, new Date());
    return (
      <div
        ref={gridScrollRef}
        className="overflow-y-auto max-h-[380px]"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="flex">
          <TimeLabels />
          <div
            className={cn('relative flex-1 rounded-lg overflow-hidden', isToday && 'bg-primary/[0.02]')}
            style={{ height: GRID_HEIGHT }}
          >
            <TimeGridLines />
            {isToday && <CurrentTimeLine />}
            {dayApts.map(apt => renderApt(apt))}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        {/* Cabecera de días */}
        <div className="flex pl-14 border-b border-border/40 pb-1 mb-0">
          {weekDays.map(day => (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 text-center py-1 rounded-t',
                isSameDay(day, new Date()) && 'bg-primary/10'
              )}
            >
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div className={cn(
                'text-sm font-semibold leading-tight',
                isSameDay(day, new Date()) && 'text-primary'
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Grid scrolleable */}
        <div
          ref={gridScrollRef}
          className="overflow-y-auto max-h-[380px]"
          style={{ scrollbarGutter: 'stable' }}
        >
          <div className="flex">
            <TimeLabels />
            {weekDays.map(day => {
              const dayApts = getAppointmentsForDate(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'relative flex-1 border-l border-slate-200 dark:border-slate-700/50',
                    isToday && 'bg-primary/[0.025]'
                  )}
                  style={{ height: GRID_HEIGHT }}
                >
                  <TimeGridLines />
                  {isToday && <CurrentTimeLine />}
                  {dayApts.map(apt => renderApt(apt))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="text-center py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        {monthWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map(day => {
              const dayApts = getAppointmentsForDate(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[60px] p-1 rounded border border-border/30 text-[10px]',
                    !isCurrentMonth && 'opacity-30',
                    isToday && 'bg-primary/5 border-primary/30'
                  )}
                >
                  <div className={cn('font-semibold mb-0.5', isToday && 'text-primary')}>
                    {format(day, 'd')}
                  </div>
                  {dayApts.slice(0, 2).map(apt => (
                    <div
                      key={apt.id}
                      className="truncate rounded px-0.5 py-px mb-0.5 cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: `${apt.doctor_color}25`, color: apt.doctor_color }}
                      onClick={() => onAppointmentClick?.(apt)}
                    >
                      {apt.hora_inicio} {apt.paciente_nombre?.split(' ')[0]}
                    </div>
                  ))}
                  {dayApts.length > 2 && (
                    <div className="text-muted-foreground">+{dayApts.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className="bg-card border border-border/50 shadow-sm" data-testid="calendar-widget">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold capitalize leading-tight">
            {getDateLabel()}
          </CardTitle>
          {/* Selector de vista */}
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5 flex-shrink-0">
            {Object.entries(VIEW_TYPES).map(([key, label]) => (
              <Button
                key={key}
                variant={view === key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView(key)}
                className="text-xs px-2 h-6"
                data-testid={`view-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Navegación */}
        <div className="flex items-center gap-1.5 mt-2">
          <Button
            variant="outline" size="icon" className="h-6 w-6"
            onClick={() => navigate('prev')}
            data-testid="calendar-prev"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="outline" size="sm" className="h-6 text-xs px-2"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="outline" size="icon" className="h-6 w-6"
            onClick={() => navigate('next')}
            data-testid="calendar-next"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {view === 'day'   && renderDayView()}
        {view === 'week'  && renderWeekView()}
        {view === 'month' && renderMonthView()}
      </CardContent>
    </Card>
  );
};
