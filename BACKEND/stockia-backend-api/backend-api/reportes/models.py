from django.db import models

from usuarios.models import Usuario


class ReporteGenerado(models.Model):
    FORMATO_CHOICES = [('excel', 'Excel'), ('pdf', 'PDF')]

    id = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_column='usuario_id')
    tipo = models.CharField(max_length=50)
    formato = models.CharField(max_length=10, choices=FORMATO_CHOICES)
    parametros = models.JSONField(null=True, blank=True)
    ruta_archivo = models.CharField(max_length=255, blank=True, null=True)
    fecha_generacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reportes_generados'


class PreferenciaUsuario(models.Model):
    id = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='usuario_id', related_name='preferencias')
    clave = models.CharField(max_length=80)
    valor = models.JSONField()
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'preferencias_usuario'
        unique_together = ('usuario', 'clave')
