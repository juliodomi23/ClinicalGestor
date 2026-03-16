"""Rutas de citas: /api/appointments/*"""
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, HTTPException, Depends, Query

from auth import get_current_user
from database import db
from models import AppointmentCreate, Appointment, MessageResponse, validate_date

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/appointments", tags=["Citas"])


async def enrich_appointments(appointments: list) -> list:
    """Carga pacientes y doctores en 2 queries en lugar de 2*N queries."""
    if not appointments:
        return appointments

    patient_ids = list({a["paciente_id"] for a in appointments})
    doctor_ids  = list({a["doctor_id"]   for a in appointments})

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
        apt["doctor_nombre"]   = d["nombre"]               if d else "Desconocido"
        apt["doctor_color"]    = d.get("color", "#0ea5e9") if d else "#0ea5e9"

    return appointments


@router.get("", response_model=List[Appointment])
async def get_appointments(
    fecha:     Optional[str] = None,
    doctor_id: Optional[str] = None,
    skip:  int = Query(0,  ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
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


@router.post("", response_model=Appointment)
async def create_appointment(
    apt_data: AppointmentCreate,
    current_user: dict = Depends(get_current_user),
):
    apt_id  = str(uuid.uuid4())
    now     = datetime.now(timezone.utc).isoformat()
    apt_doc = {"id": apt_id, **apt_data.model_dump(), "created_at": now}
    await db.appointments.insert_one(apt_doc)
    return Appointment(**(await enrich_appointments([apt_doc]))[0])


@router.put("/{apt_id}/status", response_model=MessageResponse)
async def update_appointment_status(
    apt_id: str,
    estado: str,
    current_user: dict = Depends(get_current_user),
):
    valid_states = ["confirmada", "en_sala", "atendido", "cancelada"]
    if estado not in valid_states:
        raise HTTPException(400, f"Estado inválido. Valores permitidos: {valid_states}")
    result = await db.appointments.update_one({"id": apt_id}, {"$set": {"estado": estado}})
    if result.matched_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    return MessageResponse(message="Estado actualizado")


@router.put("/{apt_id}", response_model=Appointment)
async def update_appointment(
    apt_id: str,
    apt_data: AppointmentCreate,
    current_user: dict = Depends(get_current_user),
):
    result = await db.appointments.update_one(
        {"id": apt_id}, {"$set": apt_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    return Appointment(**(await enrich_appointments([apt]))[0])


@router.delete("/{apt_id}", response_model=MessageResponse)
async def delete_appointment(apt_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.appointments.delete_one({"id": apt_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    return MessageResponse(message="Cita eliminada")
