import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { Search, Plus, Users, AlertTriangle, Pencil, X, Trash2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default avatar for patients without photos
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&blur=20';

export const PatientsPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API}/patients`, { params: { limit: 200 } });
      setPatients(res.data);
    } catch (err) {
      toast.error('Error al cargar pacientes');
    } finally {
      setLoading(false);
    }
  };
  
  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    direccion: '',
    alertas_medicas: [],
  });
  const [newAlerta, setNewAlerta] = useState({ tipo: '', descripcion: '' });

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      fecha_nacimiento: '',
      direccion: '',
      alertas_medicas: [],
    });
    setNewAlerta({ tipo: '', descripcion: '' });
    setEditingPatient(null);
  };

  const handleOpenDialog = (patient = null) => {
    if (patient) {
      setEditingPatient(patient);
      setFormData({
        nombre: patient.nombre,
        apellido: patient.apellido,
        email: patient.email || '',
        telefono: patient.telefono,
        fecha_nacimiento: patient.fecha_nacimiento,
        direccion: patient.direccion || '',
        alertas_medicas: patient.alertas_medicas || [],
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleAddAlerta = () => {
    if (newAlerta.tipo && newAlerta.descripcion) {
      setFormData(prev => ({
        ...prev,
        alertas_medicas: [...prev.alertas_medicas, { ...newAlerta, severidad: 'alta' }]
      }));
      setNewAlerta({ tipo: '', descripcion: '' });
    }
  };

  const handleRemoveAlerta = (index) => {
    setFormData(prev => ({
      ...prev,
      alertas_medicas: prev.alertas_medicas.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.apellido || !formData.telefono || !formData.fecha_nacimiento) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    // Pydantic's EmailStr rejects empty strings — send null instead
    const payload = {
      ...formData,
      email: formData.email || null,
      direccion: formData.direccion || null,
    };

    try {
      if (editingPatient) {
        await axios.put(`${API}/patients/${editingPatient.id}`, payload);
        toast.success('Paciente actualizado correctamente');
      } else {
        await axios.post(`${API}/patients`, payload);
        toast.success('Paciente agregado correctamente');
      }
      await fetchPatients();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg).join(', ')
        : (typeof detail === 'string' ? detail : 'Error al guardar paciente');
      toast.error(msg);
      return;
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDeleteClick = (patient, e) => {
    e.stopPropagation();
    setPatientToDelete(patient);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!patientToDelete) return;
    try {
      await axios.delete(`${API}/patients/${patientToDelete.id}`);
      toast.success(`Paciente ${patientToDelete.nombre} ${patientToDelete.apellido} eliminado`);
      setPatients(prev => prev.filter(p => p.id !== patientToDelete.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar paciente');
    }
    setPatientToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const getInitials = (nombre, apellido) => {
    return `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase();
  };

  const filteredPatients = patients.filter(p => 
    `${p.nombre} ${p.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.telefono.includes(searchTerm) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const patientsWithAlerts = patients.filter(p => p.alertas_medicas?.length > 0);

  return (
    <Layout>
      <div className="space-y-6" data-testid="patients-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pacientes</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona el expediente de tus pacientes
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="add-patient-btn">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Paciente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      placeholder="Juan"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      data-testid="patient-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input
                      id="apellido"
                      placeholder="Pérez López"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      data-testid="patient-lastname-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono *</Label>
                  <Input
                    id="telefono"
                    placeholder="+52 555 123 4567"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    data-testid="patient-phone-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="paciente@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="patient-email-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</Label>
                  <Input
                    id="fecha_nacimiento"
                    type="date"
                    value={formData.fecha_nacimiento}
                    onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                    data-testid="patient-birthdate-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Textarea
                    id="direccion"
                    placeholder="Calle, Número, Colonia, Ciudad"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    rows={2}
                  />
                </div>
                
                {/* Medical Alerts Section */}
                <div className="space-y-3 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
                  <Label className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4" />
                    Alertas Médicas
                  </Label>
                  
                  {/* Existing alerts */}
                  {formData.alertas_medicas.length > 0 && (
                    <div className="space-y-2">
                      {formData.alertas_medicas.map((alerta, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded">
                          <Badge variant="destructive" className="text-xs">
                            {alerta.tipo}
                          </Badge>
                          <span className="text-sm flex-1">{alerta.descripcion}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveAlerta(idx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add new alert */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Tipo (ej: Alergia)"
                      value={newAlerta.tipo}
                      onChange={(e) => setNewAlerta({ ...newAlerta, tipo: e.target.value })}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="Descripción"
                      value={newAlerta.descripcion}
                      onChange={(e) => setNewAlerta({ ...newAlerta, descripcion: e.target.value })}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddAlerta}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" data-testid="save-patient-btn">
                    {editingPatient ? 'Guardar Cambios' : 'Agregar Paciente'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patients.length}</p>
                <p className="text-xs text-muted-foreground">Total Pacientes</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patientsWithAlerts.length}</p>
                <p className="text-xs text-muted-foreground">Con Alertas Médicas</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border/50 col-span-2 md:col-span-1">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="search-patients"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patients List */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {searchTerm ? `Resultados: ${filteredPatients.length}` : 'Todos los Pacientes'}
              </CardTitle>
              {searchTerm && (
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando pacientes...</p>
            ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPatients.map(patient => (
                <div
                  key={patient.id}
                  className="p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/50 transition-colors group"
                  data-testid={`patient-${patient.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar 
                      className="h-12 w-12 cursor-pointer"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <AvatarImage src={patient.avatar_url || DEFAULT_AVATAR} alt={`${patient.nombre} ${patient.apellido}`} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getInitials(patient.nombre, patient.apellido)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <p 
                        className="font-semibold truncate cursor-pointer hover:text-primary"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        {patient.nombre} {patient.apellido}
                      </p>
                      <p className="text-sm text-muted-foreground">{patient.telefono}</p>
                      {patient.email && (
                        <p className="text-sm text-muted-foreground truncate">{patient.email}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {patient.alertas_medicas?.length > 0 && (
                        <Badge variant="destructive" className="flex-shrink-0">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {patient.alertas_medicas.length}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDialog(patient);
                        }}
                        data-testid={`edit-patient-${patient.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={(e) => handleDeleteClick(patient, e)}
                        data-testid={`delete-patient-${patient.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredPatients.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron pacientes</p>
                {searchTerm && (
                  <p className="text-sm mt-1">Intenta con otro término de búsqueda</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar paciente?</AlertDialogTitle>
              <AlertDialogDescription>
                {patientToDelete && (
                  <>
                    ¿Estás seguro que deseas eliminar a <strong>{patientToDelete.nombre} {patientToDelete.apellido}</strong>?
                    <br /><br />
                    Esta acción eliminará también todo su historial clínico, odontograma y archivos asociados. Esta acción no se puede deshacer.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="confirm-delete-patient"
              >
                Sí, eliminar paciente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};
