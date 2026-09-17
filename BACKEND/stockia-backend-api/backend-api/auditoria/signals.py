"""HU36: registra automáticamente cada creación/edición/baja de las
entidades más sensibles del sistema, sin instrumentar cada vista a mano."""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from productos.models import Producto
from inventario.models import Lote
from ventas.models import Venta
from operaciones.models import OrdenReabastecimiento
from usuarios.models import Usuario
from .models import Auditoria
from .middleware import usuario_actual

MODELOS_AUDITADOS = [Producto, Lote, Venta, OrdenReabastecimiento, Usuario]


def _registrar(accion, instancia):
    usuario = usuario_actual()
    Auditoria.objects.create(
        usuario=usuario if usuario and getattr(usuario, 'is_authenticated', False) else None,
        accion=accion,
        entidad=instancia.__class__.__name__,
        entidad_id=instancia.pk,
        detalle={'repr': str(instancia)},
    )


def _al_guardar(sender, instance, created, **kwargs):
    _registrar('crear' if created else 'actualizar', instance)


def _al_eliminar(sender, instance, **kwargs):
    _registrar('eliminar', instance)


for modelo in MODELOS_AUDITADOS:
    post_save.connect(_al_guardar, sender=modelo, weak=False,
                       dispatch_uid=f'auditoria_save_{modelo.__name__}')
    post_delete.connect(_al_eliminar, sender=modelo, weak=False,
                         dispatch_uid=f'auditoria_delete_{modelo.__name__}')
