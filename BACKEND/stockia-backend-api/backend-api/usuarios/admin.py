from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario, Rol, Permiso, RolPermiso


class UsuarioAdmin(UserAdmin):
    model = Usuario
    list_display = ('email', 'nombre', 'rol', 'activo', 'is_staff')
    ordering = ('email',)
    list_filter = ('rol', 'activo', 'is_staff')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Datos personales', {'fields': ('nombre', 'rol', 'activo')}),
        ('Permisos', {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'nombre', 'rol', 'password1', 'password2')}),
    )
    search_fields = ('email', 'nombre')


admin.site.register(Usuario, UsuarioAdmin)
admin.site.register(Rol)
admin.site.register(Permiso)
admin.site.register(RolPermiso)
