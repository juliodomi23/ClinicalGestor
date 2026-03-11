import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { Odontogram } from '../components/Odontogram';
import { NotesTimeline } from '../components/NotesTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  AlertTriangle,
  FileImage,
  Plus,
  Clock,
  ExternalLink,
  Cake
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const PatientDetail = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [teethData, setTeethData] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [patientRes, aptsRes, notesRes, odontogramRes] = await Promise.all([
          axios.get(`${API}/patients/${patientId}`),
          axios.get(`${API}/appointments`, { params: { limit: 200 } }),
          axios.get(`${API}/patients/${patientId}/notas`),
          axios.get(`${API}/patients/${patientId}/odontogram`),
        ]);
        setPatient(patientRes.data);
        setPatientAppointments(aptsRes.data.filter(a => a.paciente_id === patientId));
        setNotes(notesRes.data);
        setTeethData(odontogramRes.data.dientes || []);
      } catch (err) {
        if (err.response?.status === 404) {
          setPatient(null);
        } else {
          toast.error('Error al cargar datos del paciente');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [patientId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Cargando expediente...</p>
        </div>
      </Layout>
    );
  }

  if (!patient) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Paciente no encontrado</h2>
          <p className="text-muted-foreground mb-4">El paciente solicitado no existe en el sistema.</p>
          <Button onClick={() => navigate('/patients')}>Ver todos los pacientes</Button>
        </div>
      </Layout>
    );
  }

  const handleAddNote = async (noteData) => {
    try {
      const res = await axios.post(`${API}/patients/${patientId}/notas`, {
        paciente_id: patientId,
        contenido: noteData.contenido,
        tags: noteData.tags,
      });
      setNotes([res.data, ...notes]);
      toast.success('Nota clínica agregada');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al agregar nota');
    }
  };

  const handleOdontogramUpdate = async (update) => {
    // Optimistic update
    setTeethData(prev => {
      const existing = prev.find(t => t.numero === update.diente_numero);
      if (existing) {
        return prev.map(t =>
          t.numero === update.diente_numero
            ? { ...t, zonas: { ...t.zonas, [update.zona]: update.estado } }
            : t
        );
      } else {
        return [...prev, {
          numero: update.diente_numero,
          zonas: { [update.zona]: update.estado }
        }];
      }
    });
    try {
      await axios.put(`${API}/patients/${patientId}/odontogram`, update);
      toast.success('Odontograma actualizado');
    } catch (err) {
      toast.error('Error al guardar odontograma');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'P';
  };

  const formatDate = (dateStr) => {
    return format(new Date(dateStr), "d 'de' MMMM, yyyy", { locale: es });
  };

  const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Sort appointments by date
  const sortedAppointments = [...patientAppointments].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  );
  const pastAppointments = sortedAppointments.filter(a => new Date(a.fecha) < new Date());
  const futureAppointments = sortedAppointments.filter(a => new Date(a.fecha) >= new Date());

  return (
    <Layout>
      <div className="space-y-6" data-testid="patient-detail">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-2"
          data-testid="back-btn"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {/* Patient Header */}
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar & Basic Info */}
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 border-4 border-primary/20">
                  <AvatarImage src={patient.avatar_url} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(`${patient.nombre} ${patient.apellido}`)}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {patient.nombre} {patient.apellido}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                    <Cake className="h-4 w-4" />
                    <span>{formatDate(patient.fecha_nacimiento)} ({calculateAge(patient.fecha_nacimiento)} años)</span>
                  </div>
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 md:pl-6 md:border-l border-border">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{patient.telefono}</span>
                </div>
                {patient.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{patient.email}</span>
                  </div>
                )}
                {patient.direccion && (
                  <div className="flex items-center gap-2 text-sm col-span-full">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{patient.direccion}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Medical Alerts */}
            {patient.alertas_medicas?.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">Alertas Médicas</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patient.alertas_medicas.map((alerta, idx) => (
                    <Badge 
                      key={idx} 
                      variant="destructive"
                      className="text-sm"
                    >
                      {alerta.tipo}: {alerta.descripcion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="odontograma" className="w-full">
          <TabsList className="mb-4 w-full justify-start overflow-x-auto">
            <TabsTrigger value="odontograma" data-testid="tab-odontograma">Odontograma</TabsTrigger>
            <TabsTrigger value="notas" data-testid="tab-notas">Notas Clínicas</TabsTrigger>
            <TabsTrigger value="citas" data-testid="tab-citas">Historial de Citas</TabsTrigger>
            <TabsTrigger value="archivos" data-testid="tab-archivos">Radiografías y Archivos</TabsTrigger>
          </TabsList>
          
          {/* Odontogram Tab */}
          <TabsContent value="odontograma">
            <Odontogram 
              teethData={teethData} 
              onUpdate={handleOdontogramUpdate}
            />
          </TabsContent>
          
          {/* Clinical Notes Tab */}
          <TabsContent value="notas">
            <NotesTimeline 
              notes={notes} 
              onAddNote={handleAddNote}
            />
          </TabsContent>
          
          {/* Appointments Tab */}
          <TabsContent value="citas">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Historial de Citas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Future Appointments */}
                {futureAppointments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Próximas Citas</h3>
                    <div className="space-y-3">
                      {futureAppointments.map(apt => (
                        <div 
                          key={apt.id} 
                          className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20"
                        >
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{apt.motivo}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(apt.fecha)} • {apt.hora_inicio} - {apt.hora_fin}
                            </p>
                            <p className="text-sm text-muted-foreground">{apt.doctor_nombre}</p>
                          </div>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            Programada
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Past Appointments */}
                {pastAppointments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Citas Anteriores</h3>
                    <div className="space-y-3">
                      {pastAppointments.map(apt => (
                        <div 
                          key={apt.id} 
                          className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="p-2 rounded-lg bg-muted">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{apt.motivo}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(apt.fecha)} • {apt.hora_inicio}
                            </p>
                            <p className="text-sm text-muted-foreground">{apt.doctor_nombre}</p>
                          </div>
                          <Badge variant="outline" className={
                            apt.estado === 'atendido' 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-rose-100 text-rose-700 border-rose-300'
                          }>
                            {apt.estado === 'atendido' ? 'Completada' : 'Cancelada'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {patientAppointments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay citas registradas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Files Tab */}
          <TabsContent value="archivos">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Radiografías y Archivos</CardTitle>
                  <Button size="sm" disabled>
                    <Plus className="h-4 w-4 mr-1" />
                    Subir Archivo
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Integración con Google Drive próximamente disponible
                </p>
              </CardHeader>
              <CardContent>
                {false ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[].map(file => (
                      <Dialog key={file.id}>
                        <DialogTrigger asChild>
                          <div 
                            className="group relative aspect-square rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary/50 transition-colors"
                            data-testid={`file-${file.id}`}
                          >
                            <img 
                              src={file.url} 
                              alt={file.nombre}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <p className="text-white text-sm font-medium truncate">{file.nombre}</p>
                                <p className="text-white/70 text-xs">{formatDate(file.fecha)}</p>
                              </div>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>{file.nombre}</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4">
                            <img 
                              src={file.url} 
                              alt={file.nombre}
                              className="w-full rounded-lg"
                            />
                            {file.descripcion && (
                              <p className="mt-4 text-muted-foreground">{file.descripcion}</p>
                            )}
                            <p className="mt-2 text-sm text-muted-foreground">
                              Fecha: {formatDate(file.fecha)}
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay archivos registrados</p>
                    <p className="text-sm mt-1">Los archivos aparecerán aquí cuando se suba alguno</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};
