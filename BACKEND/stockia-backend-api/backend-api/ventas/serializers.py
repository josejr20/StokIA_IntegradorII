from rest_framework import serializers

from .models import Venta, ImportacionVenta


class VentaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = Venta
        fields = ['id', 'producto', 'producto_nombre', 'lote', 'cantidad', 'precio_unitario',
                  'fecha_venta', 'origen', 'usuario', 'fecha_creacion']
        read_only_fields = ['origen', 'usuario']


class ImportacionVentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportacionVenta
        fields = '__all__'
