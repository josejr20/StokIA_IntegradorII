from django.contrib import admin

from .models import Alerta, NotificacionCorreo

admin.site.register(Alerta)
admin.site.register(NotificacionCorreo)
