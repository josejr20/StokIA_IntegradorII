from django.db import models

from productos.models import Producto
from usuarios.models import Usuario


class UmbralConfiguracion(models.Model):
    TIPO_CHOICES = [('dias_vencimiento', 'Días para vencimiento'), ('stock_minimo', 'Stock mínimo')]

    id = models.AutoField(primary_key=True)
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, null=True, blank=True, db_column='producto_id')
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_column='usuario_id')
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'umbrales_configuracion'
        unique_together = ('tipo', 'producto')

    def __str__(self):
        objetivo = self.producto.nombre if self.producto else 'global'
        return f'{self.tipo} ({objetivo}) = {self.valor}'


class OrdenReabastecimiento(models.Model):
    ESTADO_CHOICES = [('pendiente', 'Pendiente'), ('aprobada', 'Aprobada'),
                       ('rechazada', 'Rechazada'), ('completada', 'Completada')]
    GENERADO_POR_CHOICES = [('automatico', 'Automático'), ('manual', 'Manual')]

    id = models.AutoField(primary_key=True)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='producto_id')
    cantidad_sugerida = models.DecimalField(max_digits=12, decimal_places=2)
    cantidad_aprobada = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    generado_por = models.CharField(max_length=20, choices=GENERADO_POR_CHOICES, default='automatico')
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_column='usuario_id')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ordenes_reabastecimiento'
