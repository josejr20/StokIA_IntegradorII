from rest_framework.permissions import BasePermission


class TienePermiso(BasePermission):
    """Permiso de DRF que valida contra rol_permisos (HU12, HU35, RNF4).

    Cada vista puede declarar `permiso_requerido = 'codigo_del_permiso'`.
    Si no declara nada, solo exige que el usuario esté autenticado.
    """
    permiso_requerido = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        permiso = getattr(view, 'permiso_requerido', self.permiso_requerido)
        if not permiso:
            return True
        return request.user.tiene_permiso(permiso)
