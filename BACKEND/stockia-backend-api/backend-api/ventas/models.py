from django.db import models

from productos.models import Producto
from inventario.models import Lote
from usuarios.models import Usuario


class Venta(models.Model):
    ORIGEN_CHOICES = [('manual', 'Manual'), ('importado', 'Importado')]

    id = models.BigAutoField(primary_key=True)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='producto_id', related_name='ventas')
    lote = models.ForeignKey(Lote, on_delete=models.SET_NULL, null=True, blank=True, db_column='lote_id')
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_venta = models.DateField()
    origen = models.CharField(max_length=20, choices=ORIGEN_CHOICES, default='manual')
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_column='usuario_id')
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ventas'


class ImportacionVenta(models.Model):
    ESTADO_CHOICES = [('procesando', 'Procesando'), ('completado', 'Completado'), ('fallido', 'Fallido')]

    id = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_column='usuario_id')
    nombre_archivo = models.CharField(max_length=255)
    filas_procesadas = models.IntegerField(default=0)
    filas_con_error = models.IntegerField(default=0)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='procesando')
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'importaciones_ventas'
