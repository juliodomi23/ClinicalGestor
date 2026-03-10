import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import { mockAppointments, mockPatients, mockDoctors, APPOINTMENT_STATES } from '../utils/mockData';
import { 
  Clock, 
  AlertTriangle, 
  User, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  CalendarIcon,
  GripVertical
} from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, eachWeekOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const VIEW_TYPES = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const TIME_SLOTS = [];
for (let h = 8; h < 20; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
}

// Duration options in minutes
const DURATION_OPTIONS = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1 hora 30 min' },
  { value: 120, label: '2 horas' },
  { value: 150, label: '2 horas 30 min' },
  { value: 180, label: '3 horas' },
];

export const CalendarPage = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [appointments, setAppointments] = useState(mockAppointments);
  const [patients] = useState(mockPatients);
  const [doctors] = useState(mockDoctors.filter(d => d.activo));
  
  // Sheet for appointment details
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  // Dialog for new appointment
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newApt, setNewApt] = useState({
    paciente_id: '',
    doctor_id: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    duracion: 30, // duration in minutes
    motivo: '',
    notas: '',
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Drag state
  const [draggedApt, setDraggedApt] = useState(null);

  const navigate_calendar = (direction) => {
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

  const weekDays = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDaysArray = eachDayOfInterval({ 
    start: weekDays, 
    end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
  });

  const monthWeeks = (() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    return weeks.map(weekStart => eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(weekStart, { weekStartsOn: 1 })
    }));
  })();

  const getAppointmentsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(apt => apt.fecha === dateStr);
  };

  const handleAppointmentClick = (apt) => {
    setSelectedAppointment(apt);
    setSheetOpen(true);
  };

  const handleViewPatient = (apt) => {
    setSheetOpen(false);
    navigate(`/patients/${apt.paciente_id}`);
  };

  const getPatientForAppointment = (apt) => {
    return patients.find(p => p.id === apt.paciente_id);
  };

  // Create appointment
  const handleCreateAppointment = () => {
    if (!newApt.paciente_id || !newApt.doctor_id || !newApt.motivo) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    const patient = patients.find(p => p.id === newApt.paciente_id);
    const doctor = doctors.find(d => d.id === newApt.doctor_id);
    const hora_fin = calculateEndTime(newApt.hora_inicio, newApt.duracion);

    const newAppointment = {
      id: `apt-${Date.now()}`,
      paciente_id: newApt.paciente_id,
      doctor_id: newApt.doctor_id,
      fecha: newApt.fecha,
      hora_inicio: newApt.hora_inicio,
      hora_fin: hora_fin,
      motivo: newApt.motivo,
      notas: newApt.notas,
      estado: 'confirmada',
      paciente_nombre: `${patient?.nombre} ${patient?.apellido}`,
      doctor_nombre: doctor?.nombre,
      doctor_color: doctor?.color || '#0ea5e9',
    };

    setAppointments(prev => [...prev, newAppointment]);
    toast.success(`Cita creada: ${newApt.hora_inicio} - ${hora_fin}`);
    setIsCreateOpen(false);
    setNewApt({
      paciente_id: '',
      doctor_id: '',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      hora_inicio: '09:00',
      duracion: 30,
      motivo: '',
      notas: '',
    });
  };

  // Calculate end time based on start and duration
  const calculateEndTime = (startTime, durationMinutes) => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  // Drag and drop handlers
  const handleDragStart = (e, apt) => {
    setDraggedApt(apt);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, date, hour) => {
    e.preventDefault();
    if (!draggedApt) return;

    const newDate = format(date, 'yyyy-MM-dd');
    const newStartTime = `${hour.toString().padStart(2, '0')}:00`;
    const newEndTime = calculateEndTime(newStartTime, 30); // Default 30 min when dragging

    setAppointments(prev => prev.map(apt => 
      apt.id === draggedApt.id 
        ? { ...apt, fecha: newDate, hora_inicio: newStartTime, hora_fin: newEndTime }
        : apt
    ));

    toast.success(`Cita movida a ${format(date, 'd MMM', { locale: es })} ${newStartTime}`);
    setDraggedApt(null);
  };

  const renderAppointment = (apt, isDraggable = true) => (
    <div
      key={apt.id}
      draggable={isDraggable}
      onDragStart={(e) => handleDragStart(e, apt)}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium truncate cursor-pointer hover:opacity-80 transition-all border-l-4",
        APPOINTMENT_STATES[apt.estado]?.color || 'bg-slate-100',
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
      style={{ borderLeftColor: apt.doctor_color }}
      onClick={() => handleAppointmentClick(apt)}
      data-testid={`appointment-${apt.id}`}
    >
      <div className="flex items-center gap-1">
        {isDraggable && <GripVertical className="h-3 w-3 opacity-50" />}
        <span className="font-semibold truncate">{apt.paciente_nombre?.split(' ')[0]}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-80">
        <Clock className="h-3 w-3" />
        {apt.hora_inicio}
      </div>
    </div>
  );

  const renderDayView = () => (
    <div className="space-y-1 max-h-[500px] overflow-y-auto">
      {HOURS.map(hour => {
        const hourAppointments = getAppointmentsForDate(currentDate).filter(apt => {
          const aptHour = parseInt(apt.hora_inicio.split(':')[0]);
          return aptHour === hour;
        });
        
        return (
          <div 
            key={hour} 
            className="flex gap-2 min-h-[60px] border-b border-border/50 py-1"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, currentDate, hour)}
          >
            <div className="w-16 text-xs text-muted-foreground pt-1 flex-shrink-0">
              {`${hour}:00`}
            </div>
            <div className="flex-1 space-y-1">
              {hourAppointments.map(apt => renderAppointment(apt))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="w-14" /> {/* Time column spacer */}
          {weekDaysArray.map(day => (
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
        <div className="space-y-0 max-h-[450px] overflow-y-auto">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 gap-1">
              <div className="w-14 text-xs text-muted-foreground py-1 text-right pr-2">
                {`${hour}:00`}
              </div>
              {weekDaysArray.map(day => {
                const dayAppointments = getAppointmentsForDate(day).filter(apt => {
                  const aptHour = parseInt(apt.hora_inicio.split(':')[0]);
                  return aptHour === hour;
                });
                
                return (
                  <div
                    key={day.toISOString()}
                    className="min-h-[50px] border border-border/30 rounded p-1 bg-muted/20 hover:bg-muted/40 transition-colors"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day, hour)}
                  >
                    {dayAppointments.map(apt => (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, apt)}
                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-grab active:cursor-grabbing hover:opacity-80"
                        style={{ 
                          backgroundColor: `${apt.doctor_color}20`,
                          borderLeft: `3px solid ${apt.doctor_color}`,
                        }}
                        onClick={() => handleAppointmentClick(apt)}
                        title={`${apt.paciente_nombre} - ${apt.motivo}`}
                        data-testid={`appointment-${apt.id}`}
                      >
                        <GripVertical className="h-2 w-2 inline opacity-50" />
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
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day, 9)}
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
                        draggable
                        onDragStart={(e) => handleDragStart(e, apt)}
                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-grab"
                        style={{ 
                          backgroundColor: `${apt.doctor_color}20`,
                          color: apt.doctor_color,
                        }}
                        onClick={() => handleAppointmentClick(apt)}
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
    <Layout>
      <div className="space-y-6" data-testid="calendar-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Calendario</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona todas las citas de Dentu • Arrastra y suelta para mover citas
            </p>
          </div>
          
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
                {/* Patient Select */}
                <div className="space-y-2">
                  <Label>Paciente *</Label>
                  <Select 
                    value={newApt.paciente_id} 
                    onValueChange={(v) => setNewApt({...newApt, paciente_id: v})}
                  >
                    <SelectTrigger data-testid="apt-patient-select">
                      <SelectValue placeholder="Seleccionar paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} {p.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Doctor Select */}
                <div className="space-y-2">
                  <Label>Doctor *</Label>
                  <Select 
                    value={newApt.doctor_id} 
                    onValueChange={(v) => setNewApt({...newApt, doctor_id: v})}
                  >
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

                {/* Date */}
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newApt.fecha && "text-muted-foreground"
                        )}
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
                          if (date) {
                            setNewApt({...newApt, fecha: format(date, 'yyyy-MM-dd')});
                            setCalendarOpen(false);
                          }
                        }}
                        locale={es}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora Inicio *</Label>
                    <Select 
                      value={newApt.hora_inicio}
                      onValueChange={(v) => setNewApt({...newApt, hora_inicio: v})}
                    >
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
                    <Select 
                      value={newApt.duracion.toString()}
                      onValueChange={(v) => setNewApt({...newApt, duracion: parseInt(v)})}
                    >
                      <SelectTrigger data-testid="apt-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Preview end time */}
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  Hora fin: <span className="font-medium">{calculateEndTime(newApt.hora_inicio, newApt.duracion)}</span>
                </div>

                {/* Motivo */}
                <div className="space-y-2">
                  <Label>Motivo de la Consulta *</Label>
                  <Input
                    placeholder="Ej: Limpieza dental, revisión, extracción..."
                    value={newApt.motivo}
                    onChange={(e) => setNewApt({...newApt, motivo: e.target.value})}
                    data-testid="apt-motivo"
                  />
                </div>

                {/* Notas */}
                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    placeholder="Notas adicionales..."
                    value={newApt.notas}
                    onChange={(e) => setNewApt({...newApt, notas: e.target.value})}
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={handleCreateAppointment} data-testid="save-appointment-btn">
                    Agendar Cita
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Calendar Card */}
        <Card className="bg-card border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              
              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => navigate_calendar('prev')} data-testid="calendar-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium capitalize min-w-[200px] text-center">{getDateRange()}</span>
                <Button variant="outline" size="icon" onClick={() => navigate_calendar('next')} data-testid="calendar-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-4">
                <GripVertical className="h-3 w-3" />
                <span>Arrastra para mover</span>
              </div>
            </div>
            
            {view === 'day' && renderDayView()}
            {view === 'week' && renderWeekView()}
            {view === 'month' && renderMonthView()}
          </CardContent>
        </Card>

        {/* Appointment Details Sheet */}
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
                      <span>{selectedAppointment.fecha} • {selectedAppointment.hora_inicio} - {selectedAppointment.hora_fin}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: selectedAppointment.doctor_color }}
                      />
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
                  
                  {(() => {
                    const patient = getPatientForAppointment(selectedAppointment);
                    if (patient?.alertas_medicas?.length > 0) {
                      return (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
                          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-medium text-sm">Alertas Médicas</span>
                          </div>
                          <ul className="space-y-1">
                            {patient.alertas_medicas.map((alerta, idx) => (
                              <li key={idx} className="text-sm text-rose-700 dark:text-rose-300">
                                • {alerta.descripcion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => handleViewPatient(selectedAppointment)}
                    data-testid="view-patient-btn"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Ver Expediente Completo
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
