import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Moon, Sun, User, Bell, Shield, Database,
  Users, UserPlus, Trash2, Eye, EyeOff, RefreshCw,
  Stethoscope, Plus
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

import { API } from '@/lib/api';

const ROL_LABELS = {
  admin:     'Administrador',
  doctor:    'Doctor',
  recepcion: 'Recepción',
};

const DOCTOR_COLORS = [
  { value: '#0ea5e9', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#8b5cf6', label: 'Morado' },
  { value: '#f59e0b', label: 'Naranja' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Cyan' },
];

// ── Sección de gestión de especialidades (solo admin) ─────────────────────
const EspecialidadesSection = ({ specialties, onReload }) => {
  const [newName, setNewName]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/especialidades`, { nombre: newName.trim() });
      setNewName('');
      onReload();
      toast.success('Especialidad agregada');
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(d || 'Error al agregar especialidad');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    setDeletingId(id);
    try {
      await axios.delete(`${API}/especialidades/${id}`);
      onReload();
      toast.success(`"${nombre}" eliminada`);
    } catch {
      toast.error('Error al eliminar especialidad');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          Especialidades
        </CardTitle>
        <CardDescription>
          Gestiona las especialidades disponibles para los doctores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Nueva especialidad..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={saving || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </form>
        <div className="divide-y divide-border/50">
          {specialties.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No hay especialidades registradas.</p>
          )}
          {specialties.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium">{s.nombre}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={deletingId === s.id}
                onClick={() => handleDelete(s.id, s.nombre)}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Sección de gestión de usuarios (solo admin) ────────────────────────────
const UsersSection = ({ currentUser, specialties = [] }) => {
  const [users, setUsers]           = useState([]);
  const [deleteUser, setDeleteUser] = useState(null); // { id, nombre }
  const [loadingUsers, setLoading]  = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({
    nombre: '', email: '', password: '', rol: 'recepcion',
    especialidad: '', telefono: '', color: '#0ea5e9',
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/usuarios`);
      setUsers(res.data);
    } catch {
      toast.error('No se pudo cargar la lista de usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/admin/usuarios`, {
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        rol: form.rol,
      });

      // Auto-create doctor profile when role is doctor
      if (form.rol === 'doctor') {
        try {
          await axios.post(`${API}/doctors`, {
            nombre: form.nombre,
            email: form.email,
            especialidad: form.especialidad || 'Odontología General',
            telefono: form.telefono || '',
            color: form.color || '#0ea5e9',
            activo: true,
          });
        } catch {
          toast.warning('Usuario creado, pero no se pudo crear el perfil de doctor. Edítalo desde Gestión de Doctores.');
        }
      }

      toast.success(`Usuario ${form.email} creado`);
      setForm({ nombre: '', email: '', password: '', rol: 'recepcion', especialidad: '', telefono: '', color: '#0ea5e9' });
      setShowForm(false);
      loadUsers();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map(e => e.msg).join(', ') : (d || 'Error al crear usuario'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      await axios.delete(`${API}/admin/usuarios/${deleteUser.id}`);
      toast.success('Usuario eliminado');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar usuario');
    } finally {
      setDeleteUser(null);
    }
  };

  return (
    <>
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Usuarios del sistema
        </CardTitle>
        <CardDescription>
          Crea y administra las cuentas del personal de la clínica
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Acciones */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {showForm ? 'Cancelar' : 'Nuevo usuario'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadUsers}
            disabled={loadingUsers}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Formulario de creación */}
        {showForm && (
          <form onSubmit={handleCreate} className="space-y-3 p-4 rounded-lg bg-muted/40 border border-border/50">
            <h3 className="text-sm font-semibold">Nuevo usuario</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="u-nombre">Nombre completo</Label>
                <Input
                  id="u-nombre"
                  placeholder="Dra. María López"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-email">Correo electrónico</Label>
                <Input
                  id="u-email"
                  type="email"
                  placeholder="correo@clinica.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="u-password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mínimo 8 car., 1 mayúsc., 1 número"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-rol">Rol</Label>
                <Select value={form.rol} onValueChange={v => setForm(f => ({ ...f, rol: v }))}>
                  <SelectTrigger id="u-rol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="recepcion">Recepción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Extra fields for doctor role */}
            {form.rol === 'doctor' && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/60 border border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perfil de doctor</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="u-especialidad">Especialidad</Label>
                    <Select value={form.especialidad} onValueChange={v => setForm(f => ({ ...f, especialidad: v }))}>
                      <SelectTrigger id="u-especialidad">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map(s => (
                          <SelectItem key={s.id} value={s.nombre}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="u-telefono">Teléfono</Label>
                    <Input
                      id="u-telefono"
                      placeholder="+52 555 123 4567"
                      value={form.telefono}
                      onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Color en calendario</Label>
                  <div className="flex gap-2">
                    {DOCTOR_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => setForm(f => ({ ...f, color: c.value }))}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Guardando...' : 'Crear usuario'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Lista de usuarios */}
        {loadingUsers ? (
          <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay usuarios registrados.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-sm">{u.nombre}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {ROL_LABELS[u.rol] || u.rol}
                  </span>
                  {u.id !== currentUser?.id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteUser({ id: u.id, nombre: u.nombre })}
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <ConfirmModal
      open={!!deleteUser}
      onOpenChange={open => !open && setDeleteUser(null)}
      title="¿Eliminar usuario?"
      description={`Se eliminará permanentemente la cuenta de "${deleteUser?.nombre}". Esta acción no se puede deshacer.`}
      variant="danger"
      confirmLabel="Eliminar"
      onConfirm={handleDelete}
    />
    </>
  );
};

// ── Página principal ───────────────────────────────────────────────────────
export const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const isAdmin = user?.rol === 'admin';

  const [specialties, setSpecialties] = useState([]);
  const loadSpecialties = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/especialidades`);
      setSpecialties(res.data);
    } catch { /* silencioso */ }
  }, []);
  useEffect(() => { if (isAdmin) loadSpecialties(); }, [isAdmin, loadSpecialties]);

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl" data-testid="settings-page">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground mt-1">
            Personaliza tu experiencia en la aplicación
          </p>
        </div>

        {/* ── Apariencia ─────────────────────────────────────────────────── */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Apariencia
            </CardTitle>
            <CardDescription>Configura el tema visual de la aplicación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode">Modo Oscuro</Label>
                <p className="text-sm text-muted-foreground">
                  Activa el tema oscuro para reducir la fatiga visual
                </p>
              </div>
              <Switch
                id="dark-mode"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                data-testid="theme-switch"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  theme === 'light' ? 'border-primary bg-white' : 'border-transparent bg-slate-100'
                }`}
                onClick={() => theme === 'dark' && toggleTheme()}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="h-4 w-4" />
                  <span className="font-medium text-sm text-slate-900">Claro</span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-full bg-slate-200 rounded" />
                  <div className="h-2 w-3/4 bg-slate-200 rounded" />
                </div>
              </div>

              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  theme === 'dark' ? 'border-primary bg-slate-900' : 'border-transparent bg-slate-800'
                }`}
                onClick={() => theme === 'light' && toggleTheme()}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="h-4 w-4 text-slate-100" />
                  <span className="font-medium text-sm text-slate-100">Oscuro</span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-full bg-slate-700 rounded" />
                  <div className="h-2 w-3/4 bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Cuenta ─────────────────────────────────────────────────────── */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Mi cuenta
            </CardTitle>
            <CardDescription>Información de tu cuenta de acceso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Nombre</Label>
                <p className="font-medium">{user?.nombre || '—'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Rol</Label>
                <p className="font-medium">{ROL_LABELS[user?.rol] || user?.rol || '—'}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground text-xs">Correo electrónico</Label>
                <p className="font-medium">{user?.email || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Especialidades (solo admin) ─────────────────────────────────── */}
        {isAdmin && <EspecialidadesSection specialties={specialties} onReload={loadSpecialties} />}

        {/* ── Gestión de usuarios (solo admin) ───────────────────────────── */}
        {isAdmin && <UsersSection currentUser={user} specialties={specialties} />}

        {/* ── Notificaciones (próximamente) ──────────────────────────────── */}
        <Card className="bg-card border-border/50 opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Próximamente</span>
            </CardTitle>
            <CardDescription>Configura las notificaciones de la aplicación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Recordatorios de citas</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones antes de cada cita
                </p>
              </div>
              <Switch disabled />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertas de pacientes</Label>
                <p className="text-sm text-muted-foreground">
                  Notificaciones sobre alertas médicas
                </p>
              </div>
              <Switch disabled />
            </div>
          </CardContent>
        </Card>

        {/* ── Integraciones ───────────────────────────────────────────────── */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Integraciones
            </CardTitle>
            <CardDescription>Conecta servicios externos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                  <svg viewBox="0 0 87.3 78" className="w-6 h-6">
                    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.45c0 1.55.4 3.1 1.2 4.5l3.95 9.35z" fill="#0066DA"/>
                    <path d="M43.65 25.05L29.9 1.25c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.45c-.8 1.4-1.2 2.95-1.2 4.5h26.05l17.6-26.9z" fill="#00AC47"/>
                    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.55H61.2l5.55 9.6 6.8 14.25z" fill="#EA4335"/>
                    <path d="M43.65 25.05L57.4 1.25c-1.35-.8-2.9-1.25-4.5-1.25H34.35c-1.6 0-3.15.45-4.45 1.25l13.75 23.8z" fill="#00832D"/>
                    <path d="M61.2 52.95H27.5L13.75 76.75c1.35.8 2.9 1.25 4.5 1.25h38.15c1.6 0 3.15-.45 4.5-1.25l.3-23.8z" fill="#2684FC"/>
                    <path d="M73.3 26.85L59.55 3c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.05l17.55 27.9h26c0-1.55-.4-3.1-1.2-4.5l-12.7-21.6z" fill="#FFBA00"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Google Drive</p>
                  <p className="text-sm text-muted-foreground">
                    Configurado mediante variables de entorno para almacenar radiografías
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30">
                Configurado
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Seguridad (próximamente) ───────────────────────────────────── */}
        <Card className="bg-card border-border/50 opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Próximamente</span>
            </CardTitle>
            <CardDescription>Configura la seguridad de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Cambiar contraseña</Button>
          </CardContent>
        </Card>
      </div>

    </Layout>
  );
};
