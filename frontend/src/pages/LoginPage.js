import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Stethoscope, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

import { API } from '@/lib/api';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export const LoginPage = () => {
  const [isLoading, setIsLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [clinicName, setClinicName]     = useState('');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const { login, loginWithGoogle } = useAuth();
  const { theme, toggleTheme }     = useTheme();
  const navigate                   = useNavigate();
  const googleBtnRef               = useRef(null);
  const gisLoaded                  = useRef(false);

  useEffect(() => {
    axios.get(`${API}/config`)
      .then(res => setClinicName(res.data.clinic_name || ''))
      .catch(() => {});
  }, []);

  // Carga Google Identity Services y renderiza el botón oficial de Google
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || gisLoaded.current) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      gisLoaded.current = true;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          locale: 'es',
          width: 320,
        });
      }
    };
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCredential = async (response) => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle(response.credential);
      toast.success(`Bienvenido, ${user.nombre}`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo iniciar sesión con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Bienvenido, ${user.nombre}`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Credenciales inválidas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Botón de tema */}
      <div className="fixed top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="theme-toggle-login"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>

      <div className="w-full max-w-sm space-y-8">
        {/* Encabezado */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
            <Stethoscope className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {clinicName || 'Clínica Dental'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acceso interno — solo personal autorizado
            </p>
          </div>
        </div>

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && (
          <div className="space-y-3">
            <div
              ref={googleBtnRef}
              className="flex justify-center"
              data-testid="google-signin-btn"
            />
            {googleLoading && (
              <p className="text-center text-sm text-muted-foreground">Verificando con Google...</p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">o continúa con correo</span>
              <div className="flex-1 border-t border-border" />
            </div>
          </div>
        )}

        {/* Formulario email/password */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="correo@clinica.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              data-testid="login-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                data-testid="login-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
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
            {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </div>
  );
};
