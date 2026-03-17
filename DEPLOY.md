# Guía de despliegue por cliente

## Variables a configurar en EasyPanel

### Obligatorias — la app no arranca sin estas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `MONGO_URL` | Connection string de MongoDB | `mongodb://user:pass@host:27017/db?authSource=admin` |
| `DB_NAME` | Nombre de la base de datos | `clinica_lopez` |
| `JWT_SECRET` | Clave secreta para tokens JWT (mín. 32 chars) | genera con comando abajo |
| `WEBHOOK_API_KEY` | API key para integración con n8n | genera con comando abajo |

```bash
# Generar JWT_SECRET y WEBHOOK_API_KEY:
python -c "import secrets; print(secrets.token_hex(32))"
```

---

### Identidad de la clínica (white-label)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `CLINIC_NAME` | Nombre que aparece en el encabezado y documentos | `Clínica Dental López` |
| `CLINIC_PRIMARY_COLOR` | Color primario en hex | `#0ea5e9` |
| `CLINIC_LOGO_URL` | URL pública del logo (PNG/SVG, fondo transparente) | `https://tuclinica.com/logo.png` |
| `CLINIC_TIMEZONE` | Zona horaria del servidor | `America/Mexico_City` |
| `CLINIC_PHONE` | Teléfono de la clínica (opcional) | `+52 555 123 4567` |
| `CLINIC_ADDRESS` | Dirección (opcional) | `Av. Principal 123, CDMX` |

---

### Horario laboral

| Variable | Descripción | Default |
|---|---|---|
| `WORK_START` | Hora de inicio (formato 24h, entero) | `8` |
| `WORK_END` | Hora de cierre exclusivo | `19` |
| `SLOT_DURATION` | Duración de cada cita en minutos | `30` |
| `APPOINTMENT_PRICE` | Precio base por cita (para dashboard) | `150` |

---

### Admin inicial (solo primer arranque)

> Se crea automáticamente si la base de datos está vacía.
> Después del primer login puedes eliminar estas variables.

| Variable | Descripción |
|---|---|
| `FIRST_ADMIN_EMAIL` | Correo del administrador inicial |
| `FIRST_ADMIN_PASSWORD` | Contraseña (mín. 8 chars, 1 mayúscula, 1 número) |
| `FIRST_ADMIN_NAME` | Nombre completo |

---

### URLs y CORS

| Variable | Descripción | Ejemplo |
|---|---|---|
| `CORS_ORIGINS` | URL del frontend (sin barra al final) | `https://cliente.easypanel.host` |
| `NOTIFICATION_WEBHOOK_URL` | URL del workflow n8n para WhatsApp/email (opcional) | `https://n8n.tuservidor.com/webhook/abc` |

---

## Checklist de despliegue nuevo cliente

- [ ] Crear servicio MongoDB en EasyPanel — anotar connection string
- [ ] Crear servicio Backend — configurar todas las variables de arriba
- [ ] Crear servicio Frontend — configurar `REACT_APP_BACKEND_URL` en el Dockerfile
- [ ] Verificar que el backend responde en `/api/config`
- [ ] Entrar al frontend y hacer login con `FIRST_ADMIN_EMAIL`
- [ ] Cambiar `CORS_ORIGINS` al dominio real del frontend
- [ ] Cambiar `CORS_ORIGINS=*` por el dominio real si se usó `*` temporalmente
- [ ] Crear usuarios del personal desde Configuración → Usuarios
- [ ] Eliminar `FIRST_ADMIN_PASSWORD` de las env vars (opcional pero recomendado)

---

## Cambiar de cliente (mismo servidor)

Si reutilizas el servidor para otro cliente:

1. Crea un nuevo proyecto en EasyPanel
2. Usa un `DB_NAME` diferente por cliente — cada uno tiene su propia BD aislada
3. Actualiza `CLINIC_NAME`, `CLINIC_PRIMARY_COLOR`, `CLINIC_LOGO_URL`
4. Genera nuevos `JWT_SECRET` y `WEBHOOK_API_KEY` — nunca reutilices entre clientes

---

## Cambiar el logo o colores después del deploy

Solo edita las variables de entorno en EasyPanel y haz **Restart** del servicio backend (no hace falta rebuild). El frontend lee estos valores desde `/api/config` al cargar.
