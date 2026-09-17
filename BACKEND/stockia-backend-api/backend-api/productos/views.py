from datetime import date

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from inventario.models import Lote
from .models import Categoria, UnidadMedida, Presentacion, Producto
from .serializers import (
    CategoriaSerializer, UnidadMedidaSerializer, PresentacionSerializer, ProductoSerializer,
)
from usuarios.permissions import TienePermiso


class CategoriaViewSet(viewsets.ModelViewSet):
    """HU02: alta de categorías desde el propio módulo de productos."""
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permiso_requerido = 'gestionar_productos'
    permission_classes = [TienePermiso]


class UnidadMedidaViewSet(viewsets.ModelViewSet):
    queryset = UnidadMedida.objects.all()
    serializer_class = UnidadMedidaSerializer
    permiso_requerido = 'gestionar_productos'
    permission_classes = [TienePermiso]


class PresentacionViewSet(viewsets.ModelViewSet):
    queryset = Presentacion.objects.all()
    serializer_class = PresentacionSerializer
    permiso_requerido = 'gestionar_productos'
    permission_classes = [TienePermiso]


class ProductoViewSet(viewsets.ModelViewSet):
    """HU01-HU05: catálogo de productos, búsqueda/filtro y baja lógica."""
    queryset = Producto.objects.select_related('categoria', 'unidad_medida', 'presentacion').prefetch_related('lotes')
    serializer_class = ProductoSerializer
    permiso_requerido = 'gestionar_productos'
    permission_classes = [TienePermiso]
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # multipart: la imagen viaja como archivo
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['categoria', 'unidad_medida', 'presentacion', 'activo']
    search_fields = ['codigo', 'nombre']
    ordering_fields = ['nombre', 'fecha_creacion']
    ordering = ['nombre']

    def perform_create(self, serializer):
        """HU02: código automático (P-001, P-002…) y, si mandan cantidad,
        el primer lote se crea junto con el producto en la misma operación."""
        ultimo = Producto.objects.filter(codigo__startswith='P-').order_by('-id').first()
        siguiente = 1
        if ultimo:
            try:
                siguiente = int(ultimo.codigo.split('-')[1]) + 1
            except (IndexError, ValueError):
                siguiente = Producto.objects.count() + 1

        lote_cantidad = serializer.validated_data.pop('lote_cantidad', None)
        lote_numero = serializer.validated_data.pop('lote_numero', '') or 'INICIAL'
        lote_vencimiento = serializer.validated_data.pop('lote_vencimiento', None)

        with transaction.atomic():
            producto = serializer.save(codigo=f'P-{siguiente:03d}')
            if lote_cantidad:
                Lote.objects.create(
                    producto=producto,
                    numero_lote=lote_numero,
                    cantidad_inicial=lote_cantidad,
                    cantidad_actual=lote_cantidad,
                    fecha_vencimiento=lote_vencimiento or date(2100, 1, 1),
                )

    @action(detail=True, methods=['post'])
    def desactivar(self, request, pk=None):
        """HU05: baja lógica con motivo obligatorio, conserva el histórico del producto."""
        producto = self.get_object()
        motivo = request.data.get('motivo_desactivacion')
        if not motivo:
            return Response({'detail': 'Indica el motivo de desactivación'}, status=status.HTTP_400_BAD_REQUEST)

        producto.activo = False
        producto.motivo_desactivacion = motivo
        producto.motivo_desactivacion_detalle = request.data.get('motivo_desactivacion_detalle', '')
        producto.fecha_desactivacion = timezone.now()
        producto.save(update_fields=[
            'activo', 'motivo_desactivacion', 'motivo_desactivacion_detalle', 'fecha_desactivacion',
        ])
        # HU32 (a futuro): acá va a ir el envío del correo de aviso de desactivación.
        return Response(ProductoSerializer(producto).data)

    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        """Reactiva un producto desactivado: limpia el motivo y la fecha de baja."""
        producto = self.get_object()
        producto.activo = True
        producto.motivo_desactivacion = None
        producto.motivo_desactivacion_detalle = None
        producto.fecha_desactivacion = None
        producto.save(update_fields=[
            'activo', 'motivo_desactivacion', 'motivo_desactivacion_detalle', 'fecha_desactivacion',
        ])
        return Response(ProductoSerializer(producto).data)
