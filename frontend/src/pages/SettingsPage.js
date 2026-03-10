import { Layout } from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Moon, Sun, User, Bell, Shield, Database } from 'lucide-react';

export const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl" data-testid="settings-page">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground mt-1">
            Personaliza tu experiencia en la aplicación
          </p>
        </div>

        {/* Appearance */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Apariencia
            </CardTitle>
            <CardDescription>
              Configura el tema visual de la aplicación
            </CardDescription>
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
            
            {/* Theme Preview */}
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

        {/* Account */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Cuenta
            </CardTitle>
            <CardDescription>
              Información de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Nombre</Label>
                <p className="font-medium">{user?.nombre || 'Usuario'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Rol</Label>
                <p className="font-medium capitalize">{user?.rol || 'Doctor'}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p className="font-medium">{user?.email || 'usuario@clinica.com'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications - Coming Soon */}
        <Card className="bg-card border-border/50 opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Próximamente</span>
            </CardTitle>
            <CardDescription>
              Configura las notificaciones de la aplicación
            </CardDescription>
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

        {/* Integrations - Coming Soon */}
        <Card className="bg-card border-border/50 opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Integraciones
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Próximamente</span>
            </CardTitle>
            <CardDescription>
              Conecta servicios externos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <p className="text-sm text-muted-foreground">Para almacenar radiografías</p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                Conectar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security - Coming Soon */}
        <Card className="bg-card border-border/50 opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
              <span className="text-xs bg-muted px-2 py-0.5 rounded">Próximamente</span>
            </CardTitle>
            <CardDescription>
              Configura la seguridad de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              Cambiar Contraseña
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};
