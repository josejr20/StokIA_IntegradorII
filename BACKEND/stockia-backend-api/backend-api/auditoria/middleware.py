import threading

_local = threading.local()


class AuditoriaMiddleware:
    """Guarda el usuario de la petición actual en thread-local, para que las
    señales de auditoria.signals sepan quién hizo el cambio sin tener que
    pasar el request manualmente por cada save()."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _local.usuario = getattr(request, 'user', None)
        try:
            return self.get_response(request)
        finally:
            _local.usuario = None


def usuario_actual():
    return getattr(_local, 'usuario', None)
