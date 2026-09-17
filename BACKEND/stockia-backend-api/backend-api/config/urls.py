from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import TokenRefreshView

from usuarios.views import (
    LoginView, RolViewSet, PermisoViewSet, UsuarioViewSet,
    SolicitarRecuperacionView, RestablecerPasswordView,
)
from productos.views import CategoriaViewSet, UnidadMedidaViewSet, PresentacionViewSet, ProductoViewSet
from inventario.views import LoteViewSet
from ventas.views import VentaViewSet, ImportacionVentaViewSet
from operaciones.views import UmbralConfiguracionViewSet, OrdenReabastecimientoViewSet
from alertas.views import AlertaViewSet
from reportes.views import (
    ExportarInventarioExcelView, KPIsView, ResumenInicioView, PreferenciaUsuarioViewSet,
)
from auditoria.views import AuditoriaViewSet

router = routers.DefaultRouter()
router.register('roles', RolViewSet)
router.register('permisos', PermisoViewSet)
router.register('usuarios', UsuarioViewSet)
router.register('categorias', CategoriaViewSet)
router.register('unidades-medida', UnidadMedidaViewSet)
router.register('presentaciones', PresentacionViewSet)
router.register('productos', ProductoViewSet)
router.register('lotes', LoteViewSet)
router.register('ventas', VentaViewSet)
router.register('importaciones-ventas', ImportacionVentaViewSet)
router.register('umbrales', UmbralConfiguracionViewSet)
router.register('ordenes-reabastecimiento', OrdenReabastecimientoViewSet)
router.register('alertas', AlertaViewSet)
router.register('preferencias', PreferenciaUsuarioViewSet, basename='preferencias')
router.register('auditoria', AuditoriaViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),

    # HU12, HU38
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/refresh/', TokenRefreshView.as_view()),
    path('api/auth/recuperar/', SolicitarRecuperacionView.as_view()),
    path('api/auth/restablecer/', RestablecerPasswordView.as_view()),

    # HU33, HU34, HU37
    path('api/reportes/inventario.xlsx', ExportarInventarioExcelView.as_view()),
    path('api/kpis/', KPIsView.as_view()),
    path('api/inicio/', ResumenInicioView.as_view()),

    path('api/', include(router.urls)),
]

if settings.DEBUG:
    # En desarrollo Django sirve las imágenes de productos desde disco.
    # Cuando esto se despliegue de verdad, esto se reemplaza por un
    # almacenamiento real (Supabase Storage, S3, etc.) — no antes.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
