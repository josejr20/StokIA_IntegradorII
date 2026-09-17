from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Alerta, NotificacionCorreo
from .serializers import AlertaSerializer
from .services import enviar_correo
from usuarios.permissions import TienePermiso


class AlertaViewSet(viewsets.ModelViewSet):
    """HU28-HU32: alertas del dashboard, filtrado, estado y notificación por correo."""
    queryset = Alerta.objects.select_related('producto', 'lote').all()
    serializer_class = AlertaSerializer
    permiso_requerido = 'ver_alertas'
    permission_classes = [TienePermiso]
    filterset_fields = ['tipo', 'severidad', 'estado', 'producto']

    @action(detail=True, methods=['post'])
    def marcar_vista(self, request, pk=None):
        alerta = self.get_object()
        alerta.estado = 'vista'
        alerta.save(update_fields=['estado'])
        return Response(AlertaSerializer(alerta).data)

    @action(detail=True, methods=['post'])
    def atender(self, request, pk=None):
        alerta = self.get_object()
        alerta.estado = 'atendida'
        alerta.fecha_atendida = timezone.now()
        alerta.save(update_fields=['estado', 'fecha_atendida'])
        return Response(AlertaSerializer(alerta).data)

    @action(detail=True, methods=['post'])
    def notificar(self, request, pk=None):
        """HU32: envía la alerta por correo a los destinatarios indicados."""
        alerta = self.get_object()
        destinatarios = request.data.get('destinatarios', [])
        for correo in destinatarios:
            enviado = enviar_correo(
                correo, f'Alerta {alerta.get_severidad_display()}: {alerta.producto.nombre}', alerta.mensaje,
            )
            NotificacionCorreo.objects.create(
                alerta=alerta, destinatario=correo,
                estado='enviado' if enviado else 'fallido',
                fecha_envio=timezone.now() if enviado else None,
            )
        return Response({'detail': 'Notificaciones procesadas'})
