import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { cn } from '../lib/utils';

export const DoctorWidget = ({ doctors = [] }) => {
  const activeDoctors = doctors.filter(d => d.activo);
  const maxCitas = Math.max(...doctors.map(d => d.citas_hoy || 0), 10);

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'DR';
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm" data-testid="doctor-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Doctores en Turno</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {activeDoctors.length} activos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {doctors.map(doctor => (
          <div
            key={doctor.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
              doctor.activo 
                ? "bg-muted/50 hover:bg-muted" 
                : "opacity-50"
            )}
            data-testid={`doctor-${doctor.id}`}
          >
            <div className="relative">
              <Avatar className="h-11 w-11 border-2" style={{ borderColor: doctor.color }}>
                <AvatarImage src={doctor.avatar_url} alt={doctor.nombre} />
                <AvatarFallback style={{ backgroundColor: `${doctor.color}20`, color: doctor.color }}>
                  {getInitials(doctor.nombre)}
                </AvatarFallback>
              </Avatar>
              {doctor.activo && (
                <span 
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card bg-emerald-500"
                  title="En línea"
                />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm truncate">{doctor.nombre}</p>
                <span className="text-xs text-muted-foreground ml-2">
                  {doctor.citas_hoy || 0} citas
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{doctor.especialidad}</p>
              
              {doctor.activo && (
                <div className="mt-2">
                  <Progress 
                    value={(doctor.citas_hoy || 0) / maxCitas * 100} 
                    className="h-1.5"
                    style={{ '--progress-color': doctor.color }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        
        {doctors.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No hay doctores registrados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
