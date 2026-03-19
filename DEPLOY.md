# Guía de Deploy — Dentu (ClinicalGestor)

Pasos completos para desplegar una nueva instancia de Dentu para un cliente.

---

## Requisitos previos

- Cuenta en [EasyPanel](https://easypanel.io) con un servidor configurado
- Repositorio del proyecto en GitHub
- Cuenta de Google para la clínica (Gmail o Google Workspace)
- Acceso a [Google Cloud Console](https://console.cloud.google.com)

---

## 1. Google Cloud Console

### 1.1 Crear proyecto (si no existe)
1. Google Cloud Console → **Nuevo proyecto**
2. Nombre: `dentu-[nombre-clinica]`

### 1.2 Habilitar APIs necesarias
En **APIs y servicios → Biblioteca**, habilitar:
- Google Drive API
- Google Picker API
- Identity Services API (para Sign-In)

### 1.3 Crear credencial OAuth 2.0 (para Sign-In y Picker)
1. **APIs y servicios → Credenciales → Crear credencial → ID de cliente OAuth 2.0**
2. Tipo: **Aplicación web**
3. Orígenes autorizados: agrega la URL del frontend del cliente (ej: `https://clinica.easypanel.host`)
4. Copiar el **Client ID** (termina en `.apps.googleusercontent.com`) — se usa en backend y frontend
5. Copiar la **API Key** — se usa en el frontend

### 1.4 Crear cuenta de servicio (para Drive centralizado)
1. **IAM & Admin → Cuentas de servicio → Crear cuenta de servicio**
2. Nombre: `dentu-[nombre-clinica]`
3. Click en la cuenta creada → pestaña **Claves → Agregar clave → Crear clave nueva → JSON**
4. Guardar el archivo `.json` descargado de forma segura

### 1.5 Configurar carpeta de Google Drive
1. En Google Drive de la cuenta de la clínica, crear carpeta: `Dentu-Archivos`
2. Click derecho → **Compartir** → pegar el email de la cuenta de servicio (ej: `dentu-xxx@proyecto.iam.gserviceaccount.com`)
3. Rol: **Editor**, desactivar notificación → **Compartir**
4. Abrir la carpeta y copiar el **ID** de la URL: `https://drive.google.com/drive/folders/`**`ESTE-ES-EL-ID`**

---

## 2. Configurar el repositorio

### 2.1 Dockerfile del frontend
En `frontend/Dockerfile`, actualizar los ARG con los valores del cliente:

```dockerfile
ARG REACT_APP_BACKEND_URL=https://[cliente]-backend.easypanel.host
ARG REACT_APP_GOOGLE_CLIENT_ID=[client-id].apps.googleusercontent.com
ARG REACT_APP_GOOGLE_API_KEY=[api-key]
```

### 2.2 Dockerfile del backend
En `backend/Dockerfile`, actualizar los ARG:

```dockerfile
ARG GOOGLE_CLIENT_ID=[client-id].apps.googleusercontent.com
ARG GOOGLE_DRIVE_FOLDER_ID=[id-carpeta-drive]
```

> **Nota:** El `GOOGLE_SERVICE_ACCOUNT_JSON` NO va en el Dockerfile — va en EasyPanel como env var (ver sección 3).

---

## 3. EasyPanel — Variables de entorno del backend

En EasyPanel → servicio backend → **Environment**, agregar:

| Variable | Valor |
|----------|-------|
| `MONGO_URL` | `mongodb://usuario:password@host:27017/?tls=false` |
| `DB_NAME` | `dentu_[clinica]` |
| `JWT_SECRET` | Genera con: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `WEBHOOK_API_KEY` | Genera con el mismo comando |
| `FIRST_ADMIN_EMAIL` | Email del admin inicial |
| `FIRST_ADMIN_PASSWORD` | Mínimo 8 chars, 1 mayúscula, 1 número |
| `FIRST_ADMIN_NAME` | Nombre del admin |
| `CLINIC_NAME` | Nombre de la clínica |
| `CLINIC_TIMEZONE` | Ej: `America/Mexico_City` |
| `WORK_START` | Hora inicio (ej: `8`) |
| `WORK_END` | Hora fin (ej: `19`) |
| `SLOT_DURATION` | Duración slot en minutos (ej: `30`) |
| `APPOINTMENT_PRICE` | Precio base por cita |
| `CORS_ORIGINS` | URL del frontend (ej: `https://[cliente]-frontend.easypanel.host`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Contenido completo del archivo `.json` de la cuenta de servicio |

### Cómo pegar el GOOGLE_SERVICE_ACCOUNT_JSON
1. Abrir el archivo `.json` descargado con el Bloc de notas
2. Seleccionar todo → copiar
3. Pegarlo como valor de la variable en EasyPanel (acepta JSON multilínea)

---

## 4. Deploy

1. Hacer push de los cambios del Dockerfile al repo
2. EasyPanel → servicio frontend → **Force Rebuild**
3. EasyPanel → servicio backend → **Redeploy**
4. Verificar que ambos servicios estén en verde

---

## 5. Primer acceso

1. Entrar a la URL del frontend
2. Login con `FIRST_ADMIN_EMAIL` y `FIRST_ADMIN_PASSWORD`
3. Ir a **Configuración → Usuarios** y crear las cuentas del personal
   - El email debe coincidir exactamente con su cuenta de Google si van a usar Sign-In con Google
4. El personal puede entrar con email/contraseña **o** con el botón "Continuar con Google"

---

## 6. Checklist final

- [ ] APIs de Google habilitadas
- [ ] Client ID y API Key creados y configurados
- [ ] Cuenta de servicio creada y JSON guardado de forma segura
- [ ] Carpeta de Drive creada y compartida con la cuenta de servicio
- [ ] Dockerfiles actualizados con vars del cliente
- [ ] Env vars del backend en EasyPanel
- [ ] Force Rebuild del frontend completado
- [ ] Login con email/contraseña funciona
- [ ] Login con Google funciona
- [ ] Subir archivo desde paciente va al Drive correcto
- [ ] Primer admin creado y acceso verificado

---

## Notas de seguridad

- **Nunca** subir el archivo `.json` del service account al repositorio
- Verificar que `backend/service-account.json` esté en `.gitignore`
- Generar `JWT_SECRET` y `WEBHOOK_API_KEY` únicos por cliente
- Para producción, rotar las claves del service account periódicamente
- El `GOOGLE_SERVICE_ACCOUNT_JSON` en EasyPanel contiene claves privadas — tratar con cuidado
