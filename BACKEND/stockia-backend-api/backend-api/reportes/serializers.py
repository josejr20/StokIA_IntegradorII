from rest_framework import serializers

from .models import ReporteGenerado, PreferenciaUsuario


class ReporteGeneradoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReporteGenerado
        fields = '__all__'


class PreferenciaUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenciaUsuario
        fields = ['id', 'clave', 'valor', 'fecha_actualizacion']
