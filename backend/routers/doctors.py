"""Rutas de doctores: /api/doctors/*"""
import uuid
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Depends

from auth import get_current_user, require_admin
from database import db
from models import DoctorCreate, Doctor, MessageResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/doctors", tags=["Doctores"])


@router.get("", response_model=List[Doctor])
async def get_doctors(current_user: dict = Depends(get_current_user)):
    return await db.doctors.find({}, {"_id": 0}).to_list(500)


@router.post("", response_model=Doctor)
async def create_doctor(doctor_data: DoctorCreate, _: dict = Depends(require_admin)):
    existing = await db.doctors.find_one({"email": doctor_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un doctor con ese email")
    doctor_id  = str(uuid.uuid4())
    doctor_doc = {
        "id": doctor_id,
        **doctor_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.doctors.insert_one(doctor_doc)
    return Doctor(**doctor_doc)


@router.get("/active/today", response_model=List[Doctor])
async def get_active_doctors(current_user: dict = Depends(get_current_user)):
    return await db.doctors.find({"activo": True}, {"_id": 0}).to_list(500)


@router.get("/{doctor_id}", response_model=Doctor)
async def get_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return Doctor(**doctor)


@router.put("/{doctor_id}", response_model=Doctor)
async def update_doctor(
    doctor_id: str,
    doctor_data: DoctorCreate,
    _: dict = Depends(require_admin),
):
    existing = await db.doctors.find_one({"id": doctor_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    if doctor_data.email != existing["email"]:
        conflict = await db.doctors.find_one(
            {"email": doctor_data.email, "id": {"$ne": doctor_id}}
        )
        if conflict:
            raise HTTPException(status_code=400, detail="Ya existe un doctor con ese email")
    await db.doctors.update_one({"id": doctor_id}, {"$set": doctor_data.model_dump()})
    updated = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    return Doctor(**updated)


@router.delete("/{doctor_id}", response_model=MessageResponse)
async def delete_doctor(doctor_id: str, _: dict = Depends(require_admin)):
    result = await db.doctors.delete_one({"id": doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return MessageResponse(message="Doctor eliminado correctamente")
