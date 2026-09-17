from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import UmbralConfiguracion, OrdenReabastecimiento
from .serializers import UmbralConfiguracionSerializer, OrdenReabastecimientoSerializer
from usuarios.permissions import TienePermiso


class UmbralConfiguracionViewSet(viewsets.ModelViewSet):
    """HU23-HU24: umbrales de alerta, globales (producto=null) o por producto."""
    queryset = UmbralConfiguracion.objects.select_related('producto').all()
    serializer_class = UmbralConfiguracionSerializer
    permiso_requerido = 'configurar_umbrales'
    permission_classes = [TienePermiso]
    filterset_fields = ['tipo', 'producto']


class OrdenReabastecimientoViewSet(viewsets.ModelViewSet):
    """HU26: órdenes de reabastecimiento, automáticas o manuales."""
    queryset = OrdenReabastecimiento.objects.select_related('producto').all()
    serializer_class = OrdenReabastecimientoSerializer
    permiso_requerido = 'gestionar_reabastecimiento'
    permission_classes = [TienePermiso]
    filterset_fields = ['estado', 'producto']

    def perform_create(self, serializer):
        serializer.save(generado_por='manual', usuario=self.request.user)

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        orden = self.get_object()
        orden.estado = 'aprobada'
        orden.cantidad_aprobada = request.data.get('cantidad_aprobada', orden.cantidad_sugerida)
        orden.usuario = request.user
        orden.save()
        return Response(OrdenReabastecimientoSerializer(orden).data)

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        orden = self.get_object()
        orden.estado = 'rechazada'
        orden.usuario = request.user
        orden.save()
        return Response(OrdenReabastecimientoSerializer(orden).data)
