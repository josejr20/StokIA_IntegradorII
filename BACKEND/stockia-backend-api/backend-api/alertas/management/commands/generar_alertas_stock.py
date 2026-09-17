from django.core.management.base import BaseCommand
from django.db.models import Sum

from productos.models import Producto
from inventario.models import Lote
from operaciones.models import UmbralConfiguracion
from alertas.models import Alerta


class Command(BaseCommand):
    """HU31: compara el stock actual contra el umbral configurado (o el global
    si el producto no tiene uno propio) y genera alertas de bajo stock.
    No necesita el túnel: stock y umbral viven en el mismo esquema negocio."""
    help = 'Genera alertas de bajo stock'

    def handle(self, *args, **options):
        umbral_global = UmbralConfiguracion.objects.filter(tipo='stock_minimo', producto__isnull=True).first()
        creadas = 0
        for producto in Producto.objects.filter(activo=True):
            umbral = UmbralConfiguracion.objects.filter(tipo='stock_minimo', producto=producto).first() or umbral_global
            if not umbral:
                continue
            stock_total = Lote.objects.filter(producto=producto).aggregate(total=Sum('cantidad_actual'))['total'] or 0
            if stock_total >= umbral.valor:
                continue
            ya_existe = Alerta.objects.filter(
                producto=producto, tipo='bajo_stock', estado__in=['nueva', 'vista'],
            ).exists()
            if ya_existe:
                continue
            Alerta.objects.create(
                tipo='bajo_stock', producto=producto,
                mensaje=f'Stock de {producto.nombre} en {stock_total}, por debajo del umbral de {umbral.valor}',
                severidad='alta',
            )
            creadas += 1
        self.stdout.write(self.style.SUCCESS(f'{creadas} alertas de bajo stock generadas'))
