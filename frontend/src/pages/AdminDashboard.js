import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { KPICard } from '../components/KPICard';
import { CalendarWidget } from '../components/CalendarWidget';
import { DoctorWidget } from '../components/DoctorWidget';
import { PatientCard } from '../components/PatientCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { APPOINTMENT_STATES } from '../utils/mockData';
import {
  Users,
  DollarSign,
  CalendarCheck,
  CalendarX,
  UserPlus,
  Clock,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

import { API } from '@/lib/api';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [kpis, setKpis] = useState({ pacientes_hoy: 0, ingresos_mes: 0, citas_completadas: 0, citas_canceladas: 0, nuevos_pacientes: 0 });
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [kpisRes, doctorsRes, aptsRes, patientsRes] = await Promise.all([
          axios.get(`${API}/dashboard/kpis`),
          axios.get(`${API}/doctors`),
          axios.get(`${API}/appointments`, { params: { fecha: today, limit: 100 } }),
          axios.get(`${API}/patients`, { params: { limit: 200 } }),
        ]);
        setKpis(kpisRes.data);
        setDoctors(doctorsRes.data);
        setAppointments(aptsRes.data);
        setPatients(patientsRes.data);
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      }
    };
    fetchAll();
  }, [today]);

  const todayAppointments = appointments;

  const handleAppointmentClick = (apt) => {
    setSelectedAppointment(apt);
    setSheetOpen(true);
  };

  const handleViewPatient = (patient) => {
    const patientId = patient?.paciente_id || patient?.id;
    navigate(`/patients/${patientId}`);
  };

  const getPatientForAppointment = (apt) => {
    return patients.find(p => p.id === apt.paciente_id);
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-dashboard">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visión general de Dentu
            </p>
          </div>
          <Button onClick={() => navigate('/calendar')} data-testid="go-to-calendar">
            Ver Calendario Completo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title="Pacientes Hoy"
            value={kpis.pacientes_hoy}
            icon={Users}
            trend="up"
            trendValue=""
            subtitle="citas agendadas"
          />
          <KPICard
            title="Ingresos del Mes"
            value={`$${kpis.ingresos_mes.toLocaleString()}`}
            icon={DollarSign}
            trend="up"
            trendValue=""
            subtitle="estimado"
          />
          <KPICard
            title="Citas Completadas"
            value={kpis.citas_completadas}
            icon={CalendarCheck}
            trend="up"
            trendValue=""
            subtitle="este mes"
          />
          <KPICard
            title="Citas Canceladas"
            value={kpis.citas_canceladas}
            icon={CalendarX}
            trend="down"
            trendValue=""
            subtitle="este mes"
          />
          <KPICard
            title="Nuevos Pacientes"
            value={kpis.nuevos_pacientes}
            icon={UserPlus}
            trend="up"
            trendValue=""
            subtitle="este mes"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Calendar - Takes most space */}
          <div className="lg:col-span-8">
            <CalendarWidget
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
            />
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Active Doctors */}
            <DoctorWidget doctors={doctors} />

            {/* Today's Queue */}
            <Card className="bg-card border border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Cola de Hoy</CardTitle>
                  <Badge variant="secondary">{todayAppointments.length} citas</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
                {todayAppointments.map(apt => (
                  <PatientCard
                    key={apt.id}
                    appointment={apt}
                    patient={getPatientForAppointment(apt)}
                    onViewPatient={handleViewPatient}
                    compact
                  />
                ))}
                {todayAppointments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay citas programadas para hoy
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Appointment Details Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Detalles de la Cita</SheetTitle>
            </SheetHeader>

            {selectedAppointment && (
              <div className="mt-6 space-y-6">
                {/* Patient Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{selectedAppointment.paciente_nombre}</h3>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedAppointment.hora_inicio} - {selectedAppointment.hora_fin}</span>
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

                  {/* Patient Alerts */}
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

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSheetOpen(false);
                      handleViewPatient(selectedAppointment);
                    }}
                    data-testid="view-patient-btn"
                  >
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
