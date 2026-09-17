from django.core.management.base import BaseCommand

from productos.models import Producto
from operaciones.models import OrdenReabastecimiento
from ml_client.client import obtener_riesgos_todos


class Command(BaseCommand):
    """HU26: genera órdenes de reabastecimiento a partir del riesgo que calcula
    el servicio de ML. Pensado para correr como job programado (cron o
    GitHub Actions), no en cada carga del dashboard."""
    help = 'Genera órdenes de reabastecimiento automáticas a partir del riesgo de vencimiento'

    def handle(self, *args, **options):
        riesgos = obtener_riesgos_todos()
        if riesgos is None:
            self.stdout.write(self.style.WARNING('Servicio de ML no disponible, se omite esta corrida'))
            return

        creadas = 0
        for riesgo in riesgos:
            if riesgo.get('nivel_prioridad') != 'alto':
                continue
            try:
                producto = Producto.objects.get(id=riesgo['producto_id'], activo=True)
            except Producto.DoesNotExist:
                continue

            ya_existe = OrdenReabastecimiento.objects.filter(
                producto=producto, estado='pendiente', generado_por='automatico',
            ).exists()
            if ya_existe:
                continue

            OrdenReabastecimiento.objects.create(
                producto=producto,
                cantidad_sugerida=riesgo.get('cantidad_sugerida', 0),
                generado_por='automatico',
            )
            creadas += 1

        self.stdout.write(self.style.SUCCESS(f'{creadas} órdenes de reabastecimiento generadas'))
