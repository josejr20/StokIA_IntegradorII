from django.core.management.base import BaseCommand

from productos.models import Producto
from alertas.models import Alerta
from ml_client.client import obtener_riesgos_todos, obtener_anomalias


class Command(BaseCommand):
    """HU22, HU29: trae riesgo de vencimiento y anomalías del servicio de ML
    (vía el túnel) y las materializa como alertas para el dashboard."""
    help = 'Sincroniza alertas de riesgo de vencimiento y anomalías desde el servicio de ML'

    def handle(self, *args, **options):
        creadas = 0

        riesgos = obtener_riesgos_todos() or []
        for riesgo in riesgos:
            if riesgo.get('nivel_prioridad') not in ('alto', 'medio'):
                continue
            try:
                producto = Producto.objects.get(id=riesgo['producto_id'])
            except Producto.DoesNotExist:
                continue
            existe = Alerta.objects.filter(
                producto=producto, tipo='riesgo_vencimiento', estado__in=['nueva', 'vista'],
            ).exists()
            if existe:
                continue
            Alerta.objects.create(
                tipo='riesgo_vencimiento', producto=producto,
                mensaje=f'{producto.nombre} vence en {riesgo.get("dias_para_vencer")} días '
                        f'(riesgo {riesgo["nivel_prioridad"]})',
                severidad='alta' if riesgo['nivel_prioridad'] == 'alto' else 'media',
                datos_origen=riesgo,
            )
            creadas += 1

        anomalias = obtener_anomalias(estado='nueva') or []
        for anomalia in anomalias:
            producto_id = anomalia.get('producto_id') or (
                anomalia.get('entidad_id') if anomalia.get('entidad') == 'producto' else None
            )
            if not producto_id:
                continue
            Alerta.objects.create(
                tipo='anomalia', producto_id=producto_id,
                mensaje=anomalia['descripcion'], severidad='media', datos_origen=anomalia,
            )
            creadas += 1

        self.stdout.write(self.style.SUCCESS(f'{creadas} alertas sincronizadas desde el servicio de ML'))
