"""Cliente HTTP hacia el servicio de ML (FastAPI).

Esta es la única puerta por la que la API de negocio pide algo relacionado
a ML: predicciones, riesgo, anomalías o reentrenamiento. Nunca se consulta
el esquema "ml" de la base de datos directamente desde este backend.

Todas las funciones devuelven None si el servicio de ML no responde
(por ejemplo, si está dormido en el plan gratuito de Render) para que el
que llama decida cómo degradar sin romper la petición del usuario.
"""
import requests
from django.conf import settings

TIMEOUT_SEGUNDOS = 8


def _peticion(metodo, ruta, **kwargs):
    try:
        respuesta = requests.request(
            metodo,
            f'{settings.ML_SERVICE_URL}{ruta}',
            headers={'Authorization': f'Bearer {settings.ML_SERVICE_TOKEN}'},
            timeout=TIMEOUT_SEGUNDOS,
            **kwargs,
        )
        respuesta.raise_for_status()
        cuerpo = respuesta.json()
        return cuerpo.get('data') if cuerpo.get('ok') else None
    except requests.RequestException:
        return None


def obtener_prediccion(producto_id, horizonte_dias=7):
    """HU14: predicción de demanda de un producto."""
    return _peticion('GET', f'/prediccion/{producto_id}', params={'horizonte_dias': horizonte_dias})


def obtener_riesgo(producto_id):
    """HU19-HU20: riesgo de vencimiento de un producto."""
    return _peticion('GET', f'/riesgo/{producto_id}')


def obtener_riesgos_todos():
    """HU19-HU20, HU26: riesgo calculado para todos los productos (uso en jobs programados)."""
    return _peticion('GET', '/riesgo')


def obtener_anomalias(estado='nueva'):
    """HU22: anomalías detectadas, para sincronizar en alertas."""
    return _peticion('GET', '/anomalias', params={'estado': estado})


def obtener_historico_comparacion(producto_id):
    """HU25: predicción vs venta real, ya resuelto del lado del servicio de ML."""
    return _peticion('GET', f'/historico-comparacion/{producto_id}')


def solicitar_reentrenamiento(forzar=False):
    """HU18: dispara un reentrenamiento del modelo."""
    return _peticion('POST', '/modelo/reentrenar', json={'forzar': forzar})
