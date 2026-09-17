from django.db import models


class Categoria(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'categorias'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class UnidadMedida(models.Model):
    """Unidad física del producto: kg, gr, lt, ml, unidad…"""
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50, unique=True)
    abreviatura = models.CharField(max_length=10)

    class Meta:
        db_table = 'unidades_medida'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Presentacion(models.Model):
    """Cómo se vende el producto: docena, unidad, cuarto, caja…
    Separado de UnidadMedida porque responden preguntas distintas: una
    es "en qué se mide" y la otra "en qué empaque se despacha"."""
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'presentaciones'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


MOTIVOS_DESACTIVACION = [
    ('descontinuado', 'Producto descontinuado'),
    ('sin_stock', 'Sin stock permanente'),
    ('baja_rotacion', 'Baja rotación'),
    ('cambio_proveedor', 'Cambio de proveedor'),
    ('otro', 'Otro motivo'),
]


class Producto(models.Model):
    id = models.AutoField(primary_key=True)
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=200)
    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True, blank=True,
                                   db_column='categoria_id', related_name='productos')
    unidad_medida = models.ForeignKey(UnidadMedida, on_delete=models.SET_NULL, null=True, blank=True,
                                       db_column='unidad_medida_id', related_name='productos')
    presentacion = models.ForeignKey(Presentacion, on_delete=models.SET_NULL, null=True, blank=True,
                                      db_column='presentacion_id', related_name='productos')
    imagen = models.ImageField(upload_to='productos/', null=True, blank=True)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    # HU05: motivo y fecha de la baja lógica, quedan en null mientras el
    # producto esté activo.
    motivo_desactivacion = models.CharField(max_length=20, choices=MOTIVOS_DESACTIVACION, null=True, blank=True)
    motivo_desactivacion_detalle = models.CharField(max_length=255, null=True, blank=True)
    fecha_desactivacion = models.DateTimeField(null=True, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'productos'

    def __str__(self):
        return f'{self.codigo} - {self.nombre}'
