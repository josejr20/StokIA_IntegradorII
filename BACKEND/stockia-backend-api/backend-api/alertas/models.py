from django.db import models

from productos.models import Producto
from inventario.models import Lote


class Alerta(models.Model):
    TIPO_CHOICES = [('riesgo_vencimiento', 'Riesgo de vencimiento'),
                     ('bajo_stock', 'Bajo stock'), ('anomalia', 'Anomalía')]
    SEVERIDAD_CHOICES = [('baja', 'Baja'), ('media', 'Media'), ('alta', 'Alta'), ('critica', 'Crítica')]
    ESTADO_CHOICES = [('nueva', 'Nueva'), ('vista', 'Vista'), ('atendida', 'Atendida'), ('descartada', 'Descartada')]

    id = models.BigAutoField(primary_key=True)
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='producto_id')
    lote = models.ForeignKey(Lote, on_delete=models.SET_NULL, null=True, blank=True, db_column='lote_id')
    mensaje = models.TextField()
    severidad = models.CharField(max_length=20, choices=SEVERIDAD_CHOICES, default='media')
    # Guarda el detalle traído del servicio de ML (riesgo, factores) cuando el
    # tipo de alerta viene de ahí. Así la API de negocio no necesita volver a
    # pedirlo cada vez que alguien abre la alerta.
    datos_origen = models.JSONField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='nueva')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_atendida = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'alertas'
        ordering = ['-fecha_creacion']


class NotificacionCorreo(models.Model):
    ESTADO_CHOICES = [('pendiente', 'Pendiente'), ('enviado', 'Enviado'), ('fallido', 'Fallido')]

    id = models.BigAutoField(primary_key=True)
    alerta = models.ForeignKey(Alerta, on_delete=models.SET_NULL, null=True, blank=True, db_column='alerta_id')
    destinatario = models.EmailField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    proveedor = models.CharField(max_length=30, default='brevo')
    fecha_envio = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notificaciones_correo'
