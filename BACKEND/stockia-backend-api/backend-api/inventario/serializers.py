from rest_framework import serializers

from .models import Lote, MovimientoInventario


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoInventario
        fields = '__all__'
        read_only_fields = ['usuario']


class LoteSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = Lote
        fields = ['id', 'producto', 'producto_nombre', 'numero_lote', 'cantidad_inicial',
                  'cantidad_actual', 'fecha_ingreso', 'fecha_vencimiento', 'fecha_creacion']
        read_only_fields = ['cantidad_actual']
