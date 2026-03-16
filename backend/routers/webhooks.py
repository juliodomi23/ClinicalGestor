"""
Webhooks para integración con n8n: /api/webhook/*
Auth: ?api_key=<WEBHOOK_API_KEY> en cada request (sin JWT).

Endpoints diseñados para un agente conversacional que gestiona citas.
"""
import uuid
import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, Optional, Any

from fastapi import APIRouter, HTTPException, Depends

from auth import verify_webhook_key
from database import db
from models import (
    WebhookPatientCreate, WebhookAppointmentCreate,
    validate_date, safe_regex, _TIME_RE,
)
from config import WORK_START, WORK_END, SLOT_DURATION
from routers.appointments import enrich_appointments
from notifications import notify

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhooks n8n"])

# ── Helpers internos ──────────────────────────────────────────────────────────

def _time_to_min(hhmm: str) -> int:
    h, m = map(int, hhmm.split(':'))
    return h * 60 + m


def _min_to_hhmm(total: int) -> str:
    return f"{total // 60:02d}:{total % 60:02d}"


async def _check_overlap(
    doctor_id: str,
    fecha: str,
    hora_inicio: str,
    hora_fin: str,
    exclude_apt_id: Optional[str] = None,
) -> Optional[dict]:
    """
    Devuelve la cita que solapa con el rango dado (mismo doctor, misma fecha),
    o None si no hay conflicto. Excluye canceladas y opcionalmente la cita actual.
    """
    query: Dict[str, Any] = {
        "doctor_id": doctor_id,
        "fecha":     fecha,
        "estado":    {"$ne": "cancelada"},
    }
    if exclude_apt_id:
        query["id"] = {"$ne": exclude_apt_id}

    existing = await db.appointments.find(query, {"_id": 0}).to_list(None)
    new_start = _time_to_min(hora_inicio)
    new_end   = _time_to_min(hora_fin)

    for apt in existing:
        apt_start = _time_to_min(apt["hora_inicio"])
        apt_end   = _time_to_min(apt["hora_fin"])
        if new_start < apt_end and new_end > apt_start:
            return apt
    return None


# ── DOCTORES ──────────────────────────────────────────────────────────────────

@router.get(
    "/doctores",
    summary="n8n → Lista doctores activos",
    description="Devuelve solo doctores con activo=true. Los doctores inactivos nunca aparecen aquí.",
)
async def webhook_get_doctores(_: bool = Depends(verify_webhook_key)):
    doctors = await db.doctors.find({"activo": True}, {"_id": 0}).to_list(500)
    return {"doctores": doctors, "total": len(doctors)}


# ── PACIENTES ─────────────────────────────────────────────────────────────────

@router.get(
    "/pacientes/buscar",
    summary="n8n → Buscar paciente por teléfono o nombre",
    description="Teléfono: match exacto. Nombre: búsqueda parcial case-insensitive. Máx 10 resultados.",
)
async def webhook_buscar_paciente(
    telefono: Optional[str] = None,
    nombre:   Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    if not telefono and not nombre:
        raise HTTPException(400, "Proporciona 'telefono' o 'nombre'")

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


@router.post(
    "/pacientes/registrar",
    summary="n8n → Registrar nuevo paciente",
    description="Crea paciente. Si ya existe por teléfono, retorna el existente (sin duplicar).",
)
async def webhook_registrar_paciente(
    patient_data: WebhookPatientCreate,
    _: bool = Depends(verify_webhook_key),
):
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


# ── CITAS: DISPONIBILIDAD ─────────────────────────────────────────────────────

@router.get(
    "/citas/disponibilidad",
    summary="n8n → Slots disponibles para una fecha",
    description=(
        "Devuelve horarios libres según WORK_START/WORK_END/SLOT_DURATION del .env. "
        "Filtra por doctor_id opcional. Solo incluye doctores activos."
    ),
)
async def webhook_disponibilidad(
    fecha:     str,
    doctor_id: Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    validate_date(fecha)

    doctor_query: Dict[str, Any] = {"activo": True}
    if doctor_id:
        doctor_query["id"] = doctor_id
        # Verificar que el doctor existe y está activo
        doctor = await db.doctors.find_one(doctor_query, {"_id": 0})
        if not doctor:
            raise HTTPException(404, "Doctor no encontrado o inactivo")

    doctors, existing_apts = await asyncio.gather(
        db.doctors.find(doctor_query, {"_id": 0}).to_list(500),
        db.appointments.find(
            {"fecha": fecha, "estado": {"$ne": "cancelada"}}, {"_id": 0}
        ).to_list(1000),
    )

    if not doctors:
        raise HTTPException(404, "No hay doctores activos disponibles")

    # Construir mapa de rangos ocupados por doctor
    occupied: Dict[str, list] = defaultdict(list)
    for apt in existing_apts:
        occupied[apt["doctor_id"]].append((
            _time_to_min(apt["hora_inicio"]),
            _time_to_min(apt["hora_fin"]),
        ))

    # Generar todos los slots del día
    slots_template = []
    cur = WORK_START * 60
    end = WORK_END   * 60
    while cur + SLOT_DURATION <= end:
        slots_template.append((_min_to_hhmm(cur), _min_to_hhmm(cur + SLOT_DURATION)))
        cur += SLOT_DURATION

    # Filtrar slots que no solapan con citas existentes (verificación de rango real)
    available = []
    for doc in doctors:
        doc_occupied = occupied.get(doc["id"], [])
        for s, e in slots_template:
            slot_start = _time_to_min(s)
            slot_end   = _time_to_min(e)
            if not any(slot_start < occ_end and slot_end > occ_start
                       for occ_start, occ_end in doc_occupied):
                available.append({
                    "fecha":         fecha,
                    "hora_inicio":   s,
                    "hora_fin":      e,
                    "doctor_id":     doc["id"],
                    "doctor_nombre": doc["nombre"],
                    "especialidad":  doc.get("especialidad", ""),
                    "color":         doc.get("color", "#0ea5e9"),
                })

    return {
        "fecha":            fecha,
        "slot_duracion_min": SLOT_DURATION,
        "slots_disponibles": len(available),
        "disponibilidad":   available,
    }


# ── CITAS: CRUD ───────────────────────────────────────────────────────────────

@router.get(
    "/citas/consultar",
    summary="n8n → Buscar citas con filtros",
    description=(
        "Filtra por: fecha exacta, rango de fechas, paciente_id, paciente_telefono, "
        "doctor_id, estado. Por defecto excluye canceladas. "
        "Usa incluir_canceladas=true para verlas todas."
    ),
)
async def webhook_consultar_citas(
    fecha:              Optional[str] = None,
    fecha_inicio:       Optional[str] = None,
    fecha_fin:          Optional[str] = None,
    paciente_id:        Optional[str] = None,
    paciente_telefono:  Optional[str] = None,
    doctor_id:          Optional[str] = None,
    estado:             Optional[str] = None,
    incluir_canceladas: bool          = False,
    _: bool = Depends(verify_webhook_key),
):
    query: Dict[str, Any] = {}

    # Filtro de fecha
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

    # Filtro de estado
    valid_states = ["confirmada", "en_sala", "atendido", "cancelada"]
    if estado:
        if estado not in valid_states:
            raise HTTPException(400, f"estado inválido. Usa uno de: {valid_states}")
        query["estado"] = estado
    elif not incluir_canceladas:
        query["estado"] = {"$ne": "cancelada"}

    # Filtro de doctor
    if doctor_id:
        query["doctor_id"] = doctor_id

    # Filtro de paciente — por ID directo o por teléfono
    if paciente_id:
        query["paciente_id"] = paciente_id
    elif paciente_telefono:
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


@router.post(
    "/citas/agendar",
    summary="n8n → Crear cita",
    description=(
        "Crea una cita. Identifica al paciente por 'paciente_id' o 'paciente_telefono'. "
        "Rechaza si el doctor está inactivo o si el horario solapa con otra cita del mismo doctor."
    ),
)
async def webhook_agendar_cita(
    apt_data: WebhookAppointmentCreate,
    _: bool = Depends(verify_webhook_key),
):
    # Resolver paciente
    patient = None
    if apt_data.paciente_id:
        patient = await db.patients.find_one({"id": apt_data.paciente_id}, {"_id": 0})
    elif apt_data.paciente_telefono:
        patient = await db.patients.find_one(
            {"telefono": apt_data.paciente_telefono.strip()}, {"_id": 0}
        )
    if not patient:
        raise HTTPException(
            404,
            "Paciente no encontrado. Regístralo primero en /webhook/pacientes/registrar",
        )

    # Doctor debe existir y estar activo
    doctor = await db.doctors.find_one(
        {"id": apt_data.doctor_id, "activo": True}, {"_id": 0}
    )
    if not doctor:
        raise HTTPException(
            404,
            "Doctor no encontrado o inactivo. Consulta doctores disponibles en /webhook/doctores",
        )

    # Verificar solapamiento de rango (no solo hora_inicio exacta)
    conflict = await _check_overlap(
        doctor_id=apt_data.doctor_id,
        fecha=apt_data.fecha,
        hora_inicio=apt_data.hora_inicio,
        hora_fin=apt_data.hora_fin,
    )
    if conflict:
        raise HTTPException(
            409,
            f"Horario ocupado: el doctor ya tiene una cita de "
            f"{conflict['hora_inicio']} a {conflict['hora_fin']}. "
            f"Consulta horarios libres en /webhook/citas/disponibilidad",
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
    logger.info(f"Cita agendada vía webhook: {apt_id}")
    notify("cita_creada", apt_doc, patient, doctor)

    return {
        "cita_id": apt_id,
        "cita": {
            "paciente": f"{patient['nombre']} {patient['apellido']}",
            "doctor":   doctor["nombre"],
            "fecha":    apt_data.fecha,
            "hora":     f"{apt_data.hora_inicio} – {apt_data.hora_fin}",
            "motivo":   apt_data.motivo,
            "estado":   "confirmada",
        },
        "agendada": True,
    }


@router.get(
    "/citas/{apt_id}",
    summary="n8n → Obtener cita por ID",
    description="Devuelve los detalles completos de una cita, incluyendo nombre del paciente y doctor.",
)
async def webhook_get_cita(
    apt_id: str,
    _: bool = Depends(verify_webhook_key),
):
    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Cita no encontrada")
    enriched = await enrich_appointments([apt])
    return {"cita": enriched[0]}


@router.put(
    "/citas/{apt_id}/estado",
    summary="n8n → Actualizar estado de una cita",
    description="Cambia el estado: confirmada → en_sala → atendido | cancelada. No permite reabrir canceladas.",
)
async def webhook_actualizar_estado(
    apt_id: str,
    estado: str,
    _: bool = Depends(verify_webhook_key),
):
    valid_states = ["confirmada", "en_sala", "atendido", "cancelada"]
    if estado not in valid_states:
        raise HTTPException(400, f"estado inválido. Valores: {valid_states}")

    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Cita no encontrada")
    if apt["estado"] == "cancelada" and estado != "cancelada":
        raise HTTPException(400, "No se puede reactivar una cita cancelada")

    await db.appointments.update_one(
        {"id": apt_id},
        {"$set": {"estado": estado, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "cita_id":    apt_id,
        "estado_anterior": apt["estado"],
        "estado_nuevo":    estado,
        "mensaje":    f"Estado actualizado a '{estado}'",
    }


@router.put(
    "/citas/{apt_id}/cancelar",
    summary="n8n → Cancelar una cita",
    description="Atajo para cancelar. Idempotente: si ya estaba cancelada no falla.",
)
async def webhook_cancelar_cita(
    apt_id: str,
    motivo: Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Cita no encontrada")
    if apt["estado"] == "cancelada":
        return {"mensaje": "La cita ya estaba cancelada", "cita_id": apt_id}

    await db.appointments.update_one({"id": apt_id}, {"$set": {"estado": "cancelada"}})
    apt["estado"] = "cancelada"
    patient = await db.patients.find_one({"id": apt["paciente_id"]}, {"_id": 0}) or {}
    doctor  = await db.doctors.find_one({"id": apt["doctor_id"]}, {"_id": 0}) or {}
    notify("cita_cancelada", apt, patient, doctor)
    return {
        "cita_id": apt_id,
        "fecha":   apt["fecha"],
        "hora":    f"{apt['hora_inicio']} – {apt['hora_fin']}",
        "motivo":  motivo or "Sin motivo especificado",
        "mensaje": "Cita cancelada correctamente",
    }


@router.put(
    "/citas/{apt_id}/reagendar",
    summary="n8n → Reagendar una cita",
    description=(
        "Mueve la cita a nueva fecha/hora. "
        "Conserva la duración original. "
        "Verifica que el doctor siga activo y que no haya conflicto en el nuevo horario."
    ),
)
async def webhook_reagendar_cita(
    apt_id:      str,
    nueva_fecha: str,
    nueva_hora:  str,
    motivo:      Optional[str] = None,
    _: bool = Depends(verify_webhook_key),
):
    validate_date(nueva_fecha)
    if not _TIME_RE.match(nueva_hora):
        raise HTTPException(400, "nueva_hora debe estar en formato HH:MM")

    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Cita no encontrada")
    if apt["estado"] == "cancelada":
        raise HTTPException(400, "No se puede reagendar una cita cancelada")

    # Verificar que el doctor sigue activo
    doctor = await db.doctors.find_one({"id": apt["doctor_id"], "activo": True}, {"_id": 0})
    if not doctor:
        raise HTTPException(
            400,
            "El doctor asignado está inactivo. Cancela esta cita y agenda una nueva con otro doctor.",
        )

    # Conservar la duración original de la cita
    original_duration = (
        _time_to_min(apt["hora_fin"]) - _time_to_min(apt["hora_inicio"])
    )
    if original_duration <= 0:
        original_duration = SLOT_DURATION

    nueva_hora_fin = _min_to_hhmm(_time_to_min(nueva_hora) + original_duration)

    # Verificar solapamiento de rango en el nuevo horario
    conflict = await _check_overlap(
        doctor_id=apt["doctor_id"],
        fecha=nueva_fecha,
        hora_inicio=nueva_hora,
        hora_fin=nueva_hora_fin,
        exclude_apt_id=apt_id,
    )
    if conflict:
        raise HTTPException(
            409,
            f"Horario ocupado: el doctor ya tiene una cita de "
            f"{conflict['hora_inicio']} a {conflict['hora_fin']}",
        )

    await db.appointments.update_one(
        {"id": apt_id},
        {"$set": {
            "fecha":       nueva_fecha,
            "hora_inicio": nueva_hora,
            "hora_fin":    nueva_hora_fin,
            "updated_at":  datetime.now(timezone.utc).isoformat(),
        }},
    )
    apt.update({"fecha": nueva_fecha, "hora_inicio": nueva_hora, "hora_fin": nueva_hora_fin})
    patient = await db.patients.find_one({"id": apt["paciente_id"]}, {"_id": 0}) or {}
    notify("cita_reagendada", apt, patient, doctor)
    return {
        "cita_id":     apt_id,
        "fecha_anterior": apt["fecha"],
        "hora_anterior":  f"{apt['hora_inicio']} – {apt['hora_fin']}",
        "nueva_fecha": nueva_fecha,
        "nueva_hora":  f"{nueva_hora} – {nueva_hora_fin}",
        "duracion_min": original_duration,
        "motivo":      motivo or "Sin motivo especificado",
        "mensaje":     "Cita reagendada correctamente",
    }


# ── DEMO ──────────────────────────────────────────────────────────────────────

@router.post("/demo/sembrar", summary="n8n → Sembrar datos de demostración")
async def webhook_sembrar_demo(_: bool = Depends(verify_webhook_key)):
    """Inserta doctores demo. No hace nada si ya existen doctores."""
    existing_count = await db.doctors.count_documents({})
    if existing_count > 0:
        return {"mensaje": f"Ya existen {existing_count} doctores", "sembrado": False}

    now = datetime.now(timezone.utc).isoformat()
    demo_doctors = [
        {"id": "doc-001", "nombre": "Dra. María García",   "especialidad": "Odontología General",
         "email": "maria.garcia@dentu.com",   "telefono": "+52 555 123 4567",
         "color": "#0ea5e9", "activo": True,  "avatar_url": None, "created_at": now},
        {"id": "doc-002", "nombre": "Dr. Carlos Mendoza",  "especialidad": "Endodoncia",
         "email": "carlos.mendoza@dentu.com", "telefono": "+52 555 234 5678",
         "color": "#10b981", "activo": True,  "avatar_url": None, "created_at": now},
        {"id": "doc-003", "nombre": "Dra. Ana Rodríguez",  "especialidad": "Ortodoncia",
         "email": "ana.rodriguez@dentu.com",  "telefono": "+52 555 345 6789",
         "color": "#8b5cf6", "activo": True,  "avatar_url": None, "created_at": now},
        {"id": "doc-004", "nombre": "Dr. Roberto Sánchez", "especialidad": "Cirugía Maxilofacial",
         "email": "roberto.sanchez@dentu.com","telefono": "+52 555 456 7890",
         "color": "#f59e0b", "activo": False, "avatar_url": None, "created_at": now},
    ]
    await db.doctors.insert_many(demo_doctors)
    return {
        "mensaje":          "Datos demo creados",
        "sembrado":         True,
        "doctores_creados": len(demo_doctors),
        "doctores_activos": sum(1 for d in demo_doctors if d["activo"]),
    }
