from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Lote, MovimientoInventario
from .serializers import LoteSerializer, MovimientoInventarioSerializer
from usuarios.permissions import TienePermiso


class LoteViewSet(viewsets.ModelViewSet):
    """HU06-HU09: lotes, movimientos de stock e historial por producto."""
    queryset = Lote.objects.select_related('producto').all()
    serializer_class = LoteSerializer
    permiso_requerido = 'gestionar_inventario'
    permission_classes = [TienePermiso]
    filterset_fields = ['producto']

    def perform_create(self, serializer):
        # HU07: al registrar el lote, cantidad_actual arranca igual a cantidad_inicial.
        serializer.save(cantidad_actual=serializer.validated_data.get('cantidad_inicial'))

    @action(detail=True, methods=['get'])
    def historial(self, request, pk=None):
        """HU09: historial de movimientos del lote."""
        lote = self.get_object()
        movimientos = lote.movimientos.all().order_by('-fecha')
        return Response(MovimientoInventarioSerializer(movimientos, many=True).data)

    @action(detail=True, methods=['post'])
    def registrar_movimiento(self, request, pk=None):
        """HU08: ingreso, salida o ajuste de stock sobre un lote."""
        lote = self.get_object()
        tipo = request.data.get('tipo')
        motivo = request.data.get('motivo', '')
        if tipo not in ('ingreso', 'salida', 'ajuste'):
            return Response({'detail': 'Tipo inválido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cantidad = abs(Decimal(str(request.data.get('cantidad'))))
        except (TypeError, ValueError, InvalidOperation):
            return Response({'detail': 'Cantidad inválida'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if tipo == 'ingreso':
                lote.cantidad_actual += cantidad
            elif tipo == 'salida':
                if lote.cantidad_actual < cantidad:
                    return Response({'detail': 'Stock insuficiente'}, status=status.HTTP_400_BAD_REQUEST)
                lote.cantidad_actual -= cantidad
            else:
                lote.cantidad_actual = cantidad
            lote.save(update_fields=['cantidad_actual'])
            MovimientoInventario.objects.create(
                lote=lote, tipo=tipo, cantidad=cantidad, motivo=motivo,
                usuario=request.user if request.user.is_authenticated else None,
            )
        return Response(LoteSerializer(lote).data)
