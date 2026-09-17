from django.contrib import admin

from .models import Categoria, UnidadMedida, Presentacion, Producto

admin.site.register(Categoria)
admin.site.register(UnidadMedida)
admin.site.register(Presentacion)
admin.site.register(Producto)
