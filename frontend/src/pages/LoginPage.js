import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Stethoscope, Moon, Sun, Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('doctor');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = await login(loginEmail, loginPassword);
      toast.success(`Bienvenido, ${user.nombre}`);
      navigate(user.rol === 'admin' ? '/admin/dashboard' : '/doctor/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Credenciales inválidas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = await register(regEmail, regPassword, regName, regRole);
      toast.success(`Cuenta creada. Bienvenido, ${user.nombre}`);
      navigate(user.rol === 'admin' ? '/admin/dashboard' : '/doctor/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=2000)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/70" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Stethoscope className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold">Dentu</span>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              La gestión de tu clínica dental simplificada
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              Administra pacientes, citas, historiales clínicos y odontogramas desde una sola plataforma moderna y segura.
            </p>
          </div>
          
          <p className="text-sm text-white/60">
            © 2024 Dentu. Todos los derechos reservados.
          </p>
        </div>
      </div>
      
      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Theme Toggle */}
        <div className="flex justify-end p-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="theme-toggle-login">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
            <CardHeader className="text-center lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-4 lg:hidden">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Stethoscope className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">Dentu</span>
              </div>
              <CardTitle className="text-2xl">Bienvenido</CardTitle>
              <CardDescription>
                Ingresa a tu cuenta o crea una nueva
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="tab-login">Iniciar Sesión</TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register">Registrarse</TabsTrigger>
                </TabsList>
                
                {/* Login Tab */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Correo Electrónico</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="doctor@clinica.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        data-testid="login-email"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          data-testid="login-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading}
                      data-testid="login-submit"
                    >
                      {isLoading ? 'Ingresando...' : 'Iniciar Sesión'}
                    </Button>
                  </form>
                </TabsContent>
                
                {/* Register Tab */}
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Nombre Completo</Label>
                      <Input
                        id="reg-name"
                        type="text"
                        placeholder="Dr. Juan Pérez"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                        data-testid="register-name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Correo Electrónico</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="doctor@clinica.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        data-testid="register-email"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Contraseña</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={6}
                        data-testid="register-password"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-role">Rol</Label>
                      <Select value={regRole} onValueChange={setRegRole}>
                        <SelectTrigger data-testid="register-role">
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="doctor">Doctor</SelectItem>
                          <SelectItem value="recepcion">Recepción</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading}
                      data-testid="register-submit"
                    >
                      {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              
              {/* Demo credentials hint */}
              <div className="mt-6 p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">
                  Demo: Crea una cuenta nueva o usa cualquier email/contraseña para probar.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
