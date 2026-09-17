from django.db import models

from usuarios.models import Usuario


class Auditoria(models.Model):
    id = models.BigAutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_column='usuario_id')
    accion = models.CharField(max_length=100)
    entidad = models.CharField(max_length=80)
    entidad_id = models.IntegerField(null=True, blank=True)
    detalle = models.JSONField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auditoria'
        ordering = ['-fecha']
