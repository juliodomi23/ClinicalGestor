from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'clinica-dental-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI(title="Clínica Dental API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserBase(BaseModel):
    email: EmailStr
    nombre: str
    rol: str = Field(default="doctor", description="admin, doctor, recepcion")

class UserCreate(UserBase):
    password: str

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
    estado: str = Field(default="confirmada", description="confirmada, en_sala, atendido, cancelada")
    notas: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    id: str
    created_at: str
    paciente_nombre: Optional[str] = None
    doctor_nombre: Optional[str] = None
    doctor_color: Optional[str] = None

class ToothZone(BaseModel):
    zona: str
    estado: str
    notas: Optional[str] = None

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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
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

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "nombre": user_data.nombre,
        "rol": user_data.rol,
        "password": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, user_data.rol)
    user_response = UserResponse(id=user_id, email=user_data.email, nombre=user_data.nombre, rol=user_data.rol, created_at=user_doc["created_at"])
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    token = create_token(user["id"], user["email"], user["rol"])
    user_response = UserResponse(id=user["id"], email=user["email"], nombre=user["nombre"], rol=user["rol"], created_at=user["created_at"])
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============ DOCTORS ROUTES ============

@api_router.get("/doctors", response_model=List[Doctor])
async def get_doctors(current_user: dict = Depends(get_current_user)):
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(100)
    return doctors

@api_router.post("/doctors", response_model=Doctor)
async def create_doctor(doctor_data: DoctorCreate, current_user: dict = Depends(get_current_user)):
    if current_user["rol"] != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear doctores")
    
    doctor_id = str(uuid.uuid4())
    doctor_doc = {
        "id": doctor_id,
        **doctor_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.doctors.insert_one(doctor_doc)
    return Doctor(**doctor_doc)

@api_router.get("/doctors/{doctor_id}", response_model=Doctor)
async def get_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return Doctor(**doctor)

@api_router.get("/doctors/active/today", response_model=List[Doctor])
async def get_active_doctors(current_user: dict = Depends(get_current_user)):
    doctors = await db.doctors.find({"activo": True}, {"_id": 0}).to_list(100)
    return doctors

# ============ PATIENTS ROUTES ============

@api_router.get("/patients", response_model=List[Patient])
async def get_patients(current_user: dict = Depends(get_current_user)):
    patients = await db.patients.find({}, {"_id": 0}).to_list(1000)
    return patients

@api_router.post("/patients", response_model=Patient)
async def create_patient(patient_data: PatientCreate, current_user: dict = Depends(get_current_user)):
    patient_id = str(uuid.uuid4())
    patient_doc = {
        "id": patient_id,
        **patient_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.patients.insert_one(patient_doc)
    
    # Create empty odontogram
    odontogram_doc = {
        "id": str(uuid.uuid4()),
        "paciente_id": patient_id,
        "dientes": [],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.odontograms.insert_one(odontogram_doc)
    
    return Patient(**patient_doc)

@api_router.get("/patients/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return Patient(**patient)

@api_router.put("/patients/{patient_id}", response_model=Patient)
async def update_patient(patient_id: str, patient_data: PatientCreate, current_user: dict = Depends(get_current_user)):
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$set": patient_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    return Patient(**patient)

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    # Also delete related data
    await db.odontograms.delete_many({"paciente_id": patient_id})
    await db.notas_clinicas.delete_many({"paciente_id": patient_id})
    await db.archivos_medicos.delete_many({"paciente_id": patient_id})
    return {"message": "Paciente eliminado correctamente"}

# ============ APPOINTMENTS ROUTES ============

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(
    fecha: Optional[str] = None,
    doctor_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if fecha:
        query["fecha"] = fecha
    if doctor_id:
        query["doctor_id"] = doctor_id
    
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with patient and doctor names
    for apt in appointments:
        patient = await db.patients.find_one({"id": apt["paciente_id"]}, {"_id": 0})
        doctor = await db.doctors.find_one({"id": apt["doctor_id"]}, {"_id": 0})
        if patient:
            apt["paciente_nombre"] = f"{patient['nombre']} {patient['apellido']}"
        if doctor:
            apt["doctor_nombre"] = doctor["nombre"]
            apt["doctor_color"] = doctor.get("color", "#0ea5e9")
    
    return appointments

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(apt_data: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    apt_id = str(uuid.uuid4())
    apt_doc = {
        "id": apt_id,
        **apt_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(apt_doc)
    
    # Enrich response
    patient = await db.patients.find_one({"id": apt_data.paciente_id}, {"_id": 0})
    doctor = await db.doctors.find_one({"id": apt_data.doctor_id}, {"_id": 0})
    apt_doc["paciente_nombre"] = f"{patient['nombre']} {patient['apellido']}" if patient else None
    apt_doc["doctor_nombre"] = doctor["nombre"] if doctor else None
    apt_doc["doctor_color"] = doctor.get("color", "#0ea5e9") if doctor else None
    
    return Appointment(**apt_doc)

@api_router.put("/appointments/{apt_id}/status")
async def update_appointment_status(apt_id: str, estado: str, current_user: dict = Depends(get_current_user)):
    valid_states = ["confirmada", "en_sala", "atendido", "cancelada"]
    if estado not in valid_states:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Debe ser: {', '.join(valid_states)}")
    
    result = await db.appointments.update_one({"id": apt_id}, {"$set": {"estado": estado}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return {"message": "Estado actualizado"}

@api_router.put("/appointments/{apt_id}")
async def update_appointment(apt_id: str, apt_data: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    result = await db.appointments.update_one(
        {"id": apt_id},
        {"$set": apt_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    # Enrich
    patient = await db.patients.find_one({"id": apt["paciente_id"]}, {"_id": 0})
    doctor = await db.doctors.find_one({"id": apt["doctor_id"]}, {"_id": 0})
    apt["paciente_nombre"] = f"{patient['nombre']} {patient['apellido']}" if patient else None
    apt["doctor_nombre"] = doctor["nombre"] if doctor else None
    apt["doctor_color"] = doctor.get("color", "#0ea5e9") if doctor else None
    return apt

@api_router.delete("/appointments/{apt_id}")
async def delete_appointment(apt_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.appointments.delete_one({"id": apt_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return {"message": "Cita eliminada"}

# ============ ODONTOGRAM ROUTES ============

@api_router.get("/patients/{patient_id}/odontogram", response_model=Odontogram)
async def get_odontogram(patient_id: str, current_user: dict = Depends(get_current_user)):
    odontogram = await db.odontograms.find_one({"paciente_id": patient_id}, {"_id": 0})
    if not odontogram:
        # Create empty one
        odontogram = {
            "id": str(uuid.uuid4()),
            "paciente_id": patient_id,
            "dientes": [],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.odontograms.insert_one(odontogram)
    return Odontogram(**odontogram)

@api_router.put("/patients/{patient_id}/odontogram")
async def update_odontogram(patient_id: str, update: OdontogramUpdate, current_user: dict = Depends(get_current_user)):
    odontogram = await db.odontograms.find_one({"paciente_id": patient_id})
    if not odontogram:
        odontogram = {
            "id": str(uuid.uuid4()),
            "paciente_id": patient_id,
            "dientes": [],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.odontograms.insert_one(odontogram)
    
    # Update tooth data
    dientes = odontogram.get("dientes", [])
    tooth_found = False
    for diente in dientes:
        if diente["numero"] == update.diente_numero:
            if "zonas" not in diente:
                diente["zonas"] = {}
            diente["zonas"][update.zona] = update.estado
            tooth_found = True
            break
    
    if not tooth_found:
        dientes.append({
            "numero": update.diente_numero,
            "zonas": {update.zona: update.estado}
        })
    
    await db.odontograms.update_one(
        {"paciente_id": patient_id},
        {"$set": {"dientes": dientes, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Odontograma actualizado"}

# ============ CLINICAL NOTES ROUTES ============

@api_router.get("/patients/{patient_id}/notas", response_model=List[NotaClinica])
async def get_patient_notes(patient_id: str, current_user: dict = Depends(get_current_user)):
    notas = await db.notas_clinicas.find({"paciente_id": patient_id}, {"_id": 0}).sort("fecha", -1).to_list(100)
    for nota in notas:
        doctor = await db.doctors.find_one({"id": nota.get("doctor_id")}, {"_id": 0})
        nota["doctor_nombre"] = doctor["nombre"] if doctor else "Desconocido"
    return notas

@api_router.post("/patients/{patient_id}/notas", response_model=NotaClinica)
async def create_patient_note(patient_id: str, nota_data: NotaClinicaCreate, current_user: dict = Depends(get_current_user)):
    nota_id = str(uuid.uuid4())
    
    # Get doctor info if user is a doctor
    doctor_id = current_user.get("doctor_id", current_user["id"])
    
    nota_doc = {
        "id": nota_id,
        "paciente_id": patient_id,
        "doctor_id": doctor_id,
        "contenido": nota_data.contenido,
        "tags": nota_data.tags,
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    await db.notas_clinicas.insert_one(nota_doc)
    
    nota_doc["doctor_nombre"] = current_user["nombre"]
    return NotaClinica(**nota_doc)

# ============ MEDICAL FILES ROUTES ============

@api_router.get("/patients/{patient_id}/archivos", response_model=List[ArchivoMedico])
async def get_patient_files(patient_id: str, current_user: dict = Depends(get_current_user)):
    archivos = await db.archivos_medicos.find({"paciente_id": patient_id}, {"_id": 0}).to_list(100)
    return archivos

@api_router.post("/patients/{patient_id}/archivos", response_model=ArchivoMedico)
async def create_patient_file(patient_id: str, archivo_data: ArchivoMedicoCreate, current_user: dict = Depends(get_current_user)):
    archivo_id = str(uuid.uuid4())
    archivo_doc = {
        "id": archivo_id,
        "paciente_id": patient_id,
        "nombre": archivo_data.nombre,
        "tipo": archivo_data.tipo,
        "url": archivo_data.url,
        "descripcion": archivo_data.descripcion,
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    await db.archivos_medicos.insert_one(archivo_doc)
    return ArchivoMedico(**archivo_doc)

# ============ KPI / DASHBOARD ROUTES ============

@api_router.get("/dashboard/kpis", response_model=KPIResponse)
async def get_dashboard_kpis(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
    
    # Patients today
    pacientes_hoy = await db.appointments.count_documents({"fecha": today})
    
    # Completed appointments this month
    citas_completadas = await db.appointments.count_documents({
        "fecha": {"$gte": month_start},
        "estado": "atendido"
    })
    
    # Cancelled appointments this month
    citas_canceladas = await db.appointments.count_documents({
        "fecha": {"$gte": month_start},
        "estado": "cancelada"
    })
    
    # New patients this month
    nuevos_pacientes = await db.patients.count_documents({
        "created_at": {"$gte": month_start}
    })
    
    # Simulated revenue (in real app, would come from billing module)
    ingresos_mes = citas_completadas * 150.0
    
    return KPIResponse(
        pacientes_hoy=pacientes_hoy,
        ingresos_mes=ingresos_mes,
        citas_completadas=citas_completadas,
        citas_canceladas=citas_canceladas,
        nuevos_pacientes=nuevos_pacientes
    )

@api_router.get("/")
async def root():
    return {"message": "Dentu API v1.0"}

# ============ WEBHOOK / PUBLIC API FOR N8N ============
# These endpoints can be called by n8n without authentication
# using a simple API key for security

WEBHOOK_API_KEY = os.environ.get('WEBHOOK_API_KEY', 'dentu-n8n-webhook-key-2024')

def verify_webhook_key(api_key: str = Query(..., alias="api_key")):
    if api_key != WEBHOOK_API_KEY:
        raise HTTPException(status_code=401, detail="API key inválida")
    return True

# Models for webhook
class WebhookPatientCreate(BaseModel):
    nombre: str
    apellido: str
    telefono: str
    email: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    direccion: Optional[str] = None
    alertas_medicas: List[AlertaMedica] = []

class WebhookAppointmentCreate(BaseModel):
    paciente_id: Optional[str] = None
    paciente_telefono: Optional[str] = None  # Alternative to find patient
    doctor_id: str
    fecha: str
    hora_inicio: str
    hora_fin: str
    motivo: str
    notas: Optional[str] = None

class AvailableSlot(BaseModel):
    fecha: str
    hora_inicio: str
    hora_fin: str
    doctor_id: str
    doctor_nombre: str

@api_router.get("/webhook/doctors")
async def webhook_get_doctors(_: bool = Depends(verify_webhook_key)):
    """Get all active doctors - for n8n to offer doctor options"""
    doctors = await db.doctors.find({"activo": True}, {"_id": 0}).to_list(100)
    return {"doctors": doctors}

@api_router.get("/webhook/patients/search")
async def webhook_search_patient(
    telefono: Optional[str] = None,
    nombre: Optional[str] = None,
    _: bool = Depends(verify_webhook_key)
):
    """Search patient by phone or name - for n8n to find existing patients"""
    query = {}
    if telefono:
        query["telefono"] = {"$regex": telefono, "$options": "i"}
    if nombre:
        query["$or"] = [
            {"nombre": {"$regex": nombre, "$options": "i"}},
            {"apellido": {"$regex": nombre, "$options": "i"}}
        ]
    
    patients = await db.patients.find(query, {"_id": 0}).to_list(10)
    return {"patients": patients, "count": len(patients)}

@api_router.post("/webhook/patients")
async def webhook_create_patient(patient_data: WebhookPatientCreate, _: bool = Depends(verify_webhook_key)):
    """Create a new patient via webhook - for n8n bot"""
    # Check if patient with same phone exists
    existing = await db.patients.find_one({"telefono": patient_data.telefono})
    if existing:
        return {"patient": {k: v for k, v in existing.items() if k != "_id"}, "created": False, "message": "Paciente ya existe"}
    
    patient_id = str(uuid.uuid4())
    patient_doc = {
        "id": patient_id,
        **patient_data.model_dump(),
        "avatar_url": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.patients.insert_one(patient_doc)
    
    # Create empty odontogram
    await db.odontograms.insert_one({
        "id": str(uuid.uuid4()),
        "paciente_id": patient_id,
        "dientes": [],
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"patient": {k: v for k, v in patient_doc.items() if k != "_id"}, "created": True}

@api_router.get("/webhook/availability")
async def webhook_get_availability(
    fecha: str,
    doctor_id: Optional[str] = None,
    _: bool = Depends(verify_webhook_key)
):
    """Get available time slots for a date - for n8n to offer appointment options"""
    # Define working hours (8am to 7pm, 30-minute slots)
    all_slots = []
    for hour in range(8, 19):
        for minute in [0, 30]:
            slot_start = f"{hour:02d}:{minute:02d}"
            end_minute = minute + 30
            end_hour = hour
            if end_minute >= 60:
                end_minute = 0
                end_hour += 1
            slot_end = f"{end_hour:02d}:{end_minute:02d}"
            all_slots.append((slot_start, slot_end))
    
    # Get doctors
    doctor_query = {"activo": True}
    if doctor_id:
        doctor_query["id"] = doctor_id
    doctors = await db.doctors.find(doctor_query, {"_id": 0}).to_list(100)
    
    # Get existing appointments for that date
    existing = await db.appointments.find(
        {"fecha": fecha, "estado": {"$ne": "cancelada"}}, 
        {"_id": 0}
    ).to_list(1000)
    
    # Build occupied slots per doctor
    occupied = {}
    for apt in existing:
        doc_id = apt["doctor_id"]
        if doc_id not in occupied:
            occupied[doc_id] = set()
        occupied[doc_id].add(apt["hora_inicio"])
    
    # Calculate available slots
    available = []
    for doctor in doctors:
        doc_occupied = occupied.get(doctor["id"], set())
        for slot_start, slot_end in all_slots:
            if slot_start not in doc_occupied:
                available.append({
                    "fecha": fecha,
                    "hora_inicio": slot_start,
                    "hora_fin": slot_end,
                    "doctor_id": doctor["id"],
                    "doctor_nombre": doctor["nombre"]
                })
    
    return {
        "fecha": fecha,
        "slots_disponibles": len(available),
        "availability": available
    }

@api_router.post("/webhook/appointments")
async def webhook_create_appointment(apt_data: WebhookAppointmentCreate, _: bool = Depends(verify_webhook_key)):
    """Create appointment via webhook - for n8n bot"""
    # Find patient by ID or phone
    patient = None
    if apt_data.paciente_id:
        patient = await db.patients.find_one({"id": apt_data.paciente_id}, {"_id": 0})
    elif apt_data.paciente_telefono:
        patient = await db.patients.find_one({"telefono": apt_data.paciente_telefono}, {"_id": 0})
    
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado. Crea el paciente primero.")
    
    # Check doctor exists
    doctor = await db.doctors.find_one({"id": apt_data.doctor_id, "activo": True}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado o inactivo")
    
    # Check slot availability
    existing = await db.appointments.find_one({
        "fecha": apt_data.fecha,
        "hora_inicio": apt_data.hora_inicio,
        "doctor_id": apt_data.doctor_id,
        "estado": {"$ne": "cancelada"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ese horario ya está ocupado")
    
    # Create appointment
    apt_id = str(uuid.uuid4())
    apt_doc = {
        "id": apt_id,
        "paciente_id": patient["id"],
        "doctor_id": apt_data.doctor_id,
        "fecha": apt_data.fecha,
        "hora_inicio": apt_data.hora_inicio,
        "hora_fin": apt_data.hora_fin,
        "motivo": apt_data.motivo,
        "estado": "confirmada",
        "notas": apt_data.notas,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(apt_doc)
    
    return {
        "appointment": {
            "id": apt_id,
            "paciente": f"{patient['nombre']} {patient['apellido']}",
            "doctor": doctor["nombre"],
            "fecha": apt_data.fecha,
            "hora": f"{apt_data.hora_inicio} - {apt_data.hora_fin}",
            "motivo": apt_data.motivo
        },
        "created": True
    }

@api_router.get("/webhook/appointments")
async def webhook_get_appointments(
    fecha: Optional[str] = None,
    paciente_telefono: Optional[str] = None,
    _: bool = Depends(verify_webhook_key)
):
    """Get appointments - for n8n to check patient's appointments"""
    query = {"estado": {"$ne": "cancelada"}}
    
    if fecha:
        query["fecha"] = fecha
    
    if paciente_telefono:
        patient = await db.patients.find_one({"telefono": paciente_telefono}, {"_id": 0})
        if patient:
            query["paciente_id"] = patient["id"]
        else:
            return {"appointments": [], "count": 0}
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("fecha", 1).to_list(100)
    
    # Enrich
    for apt in appointments:
        patient = await db.patients.find_one({"id": apt["paciente_id"]}, {"_id": 0})
        doctor = await db.doctors.find_one({"id": apt["doctor_id"]}, {"_id": 0})
        apt["paciente_nombre"] = f"{patient['nombre']} {patient['apellido']}" if patient else "Desconocido"
        apt["doctor_nombre"] = doctor["nombre"] if doctor else "Desconocido"
    
    return {"appointments": appointments, "count": len(appointments)}

@api_router.post("/webhook/seed-demo-data")
async def webhook_seed_demo_data(_: bool = Depends(verify_webhook_key)):
    """Seed demo data for testing - creates sample doctors"""
    # Check if we already have doctors
    existing_count = await db.doctors.count_documents({})
    if existing_count > 0:
        return {"message": f"Ya existen {existing_count} doctores en la base de datos", "seeded": False}
    
    # Create demo doctors
    demo_doctors = [
        {
            "id": "doc-001",
            "nombre": "Dra. María García",
            "especialidad": "Odontología General",
            "email": "maria.garcia@dentu.com",
            "telefono": "+52 555 123 4567",
            "color": "#0ea5e9",
            "activo": True,
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "doc-002",
            "nombre": "Dr. Carlos Mendoza",
            "especialidad": "Endodoncia",
            "email": "carlos.mendoza@dentu.com",
            "telefono": "+52 555 234 5678",
            "color": "#10b981",
            "activo": True,
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "doc-003",
            "nombre": "Dra. Ana Rodríguez",
            "especialidad": "Ortodoncia",
            "email": "ana.rodriguez@dentu.com",
            "telefono": "+52 555 345 6789",
            "color": "#8b5cf6",
            "activo": True,
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "doc-004",
            "nombre": "Dr. Roberto Sánchez",
            "especialidad": "Cirugía Maxilofacial",
            "email": "roberto.sanchez@dentu.com",
            "telefono": "+52 555 456 7890",
            "color": "#f59e0b",
            "activo": False,  # Inactive doctor
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
    ]
    
    await db.doctors.insert_many(demo_doctors)
    
    return {
        "message": "Datos de demostración creados",
        "seeded": True,
        "doctors_created": len(demo_doctors),
        "active_doctors": len([d for d in demo_doctors if d["activo"]])
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
