from rest_framework import serializers

from .models import Alerta, NotificacionCorreo


class NotificacionCorreoSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificacionCorreo
        fields = '__all__'


class AlertaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = Alerta
        fields = ['id', 'tipo', 'producto', 'producto_nombre', 'lote', 'mensaje', 'severidad',
                  'datos_origen', 'estado', 'fecha_creacion', 'fecha_atendida']
