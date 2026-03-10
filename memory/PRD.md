# PRD - Dentu - Web App de Gestión para Clínicas Odontológicas

## Fecha: 2026-01-10 (Actualizado v2)

## Problem Statement Original
Web App de Gestión para Clínicas Odontológicas con diseño limpio, minimalista y moderno.

## User Choices
- Nombre de la clínica: **Dentu**
- Autenticación: JWT (email/contraseña)
- Idioma: Solo español
- Almacenamiento: Mock local (Google Drive pendiente)
- Tema: Toggle modo claro/oscuro
- Recordatorios: Gestionados externamente con n8n + WhatsApp

## What's Been Implemented

### 1. Dashboard de Administración
- KPIs: Pacientes hoy, ingresos, citas completadas/canceladas, nuevos pacientes
- Calendario Maestro (Día/Semana/Mes) con drag & drop
- Widget de Doctores en turno con carga de trabajo
- Cola de citas del día

### 2. Gestión de Doctores (Admin)
- CRUD completo de doctores
- Especialidades configurables
- Color para calendario
- Activar/Desactivar doctor

### 3. Panel del Doctor
- Lista de pacientes del día con estados
- Indicador "Siguiente Paciente"
- Acciones rápidas de cambio de estado

### 4. Gestión de Pacientes (NUEVO)
- CRUD completo con formulario
- Avatares por defecto para todos los pacientes
- Alertas médicas con agregar/quitar
- **Botón eliminar con modal de confirmación**
- Búsqueda por nombre/teléfono/email

### 5. Calendario (MEJORADO)
- **Formulario "Nueva Cita"** para agendar desde el calendario
- **Drag and drop** para mover citas
- Vistas Día/Semana/Mes
- Colores por doctor

### 6. Expediente de Paciente
- Perfil completo
- Odontograma interactivo (32 dientes, 5 zonas)
- Notas Clínicas con timeline y tags
- Historial de citas
- Galería de archivos (preparado para Google Drive)
- Alertas médicas destacadas

### 7. API Webhooks para n8n (NUEVO)
Endpoints públicos con autenticación por API key:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/webhook/doctors` | GET | Lista doctores activos |
| `/api/webhook/patients/search` | GET | Buscar paciente por teléfono/nombre |
| `/api/webhook/patients` | POST | Crear nuevo paciente |
| `/api/webhook/availability` | GET | Horarios disponibles por fecha |
| `/api/webhook/appointments` | POST | Crear nueva cita |
| `/api/webhook/appointments` | GET | Consultar citas por fecha/paciente |

**API Key:** `dentu-n8n-webhook-key-2024` (configurable via env WEBHOOK_API_KEY)

Ejemplo de uso:
```bash
# Consultar horarios disponibles
curl "https://tu-dominio/api/webhook/availability?api_key=dentu-n8n-webhook-key-2024&fecha=2026-03-15"

# Crear paciente
curl -X POST "https://tu-dominio/api/webhook/patients?api_key=dentu-n8n-webhook-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","apellido":"Pérez","telefono":"+525551234567"}'

# Crear cita
curl -X POST "https://tu-dominio/api/webhook/appointments?api_key=dentu-n8n-webhook-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"paciente_telefono":"+525551234567","doctor_id":"doc-001","fecha":"2026-03-15","hora_inicio":"10:00","hora_fin":"10:30","motivo":"Limpieza dental"}'
```

## Navegación por Rol
- **Admin**: Dashboard, Doctores, Calendario, Pacientes, Configuración
- **Doctor**: Mi Panel, Calendario, Pacientes, Configuración  
- **Recepción**: Calendario, Pacientes, Configuración

## Prioritized Backlog

### P0 (Critical) - COMPLETADO ✅
- [x] Autenticación funcional
- [x] Dashboard operativo
- [x] CRUD de doctores
- [x] CRUD de pacientes con eliminar
- [x] Creación de citas desde calendario
- [x] Drag & drop en calendario
- [x] API Webhooks para n8n

### P1 (High) - PENDIENTE
- [ ] Integración Google Drive para radiografías
- [ ] Persistencia real en MongoDB (reemplazar mock data)

### P2 (Medium) - PENDIENTE
- [ ] Reportes y estadísticas avanzadas
- [ ] Exportación de datos

## Credenciales de Prueba
- Email: test@dentu.com
- Password: test123
- Rol: admin

## Next Tasks
1. Integrar con Google Drive (cuando se provean credenciales)
2. Persistir datos en MongoDB (reemplazar mock data)
3. Configurar API key segura en producción
