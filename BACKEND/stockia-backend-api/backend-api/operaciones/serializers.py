from rest_framework import serializers

from .models import UmbralConfiguracion, OrdenReabastecimiento


class UmbralConfiguracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UmbralConfiguracion
        fields = '__all__'


class OrdenReabastecimientoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = OrdenReabastecimiento
        fields = ['id', 'producto', 'producto_nombre', 'cantidad_sugerida', 'cantidad_aprobada',
                  'estado', 'generado_por', 'usuario', 'fecha_creacion', 'fecha_actualizacion']
        read_only_fields = ['generado_por']
