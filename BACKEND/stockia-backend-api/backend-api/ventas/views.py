import pandas as pd
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from productos.models import Producto
from .models import Venta, ImportacionVenta
from .serializers import VentaSerializer, ImportacionVentaSerializer
from usuarios.permissions import TienePermiso


class VentaViewSet(viewsets.ModelViewSet):
    """HU10: registrar y consultar ventas."""
    queryset = Venta.objects.select_related('producto', 'lote').all()
    serializer_class = VentaSerializer
    permiso_requerido = 'gestionar_ventas'
    permission_classes = [TienePermiso]
    filterset_fields = ['producto', 'fecha_venta', 'origen']

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user, origen='manual')

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def importar(self, request):
        """HU11: importación masiva desde Excel/CSV.

        Formato esperado: columnas codigo_producto, cantidad, precio_unitario, fecha_venta.
        """
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'detail': 'Adjunta un archivo excel o csv'}, status=400)

        df = pd.read_csv(archivo) if archivo.name.endswith('.csv') else pd.read_excel(archivo)

        importacion = ImportacionVenta.objects.create(
            usuario=request.user, nombre_archivo=archivo.name, estado='procesando',
        )
        procesadas, errores = 0, 0
        productos_cache = {}
        for _, fila in df.iterrows():
            try:
                codigo = str(fila['codigo_producto']).strip()
                if codigo not in productos_cache:
                    productos_cache[codigo] = Producto.objects.get(codigo=codigo)
                Venta.objects.create(
                    producto=productos_cache[codigo],
                    cantidad=fila['cantidad'],
                    precio_unitario=fila['precio_unitario'],
                    fecha_venta=fila['fecha_venta'],
                    origen='importado',
                    usuario=request.user,
                )
                procesadas += 1
            except Exception:
                errores += 1

        importacion.filas_procesadas = procesadas
        importacion.filas_con_error = errores
        importacion.estado = 'completado'
        importacion.save()
        return Response(ImportacionVentaSerializer(importacion).data)


class ImportacionVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ImportacionVenta.objects.all().order_by('-fecha')
    serializer_class = ImportacionVentaSerializer
    permiso_requerido = 'gestionar_ventas'
    permission_classes = [TienePermiso]
