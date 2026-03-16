"""Webhooks para integración con n8n: /api/webhook/*"""
import uuid
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, Optional, Any

from fastapi import APIRouter, HTTPException, Depends

from auth import verify_webhook_key
from database import db
from models import (
    WebhookPatientCreate, WebhookAppointmentCreate,
    validate_date, safe_regex,
)
from config import WORK_START, WORK_END, SLOT_DURATION
from routers.appointments import enrich_appointments

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhooks n8n"])


@router.get("/doctores", summary="n8n → Lista doctores activos")
async def webhook_get_doctores(_: bool = Depends(verify_webhook_key)):
    """Retorna todos los doctores activos para mostrar opciones al paciente."""
    doctors = await db.doctors.find({"activo": True}, {"_id": 0}).to_list(500)
    return {"doctores": doctors, "total": len(doctors)}


@router.get("/pacientes/buscar", summary="n8n → Buscar paciente por teléfono o nombre")
async def webhook_buscar_paciente(
    telefono: Optional[str] = None,
    nombre:   Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    """Busca por teléfono (match exacto) o nombre (búsqueda parcial). Máx 10 resultados."""
    if not telefono and not nombre:
        raise HTTPException(400, "Debes proporcionar 'telefono' o 'nombre'")

    query: Dict[str, Any] = {}
    if telefono:
        query["telefono"] = telefono.strip()
    elif nombre:
        escaped = safe_regex(nombre.strip())
        query["$or"] = [
            {"nombre":   {"$regex": escaped, "$options": "i"}},
            {"apellido": {"$regex": escaped, "$options": "i"}},
        ]

    patients = await db.patients.find(query, {"_id": 0}).to_list(10)
    return {"pacientes": patients, "total": len(patients)}


@router.post("/pacientes/registrar", summary="n8n → Registrar nuevo paciente")
async def webhook_registrar_paciente(
    patient_data: WebhookPatientCreate,
    _: bool = Depends(verify_webhook_key),
):
    """Crea un paciente nuevo. Si ya existe por teléfono, retorna el existente sin duplicar."""
    existing = await db.patients.find_one({"telefono": patient_data.telefono})
    if existing:
        return {
            "paciente": {k: v for k, v in existing.items() if k != "_id"},
            "creado":   False,
            "mensaje":  "El paciente ya estaba registrado",
        }

    patient_id  = str(uuid.uuid4())
    now         = datetime.now(timezone.utc).isoformat()
    patient_doc = {
        "id": patient_id, **patient_data.model_dump(),
        "avatar_url": None, "created_at": now,
    }
    await db.patients.insert_one(patient_doc)
    await db.odontograms.insert_one({
        "id": str(uuid.uuid4()), "paciente_id": patient_id,
        "dientes": [], "updated_at": now,
    })
    return {"paciente": {k: v for k, v in patient_doc.items() if k != "_id"}, "creado": True}


@router.get("/citas/disponibilidad", summary="n8n → Slots disponibles para una fecha")
async def webhook_disponibilidad(
    fecha:     str,
    doctor_id: Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    """Retorna horarios disponibles según horario de la clínica (WORK_START–WORK_END, SLOT_DURATION min)."""
    validate_date(fecha)

    doctor_query: Dict[str, Any] = {"activo": True}
    if doctor_id:
        doctor_query["id"] = doctor_id

    import asyncio
    doctors, existing_apts = await asyncio.gather(
        db.doctors.find(doctor_query, {"_id": 0}).to_list(500),
        db.appointments.find(
            {"fecha": fecha, "estado": {"$ne": "cancelada"}}, {"_id": 0}
        ).to_list(1000),
    )

    occupied: Dict[str, set] = defaultdict(set)
    for apt in existing_apts:
        occupied[apt["doctor_id"]].add(apt["hora_inicio"])

    slots_template = []
    cur = WORK_START * 60
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


@router.post("/citas/agendar", summary="n8n → Agendar una cita")
async def webhook_agendar_cita(
    apt_data: WebhookAppointmentCreate,
    _: bool = Depends(verify_webhook_key),
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
        raise HTTPException(
            404, "Paciente no encontrado. Regístralo primero con /webhook/pacientes/registrar"
        )

    doctor = await db.doctors.find_one(
        {"id": apt_data.doctor_id, "activo": True}, {"_id": 0}
    )
    if not doctor:
        raise HTTPException(404, "Doctor no encontrado o inactivo")

    conflict = await db.appointments.find_one({
        "fecha":       apt_data.fecha,
        "hora_inicio": apt_data.hora_inicio,
        "doctor_id":   apt_data.doctor_id,
        "estado":      {"$ne": "cancelada"},
    })
    if conflict:
        raise HTTPException(
            409, f"El horario {apt_data.hora_inicio} del {apt_data.fecha} ya está ocupado"
        )

    apt_id  = str(uuid.uuid4())
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
        "created_at":  datetime.now(timezone.utc).isoformat(),
    }
    await db.appointments.insert_one(apt_doc)
    return {
        "cita": {
            "id":      apt_id,
            "paciente": f"{patient['nombre']} {patient['apellido']}",
            "doctor":  doctor["nombre"],
            "fecha":   apt_data.fecha,
            "hora":    f"{apt_data.hora_inicio} – {apt_data.hora_fin}",
            "motivo":  apt_data.motivo,
            "estado":  "confirmada",
        },
        "agendada": True,
    }


@router.get("/citas/consultar", summary="n8n → Consultar citas")
async def webhook_consultar_citas(
    fecha:             Optional[str] = None,
    fecha_inicio:      Optional[str] = None,
    fecha_fin:         Optional[str] = None,
    paciente_telefono: Optional[str] = None,
    doctor_id:         Optional[str] = None,
    estado:            Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    """Filtra citas por fecha exacta, rango, teléfono, doctor o estado. Excluye canceladas por defecto."""
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
        patient = await db.patients.find_one(
            {"telefono": paciente_telefono.strip()}, {"_id": 0}
        )
        if not patient:
            return {"citas": [], "total": 0}
        query["paciente_id"] = patient["id"]

    appointments = (
        await db.appointments.find(query, {"_id": 0})
        .sort("fecha", 1).to_list(200)
    )
    enriched = await enrich_appointments(appointments)
    return {"citas": enriched, "total": len(enriched)}


@router.put("/appointments/{apt_id}/cancelar", summary="n8n → Cancelar una cita")
async def webhook_cancelar_cita(
    apt_id: str,
    motivo: Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    """Cancela una cita existente (estado → 'cancelada')."""
    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Cita no encontrada")
    if apt["estado"] == "cancelada":
        return {"mensaje": "La cita ya estaba cancelada", "cita_id": apt_id}
    await db.appointments.update_one({"id": apt_id}, {"$set": {"estado": "cancelada"}})
    return {
        "mensaje":  "Cita cancelada correctamente",
        "cita_id":  apt_id,
        "fecha":    apt["fecha"],
        "hora":     f"{apt['hora_inicio']} – {apt['hora_fin']}",
        "motivo":   motivo or "Sin motivo especificado",
    }


@router.put("/appointments/{apt_id}/reagendar", summary="n8n → Reagendar una cita")
async def webhook_reagendar_cita(
    apt_id:      str,
    nueva_fecha: str,
    nueva_hora:  str,
    motivo:      Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    """Mueve una cita a nueva fecha/hora. Calcula hora_fin automáticamente con SLOT_DURATION."""
    from models import _TIME_RE
    validate_date(nueva_fecha)
    if not _TIME_RE.match(nueva_hora):
        raise HTTPException(400, "nueva_hora debe estar en formato HH:MM")

    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Cita no encontrada")
    if apt["estado"] == "cancelada":
        raise HTTPException(400, "No se puede reagendar una cita cancelada")

    h, m       = map(int, nueva_hora.split(':'))
    total      = h * 60 + m + SLOT_DURATION
    nueva_hora_fin = f"{total // 60:02d}:{total % 60:02d}"

    conflict = await db.appointments.find_one({
        "doctor_id":   apt["doctor_id"],
        "fecha":       nueva_fecha,
        "hora_inicio": nueva_hora,
        "estado":      {"$ne": "cancelada"},
        "id":          {"$ne": apt_id},
    })
    if conflict:
        raise HTTPException(409, f"El doctor ya tiene una cita a las {nueva_hora} el {nueva_fecha}")

    await db.appointments.update_one(
        {"id": apt_id},
        {"$set": {"fecha": nueva_fecha, "hora_inicio": nueva_hora, "hora_fin": nueva_hora_fin}},
    )
    return {
        "mensaje":      "Cita reagendada correctamente",
        "cita_id":      apt_id,
        "nueva_fecha":  nueva_fecha,
        "nueva_hora":   f"{nueva_hora} – {nueva_hora_fin}",
        "motivo":       motivo or "Sin motivo especificado",
    }


@router.post("/demo/sembrar", summary="n8n → Sembrar datos de demostración")
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
