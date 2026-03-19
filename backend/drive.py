"""Google Drive upload via Service Account centralizada de la clínica."""
import io
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _get_drive_service():
    """Construye el cliente de Drive usando las credenciales de la cuenta de servicio."""
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from config import GOOGLE_SERVICE_ACCOUNT_JSON

    if not GOOGLE_SERVICE_ACCOUNT_JSON:
        return None
    try:
        raw = GOOGLE_SERVICE_ACCOUNT_JSON.strip()
        if raw.startswith('{'):
            # JSON directo
            creds_info = json.loads(raw)
        elif raw.endswith('.json'):
            # Ruta a archivo
            with open(raw) as f:
                creds_info = json.load(f)
        else:
            # Base64 — formato recomendado para EasyPanel
            import base64
            creds_info = json.loads(base64.b64decode(raw).decode('utf-8'))

        creds = service_account.Credentials.from_service_account_info(
            creds_info,
            scopes=['https://www.googleapis.com/auth/drive'],
        )
        return build('drive', 'v3', credentials=creds)
    except Exception as e:
        logger.error(f"Error al inicializar Google Drive service: {e}")
        return None


async def upload_to_drive(
    file_bytes: bytes,
    filename: str,
    mimetype: str,
    folder_id: Optional[str] = None,
) -> dict:
    """
    Sube un archivo a Google Drive con la cuenta de servicio de la clínica.
    El archivo queda con acceso de solo lectura para cualquiera con el enlace,
    lo que permite que las miniaturas funcionen en el navegador.
    Retorna: {'id': str, 'name': str, 'mimeType': str, 'url': str}
    """
    import asyncio
    from googleapiclient.http import MediaIoBaseUpload

    service = _get_drive_service()
    if not service:
        raise RuntimeError(
            "Google Drive no está configurado. "
            "Define GOOGLE_SERVICE_ACCOUNT_JSON en el .env del backend."
        )

    metadata: dict = {'name': filename}
    if folder_id:
        metadata['parents'] = [folder_id]

    media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mimetype, resumable=False)
    loop = asyncio.get_event_loop()

    # Drive API es síncrona — corre en executor para no bloquear el event loop
    result = await loop.run_in_executor(
        None,
        lambda: service.files().create(
            body=metadata,
            media_body=media,
            fields='id,name,mimeType',
        ).execute()
    )

    file_id = result['id']

    # Permiso: cualquiera con el enlace puede ver (necesario para miniaturas)
    await loop.run_in_executor(
        None,
        lambda: service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'},
        ).execute()
    )

    return {
        'id':       file_id,
        'name':     result['name'],
        'mimeType': result.get('mimeType', mimetype),
        'url':      f"https://drive.google.com/file/d/{file_id}/view",
    }
