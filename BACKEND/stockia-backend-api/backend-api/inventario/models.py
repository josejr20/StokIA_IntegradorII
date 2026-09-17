from django.db import models

from productos.models import Producto
from usuarios.models import Usuario


class Lote(models.Model):
    id = models.AutoField(primary_key=True)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='producto_id', related_name='lotes')
    numero_lote = models.CharField(max_length=60)
    cantidad_inicial = models.DecimalField(max_digits=12, decimal_places=2)
    cantidad_actual = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_ingreso = models.DateField(auto_now_add=True)
    fecha_vencimiento = models.DateField()
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lotes'
        unique_together = ('producto', 'numero_lote')

    def __str__(self):
        return f'{self.producto.codigo} / {self.numero_lote}'


class MovimientoInventario(models.Model):
    TIPO_CHOICES = [('ingreso', 'Ingreso'), ('salida', 'Salida'), ('ajuste', 'Ajuste')]

    id = models.BigAutoField(primary_key=True)
    lote = models.ForeignKey(Lote, on_delete=models.CASCADE, db_column='lote_id', related_name='movimientos')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    motivo = models.CharField(max_length=200, blank=True, null=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_column='usuario_id')
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'movimientos_inventario'
