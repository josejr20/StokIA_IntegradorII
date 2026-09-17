from rest_framework import viewsets

from .models import Auditoria
from .serializers import AuditoriaSerializer
from usuarios.permissions import TienePermiso


class AuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """HU36: consulta de auditoría, de solo lectura."""
    queryset = Auditoria.objects.select_related('usuario').all()
    serializer_class = AuditoriaSerializer
    permiso_requerido = 'ver_auditoria'
    permission_classes = [TienePermiso]
    filterset_fields = ['entidad', 'usuario']
