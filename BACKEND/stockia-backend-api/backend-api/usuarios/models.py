from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class Rol(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'roles'

    def __str__(self):
        return self.nombre


class Permiso(models.Model):
    id = models.AutoField(primary_key=True)
    codigo = models.CharField(max_length=80, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'permisos'

    def __str__(self):
        return self.codigo


class RolPermiso(models.Model):
    rol = models.ForeignKey(Rol, on_delete=models.CASCADE, db_column='rol_id', related_name='rol_permisos')
    permiso = models.ForeignKey(Permiso, on_delete=models.CASCADE, db_column='permiso_id')

    class Meta:
        db_table = 'rol_permisos'
        unique_together = ('rol', 'permiso')


class UsuarioManager(BaseUserManager):
    def create_user(self, email, nombre, rol=None, password=None, **extra):
        if not email:
            raise ValueError('El usuario necesita un correo')
        usuario = self.model(email=self.normalize_email(email), nombre=nombre, rol=rol, **extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, nombre, password=None, **extra):
        rol, _ = Rol.objects.get_or_create(nombre='Administrador')
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, nombre, rol, password, **extra)


class Usuario(AbstractBaseUser, PermissionsMixin):
    # Nota: la columna de contraseña se llama "password" (no "password_hash"
    # como en el plano SQL original) porque así la maneja internamente
    # AbstractBaseUser. Es el único ajuste que se hizo al esquema para que
    # Django no pelee con su propio sistema de autenticación.
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    rol = models.ForeignKey(Rol, on_delete=models.PROTECT, db_column='rol_id', related_name='usuarios')
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultimo_acceso = models.DateTimeField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)

    objects = UsuarioManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nombre']

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return self.email

    @property
    def is_active(self):
        return self.activo

    @is_active.setter
    def is_active(self, value):
        self.activo = value

    def tiene_permiso(self, codigo_permiso):
        if self.is_superuser:
            return True
        return RolPermiso.objects.filter(rol=self.rol, permiso__codigo=codigo_permiso).exists()


class TokenRecuperacion(models.Model):
    id = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='usuario_id',
                                 related_name='tokens_recuperacion')
    token = models.CharField(max_length=255, unique=True)
    expira_en = models.DateTimeField()
    usado = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tokens_recuperacion'
