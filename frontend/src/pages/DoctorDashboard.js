import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { PatientCard } from '../components/PatientCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { APPOINTMENT_STATES } from '../utils/mockData';
import {
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Find the doctor profile matching the logged-in user's email
        const [doctorsRes, patientsRes] = await Promise.all([
          axios.get(`${API}/doctors`),
          axios.get(`${API}/patients`, { params: { limit: 200 } }),
        ]);

        const allDoctors = doctorsRes.data;
        const doctor = allDoctors.find(d => d.email === user?.email);
        setDoctorProfile(doctor || null);
        setPatients(patientsRes.data);

        if (doctor) {
          const aptsRes = await axios.get(`${API}/appointments`, {
            params: { fecha: today, doctor_id: doctor.id, limit: 100 },
          });
          setAppointments(aptsRes.data);
        }
      } catch (err) {
        console.error('Error fetching doctor dashboard data', err);
        toast.error('Error al cargar el panel');
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [today, user]);

  const handleUpdateStatus = async (aptId, newStatus) => {
    try {
      await axios.put(`${API}/appointments/${aptId}/status`, null, {
        params: { estado: newStatus },
      });
      setAppointments(prev =>
        prev.map(a => a.id === aptId ? { ...a, estado: newStatus } : a)
      );
      const statusLabel = APPOINTMENT_STATES[newStatus]?.label || newStatus;
      toast.success(`Cita actualizada: ${statusLabel}`);
    } catch (err) {
      toast.error('Error al actualizar el estado de la cita');
    }
  };

  const handleViewPatient = (data) => {
    const patientId = data?.paciente_id || data?.id;
    navigate(`/patients/${patientId}`);
  };

  const getPatientForAppointment = (apt) => {
    return patients.find(p => p.id === apt.paciente_id);
  };

  const currentPending   = appointments.filter(a => a.estado === 'confirmada');
  const currentInWaiting = appointments.filter(a => a.estado === 'en_sala');
  const currentCompleted = appointments.filter(a => a.estado === 'atendido');
  const currentCancelled = appointments.filter(a => a.estado === 'cancelada');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando panel...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="doctor-dashboard">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Mi Panel</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenido, {user?.nombre}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* No doctor profile linked */}
        {!doctorProfile && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
            <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-400">
              No se encontró un perfil de doctor vinculado a tu cuenta ({user?.email}).
              Pide al administrador que cree un perfil de doctor con el mismo correo.
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currentPending.length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currentInWaiting.length}</p>
                <p className="text-xs text-muted-foreground">En Sala</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currentCompleted.length}</p>
                <p className="text-xs text-muted-foreground">Atendidos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currentCancelled.length}</p>
                <p className="text-xs text-muted-foreground">Canceladas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Kanban Style */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all" data-testid="tab-all">
              Todas ({appointments.length})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pendientes ({currentPending.length})
            </TabsTrigger>
            <TabsTrigger value="waiting" data-testid="tab-waiting">
              En Sala ({currentInWaiting.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Atendidos ({currentCompleted.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {appointments.map(apt => (
                <PatientCard
                  key={apt.id}
                  appointment={apt}
                  patient={getPatientForAppointment(apt)}
                  onViewPatient={handleViewPatient}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
              {appointments.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tienes citas programadas para hoy</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pending">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentPending.map(apt => (
                <PatientCard
                  key={apt.id}
                  appointment={apt}
                  patient={getPatientForAppointment(apt)}
                  onViewPatient={handleViewPatient}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
              {currentPending.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <p>No hay citas pendientes</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="waiting">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentInWaiting.map(apt => (
                <PatientCard
                  key={apt.id}
                  appointment={apt}
                  patient={getPatientForAppointment(apt)}
                  onViewPatient={handleViewPatient}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
              {currentInWaiting.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <p>No hay pacientes en sala de espera</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentCompleted.map(apt => (
                <PatientCard
                  key={apt.id}
                  appointment={apt}
                  patient={getPatientForAppointment(apt)}
                  onViewPatient={handleViewPatient}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
              {currentCompleted.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <p>No has atendido pacientes hoy</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Action - Next Patient */}
        {currentInWaiting.length > 0 && (
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Siguiente Paciente</h3>
                  <p className="text-muted-foreground">
                    {currentInWaiting[0].paciente_nombre} - {currentInWaiting[0].motivo}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleViewPatient(currentInWaiting[0])}
                  >
                    Ver Expediente
                  </Button>
                  <Button onClick={() => handleUpdateStatus(currentInWaiting[0].id, 'atendido')}>
                    Marcar como Atendido
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};
