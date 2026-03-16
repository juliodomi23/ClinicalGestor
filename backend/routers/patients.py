"""Rutas de pacientes: /api/patients/*"""
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, HTTPException, Depends, Query

from auth import get_current_user, require_admin
from database import db
from models import PatientCreate, Patient, MessageResponse, safe_regex

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/patients", tags=["Pacientes"])


@router.get("", response_model=List[Patient])
async def get_patients(
    skip:   int = Query(0,  ge=0),
    limit:  int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Busca por nombre, apellido o teléfono"),
    current_user: dict = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if search and search.strip():
        escaped = safe_regex(search.strip())
        query["$or"] = [
            {"nombre":   {"$regex": escaped, "$options": "i"}},
            {"apellido": {"$regex": escaped, "$options": "i"}},
            {"telefono": {"$regex": escaped, "$options": "i"}},
        ]
    total = await db.patients.count_documents(query)
    patients = await db.patients.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(None)
    # Añadir total en header para que el frontend pueda paginar
    # (FastAPI no soporta headers en response_model directo, usamos lista simple)
    return patients


@router.post("", response_model=Patient)
async def create_patient(
    patient_data: PatientCreate,
    current_user: dict = Depends(get_current_user),
):
    patient_id = str(uuid.uuid4())
    now        = datetime.now(timezone.utc).isoformat()
    patient_doc = {"id": patient_id, **patient_data.model_dump(), "created_at": now}
    await db.patients.insert_one(patient_doc)
    await db.odontograms.insert_one({
        "id": str(uuid.uuid4()), "paciente_id": patient_id,
        "dientes": [], "updated_at": now,
    })
    return Patient(**patient_doc)


@router.get("/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return Patient(**patient)


@router.put("/{patient_id}", response_model=Patient)
async def update_patient(
    patient_id: str,
    patient_data: PatientCreate,
    current_user: dict = Depends(get_current_user),
):
    result = await db.patients.update_one(
        {"id": patient_id}, {"$set": patient_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return Patient(**await db.patients.find_one({"id": patient_id}, {"_id": 0}))


@router.delete("/{patient_id}", response_model=MessageResponse)
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
