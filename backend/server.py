from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from enum import Enum
import os
import re
import hmac
import logging
import time
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import asyncio
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============ CONFIG (falla en startup si falta alguna variable crítica) ============

def _require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f"Variable de entorno requerida '{key}' no está definida. "
            f"Revisa tu archivo .env"
        )
    return value

MONGO_URL        = _require_env('MONGO_URL')
DB_NAME          = _require_env('DB_NAME')
JWT_SECRET       = _require_env('JWT_SECRET')
WEBHOOK_API_KEY  = _require_env('WEBHOOK_API_KEY')
JWT_ALGORITHM    = "HS256"
JWT_EXPIRATION_HOURS = 24

# ── Config de clínica (white-label — cada clínica personaliza su .env) ──────
CLINIC_NAME          = os.environ.get('CLINIC_NAME',          'Clínica Dental')
CLINIC_LOGO_URL      = os.environ.get('CLINIC_LOGO_URL',      '')
CLINIC_PRIMARY_COLOR = os.environ.get('CLINIC_PRIMARY_COLOR', '#0ea5e9')
CLINIC_PHONE         = os.environ.get('CLINIC_PHONE',         '')
CLINIC_ADDRESS       = os.environ.get('CLINIC_ADDRESS',       '')
CLINIC_TIMEZONE      = os.environ.get('CLINIC_TIMEZONE',      'America/Mexico_City')

# ── Horario laboral configurable ─────────────────────────────────────────────
WORK_START    = int(os.environ.get('WORK_START',    '8'))   # hora inicio (0-23)
WORK_END      = int(os.environ.get('WORK_END',      '19'))  # hora fin exclusivo
SLOT_DURATION = int(os.environ.get('SLOT_DURATION', '30'))  # minutos por slot

# ============ MONGODB ============

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============ LOGGING ============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ RATE LIMITER (en memoria, ventana deslizante) ============

class RateLimiter:
    """Límite de peticiones por clave (IP / email / api_key)."""
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window
        self._requests[key] = [t for t in self._requests[key] if t > window_start]
        if len(self._requests[key]) >= self.max_requests:
            return False
        self._requests[key].append(now)
        return True

login_limiter   = RateLimiter(max_requests=10, window_seconds=60)   # 10 intentos/min
webhook_limiter = RateLimiter(max_requests=60, window_seconds=60)    # 60 req/min

# ============ LIFESPAN (startup + shutdown moderno) ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info("Iniciando Dentu API...")
    await _create_indexes()
    await _seed_first_admin()
    logger.info("Dentu API lista en puerto 8001.")
    yield
    # --- Shutdown ---
    client.close()
    logger.info("Conexión MongoDB cerrada.")

async def _seed_first_admin():
    """
    Si FIRST_ADMIN_EMAIL y FIRST_ADMIN_PASSWORD están definidos en .env
    y no existe ningún usuario, crea el admin inicial automáticamente.
    """
    email    = os.environ.get('FIRST_ADMIN_EMAIL')
    password = os.environ.get('FIRST_ADMIN_PASSWORD')
    nombre   = os.environ.get('FIRST_ADMIN_NAME', 'Administrador')
    if not email or not password:
        return
    count = await db.users.count_documents({})
    if count > 0:
        return
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one({
        "id":         user_id,
        "email":      email,
        "nombre":     nombre,
        "rol":        UserRole.ADMIN,
        "password":   hash_password(password),
        "created_at": now,
    })
    logger.info(f"✅ Admin inicial creado: {email}")

async def _create_indexes():
    """Crea índices para optimizar consultas frecuentes y garantizar unicidad."""
    try:
        await db.users.create_index("email", unique=True)
        await db.doctors.create_index("id", unique=True)
        await db.doctors.create_index("activo")
        await db.doctors.create_index("email", unique=True)
        await db.patients.create_index("id", unique=True)
        await db.patients.create_index("telefono")
        await db.appointments.create_index("id", unique=True)
        await db.appointments.create_index("fecha")
        await db.appointments.create_index("paciente_id")
        await db.appointments.create_index("doctor_id")
        await db.appointments.create_index([("fecha", 1), ("doctor_id", 1)])
        await db.appointments.create_index([("fecha", 1), ("estado", 1)])
        await db.notas_clinicas.create_index("paciente_id")
        await db.archivos_medicos.create_index("paciente_id")
        await db.odontograms.create_index("paciente_id", unique=True)
        logger.info("Índices MongoDB creados/verificados.")
    except Exception as e:
        logger.warning(f"Advertencia al crear índices: {e}")

# ============ APP ============

app = FastAPI(
    title="Dentu Clínica Dental API",
    version="1.0.0",
    lifespan=lifespan
)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============ ROLES ============

class UserRole(str, Enum):
    ADMIN     = "admin"
    DOCTOR    = "doctor"
    RECEPCION = "recepcion"

# ============ HELPERS DE VALIDACIÓN ============

_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_TIME_RE = re.compile(r'^\d{2}:\d{2}$')

def validate_date(value: str, field_name: str = "fecha") -> str:
    if not value or not _DATE_RE.match(value):
        raise HTTPException(422, f"'{field_name}' debe estar en formato YYYY-MM-DD")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, f"'{field_name}' no es una fecha válida")
    return value

def validate_time(value: str, field_name: str = "hora") -> str:
    if not value or not _TIME_RE.match(value):
        raise HTTPException(422, f"'{field_name}' debe estar en formato HH:MM")
    return value

def safe_regex(text: str, max_len: int = 100) -> str:
    """Escapa input del usuario antes de usarlo en $regex de MongoDB."""
    return re.escape(text[:max_len])

def verify_webhook_key_safe(api_key: str) -> bool:
    """Comparación en tiempo constante para evitar timing attacks."""
    return hmac.compare_digest(api_key.encode(), WEBHOOK_API_KEY.encode())

# ============ MODELOS ============

class UserBase(BaseModel):
    email: EmailStr
    nombre: str
    rol: UserRole = UserRole.DOCTOR

class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Mínimo 8 caracteres')
        if not any(c.isupper() for c in v):
            raise ValueError('Debe incluir al menos una mayúscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('Debe incluir al menos un número')
        return v

    @field_validator('nombre')
    @classmethod
    def nombre_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('El nombre no puede estar vacío')
        return v.strip()

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class DoctorBase(BaseModel):
    nombre: str
    especialidad: str
    email: EmailStr
    telefono: str
    color: str = "#0ea5e9"
    activo: bool = True
    avatar_url: Optional[str] = None

class DoctorCreate(DoctorBase):
    pass

class Doctor(DoctorBase):
    id: str
    created_at: str

class AlertaMedica(BaseModel):
    tipo: str
    descripcion: str
    severidad: str = "alta"

class PatientBase(BaseModel):
    nombre: str
    apellido: str
    email: Optional[EmailStr] = None
    telefono: str
    fecha_nacimiento: str
    direccion: Optional[str] = None
    alertas_medicas: List[AlertaMedica] = []
    notas: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator('fecha_nacimiento')
    @classmethod
    def validate_fecha(cls, v: str) -> str:
        if not _DATE_RE.match(v):
            raise ValueError('fecha_nacimiento debe estar en formato YYYY-MM-DD')
        return v

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase):
    id: str
    created_at: str

class AppointmentBase(BaseModel):
    paciente_id: str
    doctor_id: str
    fecha: str
    hora_inicio: str
    hora_fin: str
    motivo: str
    estado: str = Field(default="confirmada")
    notas: Optional[str] = None

    @field_validator('fecha')
    @classmethod
    def validate_fecha(cls, v: str) -> str:
        if not _DATE_RE.match(v):
            raise ValueError('fecha debe estar en formato YYYY-MM-DD')
        return v

    @field_validator('hora_inicio', 'hora_fin')
    @classmethod
    def validate_hora(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError('hora debe estar en formato HH:MM')
        return v

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    id: str
    created_at: str
    paciente_nombre: Optional[str] = None
    doctor_nombre: Optional[str] = None
    doctor_color: Optional[str] = None

class ToothData(BaseModel):
    numero: int
    zonas: Dict[str, str] = {}
    notas: Optional[str] = None

class OdontogramBase(BaseModel):
    paciente_id: str
    dientes: List[ToothData] = []

class OdontogramUpdate(BaseModel):
    diente_numero: int
    zona: str
    estado: str

    @field_validator('diente_numero')
    @classmethod
    def validate_diente(cls, v: int) -> int:
        if not (1 <= v <= 52):
            raise ValueError('diente_numero debe estar entre 1 y 52')
        return v

class Odontogram(OdontogramBase):
    id: str
    updated_at: str

class NotaClinica(BaseModel):
    id: str
    paciente_id: str
    doctor_id: str
    doctor_nombre: Optional[str] = None
    contenido: str
    tags: List[str] = []
    fecha: str

class NotaClinicaCreate(BaseModel):
    paciente_id: str
    contenido: str
    tags: List[str] = []

class ArchivoMedico(BaseModel):
    id: str
    paciente_id: str
    nombre: str
    tipo: str
    url: str
    fecha: str
    descripcion: Optional[str] = None

class ArchivoMedicoCreate(BaseModel):
    paciente_id: str
    nombre: str
    tipo: str
    url: str
    descripcion: Optional[str] = None

class KPIResponse(BaseModel):
    pacientes_hoy: int
    ingresos_mes: float
    citas_completadas: int
    citas_canceladas: int
    nuevos_pacientes: int

class MessageResponse(BaseModel):
    message: str

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, rol: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "rol": rol,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Se requieren permisos de administrador")
    return current_user

# ============ HELPER: ENRICH APPOINTMENTS SIN N+1 ============

async def enrich_appointments(appointments: list) -> list:
    """Carga pacientes y doctores en 2 queries en lugar de 2*N queries."""
    if not appointments:
        return appointments

    patient_ids = list({a["paciente_id"] for a in appointments})
    doctor_ids  = list({a["doctor_id"]  for a in appointments})

    patients_list, doctors_list = await asyncio.gather(
        db.patients.find({"id": {"$in": patient_ids}}, {"_id": 0}).to_list(None),
        db.doctors.find( {"id": {"$in": doctor_ids}},  {"_id": 0}).to_list(None),
    )

    patients = {p["id"]: p for p in patients_list}
    doctors  = {d["id"]: d for d in doctors_list}

    for apt in appointments:
        p = patients.get(apt["paciente_id"])
        d = doctors.get(apt["doctor_id"])
        apt["paciente_nombre"] = f"{p['nombre']} {p['apellido']}" if p else "Desconocido"
        apt["doctor_nombre"]   = d["nombre"]              if d else "Desconocido"
        apt["doctor_color"]    = d.get("color", "#0ea5e9") if d else "#0ea5e9"

    return appointments

# ============ AUTH ROUTES ============

@api_router.post("/auth/bootstrap", response_model=UserResponse, tags=["Auth"])
async def bootstrap_admin(user_data: UserCreate):
    """
    Crea el primer administrador del sistema.
    Solo funciona si no existe NINGÚN usuario en la base de datos.
    Una vez creado el primer admin, este endpoint devuelve 403.
    """
    count = await db.users.count_documents({})
    if count > 0:
        raise HTTPException(
            status_code=403,
            detail="Ya existen usuarios en el sistema. Usa /admin/usuarios para crear cuentas adicionales."
        )
    if user_data.rol != UserRole.ADMIN:
        raise HTTPException(
            status_code=400,
            detail="El primer usuario creado debe tener rol 'admin'."
        )
    return await _create_user_internal(user_data)

@api_router.post("/auth/register", response_model=UserResponse, tags=["Auth"])
async def register(user_data: UserCreate, _: dict = Depends(require_admin)):
    """Crear cuenta de usuario. Solo accesible por administradores."""
    return await _create_user_internal(user_data)

@api_router.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(credentials: UserLogin):
    if not login_limiter.is_allowed(credentials.email):
        logger.warning(f"Rate limit excedido en login para: {credentials.email}")
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espera un minuto antes de intentarlo de nuevo."
        )

    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        logger.warning(f"Login fallido para: {credentials.email}")
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_token(user["id"], user["email"], user["rol"])
    user_response = UserResponse(
        id=user["id"], email=user["email"],
        nombre=user["nombre"], rol=user["rol"], created_at=user["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse, tags=["Auth"])
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ── Helper interno compartido por /auth/register y /admin/usuarios ───────────
async def _create_user_internal(user_data: UserCreate) -> UserResponse:
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id":         user_id,
        "email":      user_data.email,
        "nombre":     user_data.nombre,
        "rol":        user_data.rol,
        "password":   hash_password(user_data.password),
        "created_at": now,
    }
    await db.users.insert_one(user_doc)
    logger.info(f"Usuario creado: {user_data.email} ({user_data.rol})")
    return UserResponse(
        id=user_id, email=user_data.email,
        nombre=user_data.nombre, rol=user_data.rol, created_at=now
    )

# ============ ADMIN — GESTIÓN DE USUARIOS ============

@api_router.get("/admin/usuarios", response_model=List[UserResponse], tags=["Admin"])
async def list_users(_: dict = Depends(require_admin)):
    """Lista todos los usuarios del sistema."""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(200)
    return users

@api_router.post("/admin/usuarios", response_model=UserResponse, tags=["Admin"])
async def create_user(user_data: UserCreate, _: dict = Depends(require_admin)):
    """Crea un nuevo usuario (empleado de la clínica). Solo admins."""
    return await _create_user_internal(user_data)

@api_router.put("/admin/usuarios/{user_id}", response_model=UserResponse, tags=["Admin"])
async def update_user(
    user_id: str,
    user_data: UserCreate,
    current_admin: dict = Depends(require_admin),
):
    """Actualiza datos de un usuario (incluyendo contraseña). Solo admins."""
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(404, "Usuario no encontrado")
    updates = {
        "email":    user_data.email,
        "nombre":   user_data.nombre,
        "rol":      user_data.rol,
        "password": hash_password(user_data.password),
    }
    await db.users.update_one({"id": user_id}, {"$set": updates})
    return UserResponse(
        id=user_id, email=user_data.email,
        nombre=user_data.nombre, rol=user_data.rol,
        created_at=existing["created_at"]
    )

@api_router.delete("/admin/usuarios/{user_id}", response_model=MessageResponse, tags=["Admin"])
async def delete_user(user_id: str, current_admin: dict = Depends(require_admin)):
    """Elimina un usuario. No puedes eliminarte a ti mismo."""
    if current_admin["id"] == user_id:
        raise HTTPException(400, "No puedes eliminar tu propia cuenta")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Usuario no encontrado")
    logger.info(f"Usuario {user_id} eliminado por admin {current_admin['email']}")
    return MessageResponse(message="Usuario eliminado correctamente")

# ============ DOCTORS ROUTES ============

@api_router.get("/doctors", response_model=List[Doctor], tags=["Doctores"])
async def get_doctors(current_user: dict = Depends(get_current_user)):
    return await db.doctors.find({}, {"_id": 0}).to_list(500)

@api_router.post("/doctors", response_model=Doctor, tags=["Doctores"])
async def create_doctor(doctor_data: DoctorCreate, _: dict = Depends(require_admin)):
    existing = await db.doctors.find_one({"email": doctor_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un doctor con ese email")
    doctor_id = str(uuid.uuid4())
    doctor_doc = {
        "id": doctor_id,
        **doctor_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.doctors.insert_one(doctor_doc)
    return Doctor(**doctor_doc)

@api_router.get("/doctors/{doctor_id}", response_model=Doctor, tags=["Doctores"])
async def get_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return Doctor(**doctor)

@api_router.get("/doctors/active/today", response_model=List[Doctor], tags=["Doctores"])
async def get_active_doctors(current_user: dict = Depends(get_current_user)):
    return await db.doctors.find({"activo": True}, {"_id": 0}).to_list(500)

# ============ PATIENTS ROUTES ============

@api_router.get("/patients", response_model=List[Patient], tags=["Pacientes"])
async def get_patients(
    skip:  int = Query(0,  ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    return await db.patients.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(None)

@api_router.post("/patients", response_model=Patient, tags=["Pacientes"])
async def create_patient(
    patient_data: PatientCreate,
    current_user: dict = Depends(get_current_user)
):
    patient_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    patient_doc = {"id": patient_id, **patient_data.model_dump(), "created_at": now}
    await db.patients.insert_one(patient_doc)
    await db.odontograms.insert_one({
        "id": str(uuid.uuid4()), "paciente_id": patient_id,
        "dientes": [], "updated_at": now
    })
    return Patient(**patient_doc)

@api_router.get("/patients/{patient_id}", response_model=Patient, tags=["Pacientes"])
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return Patient(**patient)

@api_router.put("/patients/{patient_id}", response_model=Patient, tags=["Pacientes"])
async def update_patient(
    patient_id: str,
    patient_data: PatientCreate,
    current_user: dict = Depends(get_current_user)
):
    result = await db.patients.update_one(
        {"id": patient_id}, {"$set": patient_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return Patient(**await db.patients.find_one({"id": patient_id}, {"_id": 0}))

@api_router.delete("/patients/{patient_id}", response_model=MessageResponse, tags=["Pacientes"])
async def delete_patient(patient_id: str, _: dict = Depends(require_admin)):
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    await asyncio.gather(
        db.odontograms.delete_many({"paciente_id": patient_id}),
        db.notas_clinicas.delete_many({"paciente_id": patient_id}),
        db.archivos_medicos.delete_many({"paciente_id": patient_id}),
    )
    logger.info(f"Paciente {patient_id} eliminado")
    return MessageResponse(message="Paciente eliminado correctamente")

# ============ APPOINTMENTS ROUTES ============

@api_router.get("/appointments", response_model=List[Appointment], tags=["Citas"])
async def get_appointments(
    fecha:     Optional[str] = None,
    doctor_id: Optional[str] = None,
    skip:  int = Query(0,  ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    if fecha:
        validate_date(fecha)
    query: Dict[str, Any] = {}
    if fecha:
        query["fecha"] = fecha
    if doctor_id:
        query["doctor_id"] = doctor_id
    appointments = (
        await db.appointments.find(query, {"_id": 0})
        .skip(skip).limit(limit).to_list(None)
    )
    return await enrich_appointments(appointments)

@api_router.post("/appointments", response_model=Appointment, tags=["Citas"])
async def create_appointment(
    apt_data: AppointmentCreate,
    current_user: dict = Depends(get_current_user)
):
    apt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    apt_doc = {"id": apt_id, **apt_data.model_dump(), "created_at": now}
    await db.appointments.insert_one(apt_doc)
    return Appointment(**(await enrich_appointments([apt_doc]))[0])

@api_router.put("/appointments/{apt_id}/status", response_model=MessageResponse, tags=["Citas"])
async def update_appointment_status(
    apt_id: str,
    estado: str,
    current_user: dict = Depends(get_current_user)
):
    valid_states = ["confirmada", "en_sala", "atendido", "cancelada"]
    if estado not in valid_states:
        raise HTTPException(400, f"Estado inválido. Valores permitidos: {valid_states}")
    result = await db.appointments.update_one({"id": apt_id}, {"$set": {"estado": estado}})
    if result.matched_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    return MessageResponse(message="Estado actualizado")

@api_router.put("/appointments/{apt_id}", response_model=Appointment, tags=["Citas"])
async def update_appointment(
    apt_id: str,
    apt_data: AppointmentCreate,
    current_user: dict = Depends(get_current_user)
):
    result = await db.appointments.update_one(
        {"id": apt_id}, {"$set": apt_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    return Appointment(**(await enrich_appointments([apt]))[0])

@api_router.delete("/appointments/{apt_id}", response_model=MessageResponse, tags=["Citas"])
async def delete_appointment(apt_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.appointments.delete_one({"id": apt_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    return MessageResponse(message="Cita eliminada")

# ============ ODONTOGRAM ROUTES ============

@api_router.get("/patients/{patient_id}/odontogram", response_model=Odontogram, tags=["Odontograma"])
async def get_odontogram(patient_id: str, current_user: dict = Depends(get_current_user)):
    odontogram = await db.odontograms.find_one({"paciente_id": patient_id}, {"_id": 0})
    if not odontogram:
        now = datetime.now(timezone.utc).isoformat()
        odontogram = {"id": str(uuid.uuid4()), "paciente_id": patient_id, "dientes": [], "updated_at": now}
        await db.odontograms.insert_one(odontogram)
    return Odontogram(**odontogram)

@api_router.put("/patients/{patient_id}/odontogram", response_model=MessageResponse, tags=["Odontograma"])
async def update_odontogram(
    patient_id: str,
    update: OdontogramUpdate,
    current_user: dict = Depends(get_current_user)
):
    odontogram = await db.odontograms.find_one({"paciente_id": patient_id})
    now = datetime.now(timezone.utc).isoformat()
    if not odontogram:
        odontogram = {"id": str(uuid.uuid4()), "paciente_id": patient_id, "dientes": [], "updated_at": now}
        await db.odontograms.insert_one(odontogram)

    dientes = odontogram.get("dientes", [])
    tooth_found = False
    for diente in dientes:
        if diente["numero"] == update.diente_numero:
            diente.setdefault("zonas", {})[update.zona] = update.estado
            tooth_found = True
            break
    if not tooth_found:
        dientes.append({"numero": update.diente_numero, "zonas": {update.zona: update.estado}})

    await db.odontograms.update_one(
        {"paciente_id": patient_id},
        {"$set": {"dientes": dientes, "updated_at": now}}
    )
    return MessageResponse(message="Odontograma actualizado")

# ============ CLINICAL NOTES ROUTES ============

@api_router.get("/patients/{patient_id}/notas", response_model=List[NotaClinica], tags=["Notas"])
async def get_patient_notes(patient_id: str, current_user: dict = Depends(get_current_user)):
    notas = await db.notas_clinicas.find(
        {"paciente_id": patient_id}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)

    # Carga doctores en 1 query (evita N+1)
    doctor_ids = list({n.get("doctor_id") for n in notas if n.get("doctor_id")})
    doctors = {
        d["id"]: d["nombre"]
        for d in await db.doctors.find({"id": {"$in": doctor_ids}}, {"_id": 0}).to_list(None)
    }
    for nota in notas:
        nota["doctor_nombre"] = doctors.get(nota.get("doctor_id"), "Desconocido")
    return notas

@api_router.post("/patients/{patient_id}/notas", response_model=NotaClinica, tags=["Notas"])
async def create_patient_note(
    patient_id: str,
    nota_data: NotaClinicaCreate,
    current_user: dict = Depends(get_current_user)
):
    nota_doc = {
        "id":          str(uuid.uuid4()),
        "paciente_id": patient_id,
        "doctor_id":   current_user["id"],
        "contenido":   nota_data.contenido,
        "tags":        nota_data.tags,
        "fecha":       datetime.now(timezone.utc).isoformat()
    }
    await db.notas_clinicas.insert_one(nota_doc)
    nota_doc["doctor_nombre"] = current_user["nombre"]
    return NotaClinica(**nota_doc)

# ============ MEDICAL FILES ROUTES ============

@api_router.get("/patients/{patient_id}/archivos", response_model=List[ArchivoMedico], tags=["Archivos"])
async def get_patient_files(patient_id: str, current_user: dict = Depends(get_current_user)):
    return await db.archivos_medicos.find({"paciente_id": patient_id}, {"_id": 0}).to_list(100)

@api_router.post("/patients/{patient_id}/archivos", response_model=ArchivoMedico, tags=["Archivos"])
async def create_patient_file(
    patient_id: str,
    archivo_data: ArchivoMedicoCreate,
    current_user: dict = Depends(get_current_user)
):
    archivo_doc = {
        "id":          str(uuid.uuid4()),
        "paciente_id": patient_id,
        "nombre":      archivo_data.nombre,
        "tipo":        archivo_data.tipo,
        "url":         archivo_data.url,
        "descripcion": archivo_data.descripcion,
        "fecha":       datetime.now(timezone.utc).isoformat()
    }
    await db.archivos_medicos.insert_one(archivo_doc)
    return ArchivoMedico(**archivo_doc)

# ============ KPI / DASHBOARD ============

@api_router.get("/dashboard/kpis", response_model=KPIResponse, tags=["Dashboard"])
async def get_dashboard_kpis(current_user: dict = Depends(get_current_user)):
    today       = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")

    pacientes_hoy, citas_completadas, citas_canceladas, nuevos_pacientes = await asyncio.gather(
        db.appointments.count_documents({"fecha": today}),
        db.appointments.count_documents({"fecha": {"$gte": month_start}, "estado": "atendido"}),
        db.appointments.count_documents({"fecha": {"$gte": month_start}, "estado": "cancelada"}),
        db.patients.count_documents({"created_at": {"$gte": month_start}}),
    )
    return KPIResponse(
        pacientes_hoy=pacientes_hoy,
        ingresos_mes=citas_completadas * 150.0,
        citas_completadas=citas_completadas,
        citas_canceladas=citas_canceladas,
        nuevos_pacientes=nuevos_pacientes
    )

@api_router.get("/", tags=["Sistema"])
async def root():
    return {"message": "Dentu API v1.0", "status": "ok"}

@api_router.get("/config", tags=["Sistema"])
async def get_clinic_config():
    """
    Endpoint público — devuelve la configuración de la clínica.
    El frontend lo usa al arrancar para mostrar nombre, logo y horarios.
    """
    return {
        "clinic_name":          CLINIC_NAME,
        "clinic_logo_url":      CLINIC_LOGO_URL,
        "clinic_primary_color": CLINIC_PRIMARY_COLOR,
        "clinic_phone":         CLINIC_PHONE,
        "clinic_address":       CLINIC_ADDRESS,
        "clinic_timezone":      CLINIC_TIMEZONE,
        "work_start":           WORK_START,
        "work_end":             WORK_END,
        "slot_duration":        SLOT_DURATION,
    }

# ============================================================
#  WEBHOOKS PARA N8N
#  Auth: ?api_key=<WEBHOOK_API_KEY>  (sin JWT)
# ============================================================

def verify_webhook_key(api_key: str = Query(..., alias="api_key")):
    if not verify_webhook_key_safe(api_key):
        logger.warning("Intento de acceso webhook con API key inválida")
        raise HTTPException(status_code=401, detail="API key inválida")
    if not webhook_limiter.is_allowed(api_key):
        raise HTTPException(status_code=429, detail="Límite de peticiones excedido. Intenta en un minuto.")
    return True

class WebhookPatientCreate(BaseModel):
    nombre: str
    apellido: str
    telefono: str
    email: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    direccion: Optional[str] = None
    alertas_medicas: List[AlertaMedica] = []
    notas: Optional[str] = None

class WebhookAppointmentCreate(BaseModel):
    paciente_id: Optional[str] = None
    paciente_telefono: Optional[str] = None
    doctor_id: str
    fecha: str
    hora_inicio: str
    hora_fin: str
    motivo: str
    notas: Optional[str] = None

    @field_validator('fecha')
    @classmethod
    def validate_fecha(cls, v: str) -> str:
        if not _DATE_RE.match(v):
            raise ValueError('fecha debe estar en formato YYYY-MM-DD')
        return v

    @field_validator('hora_inicio', 'hora_fin')
    @classmethod
    def validate_hora(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError('hora debe estar en formato HH:MM')
        return v

# ── GET /webhook/doctores ──────────────────────────────────
@api_router.get("/webhook/doctores",
    summary="n8n → Lista doctores activos",
    tags=["Webhooks n8n"])
async def webhook_get_doctores(_: bool = Depends(verify_webhook_key)):
    """Retorna todos los doctores activos para mostrar opciones al paciente."""
    doctors = await db.doctors.find({"activo": True}, {"_id": 0}).to_list(500)
    return {"doctores": doctors, "total": len(doctors)}

# ── GET /webhook/pacientes/buscar ──────────────────────────
@api_router.get("/webhook/pacientes/buscar",
    summary="n8n → Buscar paciente por teléfono o nombre",
    tags=["Webhooks n8n"])
async def webhook_buscar_paciente(
    telefono: Optional[str] = None,
    nombre:   Optional[str] = None,
    _: bool = Depends(verify_webhook_key)
):
    """
    Busca por teléfono (match exacto) o nombre (búsqueda parcial).
    Retorna hasta 10 coincidencias.
    """
    if not telefono and not nombre:
        raise HTTPException(400, "Debes proporcionar 'telefono' o 'nombre'")

    query: Dict[str, Any] = {}
    if telefono:
        query["telefono"] = telefono.strip()           # Exact match, sin regex
    elif nombre:
        escaped = safe_regex(nombre.strip())
        query["$or"] = [
            {"nombre":   {"$regex": escaped, "$options": "i"}},
            {"apellido": {"$regex": escaped, "$options": "i"}},
        ]

    patients = await db.patients.find(query, {"_id": 0}).to_list(10)
    return {"pacientes": patients, "total": len(patients)}

# ── POST /webhook/pacientes/registrar ─────────────────────
@api_router.post("/webhook/pacientes/registrar",
    summary="n8n → Registrar nuevo paciente",
    tags=["Webhooks n8n"])
async def webhook_registrar_paciente(
    patient_data: WebhookPatientCreate,
    _: bool = Depends(verify_webhook_key)
):
    """Crea un paciente nuevo. Si ya existe por teléfono, retorna el existente sin duplicar."""
    existing = await db.patients.find_one({"telefono": patient_data.telefono})
    if existing:
        return {
            "paciente": {k: v for k, v in existing.items() if k != "_id"},
            "creado": False,
            "mensaje": "El paciente ya estaba registrado"
        }

    patient_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    patient_doc = {
        "id": patient_id, **patient_data.model_dump(),
        "avatar_url": None, "created_at": now
    }
    await db.patients.insert_one(patient_doc)
    await db.odontograms.insert_one({
        "id": str(uuid.uuid4()), "paciente_id": patient_id,
        "dientes": [], "updated_at": now
    })
    return {"paciente": {k: v for k, v in patient_doc.items() if k != "_id"}, "creado": True}

# ── GET /webhook/citas/disponibilidad ─────────────────────
@api_router.get("/webhook/citas/disponibilidad",
    summary="n8n → Slots disponibles para una fecha",
    tags=["Webhooks n8n"])
async def webhook_disponibilidad(
    fecha:     str,
    doctor_id: Optional[str] = None,
    _: bool = Depends(verify_webhook_key)
):
    """Retorna horarios disponibles según horario de la clínica (WORK_START–WORK_END, SLOT_DURATION min)."""
    validate_date(fecha)

    doctor_query: Dict[str, Any] = {"activo": True}
    if doctor_id:
        doctor_query["id"] = doctor_id

    doctors, existing_apts = await asyncio.gather(
        db.doctors.find(doctor_query, {"_id": 0}).to_list(500),
        db.appointments.find(
            {"fecha": fecha, "estado": {"$ne": "cancelada"}}, {"_id": 0}
        ).to_list(1000),
    )

    occupied: Dict[str, set] = defaultdict(set)
    for apt in existing_apts:
        occupied[apt["doctor_id"]].add(apt["hora_inicio"])

    # Genera template de slots usando la config de horario (WORK_START/WORK_END/SLOT_DURATION)
    slots_template = []
    cur = WORK_START * 60                      # minutos desde medianoche
    end = WORK_END   * 60
    while cur + SLOT_DURATION <= end:
        h_s = f"{cur // 60:02d}:{cur % 60:02d}"
        nxt = cur + SLOT_DURATION
        h_e = f"{nxt // 60:02d}:{nxt % 60:02d}"
        slots_template.append((h_s, h_e))
        cur = nxt

    available = [
        {
            "fecha":        fecha,
            "hora_inicio":  s,
            "hora_fin":     e,
            "doctor_id":    doc["id"],
            "doctor_nombre": doc["nombre"],
            "especialidad":  doc.get("especialidad", ""),
        }
        for doc in doctors
        for s, e in slots_template
        if s not in occupied.get(doc["id"], set())
    ]

    return {"fecha": fecha, "slots_disponibles": len(available), "disponibilidad": available}

# ── POST /webhook/citas/agendar ───────────────────────────
@api_router.post("/webhook/citas/agendar",
    summary="n8n → Agendar una cita",
    tags=["Webhooks n8n"])
async def webhook_agendar_cita(
    apt_data: WebhookAppointmentCreate,
    _: bool = Depends(verify_webhook_key)
):
    """Crea una cita. Identifica al paciente por 'paciente_id' o 'paciente_telefono'."""
    patient = None
    if apt_data.paciente_id:
        patient = await db.patients.find_one({"id": apt_data.paciente_id}, {"_id": 0})
    elif apt_data.paciente_telefono:
        patient = await db.patients.find_one(
            {"telefono": apt_data.paciente_telefono.strip()}, {"_id": 0}
        )

    if not patient:
        raise HTTPException(404,
            "Paciente no encontrado. Regístralo primero con /webhook/pacientes/registrar"
        )

    doctor = await db.doctors.find_one({"id": apt_data.doctor_id, "activo": True}, {"_id": 0})
    if not doctor:
        raise HTTPException(404, "Doctor no encontrado o inactivo")

    conflict = await db.appointments.find_one({
        "fecha":       apt_data.fecha,
        "hora_inicio": apt_data.hora_inicio,
        "doctor_id":   apt_data.doctor_id,
        "estado":      {"$ne": "cancelada"}
    })
    if conflict:
        raise HTTPException(409,
            f"El horario {apt_data.hora_inicio} del {apt_data.fecha} ya está ocupado"
        )

    apt_id = str(uuid.uuid4())
    apt_doc = {
        "id":          apt_id,
        "paciente_id": patient["id"],
        "doctor_id":   apt_data.doctor_id,
        "fecha":       apt_data.fecha,
        "hora_inicio": apt_data.hora_inicio,
        "hora_fin":    apt_data.hora_fin,
        "motivo":      apt_data.motivo,
        "estado":      "confirmada",
        "notas":       apt_data.notas,
        "created_at":  datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(apt_doc)

    return {
        "cita": {
            "id":       apt_id,
            "paciente": f"{patient['nombre']} {patient['apellido']}",
            "doctor":   doctor["nombre"],
            "fecha":    apt_data.fecha,
            "hora":     f"{apt_data.hora_inicio} – {apt_data.hora_fin}",
            "motivo":   apt_data.motivo,
            "estado":   "confirmada",
        },
        "agendada": True
    }

# ── GET /webhook/citas/consultar ──────────────────────────
@api_router.get("/webhook/citas/consultar",
    summary="n8n → Consultar citas",
    tags=["Webhooks n8n"])
async def webhook_consultar_citas(
    fecha:             Optional[str] = None,
    fecha_inicio:      Optional[str] = None,
    fecha_fin:         Optional[str] = None,
    paciente_telefono: Optional[str] = None,
    doctor_id:         Optional[str] = None,
    estado:            Optional[str] = None,
    _: bool = Depends(verify_webhook_key)
):
    """
    Filtra citas por fecha exacta, rango de fechas, teléfono, doctor o estado.
    Por defecto excluye canceladas.
    """
    query: Dict[str, Any] = {}

    if fecha:
        validate_date(fecha)
        query["fecha"] = fecha
    elif fecha_inicio or fecha_fin:
        date_filter: Dict[str, str] = {}
        if fecha_inicio:
            validate_date(fecha_inicio, "fecha_inicio")
            date_filter["$gte"] = fecha_inicio
        if fecha_fin:
            validate_date(fecha_fin, "fecha_fin")
            date_filter["$lte"] = fecha_fin
        query["fecha"] = date_filter

    valid_states = ["confirmada", "en_sala", "atendido", "cancelada"]
    if estado:
        if estado not in valid_states:
            raise HTTPException(400, f"estado inválido. Usa uno de: {valid_states}")
        query["estado"] = estado
    else:
        query["estado"] = {"$ne": "cancelada"}

    if doctor_id:
        query["doctor_id"] = doctor_id

    if paciente_telefono:
        patient = await db.patients.find_one({"telefono": paciente_telefono.strip()}, {"_id": 0})
        if not patient:
            return {"citas": [], "total": 0}
        query["paciente_id"] = patient["id"]

    appointments = (
        await db.appointments.find(query, {"_id": 0})
        .sort("fecha", 1).to_list(200)
    )
    enriched = await enrich_appointments(appointments)
    return {"citas": enriched, "total": len(enriched)}

# ── POST /webhook/demo/sembrar ────────────────────────────
@api_router.post("/webhook/demo/sembrar",
    summary="n8n → Sembrar datos de demostración",
    tags=["Webhooks n8n"])
async def webhook_sembrar_demo(_: bool = Depends(verify_webhook_key)):
    """Inserta doctores demo para pruebas. No hace nada si ya existen doctores."""
    existing_count = await db.doctors.count_documents({})
    if existing_count > 0:
        return {"mensaje": f"Ya existen {existing_count} doctores", "sembrado": False}

    now = datetime.now(timezone.utc).isoformat()
    demo_doctors = [
        {"id": "doc-001", "nombre": "Dra. María García",    "especialidad": "Odontología General",
         "email": "maria.garcia@dentu.com",    "telefono": "+52 555 123 4567",
         "color": "#0ea5e9", "activo": True,  "avatar_url": None, "created_at": now},
        {"id": "doc-002", "nombre": "Dr. Carlos Mendoza",   "especialidad": "Endodoncia",
         "email": "carlos.mendoza@dentu.com",  "telefono": "+52 555 234 5678",
         "color": "#10b981", "activo": True,  "avatar_url": None, "created_at": now},
        {"id": "doc-003", "nombre": "Dra. Ana Rodríguez",   "especialidad": "Ortodoncia",
         "email": "ana.rodriguez@dentu.com",   "telefono": "+52 555 345 6789",
         "color": "#8b5cf6", "activo": True,  "avatar_url": None, "created_at": now},
        {"id": "doc-004", "nombre": "Dr. Roberto Sánchez",  "especialidad": "Cirugía Maxilofacial",
         "email": "roberto.sanchez@dentu.com", "telefono": "+52 555 456 7890",
         "color": "#f59e0b", "activo": False, "avatar_url": None, "created_at": now},
    ]
    await db.doctors.insert_many(demo_doctors)
    return {
        "mensaje":          "Datos demo creados",
        "sembrado":         True,
        "doctores_creados": len(demo_doctors),
        "doctores_activos": sum(1 for d in demo_doctors if d["activo"]),
    }

# ============ REGISTRA ROUTER + CORS ============

app.include_router(api_router)

_cors_origins = [
    o.strip()
    for o in os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
