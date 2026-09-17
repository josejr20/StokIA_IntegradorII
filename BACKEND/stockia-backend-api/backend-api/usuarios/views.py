import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Usuario, Rol, Permiso, TokenRecuperacion
from .serializers import UsuarioSerializer, RolSerializer, PermisoSerializer, LoginSerializer
from .permissions import TienePermiso


class LoginView(TokenObtainPairView):
    """HU12: inicio de sesión. Devuelve access/refresh y registra último acceso."""
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        respuesta = super().post(request, *args, **kwargs)
        if respuesta.status_code == 200:
            email = request.data.get('email')
            Usuario.objects.filter(email=email).update(ultimo_acceso=timezone.now())
        return respuesta


class RolViewSet(viewsets.ModelViewSet):
    """HU12, HU35: gestión de roles."""
    queryset = Rol.objects.all()
    serializer_class = RolSerializer
    permiso_requerido = 'gestionar_roles'
    permission_classes = [TienePermiso]


class PermisoViewSet(viewsets.ModelViewSet):
    """HU35: catálogo de permisos disponibles."""
    queryset = Permiso.objects.all()
    serializer_class = PermisoSerializer
    permiso_requerido = 'gestionar_roles'
    permission_classes = [TienePermiso]


class UsuarioViewSet(viewsets.ModelViewSet):
    """HU35: panel de administración de usuarios y permisos."""
    queryset = Usuario.objects.select_related('rol').all()
    serializer_class = UsuarioSerializer
    permiso_requerido = 'gestionar_usuarios'
    permission_classes = [TienePermiso]
    filterset_fields = ['rol', 'activo']

    @action(detail=True, methods=['post'])
    def desactivar(self, request, pk=None):
        usuario = self.get_object()
        usuario.activo = False
        usuario.save(update_fields=['activo'])
        return Response({'detail': 'Usuario desactivado'})

    @action(detail=False, methods=['get'], permission_classes=[])
    def yo(self, request):
        return Response(UsuarioSerializer(request.user).data)


class SolicitarRecuperacionView(APIView):
    """HU38: paso 1, solicitar el enlace de recuperación por correo."""
    permission_classes = [AllowAny]

    def post(self, request):
        from alertas.services import enviar_correo  # import diferido: evita ciclos de import

        email = request.data.get('email')
        usuario = Usuario.objects.filter(email=email, activo=True).first()
        if usuario:
            token = secrets.token_urlsafe(32)
            TokenRecuperacion.objects.create(
                usuario=usuario, token=token,
                expira_en=timezone.now() + timedelta(hours=1),
            )
            enlace = f'{settings.FRONTEND_URL}/restablecer?token={token}'
            enviar_correo(
                usuario.email, 'Recupera tu contraseña - StockIA',
                f'Usa este enlace para restablecer tu contraseña (vence en 1 hora): {enlace}',
            )
        # Se responde igual exista o no el correo, para no filtrar qué correos están registrados.
        return Response({'detail': 'Si el correo existe, se envió un enlace de recuperación'})


class RestablecerPasswordView(APIView):
    """HU38: paso 2, cambiar la contraseña con el token recibido."""
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        nueva_password = request.data.get('password')
        registro = TokenRecuperacion.objects.filter(token=token, usado=False).select_related('usuario').first()
        if not registro or registro.expira_en < timezone.now():
            return Response({'detail': 'Token inválido o expirado'}, status=400)
        registro.usuario.set_password(nueva_password)
        registro.usuario.save()
        registro.usado = True
        registro.save(update_fields=['usado'])
        return Response({'detail': 'Contraseña actualizada'})
