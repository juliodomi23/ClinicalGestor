import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { APPOINTMENT_STATES } from '../utils/mockData';
import { Clock, MoreVertical, User, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export const PatientCard = ({ 
  appointment, 
  patient,
  onViewPatient, 
  onUpdateStatus,
  compact = false 
}) => {
  const state = APPOINTMENT_STATES[appointment?.estado] || APPOINTMENT_STATES.confirmada;
  const hasAlerts = patient?.alertas_medicas?.length > 0;

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'P';
  };

  if (compact) {
    return (
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors cursor-pointer",
          hasAlerts && "border-l-4 border-l-rose-500"
        )}
        onClick={() => onViewPatient?.(patient || appointment)}
        data-testid={`patient-card-${appointment?.id || patient?.id}`}
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={patient?.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {getInitials(appointment?.paciente_nombre || `${patient?.nombre} ${patient?.apellido}`)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {appointment?.paciente_nombre || `${patient?.nombre} ${patient?.apellido}`}
          </p>
          {appointment && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{appointment.hora_inicio}</span>
              <span className="truncate">{appointment.motivo}</span>
            </div>
          )}
        </div>
        
        {hasAlerts && (
          <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
        )}
        
        {appointment && (
          <Badge variant="outline" className={cn("text-xs flex-shrink-0", state.color)}>
            {state.label}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "p-4 rounded-xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all",
        hasAlerts && "border-l-4 border-l-rose-500"
      )}
      data-testid={`patient-card-${appointment?.id || patient?.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={patient?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(appointment?.paciente_nombre || `${patient?.nombre} ${patient?.apellido}`)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <p className="font-semibold">
              {appointment?.paciente_nombre || `${patient?.nombre} ${patient?.apellido}`}
            </p>
            {appointment && (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{appointment.hora_inicio} - {appointment.hora_fin}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{appointment.motivo}</p>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {appointment && (
            <Badge variant="outline" className={cn("text-xs", state.color)}>
              {state.label}
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="patient-menu-btn">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewPatient?.(patient || appointment)}>
                <User className="mr-2 h-4 w-4" />
                Ver Expediente
              </DropdownMenuItem>
              {appointment && onUpdateStatus && (
                <>
                  <DropdownMenuItem onClick={() => onUpdateStatus(appointment.id, 'en_sala')}>
                    En Sala de Espera
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateStatus(appointment.id, 'atendido')}>
                    Marcar Atendido
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onUpdateStatus(appointment.id, 'cancelada')}
                    className="text-destructive"
                  >
                    Cancelar Cita
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Medical Alerts */}
      {hasAlerts && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex flex-wrap gap-2">
            {patient.alertas_medicas.map((alerta, idx) => (
              <Badge 
                key={idx} 
                variant="destructive" 
                className="text-xs"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {alerta.descripcion}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Doctor info if from appointment */}
      {appointment?.doctor_nombre && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: appointment.doctor_color }}
          />
          <span className="text-xs text-muted-foreground">{appointment.doctor_nombre}</span>
        </div>
      )}
    </div>
  );
};
