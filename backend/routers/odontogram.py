"""Rutas del odontograma: /api/patients/{patient_id}/odontogram"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from auth import get_current_user
from database import db
from models import Odontogram, OdontogramUpdate, MessageResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Odontograma"])


@router.get("/patients/{patient_id}/odontogram", response_model=Odontogram)
async def get_odontogram(patient_id: str, current_user: dict = Depends(get_current_user)):
    odontogram = await db.odontograms.find_one({"paciente_id": patient_id}, {"_id": 0})
    if not odontogram:
        now        = datetime.now(timezone.utc).isoformat()
        odontogram = {
            "id": str(uuid.uuid4()), "paciente_id": patient_id,
            "dientes": [], "updated_at": now,
        }
        await db.odontograms.insert_one(odontogram)
    return Odontogram(**odontogram)


@router.put("/patients/{patient_id}/odontogram", response_model=MessageResponse)
async def update_odontogram(
    patient_id: str,
    update: OdontogramUpdate,
    current_user: dict = Depends(get_current_user),
):
    odontogram = await db.odontograms.find_one({"paciente_id": patient_id})
    now        = datetime.now(timezone.utc).isoformat()
    if not odontogram:
        odontogram = {
            "id": str(uuid.uuid4()), "paciente_id": patient_id,
            "dientes": [], "updated_at": now,
        }
        await db.odontograms.insert_one(odontogram)

    dientes     = odontogram.get("dientes", [])
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
        {"$set": {"dientes": dientes, "updated_at": now}},
    )
    return MessageResponse(message="Odontograma actualizado")
