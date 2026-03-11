import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  Search,
  Pencil,
  Trash2,
  Stethoscope,
  Mail,
  Phone,
  UserCheck,
  UserX
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPECIALTIES = [
  'Odontología General',
  'Endodoncia',
  'Ortodoncia',
  'Cirugía Maxilofacial',
  'Periodoncia',
  'Odontopediatría',
  'Prostodoncia',
  'Implantología',
];

const COLORS = [
  { value: '#0ea5e9', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#8b5cf6', label: 'Morado' },
  { value: '#f59e0b', label: 'Naranja' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Cyan' },
];

export const DoctorsPage = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    especialidad: '',
    email: '',
    telefono: '',
    color: '#0ea5e9',
    activo: true,
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${API}/doctors`);
      setDoctors(res.data);
    } catch (err) {
      toast.error('Error al cargar doctores');
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(d =>
    d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.especialidad.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeDoctors = doctors.filter(d => d.activo);
  const inactiveDoctors = doctors.filter(d => !d.activo);

  const resetForm = () => {
    setFormData({
      nombre: '',
      especialidad: '',
      email: '',
      telefono: '',
      color: '#0ea5e9',
      activo: true,
    });
    setEditingDoctor(null);
  };

  const handleOpenDialog = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        nombre: doctor.nombre,
        especialidad: doctor.especialidad,
        email: doctor.email,
        telefono: doctor.telefono,
        color: doctor.color,
        activo: doctor.activo,
        avatar_url: doctor.avatar_url || null,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.especialidad || !formData.email || !formData.telefono) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      if (editingDoctor) {
        await axios.put(`${API}/doctors/${editingDoctor.id}`, formData);
        toast.success('Doctor actualizado correctamente');
      } else {
        await axios.post(`${API}/doctors`, formData);
        toast.success('Doctor agregado correctamente');
      }
      await fetchDoctors();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map(e => e.msg).join(', ') : (d || 'Error al guardar doctor'));
      return;
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (doctorId) => {
    if (!window.confirm('¿Estás seguro de eliminar este doctor?')) return;
    try {
      await axios.delete(`${API}/doctors/${doctorId}`);
      toast.success('Doctor eliminado');
      setDoctors(prev => prev.filter(d => d.id !== doctorId));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar doctor');
    }
  };

  const handleToggleActive = async (doctor) => {
    try {
      await axios.put(`${API}/doctors/${doctor.id}`, {
        nombre: doctor.nombre,
        especialidad: doctor.especialidad,
        email: doctor.email,
        telefono: doctor.telefono,
        color: doctor.color,
        activo: !doctor.activo,
        avatar_url: doctor.avatar_url || null,
      });
      toast.success('Estado actualizado');
      setDoctors(prev => prev.map(d => d.id === doctor.id ? { ...d, activo: !d.activo } : d));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar estado');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'DR';
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="doctors-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Gestión de Doctores</h1>
            <p className="text-muted-foreground mt-1">
              Administra el equipo médico de Dentu
            </p>
          </div>
        </div>

        {/* Edit Doctor Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Doctor</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre Completo</Label>
                  <Input
                    id="nombre"
                    placeholder="Dr. Juan Pérez"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    data-testid="doctor-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="especialidad">Especialidad</Label>
                  <Select
                    value={formData.especialidad}
                    onValueChange={(v) => setFormData({ ...formData, especialidad: v })}
                  >
                    <SelectTrigger data-testid="doctor-specialty-select">
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map(spec => (
                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="doctor@dentu.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="doctor-email-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    placeholder="+52 555 123 4567"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    data-testid="doctor-phone-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Color en Calendario</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.color === color.value
                            ? 'border-foreground scale-110'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setFormData({ ...formData, color: color.value })}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="activo">Doctor Activo</Label>
                  <Switch
                    id="activo"
                    checked={formData.activo}
                    onCheckedChange={(v) => setFormData({ ...formData, activo: v })}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" data-testid="save-doctor-btn">
                    {editingDoctor ? 'Guardar Cambios' : 'Agregar Doctor'}
                  </Button>
                </div>
              </form>
            </DialogContent>
        </Dialog>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{doctors.length}</p>
                <p className="text-xs text-muted-foreground">Total Doctores</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeDoctors.length}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <UserX className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveDoctors.length}</p>
                <p className="text-xs text-muted-foreground">Inactivos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="search-doctors"
          />
        </div>

        {/* Doctors List */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              {searchTerm ? `Resultados: ${filteredDoctors.length}` : 'Todos los Doctores'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando doctores...</p>
            ) : (
              <div className="space-y-3">
                {filteredDoctors.map(doctor => (
                  <div
                    key={doctor.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border border-border/50 transition-all ${
                      doctor.activo
                        ? 'bg-card hover:bg-muted/50'
                        : 'bg-muted/30 opacity-60'
                    }`}
                    data-testid={`doctor-row-${doctor.id}`}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2" style={{ borderColor: doctor.color }}>
                        <AvatarImage src={doctor.avatar_url} />
                        <AvatarFallback style={{ backgroundColor: `${doctor.color}20`, color: doctor.color }}>
                          {getInitials(doctor.nombre)}
                        </AvatarFallback>
                      </Avatar>
                      {doctor.activo && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card bg-emerald-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{doctor.nombre}</p>
                        <Badge
                          variant={doctor.activo ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {doctor.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{doctor.especialidad}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {doctor.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {doctor.telefono}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: doctor.color }}
                        title="Color en calendario"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(doctor)}
                        data-testid={`edit-doctor-${doctor.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(doctor)}
                        title={doctor.activo ? 'Desactivar' : 'Activar'}
                      >
                        {doctor.activo ? (
                          <UserX className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doctor.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-doctor-${doctor.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {filteredDoctors.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron doctores</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};
