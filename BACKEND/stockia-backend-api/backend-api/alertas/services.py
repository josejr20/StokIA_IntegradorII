"""HU32: envío de correos de alertas críticas vía Brevo."""
import requests
from django.conf import settings


def enviar_correo(destinatario, asunto, contenido_html):
    if not settings.BREVO_API_KEY:
        return False
    try:
        respuesta = requests.post(
            'https://api.brevo.com/v3/smtp/email',
            headers={'api-key': settings.BREVO_API_KEY, 'Content-Type': 'application/json'},
            json={
                'sender': {'email': settings.BREVO_SENDER_EMAIL, 'name': 'StockIA'},
                'to': [{'email': destinatario}],
                'subject': asunto,
                'htmlContent': contenido_html,
            },
            timeout=10,
        )
        return respuesta.status_code in (200, 201)
    except requests.RequestException:
        return False
