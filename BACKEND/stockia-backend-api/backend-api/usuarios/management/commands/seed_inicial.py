from django.core.management.base import BaseCommand

from usuarios.models import Rol, Permiso, RolPermiso

PERMISOS = [
    'gestionar_productos', 'gestionar_inventario', 'gestionar_ventas',
    'configurar_umbrales', 'gestionar_reabastecimiento', 'ver_alertas',
    'generar_reportes', 'ver_kpis', 'gestionar_usuarios', 'gestionar_roles',
    'ver_auditoria',
]

ROLES = {
    'Administrador': PERMISOS,
    'Encargado de Inventario': [
        'gestionar_productos', 'gestionar_inventario', 'gestionar_ventas',
        'configurar_umbrales', 'gestionar_reabastecimiento', 'ver_alertas',
    ],
    'Encargado de Almacén': ['gestionar_inventario', 'ver_alertas'],
    'Jefe de Ventas': ['ver_alertas', 'generar_reportes', 'ver_kpis'],
}


class Command(BaseCommand):
    help = 'Crea los permisos y roles iniciales del sistema (correr una sola vez, después de migrate)'

    def handle(self, *args, **options):
        permisos_obj = {}
        for codigo in PERMISOS:
            permiso, _ = Permiso.objects.get_or_create(codigo=codigo)
            permisos_obj[codigo] = permiso

        for nombre_rol, codigos in ROLES.items():
            rol, _ = Rol.objects.get_or_create(nombre=nombre_rol)
            for codigo in codigos:
                RolPermiso.objects.get_or_create(rol=rol, permiso=permisos_obj[codigo])

        self.stdout.write(self.style.SUCCESS('Roles y permisos iniciales creados'))
