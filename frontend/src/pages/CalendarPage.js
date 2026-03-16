import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { APPOINTMENT_STATES } from '../utils/mockData';
import {
  Clock, AlertTriangle, User, Plus,
  ChevronLeft, ChevronRight, CalendarIcon,
  GripVertical, Trash2, XCircle,
} from 'lucide-react';
import {
  format, addDays, subDays,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  addWeeks, subWeeks, startOfMonth, endOfMonth,
  addMonths, subMonths, eachWeekOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ── Constantes de layout del grid ─────────────────────────────────────────────
const PX_PER_HOUR = 64;   // px por hora → 1 min = 64/60 ≈ 1.07 px

const VIEW_TYPES = { day: 'Día', week: 'Semana', month: 'Mes' };

const DURATION_OPTIONS = [
  { value: 20,  label: '20 min' },
  { value: 30,  label: '30 min' },
  { value: 40,  label: '40 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 hora' },
  { value: 90,  label: '1h 30 min' },
  { value: 120, label: '2 horas' },
];

// ── Helpers de tiempo ─────────────────────────────────────────────────────────
const timeToMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const minToHHMM = (totalMin) => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const calcEndTime   = (start, durMin) => minToHHMM(timeToMin(start) + durMin);
const calcDuration  = (start, end)    => timeToMin(end) - timeToMin(start);

export const CalendarPage = () => {
  const navigate = useNavigate();

  // ── Config de clínica (horarios y slot por defecto) ───────────────────────
  const [clinicConfig, setClinicConfig] = useState({
    work_start:    8,
    work_end:      19,
    slot_duration: 30,
  });

  useEffect(() => {
    axios.get(`${API}/config`)
      .then(r => setClinicConfig({
        work_start:    r.data.work_start    ?? 8,
        work_end:      r.data.work_end      ?? 19,
        slot_duration: r.data.slot_duration ?? 30,
      }))
      .catch(() => {}); // falla silenciosamente → usa defaults
  }, []);

  // Horas visibles y slots de tiempo calculados desde la config
  const HOURS = useMemo(
    () => Array.from(
      { length: clinicConfig.work_end - clinicConfig.work_start },
      (_, i) => i + clinicConfig.work_start
    ),
    [clinicConfig.work_start, clinicConfig.work_end]
  );

  const TIME_SLOTS = useMemo(() => {
    const slots = [];
    for (let h = clinicConfig.work_start; h < clinicConfig.work_end; h++) {
      for (let m = 0; m < 60; m += 10) {
        slots.push(minToHHMM(h * 60 + m));
      }
    }
    return slots;
  }, [clinicConfig.work_start, clinicConfig.work_end]);

  const GRID_HEIGHT = (clinicConfig.work_end - clinicConfig.work_start) * PX_PER_HOUR;
  const pxFromWorkStart = (hhmm) =>
    (timeToMin(hhmm) - clinicConfig.work_start * 60) * (PX_PER_HOUR / 60);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [view,         setView]         = useState('week');
  const [appointments, setAppointments] = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [doctors,      setDoctors]      = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aptsRes, patientsRes, doctorsRes] = await Promise.all([
          axios.get(`${API}/appointments`, { params: { limit: 200 } }),
          axios.get(`${API}/patients`,     { params: { limit: 200 } }),
          axios.get(`${API}/doctors`),
        ]);
        setAppointments(aptsRes.data);
        setPatients(patientsRes.data);
        setDoctors(doctorsRes.data.filter(d => d.activo));
      } catch {
        toast.error('Error al cargar datos del calendario');
      }
    };
    fetchData();
  }, []);

  // ── Scroll al horario actual al montar ────────────────────────────────────
  const gridScrollRef = useRef(null);
  useEffect(() => {
    if (!gridScrollRef.current) return;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const workStartMin = clinicConfig.work_start * 60;
    const px = (currentMin - workStartMin) * (PX_PER_HOUR / 60);
    gridScrollRef.current.scrollTop = Math.max(0, px - 80);
  }, [clinicConfig.work_start, view]);

  // ── Sheet detalles ────────────────────────────────────────────────────────
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [sheetOpen,           setSheetOpen]           = useState(false);

  // ── Dialog nueva cita ─────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newApt, setNewApt] = useState({
    paciente_id: '',
    doctor_id:   '',
    fecha:       format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    duracion:    clinicConfig.slot_duration,
    motivo:      '',
    notas:       '',
  });

  // Sync duracion default con config cuando llegue
  useEffect(() => {
    setNewApt(prev => ({ ...prev, duracion: clinicConfig.slot_duration }));
  }, [clinicConfig.slot_duration]);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const [draggedApt, setDraggedApt] = useState(null);

  const handleDragStart = (e, apt) => {
    setDraggedApt(apt);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = async (e, date, slotMin) => {
    e.preventDefault();
    if (!draggedApt) return;
    const newDate      = format(date, 'yyyy-MM-dd');
    const newStart     = minToHHMM(slotMin);
    const originalDur  = calcDuration(draggedApt.hora_inicio, draggedApt.hora_fin);
    const newEnd       = calcEndTime(newStart, originalDur > 0 ? originalDur : clinicConfig.slot_duration);

    setAppointments(prev => prev.map(a =>
      a.id === draggedApt.id ? { ...a, fecha: newDate, hora_inicio: newStart, hora_fin: newEnd } : a
    ));
    try {
      await axios.put(`${API}/appointments/${draggedApt.id}`, {
        paciente_id: draggedApt.paciente_id,
        doctor_id:   draggedApt.doctor_id,
        fecha:       newDate,
        hora_inicio: newStart,
        hora_fin:    newEnd,
        motivo:      draggedApt.motivo,
        notas:       draggedApt.notas || '',
        estado:      draggedApt.estado,
      });
      toast.success(`Cita movida a ${format(date, 'd MMM', { locale: es })} ${newStart}`);
    } catch {
      toast.error('Error al mover la cita');
      setAppointments(prev => prev.map(a => a.id === draggedApt.id ? draggedApt : a));
    }
    setDraggedApt(null);
  };

  // ── Navegación ────────────────────────────────────────────────────────────
  const navigateCalendar = (dir) => {
    if (view === 'day')   setCurrentDate(dir === 'next' ? addDays(currentDate, 1)    : subDays(currentDate, 1));
    else if (view === 'week') setCurrentDate(dir === 'next' ? addWeeks(currentDate, 1)  : subWeeks(currentDate, 1));
    else                  setCurrentDate(dir === 'next' ? addMonths(currentDate, 1)  : subMonths(currentDate, 1));
  };

  const getDateRange = () => {
    if (view === 'day')
      return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end   = endOfWeek(currentDate,   { weekStartsOn: 1 });
      return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`;
    }
    return format(currentDate, "MMMM yyyy", { locale: es });
  };

  const weekDaysArray = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end:   endOfWeek(currentDate,   { weekStartsOn: 1 }),
  });

  const monthWeeks = (() => {
    const start = startOfMonth(currentDate);
    const end   = endOfMonth(currentDate);
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
      .map(ws => eachDayOfInterval({ start: ws, end: endOfWeek(ws, { weekStartsOn: 1 }) }));
  })();

  const getAppointmentsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(a => a.fecha === dateStr);
  };

  // ── Handlers de cita ──────────────────────────────────────────────────────
  const handleAppointmentClick = (apt) => { setSelectedAppointment(apt); setSheetOpen(true); };

  const handleViewPatient = (apt) => { setSheetOpen(false); navigate(`/patients/${apt.paciente_id}`); };

  const handleCancelAppointment = async (apt) => {
    if (!window.confirm(`¿Cancelar la cita de ${apt.paciente_nombre}?`)) return;
    try {
      await axios.put(`${API}/appointments/${apt.id}/status`, null, { params: { estado: 'cancelada' } });
      setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, estado: 'cancelada' } : a));
      setSelectedAppointment(prev => ({ ...prev, estado: 'cancelada' }));
      toast.success('Cita cancelada');
    } catch { toast.error('Error al cancelar la cita'); }
  };

  const handleDeleteAppointment = async (apt) => {
    if (!window.confirm(`¿Eliminar permanentemente la cita de ${apt.paciente_nombre}?`)) return;
    try {
      await axios.delete(`${API}/appointments/${apt.id}`);
      setAppointments(prev => prev.filter(a => a.id !== apt.id));
      setSheetOpen(false);
      toast.success('Cita eliminada');
    } catch { toast.error('Error al eliminar la cita'); }
  };

  const handleCreateAppointment = async () => {
    if (!newApt.paciente_id || !newApt.doctor_id || !newApt.motivo) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    const hora_fin = calcEndTime(newApt.hora_inicio, newApt.duracion);
    try {
      const res = await axios.post(`${API}/appointments`, {
        paciente_id: newApt.paciente_id,
        doctor_id:   newApt.doctor_id,
        fecha:       newApt.fecha,
        hora_inicio: newApt.hora_inicio,
        hora_fin,
        motivo:      newApt.motivo,
        notas:       newApt.notas,
        estado:      'confirmada',
      });
      setAppointments(prev => [...prev, res.data]);
      toast.success(`Cita creada: ${newApt.hora_inicio} – ${hora_fin}`);
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map(e => e.msg).join(', ') : (d || 'Error al crear cita'));
      return;
    }
    setIsCreateOpen(false);
    setNewApt({
      paciente_id: '', doctor_id: '',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      hora_inicio: '09:00', duracion: clinicConfig.slot_duration,
      motivo: '', notas: '',
    });
  };

  // ── Renders ───────────────────────────────────────────────────────────────

  /** Tarjeta de cita para la vista Día (más ancha, muestra más info) */
  const renderAptDay = (apt) => {
    const dur    = calcDuration(apt.hora_inicio, apt.hora_fin);
    const top    = pxFromWorkStart(apt.hora_inicio);
    const height = Math.max(dur > 0 ? dur * (PX_PER_HOUR / 60) : PX_PER_HOUR / 2, 22);
    const isShort = height < 40;

    return (
      <div
        key={apt.id}
        draggable
        onDragStart={(e) => handleDragStart(e, apt)}
        onClick={() => handleAppointmentClick(apt)}
        data-testid={`appointment-${apt.id}`}
        className={cn(
          'absolute left-0 right-0 mx-1 rounded-md border-l-4 px-2 overflow-hidden',
          'cursor-grab active:cursor-grabbing hover:brightness-95 transition-all select-none',
          APPOINTMENT_STATES[apt.estado]?.color || 'bg-slate-100',
        )}
        style={{
          top:           top + 1,
          height:        height - 2,
          borderLeftColor: apt.doctor_color,
          zIndex: 10,
        }}
        title={`${apt.paciente_nombre} · ${apt.motivo} · ${apt.hora_inicio}–${apt.hora_fin}`}
      >
        {isShort ? (
          <span className="text-[10px] font-semibold leading-tight truncate block">
            {apt.hora_inicio} {apt.paciente_nombre?.split(' ')[0]}
          </span>
        ) : (
          <>
            <div className="flex items-center gap-1 mt-0.5">
              <GripVertical className="h-3 w-3 opacity-40 flex-shrink-0" />
              <span className="text-xs font-semibold truncate">{apt.paciente_nombre}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] opacity-75">
              <Clock className="h-3 w-3" />
              {apt.hora_inicio} – {apt.hora_fin}
              <span className="ml-1 opacity-60">{dur} min</span>
            </div>
            {height >= 56 && (
              <div className="text-[10px] opacity-60 truncate">{apt.motivo}</div>
            )}
          </>
        )}
      </div>
    );
  };

  /** Tarjeta de cita para la vista Semana (columnas angostas) */
  const renderAptWeek = (apt) => {
    const dur    = calcDuration(apt.hora_inicio, apt.hora_fin);
    const top    = pxFromWorkStart(apt.hora_inicio);
    const height = Math.max(dur > 0 ? dur * (PX_PER_HOUR / 60) : PX_PER_HOUR / 2, 18);

    return (
      <div
        key={apt.id}
        draggable
        onDragStart={(e) => handleDragStart(e, apt)}
        onClick={() => handleAppointmentClick(apt)}
        data-testid={`appointment-${apt.id}`}
        className="absolute inset-x-0.5 rounded overflow-hidden cursor-grab active:cursor-grabbing hover:brightness-95 transition-all select-none"
        style={{
          top:             top + 1,
          height:          height - 2,
          backgroundColor: `${apt.doctor_color}22`,
          borderLeft:      `3px solid ${apt.doctor_color}`,
          zIndex:          10,
        }}
        title={`${apt.paciente_nombre} · ${apt.hora_inicio}–${apt.hora_fin} · ${dur} min`}
      >
        <div className="px-1 pt-0.5 text-[10px] font-semibold leading-tight truncate"
             style={{ color: apt.doctor_color }}>
          {apt.paciente_nombre?.split(' ')[0]}
        </div>
        {height >= 34 && (
          <div className="px-1 text-[9px] opacity-70 truncate" style={{ color: apt.doctor_color }}>
            {apt.hora_inicio}
          </div>
        )}
      </div>
    );
  };

  /** Grid de líneas de tiempo (fondo del calendario) */
  const TimeGridLines = () => (
    <>
      {HOURS.map((h) => {
        const top = (h - clinicConfig.work_start) * PX_PER_HOUR;
        return (
          <div key={h}>
            {/* Línea de hora — sólida */}
            <div
              className="absolute w-full border-t border-border/60"
              style={{ top }}
            />
            {/* Línea de media hora — punteada más suave */}
            <div
              className="absolute w-full border-t border-dashed border-border/30"
              style={{ top: top + PX_PER_HOUR / 2 }}
            />
          </div>
        );
      })}
    </>
  );

  /** Columna de etiquetas horarias */
  const TimeLabels = () => (
    <div className="relative flex-shrink-0 w-12 select-none" style={{ height: GRID_HEIGHT }}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute right-2 text-[10px] font-medium text-muted-foreground/70 leading-none"
          style={{ top: (h - clinicConfig.work_start) * PX_PER_HOUR - 6 }}
        >
          {h}:00
        </div>
      ))}
    </div>
  );

  /** Celdas invisibles para drag & drop (cada SLOT_DURATION minutos) */
  const DropCells = ({ date }) => {
    const snapMin = 30; // snapping a 30 min
    const slots = [];
    for (let m = 0; m < (clinicConfig.work_end - clinicConfig.work_start) * 60; m += snapMin) {
      const slotAbsMin = clinicConfig.work_start * 60 + m;
      slots.push(
        <div
          key={m}
          className="absolute w-full"
          style={{ top: m * (PX_PER_HOUR / 60), height: snapMin * (PX_PER_HOUR / 60) }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, date, slotAbsMin)}
        />
      );
    }
    return <>{slots}</>;
  };

  // ── Indicador de hora actual ──────────────────────────────────────────────
  const CurrentTimeLine = () => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = clinicConfig.work_start * 60;
    const endMin   = clinicConfig.work_end   * 60;
    if (nowMin < startMin || nowMin > endMin) return null;
    const top = (nowMin - startMin) * (PX_PER_HOUR / 60);
    return (
      <div className="absolute w-full flex items-center pointer-events-none" style={{ top, zIndex: 20 }}>
        <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 flex-shrink-0" />
        <div className="flex-1 border-t-2 border-rose-500/70" />
      </div>
    );
  };

  // ── Vista Día ─────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const dayApts = getAppointmentsForDate(currentDate);
    const isToday = isSameDay(currentDate, new Date());

    return (
      <div
        ref={gridScrollRef}
        className="overflow-y-auto max-h-[560px] mt-2"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="flex gap-0">
          <TimeLabels />
          {/* Columna del día */}
          <div
            className={cn(
              'relative flex-1 rounded-lg overflow-hidden',
              isToday && 'bg-primary/[0.02]'
            )}
            style={{ height: GRID_HEIGHT }}
          >
            <TimeGridLines />
            <DropCells date={currentDate} />
            {isToday && <CurrentTimeLine />}
            {dayApts.map(apt => renderAptDay(apt))}
          </div>
        </div>
      </div>
    );
  };

  // ── Vista Semana ──────────────────────────────────────────────────────────
  const renderWeekView = () => (
    <div className="overflow-x-auto mt-2">
      <div className="min-w-[640px]">
        {/* Header de días — sticky */}
        <div className="flex gap-0 mb-0 pl-12 border-b border-border/40 pb-2">
          {weekDaysArray.map(day => (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 text-center py-1 rounded-t-lg',
                isSameDay(day, new Date()) && 'bg-primary/10'
              )}
            >
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div className={cn(
                'text-base font-semibold leading-tight',
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
          className="overflow-y-auto max-h-[520px]"
          style={{ scrollbarGutter: 'stable' }}
        >
          <div className="flex gap-0">
            <TimeLabels />

            {weekDaysArray.map(day => {
              const dayApts = getAppointmentsForDate(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'relative flex-1 border-l border-border/25',
                    isToday && 'bg-primary/[0.025]'
                  )}
                  style={{ height: GRID_HEIGHT }}
                >
                  <TimeGridLines />
                  <DropCells date={day} />
                  {isToday && <CurrentTimeLine />}
                  {dayApts.map(apt => renderAptWeek(apt))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Vista Mes ─────────────────────────────────────────────────────────────
  const renderMonthView = () => (
    <div className="mt-2">
      <div className="grid grid-cols-7 mb-1">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="text-center py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {monthWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map(day => {
              const dayApts      = getAppointmentsForDate(day);
              const isOtherMonth = day.getMonth() !== currentDate.getMonth();
              const isToday      = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[76px] p-1 rounded-lg border',
                    isOtherMonth ? 'opacity-35 border-border/20' : 'border-border/30',
                    isToday && 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                  )}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day, 9 * 60)}
                >
                  <div className={cn(
                    'text-sm font-semibold mb-1 leading-none',
                    isToday && 'text-primary'
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayApts.slice(0, 3).map(apt => (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, apt)}
                        onClick={() => handleAppointmentClick(apt)}
                        data-testid={`appointment-${apt.id}`}
                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:brightness-95 transition-all"
                        style={{
                          backgroundColor: `${apt.doctor_color}20`,
                          color:            apt.doctor_color,
                          borderLeft:      `2px solid ${apt.doctor_color}`,
                        }}
                      >
                        {apt.hora_inicio} {apt.paciente_nombre?.split(' ')[0]}
                      </div>
                    ))}
                    {dayApts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayApts.length - 3} más
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

  // ── Render principal ──────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-6" data-testid="calendar-page">

        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Calendario</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona las citas · Slot por defecto: <strong>{clinicConfig.slot_duration} min</strong> · Arrastra para mover
            </p>
          </div>

          {/* Dialog nueva cita */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-appointment-btn">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cita
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Agendar Nueva Cita</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">

                {/* Paciente */}
                <div className="space-y-2">
                  <Label>Paciente *</Label>
                  <Select value={newApt.paciente_id} onValueChange={v => setNewApt({ ...newApt, paciente_id: v })}>
                    <SelectTrigger data-testid="apt-patient-select">
                      <SelectValue placeholder="Seleccionar paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre} {p.apellido}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Doctor */}
                <div className="space-y-2">
                  <Label>Doctor *</Label>
                  <Select value={newApt.doctor_id} onValueChange={v => setNewApt({ ...newApt, doctor_id: v })}>
                    <SelectTrigger data-testid="apt-doctor-select">
                      <SelectValue placeholder="Seleccionar doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                            {d.nombre}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fecha */}
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal', !newApt.fecha && 'text-muted-foreground')}
                        data-testid="apt-date-btn"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newApt.fecha ? format(new Date(newApt.fecha), 'PPP', { locale: es }) : 'Seleccionar fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newApt.fecha ? new Date(newApt.fecha) : undefined}
                        onSelect={(date) => {
                          if (date) { setNewApt({ ...newApt, fecha: format(date, 'yyyy-MM-dd') }); setCalendarOpen(false); }
                        }}
                        locale={es}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Hora inicio + Duración */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora Inicio *</Label>
                    <Select value={newApt.hora_inicio} onValueChange={v => setNewApt({ ...newApt, hora_inicio: v })}>
                      <SelectTrigger data-testid="apt-start-time">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map(slot => (
                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duración *</Label>
                    <Select value={newApt.duracion.toString()} onValueChange={v => setNewApt({ ...newApt, duracion: parseInt(v) })}>
                      <SelectTrigger data-testid="apt-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                            {opt.value === clinicConfig.slot_duration && (
                              <span className="ml-2 text-[10px] text-muted-foreground">(default)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview hora fin */}
                <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Hora fin:</span>
                  <span className="font-semibold">{calcEndTime(newApt.hora_inicio, newApt.duracion)}</span>
                  <span className="text-muted-foreground ml-auto">{newApt.duracion} min</span>
                </div>

                {/* Motivo */}
                <div className="space-y-2">
                  <Label>Motivo *</Label>
                  <Input
                    placeholder="Ej: Limpieza, revisión, extracción..."
                    value={newApt.motivo}
                    onChange={(e) => setNewApt({ ...newApt, motivo: e.target.value })}
                    data-testid="apt-motivo"
                  />
                </div>

                {/* Notas */}
                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    placeholder="Notas adicionales..."
                    value={newApt.notas}
                    onChange={(e) => setNewApt({ ...newApt, notas: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleCreateAppointment} data-testid="save-appointment-btn">
                    Agendar Cita
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Card del calendario */}
        <Card className="bg-card border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Tabs de vista */}
              <div className="flex bg-muted rounded-lg p-1 w-fit">
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

              {/* Navegación */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => navigateCalendar('prev')} data-testid="calendar-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium capitalize min-w-[200px] text-center">
                  {getDateRange()}
                </span>
                <Button variant="outline" size="icon" onClick={() => navigateCalendar('next')} data-testid="calendar-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {Object.entries(APPOINTMENT_STATES).map(([key, { label, color }]) => (
                <Badge key={key} variant="outline" className={cn('text-xs', color)}>{label}</Badge>
              ))}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-2">
                <GripVertical className="h-3 w-3" /> Arrastra para mover
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {view === 'day'   && renderDayView()}
            {view === 'week'  && renderWeekView()}
            {view === 'month' && renderMonthView()}
          </CardContent>
        </Card>

        {/* Sheet detalles de cita */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Detalles de la Cita</SheetTitle>
            </SheetHeader>
            {selectedAppointment && (
              <div className="mt-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{selectedAppointment.paciente_nombre}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {selectedAppointment.fecha} · {selectedAppointment.hora_inicio} – {selectedAppointment.hora_fin}
                      </span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {calcDuration(selectedAppointment.hora_inicio, selectedAppointment.hora_fin)} min
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAppointment.doctor_color }} />
                      <span>{selectedAppointment.doctor_nombre}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Motivo</p>
                    <p className="font-medium">{selectedAppointment.motivo}</p>
                  </div>
                  <Badge className={APPOINTMENT_STATES[selectedAppointment.estado]?.color}>
                    {APPOINTMENT_STATES[selectedAppointment.estado]?.label}
                  </Badge>

                  {/* Alertas médicas */}
                  {(() => {
                    const patient = patients.find(p => p.id === selectedAppointment.paciente_id);
                    if (!patient?.alertas_medicas?.length) return null;
                    return (
                      <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium text-sm">Alertas Médicas</span>
                        </div>
                        <ul className="space-y-1">
                          {patient.alertas_medicas.map((alerta, i) => (
                            <li key={i} className="text-sm text-rose-700 dark:text-rose-300">
                              · {alerta.descripcion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Button className="w-full" onClick={() => handleViewPatient(selectedAppointment)} data-testid="view-patient-btn">
                    <User className="h-4 w-4 mr-2" /> Ver Expediente Completo
                  </Button>
                  {selectedAppointment.estado !== 'cancelada' && (
                    <Button
                      variant="outline"
                      className="w-full text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                      onClick={() => handleCancelAppointment(selectedAppointment)}
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Cancelar Cita
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleDeleteAppointment(selectedAppointment)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Eliminar Cita
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setSheetOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
};
