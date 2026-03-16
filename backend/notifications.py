"""
Notificaciones outbound → n8n.
Fire-and-forget: nunca bloquea la respuesta al cliente.

Eventos soportados:
  - cita_creada
  - cita_cancelada
  - cita_reagendada
  - estado_actualizado

Payload enviado a NOTIFICATION_WEBHOOK_URL (POST JSON):
{
  "evento":        "cita_creada",
  "cita_id":       "...",
  "paciente_nombre": "...",
  "paciente_telefono": "...",
  "doctor_nombre": "...",
  "fecha":         "2026-03-20",
  "hora_inicio":   "09:00",
  "hora_fin":      "09:30",
  "motivo":        "...",
  "estado":        "confirmada",
  "timestamp":     "2026-03-16T..."
}
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx

from config import NOTIFICATION_WEBHOOK_URL

logger = logging.getLogger(__name__)


async def _fire(payload: dict) -> None:
    if not NOTIFICATION_WEBHOOK_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(NOTIFICATION_WEBHOOK_URL, json=payload)
            if resp.status_code >= 400:
                logger.warning(
                    f"Notificación fallida [{payload.get('evento')}]: HTTP {resp.status_code}"
                )
    except Exception as exc:
        logger.warning(f"Error enviando notificación [{payload.get('evento')}]: {exc}")


def notify(evento: str, apt: dict, patient: dict, doctor: dict) -> None:
    """
    Lanza la notificación en background. No await — no bloquea.
    """
    payload = {
        "evento":              evento,
        "cita_id":             apt.get("id"),
        "paciente_nombre":     f"{patient.get('nombre', '')} {patient.get('apellido', '')}".strip(),
        "paciente_telefono":   patient.get("telefono", ""),
        "doctor_nombre":       doctor.get("nombre", ""),
        "fecha":               apt.get("fecha"),
        "hora_inicio":         apt.get("hora_inicio"),
        "hora_fin":            apt.get("hora_fin"),
        "motivo":              apt.get("motivo", ""),
        "estado":              apt.get("estado", ""),
        "timestamp":           datetime.now(timezone.utc).isoformat(),
    }
    asyncio.create_task(_fire(payload))
