from rest_framework import serializers

from .models import Categoria, UnidadMedida, Presentacion, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'


class UnidadMedidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnidadMedida
        fields = '__all__'


class PresentacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Presentacion
        fields = '__all__'


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    unidad_medida_nombre = serializers.CharField(source='unidad_medida.nombre', read_only=True)
    presentacion_nombre = serializers.CharField(source='presentacion.nombre', read_only=True)
    motivo_desactivacion_display = serializers.CharField(source='get_motivo_desactivacion_display', read_only=True)
    stock_total = serializers.SerializerMethodField()

    # HU02: al registrar, opcionalmente se crea de una vez el primer lote.
    # Son campos de solo escritura: no existen como columnas en Producto,
    # los usa ProductoViewSet.perform_create para armar el Lote aparte.
    lote_numero = serializers.CharField(write_only=True, required=False, allow_blank=True)
    lote_cantidad = serializers.DecimalField(max_digits=12, decimal_places=2, write_only=True, required=False)
    lote_vencimiento = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = Producto
        fields = [
            'id', 'codigo', 'nombre', 'categoria', 'categoria_nombre',
            'unidad_medida', 'unidad_medida_nombre', 'presentacion', 'presentacion_nombre',
            'imagen', 'descripcion', 'activo',
            'motivo_desactivacion', 'motivo_desactivacion_display', 'motivo_desactivacion_detalle',
            'fecha_desactivacion', 'stock_total', 'fecha_creacion', 'fecha_actualizacion',
            'lote_numero', 'lote_cantidad', 'lote_vencimiento',
        ]
        # HU05: la desactivación tiene su propio endpoint (con motivo); acá
        # solo se puede editar la ficha del producto, nunca su estado.
        read_only_fields = ['codigo', 'activo', 'motivo_desactivacion', 'fecha_desactivacion']

    def validate_lote_vencimiento(self, valor):
        from datetime import date
        if valor <= date.today():
            raise serializers.ValidationError('La fecha de vencimiento debe ser posterior a hoy.')
        return valor

    def get_stock_total(self, obj):
        return sum(l.cantidad_actual for l in obj.lotes.all())
