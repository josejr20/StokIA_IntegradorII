import io

from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from productos.models import Producto
from ventas.models import Venta
from alertas.models import Alerta
from operaciones.models import OrdenReabastecimiento
from .models import ReporteGenerado, PreferenciaUsuario
from .serializers import PreferenciaUsuarioSerializer
from usuarios.permissions import TienePermiso


class ExportarInventarioExcelView(APIView):
    """HU33: exporta el inventario y su stock consolidado a Excel."""
    permiso_requerido = 'generar_reportes'
    permission_classes = [TienePermiso]

    def get(self, request):
        libro = Workbook()
        hoja = libro.active
        hoja.title = 'Inventario'
        hoja.append(['Código', 'Producto', 'Categoría', 'Stock total', 'Activo'])
        for producto in Producto.objects.select_related('categoria').prefetch_related('lotes'):
            stock = sum(l.cantidad_actual for l in producto.lotes.all())
            hoja.append([
                producto.codigo, producto.nombre,
                producto.categoria.nombre if producto.categoria else '',
                float(stock), 'Sí' if producto.activo else 'No',
            ])

        buffer = io.BytesIO()
        libro.save(buffer)
        buffer.seek(0)

        ReporteGenerado.objects.create(usuario=request.user, tipo='inventario', formato='excel')

        respuesta = HttpResponse(
            buffer.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        respuesta['Content-Disposition'] = 'attachment; filename="inventario.xlsx"'
        return respuesta


def _calcular_kpis():
    ahora = timezone.now()
    return {
        'productos_activos': Producto.objects.filter(activo=True).count(),
        'ventas_mes_actual': float(Venta.objects.filter(
            fecha_venta__month=ahora.month, fecha_venta__year=ahora.year,
        ).aggregate(total=Sum('cantidad'))['total'] or 0),
        'alertas_activas': Alerta.objects.filter(estado__in=['nueva', 'vista']).count(),
        'alertas_criticas': Alerta.objects.filter(severidad='critica', estado__in=['nueva', 'vista']).count(),
        'ordenes_pendientes': OrdenReabastecimiento.objects.filter(estado='pendiente').count(),
    }


class KPIsView(APIView):
    """HU34: KPIs generales, calculados por consulta agregada (no necesita tabla propia)."""
    permiso_requerido = 'ver_kpis'
    permission_classes = [TienePermiso]

    def get(self, request):
        return Response(_calcular_kpis())


class ResumenInicioView(APIView):
    """HU37: página de inicio, combina alertas recientes con los KPIs."""

    def get(self, request):
        alertas = Alerta.objects.filter(estado__in=['nueva', 'vista']).order_by('-fecha_creacion')[:5]
        return Response({
            'alertas_recientes': list(alertas.values('id', 'tipo', 'mensaje', 'severidad', 'fecha_creacion')),
            'kpis': _calcular_kpis(),
        })


class PreferenciaUsuarioViewSet(viewsets.ModelViewSet):
    """HU39: preferencias de visualización del dashboard, por usuario."""
    serializer_class = PreferenciaUsuarioSerializer

    def get_queryset(self):
        return PreferenciaUsuario.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
