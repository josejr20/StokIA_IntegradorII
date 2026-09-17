from rest_framework import serializers

from .models import Auditoria


class AuditoriaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = Auditoria
        fields = ['id', 'usuario', 'usuario_nombre', 'accion', 'entidad', 'entidad_id', 'detalle', 'fecha']
