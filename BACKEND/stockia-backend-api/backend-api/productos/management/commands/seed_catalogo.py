from django.core.management.base import BaseCommand

from productos.models import Categoria, UnidadMedida, Presentacion

CATEGORIAS = ['Condimentos', 'Bolsas', 'Plásticos', 'Sibaritas', 'Molidos']

UNIDADES = [
    ('Kilogramo', 'kg'),
    ('Gramo', 'gr'),
    ('Litro', 'lt'),
    ('Mililitro', 'ml'),
    ('Unidad', 'u'),
]

PRESENTACIONES = ['0.25', '1', '12', '24', '25', '50', '75', '100']


class Command(BaseCommand):
    help = 'Carga categorías, unidades de medida y presentaciones reales de VLAG (se puede correr de nuevo sin duplicar)'

    def handle(self, *args, **options):
        for nombre in CATEGORIAS:
            Categoria.objects.get_or_create(nombre=nombre)

        for nombre, abreviatura in UNIDADES:
            UnidadMedida.objects.get_or_create(nombre=nombre, defaults={'abreviatura': abreviatura})

        # Las presentaciones cambiaron de nombre (Docena, Cuarto…) a números
        # (0.25, 1, 12…), así que se reemplazan enteras en vez de sumarse.
        Presentacion.objects.all().delete()
        for nombre in PRESENTACIONES:
            Presentacion.objects.create(nombre=nombre)

        self.stdout.write(self.style.SUCCESS(
            f'{len(CATEGORIAS)} categorías, {len(UNIDADES)} unidades y {len(PRESENTACIONES)} presentaciones listas',
        ))
