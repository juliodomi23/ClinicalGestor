"""
Modelos Pydantic y helpers de validación compartidos.
"""
import re
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, EmailStr, field_validator

# ── Regex de validación ───────────────────────────────────────────────────────
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_TIME_RE = re.compile(r'^\d{2}:\d{2}$')


# ── Helpers de validación ─────────────────────────────────────────────────────

def validate_date(value: str, field_name: str = "fecha") -> str:
    from fastapi import HTTPException
    from datetime import datetime
    if not value or not _DATE_RE.match(value):
        raise HTTPException(422, f"'{field_name}' debe estar en formato YYYY-MM-DD")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, f"'{field_name}' no es una fecha válida")
    return value


def validate_time(value: str, field_name: str = "hora") -> str:
    from fastapi import HTTPException
    if not value or not _TIME_RE.match(value):
        raise HTTPException(422, f"'{field_name}' debe estar en formato HH:MM")
    return value


def safe_regex(text: str, max_len: int = 100) -> str:
    """Escapa input del usuario antes de usarlo en $regex de MongoDB."""
    return re.escape(text[:max_len])


# ── Roles ─────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    ADMIN     = "admin"
    DOCTOR    = "doctor"
    RECEPCION = "recepcion"


# ── Usuarios ──────────────────────────────────────────────────────────────────

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


# ── Doctores ──────────────────────────────────────────────────────────────────

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


# ── Pacientes ─────────────────────────────────────────────────────────────────

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


# ── Citas ─────────────────────────────────────────────────────────────────────

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


# ── Odontograma ───────────────────────────────────────────────────────────────

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


# ── Notas y archivos clínicos ─────────────────────────────────────────────────

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


# ── Especialidades ────────────────────────────────────────────────────────────

class EspecialidadCreate(BaseModel):
    nombre: str

class Especialidad(BaseModel):
    id: str
    nombre: str


# ── Dashboard ─────────────────────────────────────────────────────────────────

class KPIResponse(BaseModel):
    pacientes_hoy: int
    ingresos_mes: float
    citas_completadas: int
    citas_canceladas: int
    nuevos_pacientes: int


# ── Genérico ──────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


# ── Webhooks ──────────────────────────────────────────────────────────────────

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
