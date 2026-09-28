--
-- PostgreSQL database dump
--

\restrict Hvr6qKjnSQAsRdcWnAZUPfJzbkfVHmnrsSv4cLBo2Tw4kQRZRycAze8x2yXUYHn

-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.9

-- Started on 2026-09-28 08:40:20

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 22749)
-- Name: ml; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA ml;


ALTER SCHEMA ml OWNER TO postgres;

--
-- TOC entry 6 (class 2615 OID 22748)
-- Name: negocio; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA negocio;


ALTER SCHEMA negocio OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 276 (class 1259 OID 23239)
-- Name: anomalias; Type: TABLE; Schema: ml; Owner: postgres
--

CREATE TABLE ml.anomalias (
    id bigint NOT NULL,
    tipo character varying(50) NOT NULL,
    entidad character varying(30) NOT NULL,
    entidad_id integer NOT NULL,
    descripcion text NOT NULL,
    severidad character varying(20) DEFAULT 'media'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'nueva'::character varying NOT NULL,
    fecha_deteccion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT anomalias_entidad_check CHECK (((entidad)::text = ANY ((ARRAY['venta'::character varying, 'lote'::character varying, 'producto'::character varying])::text[]))),
    CONSTRAINT anomalias_estado_check CHECK (((estado)::text = ANY ((ARRAY['nueva'::character varying, 'revisada'::character varying, 'descartada'::character varying])::text[]))),
    CONSTRAINT anomalias_severidad_check CHECK (((severidad)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying])::text[])))
);


ALTER TABLE ml.anomalias OWNER TO postgres;

--
-- TOC entry 6319 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE anomalias; Type: COMMENT; Schema: ml; Owner: postgres
--

COMMENT ON TABLE ml.anomalias IS 'HU22: anomalías detectadas';


--
-- TOC entry 275 (class 1259 OID 23238)
-- Name: anomalias_id_seq; Type: SEQUENCE; Schema: ml; Owner: postgres
--

CREATE SEQUENCE ml.anomalias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE ml.anomalias_id_seq OWNER TO postgres;

--
-- TOC entry 6321 (class 0 OID 0)
-- Dependencies: 275
-- Name: anomalias_id_seq; Type: SEQUENCE OWNED BY; Schema: ml; Owner: postgres
--

ALTER SEQUENCE ml.anomalias_id_seq OWNED BY ml.anomalias.id;


--
-- TOC entry 264 (class 1259 OID 23161)
-- Name: conjuntos_datos; Type: TABLE; Schema: ml; Owner: postgres
--

CREATE TABLE ml.conjuntos_datos (
    id integer NOT NULL,
    descripcion character varying(200),
    filas integer,
    rango_desde date,
    rango_hasta date,
    fecha_preparacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE ml.conjuntos_datos OWNER TO postgres;

--
-- TOC entry 6323 (class 0 OID 0)
-- Dependencies: 264
-- Name: TABLE conjuntos_datos; Type: COMMENT; Schema: ml; Owner: postgres
--

COMMENT ON TABLE ml.conjuntos_datos IS 'HU13: registro de preparación de datos históricos';


--
-- TOC entry 263 (class 1259 OID 23160)
-- Name: conjuntos_datos_id_seq; Type: SEQUENCE; Schema: ml; Owner: postgres
--

CREATE SEQUENCE ml.conjuntos_datos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE ml.conjuntos_datos_id_seq OWNER TO postgres;

--
-- TOC entry 6325 (class 0 OID 0)
-- Dependencies: 263
-- Name: conjuntos_datos_id_seq; Type: SEQUENCE OWNED BY; Schema: ml; Owner: postgres
--

ALTER SEQUENCE ml.conjuntos_datos_id_seq OWNED BY ml.conjuntos_datos.id;


--
-- TOC entry 268 (class 1259 OID 23181)
-- Name: entrenamientos; Type: TABLE; Schema: ml; Owner: postgres
--

CREATE TABLE ml.entrenamientos (
    id integer NOT NULL,
    modelo_id integer,
    iniciado_en timestamp without time zone DEFAULT now() NOT NULL,
    finalizado_en timestamp without time zone,
    estado character varying(20) DEFAULT 'en_progreso'::character varying NOT NULL,
    metricas jsonb,
    detalle text,
    CONSTRAINT entrenamientos_estado_check CHECK (((estado)::text = ANY ((ARRAY['en_progreso'::character varying, 'completado'::character varying, 'fallido'::character varying])::text[])))
);


ALTER TABLE ml.entrenamientos OWNER TO postgres;

--
-- TOC entry 6327 (class 0 OID 0)
-- Dependencies: 268
-- Name: TABLE entrenamientos; Type: COMMENT; Schema: ml; Owner: postgres
--

COMMENT ON TABLE ml.entrenamientos IS 'HU16, HU18: historial de entrenamiento';


--
-- TOC entry 267 (class 1259 OID 23180)
-- Name: entrenamientos_id_seq; Type: SEQUENCE; Schema: ml; Owner: postgres
--

CREATE SEQUENCE ml.entrenamientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE ml.entrenamientos_id_seq OWNER TO postgres;

--
-- TOC entry 6329 (class 0 OID 0)
-- Dependencies: 267
-- Name: entrenamientos_id_seq; Type: SEQUENCE OWNED BY; Schema: ml; Owner: postgres
--

ALTER SEQUENCE ml.entrenamientos_id_seq OWNED BY ml.entrenamientos.id;


--
-- TOC entry 266 (class 1259 OID 23169)
-- Name: modelos; Type: TABLE; Schema: ml; Owner: postgres
--

CREATE TABLE ml.modelos (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    metricas jsonb,
    ruta_artefacto character varying(255),
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    fecha_entrenamiento timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT modelos_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'archivado'::character varying])::text[])))
);


ALTER TABLE ml.modelos OWNER TO postgres;

--
-- TOC entry 6331 (class 0 OID 0)
-- Dependencies: 266
-- Name: TABLE modelos; Type: COMMENT; Schema: ml; Owner: postgres
--

COMMENT ON TABLE ml.modelos IS 'HU15-HU18: versiones del modelo de predicción';


--
-- TOC entry 265 (class 1259 OID 23168)
-- Name: modelos_id_seq; Type: SEQUENCE; Schema: ml; Owner: postgres
--

CREATE SEQUENCE ml.modelos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE ml.modelos_id_seq OWNER TO postgres;

--
-- TOC entry 6333 (class 0 OID 0)
-- Dependencies: 265
-- Name: modelos_id_seq; Type: SEQUENCE OWNED BY; Schema: ml; Owner: postgres
--

ALTER SEQUENCE ml.modelos_id_seq OWNED BY ml.modelos.id;


--
-- TOC entry 270 (class 1259 OID 23198)
-- Name: predicciones_demanda; Type: TABLE; Schema: ml; Owner: postgres
--

CREATE TABLE ml.predicciones_demanda (
    id bigint NOT NULL,
    producto_id integer NOT NULL,
    modelo_id integer,
    horizonte_dias integer NOT NULL,
    cantidad_predicha numeric(12,2) NOT NULL,
    intervalo_inferior numeric(12,2),
    intervalo_superior numeric(12,2),
    fecha_prediccion date DEFAULT CURRENT_DATE NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE ml.predicciones_demanda OWNER TO postgres;

--
-- TOC entry 6335 (class 0 OID 0)
-- Dependencies: 270
-- Name: TABLE predicciones_demanda; Type: COMMENT; Schema: ml; Owner: postgres
--

COMMENT ON TABLE ml.predicciones_demanda IS 'HU14, HU28: predicciones de demanda';


--
-- TOC entry 269 (class 1259 OID 23197)
-- Name: predicciones_demanda_id_seq; Type: SEQUENCE; Schema: ml; Owner: postgres
--

CREATE SEQUENCE ml.predicciones_demanda_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE ml.predicciones_demanda_id_seq OWNER TO postgres;

--
-- TOC entry 6337 (class 0 OID 0)
-- Dependencies: 269
-- Name: predicciones_demanda_id_seq; Type: SEQUENCE OWNED BY; Schema: ml; Owner: postgres
--

ALTER SEQUENCE ml.predicciones_demanda_id_seq OWNED BY ml.predicciones_demanda.id;


--
-- TOC entry 274 (class 1259 OID 23226)
-- Name: recomendaciones; Type: TABLE; Schema: ml; Owner: postgres
--

CREATE TABLE ml.recomendaciones (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    descripcion text NOT NULL,
    prioridad character varying(20) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT recomendaciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'atendida'::character varying, 'descartada'::character varying])::text[]))),
    CONSTRAINT recomendaciones_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying])::text[])))
);


ALTER TABLE ml.recomendaciones OWNER TO postgres;

--
-- TOC entry 6339 (class 0 OID 0)
-- Dependencies: 274
-- Name: TABLE recomendaciones; Type: COMMENT; Schema: ml; Owner: postgres
--

COMMENT ON TABLE ml.recomendaciones IS 'HU21: recomendaciones prioritarias';


--
-- TOC entry 273 (class 1259 OID 23225)
-- Name: recomendaciones_id_seq; Type: SEQUENCE; Schema: ml; Owner: postgres
--

CREATE SEQUENCE ml.recomendaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE ml.recomendaciones_id_seq OWNER TO postgres;

--
-- TOC entry 6341 (class 0 OID 0)
-- Dependencies: 273
-- Name: recomendaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: ml; Owner: postgres
--

ALTER SEQUENCE ml.recomendaciones_id_seq OWNED BY ml.recomendaciones.id;


--
-- TOC entry 272 (class 1259 OID 23213)
-- Name: riesgos_vencimiento; Type: TABLE; Schema: ml; Owner: postgres
--

CREATE TABLE ml.riesgos_vencimiento (
    id bigint NOT NULL,
    producto_id integer NOT NULL,
    lote_id integer,
    puntaje_riesgo numeric(5,4) NOT NULL,
    nivel_prioridad character varying(20) NOT NULL,
    dias_para_vencer integer,
    factores jsonb,
    fecha_calculo timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT riesgos_vencimiento_nivel_prioridad_check CHECK (((nivel_prioridad)::text = ANY ((ARRAY['bajo'::character varying, 'medio'::character varying, 'alto'::character varying])::text[]))),
    CONSTRAINT riesgos_vencimiento_puntaje_riesgo_check CHECK (((puntaje_riesgo >= (0)::numeric) AND (puntaje_riesgo <= (1)::numeric)))
);


ALTER TABLE ml.riesgos_vencimiento OWNER TO postgres;

--
-- TOC entry 6343 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE riesgos_vencimiento; Type: COMMENT; Schema: ml; Owner: postgres
--

COMMENT ON TABLE ml.riesgos_vencimiento IS 'HU19-HU20, HU29: puntaje de riesgo';


--
-- TOC entry 271 (class 1259 OID 23212)
-- Name: riesgos_vencimiento_id_seq; Type: SEQUENCE; Schema: ml; Owner: postgres
--

CREATE SEQUENCE ml.riesgos_vencimiento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE ml.riesgos_vencimiento_id_seq OWNER TO postgres;

--
-- TOC entry 6345 (class 0 OID 0)
-- Dependencies: 271
-- Name: riesgos_vencimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: ml; Owner: postgres
--

ALTER SEQUENCE ml.riesgos_vencimiento_id_seq OWNED BY ml.riesgos_vencimiento.id;


--
-- TOC entry 254 (class 1259 OID 23066)
-- Name: alertas; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.alertas (
    id bigint NOT NULL,
    tipo character varying(30) NOT NULL,
    producto_id integer NOT NULL,
    lote_id integer,
    mensaje text NOT NULL,
    severidad character varying(20) DEFAULT 'media'::character varying NOT NULL,
    datos_origen jsonb,
    estado character varying(20) DEFAULT 'nueva'::character varying NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_atendida timestamp without time zone,
    CONSTRAINT alertas_estado_check CHECK (((estado)::text = ANY ((ARRAY['nueva'::character varying, 'vista'::character varying, 'atendida'::character varying, 'descartada'::character varying])::text[]))),
    CONSTRAINT alertas_severidad_check CHECK (((severidad)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying, 'critica'::character varying])::text[]))),
    CONSTRAINT alertas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['riesgo_vencimiento'::character varying, 'bajo_stock'::character varying, 'anomalia'::character varying])::text[])))
);


ALTER TABLE negocio.alertas OWNER TO postgres;

--
-- TOC entry 6347 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE alertas; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.alertas IS 'Alertas del dashboard';


--
-- TOC entry 253 (class 1259 OID 23065)
-- Name: alertas_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.alertas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.alertas_id_seq OWNER TO postgres;

--
-- TOC entry 6349 (class 0 OID 0)
-- Dependencies: 253
-- Name: alertas_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.alertas_id_seq OWNED BY negocio.alertas.id;


--
-- TOC entry 262 (class 1259 OID 23142)
-- Name: auditoria; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.auditoria (
    id bigint NOT NULL,
    usuario_id integer,
    accion character varying(100) NOT NULL,
    entidad character varying(80) NOT NULL,
    entidad_id integer,
    detalle jsonb,
    fecha timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE negocio.auditoria OWNER TO postgres;

--
-- TOC entry 6351 (class 0 OID 0)
-- Dependencies: 262
-- Name: TABLE auditoria; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.auditoria IS 'Registro de auditoría';


--
-- TOC entry 261 (class 1259 OID 23141)
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.auditoria_id_seq OWNER TO postgres;

--
-- TOC entry 6353 (class 0 OID 0)
-- Dependencies: 261
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.auditoria_id_seq OWNED BY negocio.auditoria.id;


--
-- TOC entry 235 (class 1259 OID 22859)
-- Name: catalogo_marcas; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.catalogo_marcas (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


ALTER TABLE negocio.catalogo_marcas OWNER TO postgres;

--
-- TOC entry 6355 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE catalogo_marcas; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.catalogo_marcas IS 'Marcas del catálogo de Excel';


--
-- TOC entry 236 (class 1259 OID 22867)
-- Name: catalogo_marcas_familias; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.catalogo_marcas_familias (
    marca_id integer NOT NULL,
    categoria_id integer NOT NULL
);


ALTER TABLE negocio.catalogo_marcas_familias OWNER TO postgres;

--
-- TOC entry 6357 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE catalogo_marcas_familias; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.catalogo_marcas_familias IS 'Relación N:N marcas-categorías (familias)';


--
-- TOC entry 234 (class 1259 OID 22858)
-- Name: catalogo_marcas_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.catalogo_marcas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.catalogo_marcas_id_seq OWNER TO postgres;

--
-- TOC entry 6359 (class 0 OID 0)
-- Dependencies: 234
-- Name: catalogo_marcas_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.catalogo_marcas_id_seq OWNED BY negocio.catalogo_marcas.id;


--
-- TOC entry 238 (class 1259 OID 22883)
-- Name: catalogo_valores; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.catalogo_valores (
    id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    valor character varying(100) NOT NULL,
    etiqueta character varying(100)
);


ALTER TABLE negocio.catalogo_valores OWNER TO postgres;

--
-- TOC entry 6361 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE catalogo_valores; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.catalogo_valores IS 'Valores genéricos de catálogo (material, color, etc.)';


--
-- TOC entry 237 (class 1259 OID 22882)
-- Name: catalogo_valores_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.catalogo_valores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.catalogo_valores_id_seq OWNER TO postgres;

--
-- TOC entry 6363 (class 0 OID 0)
-- Dependencies: 237
-- Name: catalogo_valores_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.catalogo_valores_id_seq OWNED BY negocio.catalogo_valores.id;


--
-- TOC entry 229 (class 1259 OID 22827)
-- Name: categorias; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    vida_util_dias integer,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE negocio.categorias OWNER TO postgres;

--
-- TOC entry 6365 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE categorias; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.categorias IS 'Categorías de productos';


--
-- TOC entry 228 (class 1259 OID 22826)
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.categorias_id_seq OWNER TO postgres;

--
-- TOC entry 6367 (class 0 OID 0)
-- Dependencies: 228
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.categorias_id_seq OWNED BY negocio.categorias.id;


--
-- TOC entry 248 (class 1259 OID 23004)
-- Name: importaciones_ventas; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.importaciones_ventas (
    id integer NOT NULL,
    usuario_id integer,
    nombre_archivo character varying(255) NOT NULL,
    filas_procesadas integer DEFAULT 0 NOT NULL,
    filas_con_error integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'procesando'::character varying NOT NULL,
    fecha timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT importaciones_ventas_estado_check CHECK (((estado)::text = ANY ((ARRAY['procesando'::character varying, 'completado'::character varying, 'fallido'::character varying])::text[])))
);


ALTER TABLE negocio.importaciones_ventas OWNER TO postgres;

--
-- TOC entry 6369 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE importaciones_ventas; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.importaciones_ventas IS 'Importaciones masivas de ventas desde Excel/CSV';


--
-- TOC entry 247 (class 1259 OID 23003)
-- Name: importaciones_ventas_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.importaciones_ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.importaciones_ventas_id_seq OWNER TO postgres;

--
-- TOC entry 6371 (class 0 OID 0)
-- Dependencies: 247
-- Name: importaciones_ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.importaciones_ventas_id_seq OWNED BY negocio.importaciones_ventas.id;


--
-- TOC entry 242 (class 1259 OID 22930)
-- Name: lotes; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.lotes (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    numero_lote character varying(60) NOT NULL,
    cantidad_inicial numeric(12,2) DEFAULT 0 NOT NULL,
    cantidad_actual numeric(12,2) DEFAULT 0 NOT NULL,
    fecha_ingresso date DEFAULT CURRENT_DATE NOT NULL,
    fecha_vencimiento date NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE negocio.lotes OWNER TO postgres;

--
-- TOC entry 6373 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE lotes; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.lotes IS 'Lotes de productos con vencimiento';


--
-- TOC entry 241 (class 1259 OID 22929)
-- Name: lotes_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.lotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.lotes_id_seq OWNER TO postgres;

--
-- TOC entry 6375 (class 0 OID 0)
-- Dependencies: 241
-- Name: lotes_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.lotes_id_seq OWNED BY negocio.lotes.id;


--
-- TOC entry 244 (class 1259 OID 22950)
-- Name: movimientos_inventario; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.movimientos_inventario (
    id bigint NOT NULL,
    lote_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    origen character varying(20) DEFAULT 'otro'::character varying NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    precio_unitario numeric(10,2),
    precio_total numeric(12,2),
    saldo_cantidad numeric(12,2) DEFAULT 0 NOT NULL,
    saldo_precio_unitario numeric(10,2) DEFAULT 0 NOT NULL,
    saldo_valorizado numeric(12,2) DEFAULT 0 NOT NULL,
    motivo character varying(200),
    usuario_id integer,
    fecha timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT movimientos_inventario_origen_check CHECK (((origen)::text = ANY ((ARRAY['compra'::character varying, 'venta'::character varying, 'inicial'::character varying, 'ajuste'::character varying, 'otro'::character varying])::text[]))),
    CONSTRAINT movimientos_inventario_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ingreso'::character varying, 'salida'::character varying, 'ajuste'::character varying])::text[])))
);


ALTER TABLE negocio.movimientos_inventario OWNER TO postgres;

--
-- TOC entry 6377 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE movimientos_inventario; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.movimientos_inventario IS 'Kardex: historial de movimientos de stock';


--
-- TOC entry 243 (class 1259 OID 22949)
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.movimientos_inventario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.movimientos_inventario_id_seq OWNER TO postgres;

--
-- TOC entry 6379 (class 0 OID 0)
-- Dependencies: 243
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.movimientos_inventario_id_seq OWNED BY negocio.movimientos_inventario.id;


--
-- TOC entry 256 (class 1259 OID 23094)
-- Name: notificaciones_correo; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.notificaciones_correo (
    id bigint NOT NULL,
    alerta_id integer,
    destinatario character varying(254) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    proveedor character varying(30) DEFAULT 'brevo'::character varying NOT NULL,
    fecha_envio timestamp without time zone,
    CONSTRAINT notificaciones_correo_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'enviado'::character varying, 'fallido'::character varying])::text[])))
);


ALTER TABLE negocio.notificaciones_correo OWNER TO postgres;

--
-- TOC entry 6381 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE notificaciones_correo; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.notificaciones_correo IS 'Registro de notificaciones por correo';


--
-- TOC entry 255 (class 1259 OID 23093)
-- Name: notificaciones_correo_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.notificaciones_correo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.notificaciones_correo_id_seq OWNER TO postgres;

--
-- TOC entry 6383 (class 0 OID 0)
-- Dependencies: 255
-- Name: notificaciones_correo_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.notificaciones_correo_id_seq OWNED BY negocio.notificaciones_correo.id;


--
-- TOC entry 252 (class 1259 OID 23042)
-- Name: ordenes_reabastecimiento; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.ordenes_reabastecimiento (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_sugerida numeric(12,2) NOT NULL,
    cantidad_aprobada numeric(12,2),
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    generado_por character varying(20) DEFAULT 'automatico'::character varying NOT NULL,
    usuario_id integer,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ordenes_reabastecimiento_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'completada'::character varying])::text[]))),
    CONSTRAINT ordenes_reabastecimiento_generado_por_check CHECK (((generado_por)::text = ANY ((ARRAY['automatico'::character varying, 'manual'::character varying])::text[])))
);


ALTER TABLE negocio.ordenes_reabastecimiento OWNER TO postgres;

--
-- TOC entry 6385 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE ordenes_reabastecimiento; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.ordenes_reabastecimiento IS 'Órdenes de reabastecimiento';


--
-- TOC entry 251 (class 1259 OID 23041)
-- Name: ordenes_reabastecimiento_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.ordenes_reabastecimiento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.ordenes_reabastecimiento_id_seq OWNER TO postgres;

--
-- TOC entry 6387 (class 0 OID 0)
-- Dependencies: 251
-- Name: ordenes_reabastecimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.ordenes_reabastecimiento_id_seq OWNED BY negocio.ordenes_reabastecimiento.id;


--
-- TOC entry 222 (class 1259 OID 22763)
-- Name: permisos; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.permisos (
    id integer NOT NULL,
    codigo character varying(80) NOT NULL,
    descripcion text
);


ALTER TABLE negocio.permisos OWNER TO postgres;

--
-- TOC entry 6389 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE permisos; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.permisos IS 'Permisos disponibles del sistema';


--
-- TOC entry 221 (class 1259 OID 22762)
-- Name: permisos_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.permisos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.permisos_id_seq OWNER TO postgres;

--
-- TOC entry 6391 (class 0 OID 0)
-- Dependencies: 221
-- Name: permisos_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.permisos_id_seq OWNED BY negocio.permisos.id;


--
-- TOC entry 260 (class 1259 OID 23125)
-- Name: preferencias_usuario; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.preferencias_usuario (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    clave character varying(80) NOT NULL,
    valor jsonb NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE negocio.preferencias_usuario OWNER TO postgres;

--
-- TOC entry 6393 (class 0 OID 0)
-- Dependencies: 260
-- Name: TABLE preferencias_usuario; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.preferencias_usuario IS 'Preferencias de visualización por usuario';


--
-- TOC entry 259 (class 1259 OID 23124)
-- Name: preferencias_usuario_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.preferencias_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.preferencias_usuario_id_seq OWNER TO postgres;

--
-- TOC entry 6395 (class 0 OID 0)
-- Dependencies: 259
-- Name: preferencias_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.preferencias_usuario_id_seq OWNED BY negocio.preferencias_usuario.id;


--
-- TOC entry 233 (class 1259 OID 22848)
-- Name: presentaciones; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.presentaciones (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text
);


ALTER TABLE negocio.presentaciones OWNER TO postgres;

--
-- TOC entry 6397 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE presentaciones; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.presentaciones IS 'Presentaciones de venta';


--
-- TOC entry 232 (class 1259 OID 22847)
-- Name: presentaciones_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.presentaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.presentaciones_id_seq OWNER TO postgres;

--
-- TOC entry 6399 (class 0 OID 0)
-- Dependencies: 232
-- Name: presentaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.presentaciones_id_seq OWNED BY negocio.presentaciones.id;


--
-- TOC entry 240 (class 1259 OID 22892)
-- Name: productos; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.productos (
    id integer NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(200) NOT NULL,
    categoria_id integer,
    unidad_medida_id integer,
    presentacion_id integer,
    imagen character varying(255),
    descripcion text,
    marca_id integer,
    precio_venta numeric(10,2),
    caracteristicas jsonb DEFAULT '{}'::jsonb,
    activo boolean DEFAULT true NOT NULL,
    motivo_desactivacion character varying(20),
    motivo_desactivacion_detalle character varying(255),
    fecha_desactivacion timestamp without time zone,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE negocio.productos OWNER TO postgres;

--
-- TOC entry 6401 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE productos; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.productos IS 'Catálogo de productos';


--
-- TOC entry 239 (class 1259 OID 22891)
-- Name: productos_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.productos_id_seq OWNER TO postgres;

--
-- TOC entry 6403 (class 0 OID 0)
-- Dependencies: 239
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.productos_id_seq OWNED BY negocio.productos.id;


--
-- TOC entry 258 (class 1259 OID 23109)
-- Name: reportes_generados; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.reportes_generados (
    id integer NOT NULL,
    usuario_id integer,
    tipo character varying(50) NOT NULL,
    formato character varying(10) NOT NULL,
    parametros jsonb,
    ruta_archivo character varying(255),
    fecha_generacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT reportes_generados_formato_check CHECK (((formato)::text = ANY ((ARRAY['excel'::character varying, 'pdf'::character varying])::text[])))
);


ALTER TABLE negocio.reportes_generados OWNER TO postgres;

--
-- TOC entry 6405 (class 0 OID 0)
-- Dependencies: 258
-- Name: TABLE reportes_generados; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.reportes_generados IS 'Reportes generados por usuarios';


--
-- TOC entry 257 (class 1259 OID 23108)
-- Name: reportes_generados_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.reportes_generados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.reportes_generados_id_seq OWNER TO postgres;

--
-- TOC entry 6407 (class 0 OID 0)
-- Dependencies: 257
-- Name: reportes_generados_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.reportes_generados_id_seq OWNED BY negocio.reportes_generados.id;


--
-- TOC entry 223 (class 1259 OID 22773)
-- Name: rol_permisos; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.rol_permisos (
    rol_id integer NOT NULL,
    permiso_id integer NOT NULL
);


ALTER TABLE negocio.rol_permisos OWNER TO postgres;

--
-- TOC entry 6409 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE rol_permisos; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.rol_permisos IS 'Relación N:N entre roles y permisos';


--
-- TOC entry 220 (class 1259 OID 22751)
-- Name: roles; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.roles (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE negocio.roles OWNER TO postgres;

--
-- TOC entry 6411 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE roles; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.roles IS 'Roles del sistema (Administrador, Encargado de Inventario, etc.)';


--
-- TOC entry 219 (class 1259 OID 22750)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.roles_id_seq OWNER TO postgres;

--
-- TOC entry 6413 (class 0 OID 0)
-- Dependencies: 219
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.roles_id_seq OWNED BY negocio.roles.id;


--
-- TOC entry 227 (class 1259 OID 22810)
-- Name: tokens_recuperacion; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.tokens_recuperacion (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    token character varying(255) NOT NULL,
    expira_en timestamp without time zone NOT NULL,
    usado boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE negocio.tokens_recuperacion OWNER TO postgres;

--
-- TOC entry 6415 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE tokens_recuperacion; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.tokens_recuperacion IS 'Tokens para recuperación de contraseña';


--
-- TOC entry 226 (class 1259 OID 22809)
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.tokens_recuperacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.tokens_recuperacion_id_seq OWNER TO postgres;

--
-- TOC entry 6417 (class 0 OID 0)
-- Dependencies: 226
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.tokens_recuperacion_id_seq OWNED BY negocio.tokens_recuperacion.id;


--
-- TOC entry 250 (class 1259 OID 23021)
-- Name: umbrales_configuracion; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.umbrales_configuracion (
    id integer NOT NULL,
    tipo character varying(30) NOT NULL,
    producto_id integer,
    valor numeric(10,2) NOT NULL,
    usuario_id integer,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT umbrales_configuracion_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['dias_vencimiento'::character varying, 'stock_minimo'::character varying])::text[])))
);


ALTER TABLE negocio.umbrales_configuracion OWNER TO postgres;

--
-- TOC entry 6419 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE umbrales_configuracion; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.umbrales_configuracion IS 'Umbrales de alerta por producto/tipo';


--
-- TOC entry 249 (class 1259 OID 23020)
-- Name: umbrales_configuracion_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.umbrales_configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.umbrales_configuracion_id_seq OWNER TO postgres;

--
-- TOC entry 6421 (class 0 OID 0)
-- Dependencies: 249
-- Name: umbrales_configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.umbrales_configuracion_id_seq OWNED BY negocio.umbrales_configuracion.id;


--
-- TOC entry 231 (class 1259 OID 22839)
-- Name: unidades_medida; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.unidades_medida (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    abreviatura character varying(10) NOT NULL
);


ALTER TABLE negocio.unidades_medida OWNER TO postgres;

--
-- TOC entry 6423 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE unidades_medida; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.unidades_medida IS 'Unidades de medida físicas';


--
-- TOC entry 230 (class 1259 OID 22838)
-- Name: unidades_medida_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.unidades_medida_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.unidades_medida_id_seq OWNER TO postgres;

--
-- TOC entry 6425 (class 0 OID 0)
-- Dependencies: 230
-- Name: unidades_medida_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.unidades_medida_id_seq OWNED BY negocio.unidades_medida.id;


--
-- TOC entry 225 (class 1259 OID 22789)
-- Name: usuarios; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.usuarios (
    id integer NOT NULL,
    password character varying(128) NOT NULL,
    email character varying(254) NOT NULL,
    rol_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    ultimo_acceso timestamp without time zone,
    is_staff boolean DEFAULT false NOT NULL,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) DEFAULT ''::character varying NOT NULL,
    dni character varying(20)
);


ALTER TABLE negocio.usuarios OWNER TO postgres;

--
-- TOC entry 6427 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE usuarios; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.usuarios IS 'Usuarios del sistema (auth custom con email)';


--
-- TOC entry 224 (class 1259 OID 22788)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.usuarios_id_seq OWNER TO postgres;

--
-- TOC entry 6429 (class 0 OID 0)
-- Dependencies: 224
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.usuarios_id_seq OWNED BY negocio.usuarios.id;


--
-- TOC entry 246 (class 1259 OID 22977)
-- Name: ventas; Type: TABLE; Schema: negocio; Owner: postgres
--

CREATE TABLE negocio.ventas (
    id bigint NOT NULL,
    producto_id integer NOT NULL,
    lote_id integer,
    cantidad numeric(12,2) NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    fecha_venta date NOT NULL,
    origen character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    usuario_id integer,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ventas_origen_check CHECK (((origen)::text = ANY ((ARRAY['manual'::character varying, 'importado'::character varying])::text[])))
);


ALTER TABLE negocio.ventas OWNER TO postgres;

--
-- TOC entry 6431 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE ventas; Type: COMMENT; Schema: negocio; Owner: postgres
--

COMMENT ON TABLE negocio.ventas IS 'Registro de ventas';


--
-- TOC entry 245 (class 1259 OID 22976)
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: negocio; Owner: postgres
--

CREATE SEQUENCE negocio.ventas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE negocio.ventas_id_seq OWNER TO postgres;

--
-- TOC entry 6433 (class 0 OID 0)
-- Dependencies: 245
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: negocio; Owner: postgres
--

ALTER SEQUENCE negocio.ventas_id_seq OWNED BY negocio.ventas.id;


--
-- TOC entry 311 (class 1259 OID 23537)
-- Name: alertas; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.alertas (
    id bigint NOT NULL,
    tipo character varying(30) NOT NULL,
    producto_id integer NOT NULL,
    lote_id integer,
    mensaje text NOT NULL,
    severidad character varying(20) DEFAULT 'media'::character varying NOT NULL,
    datos_origen jsonb,
    estado character varying(20) DEFAULT 'nueva'::character varying NOT NULL,
    fecha_creacion timestamp with time zone NOT NULL,
    fecha_atendida timestamp with time zone
);


ALTER TABLE public.alertas OWNER TO business_api_role;

--
-- TOC entry 310 (class 1259 OID 23536)
-- Name: alertas_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.alertas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alertas_id_seq OWNER TO business_api_role;

--
-- TOC entry 6435 (class 0 OID 0)
-- Dependencies: 310
-- Name: alertas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.alertas_id_seq OWNED BY public.alertas.id;


--
-- TOC entry 319 (class 1259 OID 23605)
-- Name: auditoria; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.auditoria (
    id bigint NOT NULL,
    usuario_id integer,
    accion character varying(100) NOT NULL,
    entidad character varying(80) NOT NULL,
    entidad_id integer,
    detalle jsonb,
    fecha timestamp with time zone NOT NULL
);


ALTER TABLE public.auditoria OWNER TO business_api_role;

--
-- TOC entry 318 (class 1259 OID 23604)
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auditoria_id_seq OWNER TO business_api_role;

--
-- TOC entry 6436 (class 0 OID 0)
-- Dependencies: 318
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


--
-- TOC entry 293 (class 1259 OID 23361)
-- Name: catalogo_marcas; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.catalogo_marcas (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


ALTER TABLE public.catalogo_marcas OWNER TO business_api_role;

--
-- TOC entry 292 (class 1259 OID 23360)
-- Name: catalogo_marcas_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.catalogo_marcas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.catalogo_marcas_id_seq OWNER TO business_api_role;

--
-- TOC entry 6437 (class 0 OID 0)
-- Dependencies: 292
-- Name: catalogo_marcas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.catalogo_marcas_id_seq OWNED BY public.catalogo_marcas.id;


--
-- TOC entry 295 (class 1259 OID 23370)
-- Name: catalogo_valores; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.catalogo_valores (
    id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    valor character varying(100) NOT NULL,
    etiqueta character varying(100)
);


ALTER TABLE public.catalogo_valores OWNER TO business_api_role;

--
-- TOC entry 294 (class 1259 OID 23369)
-- Name: catalogo_valores_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.catalogo_valores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.catalogo_valores_id_seq OWNER TO business_api_role;

--
-- TOC entry 6438 (class 0 OID 0)
-- Dependencies: 294
-- Name: catalogo_valores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.catalogo_valores_id_seq OWNED BY public.catalogo_valores.id;


--
-- TOC entry 287 (class 1259 OID 23330)
-- Name: categorias; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    vida_util_dias integer
);


ALTER TABLE public.categorias OWNER TO business_api_role;

--
-- TOC entry 286 (class 1259 OID 23329)
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_id_seq OWNER TO business_api_role;

--
-- TOC entry 6439 (class 0 OID 0)
-- Dependencies: 286
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- TOC entry 305 (class 1259 OID 23481)
-- Name: importaciones_ventas; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.importaciones_ventas (
    id integer NOT NULL,
    usuario_id integer,
    nombre_archivo character varying(255) NOT NULL,
    filas_procesadas integer DEFAULT 0 NOT NULL,
    filas_con_error integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'procesando'::character varying NOT NULL,
    fecha timestamp with time zone NOT NULL
);


ALTER TABLE public.importaciones_ventas OWNER TO business_api_role;

--
-- TOC entry 304 (class 1259 OID 23480)
-- Name: importaciones_ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.importaciones_ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.importaciones_ventas_id_seq OWNER TO business_api_role;

--
-- TOC entry 6440 (class 0 OID 0)
-- Dependencies: 304
-- Name: importaciones_ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.importaciones_ventas_id_seq OWNED BY public.importaciones_ventas.id;


--
-- TOC entry 299 (class 1259 OID 23415)
-- Name: lotes; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.lotes (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    numero_lote character varying(60) NOT NULL,
    cantidad_inicial numeric(12,2) DEFAULT 0 NOT NULL,
    cantidad_actual numeric(12,2) DEFAULT 0 NOT NULL,
    fecha_ingreso timestamp with time zone NOT NULL,
    fecha_vencimiento timestamp with time zone NOT NULL,
    fecha_creacion timestamp with time zone NOT NULL
);


ALTER TABLE public.lotes OWNER TO business_api_role;

--
-- TOC entry 298 (class 1259 OID 23414)
-- Name: lotes_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.lotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lotes_id_seq OWNER TO business_api_role;

--
-- TOC entry 6441 (class 0 OID 0)
-- Dependencies: 298
-- Name: lotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.lotes_id_seq OWNED BY public.lotes.id;


--
-- TOC entry 301 (class 1259 OID 23433)
-- Name: movimientos_inventario; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.movimientos_inventario (
    id bigint NOT NULL,
    lote_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    origen character varying(20) DEFAULT 'otro'::character varying NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    precio_unitario numeric(10,2),
    precio_total numeric(12,2),
    saldo_cantidad numeric(12,2) DEFAULT 0 NOT NULL,
    saldo_precio_unitario numeric(10,2) DEFAULT 0 NOT NULL,
    saldo_valorizado numeric(12,2) DEFAULT 0 NOT NULL,
    motivo character varying(200),
    usuario_id integer,
    fecha timestamp with time zone NOT NULL
);


ALTER TABLE public.movimientos_inventario OWNER TO business_api_role;

--
-- TOC entry 300 (class 1259 OID 23432)
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.movimientos_inventario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movimientos_inventario_id_seq OWNER TO business_api_role;

--
-- TOC entry 6442 (class 0 OID 0)
-- Dependencies: 300
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.movimientos_inventario_id_seq OWNED BY public.movimientos_inventario.id;


--
-- TOC entry 313 (class 1259 OID 23561)
-- Name: notificaciones_correo; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.notificaciones_correo (
    id bigint NOT NULL,
    alerta_id integer,
    destinatario character varying(254) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    proveedor character varying(30) DEFAULT 'brevo'::character varying NOT NULL,
    fecha_envio timestamp with time zone
);


ALTER TABLE public.notificaciones_correo OWNER TO business_api_role;

--
-- TOC entry 312 (class 1259 OID 23560)
-- Name: notificaciones_correo_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.notificaciones_correo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notificaciones_correo_id_seq OWNER TO business_api_role;

--
-- TOC entry 6443 (class 0 OID 0)
-- Dependencies: 312
-- Name: notificaciones_correo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.notificaciones_correo_id_seq OWNED BY public.notificaciones_correo.id;


--
-- TOC entry 309 (class 1259 OID 23517)
-- Name: ordenes_reabastecimiento; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.ordenes_reabastecimiento (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_sugerida numeric(12,2) NOT NULL,
    cantidad_aprobada numeric(12,2),
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    generado_por character varying(20) DEFAULT 'automatico'::character varying NOT NULL,
    usuario_id integer,
    fecha_creacion timestamp with time zone NOT NULL,
    fecha_actualizacion timestamp with time zone NOT NULL
);


ALTER TABLE public.ordenes_reabastecimiento OWNER TO business_api_role;

--
-- TOC entry 308 (class 1259 OID 23516)
-- Name: ordenes_reabastecimiento_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.ordenes_reabastecimiento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ordenes_reabastecimiento_id_seq OWNER TO business_api_role;

--
-- TOC entry 6444 (class 0 OID 0)
-- Dependencies: 308
-- Name: ordenes_reabastecimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.ordenes_reabastecimiento_id_seq OWNED BY public.ordenes_reabastecimiento.id;


--
-- TOC entry 282 (class 1259 OID 23289)
-- Name: permisos; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.permisos (
    id integer NOT NULL,
    codigo character varying(80) NOT NULL,
    descripcion text
);


ALTER TABLE public.permisos OWNER TO business_api_role;

--
-- TOC entry 281 (class 1259 OID 23288)
-- Name: permisos_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.permisos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_id_seq OWNER TO business_api_role;

--
-- TOC entry 6445 (class 0 OID 0)
-- Dependencies: 281
-- Name: permisos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.permisos_id_seq OWNED BY public.permisos.id;


--
-- TOC entry 326 (class 1259 OID 39790)
-- Name: precio; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.precio (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    preciolista numeric(10,2) NOT NULL,
    preciodescuento numeric(10,2),
    vigente_desde date DEFAULT CURRENT_DATE NOT NULL,
    creado_en timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT precio_preciodescuento_check CHECK ((preciodescuento >= (0)::numeric)),
    CONSTRAINT precio_preciolista_check CHECK ((preciolista >= (0)::numeric))
);


ALTER TABLE public.precio OWNER TO business_api_role;

--
-- TOC entry 325 (class 1259 OID 39789)
-- Name: precio_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.precio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.precio_id_seq OWNER TO business_api_role;

--
-- TOC entry 6446 (class 0 OID 0)
-- Dependencies: 325
-- Name: precio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.precio_id_seq OWNED BY public.precio.id;


--
-- TOC entry 317 (class 1259 OID 23589)
-- Name: preferencias_usuario; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.preferencias_usuario (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    clave character varying(80) NOT NULL,
    valor jsonb NOT NULL,
    fecha_actualizacion timestamp with time zone NOT NULL
);


ALTER TABLE public.preferencias_usuario OWNER TO business_api_role;

--
-- TOC entry 316 (class 1259 OID 23588)
-- Name: preferencias_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.preferencias_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.preferencias_usuario_id_seq OWNER TO business_api_role;

--
-- TOC entry 6447 (class 0 OID 0)
-- Dependencies: 316
-- Name: preferencias_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.preferencias_usuario_id_seq OWNED BY public.preferencias_usuario.id;


--
-- TOC entry 291 (class 1259 OID 23350)
-- Name: presentaciones; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.presentaciones (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text
);


ALTER TABLE public.presentaciones OWNER TO business_api_role;

--
-- TOC entry 290 (class 1259 OID 23349)
-- Name: presentaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.presentaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.presentaciones_id_seq OWNER TO business_api_role;

--
-- TOC entry 6448 (class 0 OID 0)
-- Dependencies: 290
-- Name: presentaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.presentaciones_id_seq OWNED BY public.presentaciones.id;


--
-- TOC entry 323 (class 1259 OID 39763)
-- Name: producto_presentacion; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.producto_presentacion (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    nivel smallint NOT NULL,
    envase_id integer NOT NULL,
    cantidad numeric(10,2) NOT NULL,
    CONSTRAINT producto_presentacion_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT producto_presentacion_nivel_check CHECK ((nivel > 0))
);


ALTER TABLE public.producto_presentacion OWNER TO business_api_role;

--
-- TOC entry 322 (class 1259 OID 39762)
-- Name: producto_presentacion_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.producto_presentacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.producto_presentacion_id_seq OWNER TO business_api_role;

--
-- TOC entry 6449 (class 0 OID 0)
-- Dependencies: 322
-- Name: producto_presentacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.producto_presentacion_id_seq OWNED BY public.producto_presentacion.id;


--
-- TOC entry 297 (class 1259 OID 23379)
-- Name: productos; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    imagen character varying(255),
    precio_venta numeric(10,2),
    caracteristicas jsonb DEFAULT '{}'::jsonb,
    activo boolean DEFAULT true NOT NULL,
    motivo_desactivacion character varying(20),
    motivo_desactivacion_detalle character varying(255),
    fecha_desactivacion timestamp with time zone,
    fecha_creacion timestamp with time zone NOT NULL,
    fecha_actualizacion timestamp with time zone NOT NULL,
    categoria_id integer,
    unidad_medida_id integer,
    presentacion_id integer,
    marca_id integer,
    es_bonificacion boolean DEFAULT false NOT NULL,
    contenido_valor numeric(10,2),
    categoria_paquete_id integer,
    contenido_paquete_cantidad numeric(10,2),
    contenido_paquete_envase_id integer,
    CONSTRAINT chk_producto_paquete_emparejado CHECK (((contenido_paquete_cantidad IS NULL) = (contenido_paquete_envase_id IS NULL))),
    CONSTRAINT productos_contenido_paquete_cantidad_check CHECK (((contenido_paquete_cantidad IS NULL) OR (contenido_paquete_cantidad > (0)::numeric))),
    CONSTRAINT productos_contenido_valor_check CHECK ((contenido_valor >= (0)::numeric))
);


ALTER TABLE public.productos OWNER TO business_api_role;

--
-- TOC entry 296 (class 1259 OID 23378)
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_seq OWNER TO business_api_role;

--
-- TOC entry 6450 (class 0 OID 0)
-- Dependencies: 296
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- TOC entry 315 (class 1259 OID 23575)
-- Name: reportes_generados; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.reportes_generados (
    id integer NOT NULL,
    usuario_id integer,
    tipo character varying(50) NOT NULL,
    formato character varying(10) NOT NULL,
    parametros jsonb,
    ruta_archivo character varying(255),
    fecha_generacion timestamp with time zone NOT NULL
);


ALTER TABLE public.reportes_generados OWNER TO business_api_role;

--
-- TOC entry 314 (class 1259 OID 23574)
-- Name: reportes_generados_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.reportes_generados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reportes_generados_id_seq OWNER TO business_api_role;

--
-- TOC entry 6451 (class 0 OID 0)
-- Dependencies: 314
-- Name: reportes_generados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.reportes_generados_id_seq OWNED BY public.reportes_generados.id;


--
-- TOC entry 283 (class 1259 OID 23299)
-- Name: rol_permisos; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.rol_permisos (
    rol_id integer NOT NULL,
    permiso_id integer NOT NULL
);


ALTER TABLE public.rol_permisos OWNER TO business_api_role;

--
-- TOC entry 278 (class 1259 OID 23260)
-- Name: roles; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    fecha_creacion timestamp with time zone NOT NULL
);


ALTER TABLE public.roles OWNER TO business_api_role;

--
-- TOC entry 277 (class 1259 OID 23259)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO business_api_role;

--
-- TOC entry 6452 (class 0 OID 0)
-- Dependencies: 277
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 321 (class 1259 OID 39752)
-- Name: tipo_envase; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.tipo_envase (
    id integer NOT NULL,
    nombre character varying(40) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone NOT NULL
);


ALTER TABLE public.tipo_envase OWNER TO business_api_role;

--
-- TOC entry 320 (class 1259 OID 39751)
-- Name: tipo_envase_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.tipo_envase_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tipo_envase_id_seq OWNER TO business_api_role;

--
-- TOC entry 6453 (class 0 OID 0)
-- Dependencies: 320
-- Name: tipo_envase_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.tipo_envase_id_seq OWNED BY public.tipo_envase.id;


--
-- TOC entry 285 (class 1259 OID 23315)
-- Name: tokens_recuperacion; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.tokens_recuperacion (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    token character varying(255),
    expira_en timestamp with time zone NOT NULL,
    usado boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp with time zone NOT NULL,
    code_hash character varying(255),
    intentos integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.tokens_recuperacion OWNER TO business_api_role;

--
-- TOC entry 284 (class 1259 OID 23314)
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.tokens_recuperacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tokens_recuperacion_id_seq OWNER TO business_api_role;

--
-- TOC entry 6454 (class 0 OID 0)
-- Dependencies: 284
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.tokens_recuperacion_id_seq OWNED BY public.tokens_recuperacion.id;


--
-- TOC entry 307 (class 1259 OID 23496)
-- Name: umbrales_configuracion; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.umbrales_configuracion (
    id integer NOT NULL,
    tipo character varying(30) NOT NULL,
    producto_id integer,
    valor numeric(10,2) NOT NULL,
    usuario_id integer,
    fecha_actualizacion timestamp with time zone NOT NULL
);


ALTER TABLE public.umbrales_configuracion OWNER TO business_api_role;

--
-- TOC entry 306 (class 1259 OID 23495)
-- Name: umbrales_configuracion_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.umbrales_configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.umbrales_configuracion_id_seq OWNER TO business_api_role;

--
-- TOC entry 6455 (class 0 OID 0)
-- Dependencies: 306
-- Name: umbrales_configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.umbrales_configuracion_id_seq OWNED BY public.umbrales_configuracion.id;


--
-- TOC entry 289 (class 1259 OID 23341)
-- Name: unidades_medida; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.unidades_medida (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    abreviatura character varying(10) NOT NULL
);


ALTER TABLE public.unidades_medida OWNER TO business_api_role;

--
-- TOC entry 288 (class 1259 OID 23340)
-- Name: unidades_medida_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.unidades_medida_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.unidades_medida_id_seq OWNER TO business_api_role;

--
-- TOC entry 6456 (class 0 OID 0)
-- Dependencies: 288
-- Name: unidades_medida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.unidades_medida_id_seq OWNED BY public.unidades_medida.id;


--
-- TOC entry 280 (class 1259 OID 23271)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    email character varying(254) NOT NULL,
    rol_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp with time zone NOT NULL,
    ultimo_acceso timestamp with time zone,
    is_staff boolean DEFAULT false NOT NULL,
    password_hash character varying(128),
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) DEFAULT ''::character varying NOT NULL,
    dni character varying(20)
);


ALTER TABLE public.usuarios OWNER TO business_api_role;

--
-- TOC entry 279 (class 1259 OID 23270)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO business_api_role;

--
-- TOC entry 6457 (class 0 OID 0)
-- Dependencies: 279
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- TOC entry 303 (class 1259 OID 23456)
-- Name: ventas; Type: TABLE; Schema: public; Owner: business_api_role
--

CREATE TABLE public.ventas (
    id bigint NOT NULL,
    producto_id integer NOT NULL,
    lote_id integer,
    cantidad numeric(12,2) NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    fecha_venta timestamp with time zone NOT NULL,
    origen character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    usuario_id integer,
    fecha_creacion timestamp with time zone NOT NULL
);


ALTER TABLE public.ventas OWNER TO business_api_role;

--
-- TOC entry 302 (class 1259 OID 23455)
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: business_api_role
--

CREATE SEQUENCE public.ventas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ventas_id_seq OWNER TO business_api_role;

--
-- TOC entry 6458 (class 0 OID 0)
-- Dependencies: 302
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: business_api_role
--

ALTER SEQUENCE public.ventas_id_seq OWNED BY public.ventas.id;


--
-- TOC entry 327 (class 1259 OID 39806)
-- Name: vista_precios_vigentes; Type: VIEW; Schema: public; Owner: business_api_role
--

CREATE VIEW public.vista_precios_vigentes AS
 SELECT DISTINCT ON (producto_id) producto_id,
    preciolista,
    preciodescuento,
    vigente_desde
   FROM public.precio
  WHERE (vigente_desde <= CURRENT_DATE)
  ORDER BY producto_id, vigente_desde DESC;


ALTER VIEW public.vista_precios_vigentes OWNER TO business_api_role;

--
-- TOC entry 324 (class 1259 OID 39785)
-- Name: vista_producto_empaque_total; Type: VIEW; Schema: public; Owner: business_api_role
--

CREATE VIEW public.vista_producto_empaque_total AS
 SELECT producto_id,
    round(exp(sum(ln(cantidad))), 0) AS total_unidades_empaque_mayor
   FROM public.producto_presentacion
  GROUP BY producto_id;


ALTER VIEW public.vista_producto_empaque_total OWNER TO business_api_role;

--
-- TOC entry 5100 (class 2604 OID 23242)
-- Name: anomalias id; Type: DEFAULT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.anomalias ALTER COLUMN id SET DEFAULT nextval('ml.anomalias_id_seq'::regclass);


--
-- TOC entry 5084 (class 2604 OID 23164)
-- Name: conjuntos_datos id; Type: DEFAULT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.conjuntos_datos ALTER COLUMN id SET DEFAULT nextval('ml.conjuntos_datos_id_seq'::regclass);


--
-- TOC entry 5089 (class 2604 OID 23184)
-- Name: entrenamientos id; Type: DEFAULT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.entrenamientos ALTER COLUMN id SET DEFAULT nextval('ml.entrenamientos_id_seq'::regclass);


--
-- TOC entry 5086 (class 2604 OID 23172)
-- Name: modelos id; Type: DEFAULT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.modelos ALTER COLUMN id SET DEFAULT nextval('ml.modelos_id_seq'::regclass);


--
-- TOC entry 5092 (class 2604 OID 23201)
-- Name: predicciones_demanda id; Type: DEFAULT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.predicciones_demanda ALTER COLUMN id SET DEFAULT nextval('ml.predicciones_demanda_id_seq'::regclass);


--
-- TOC entry 5097 (class 2604 OID 23229)
-- Name: recomendaciones id; Type: DEFAULT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.recomendaciones ALTER COLUMN id SET DEFAULT nextval('ml.recomendaciones_id_seq'::regclass);


--
-- TOC entry 5095 (class 2604 OID 23216)
-- Name: riesgos_vencimiento id; Type: DEFAULT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.riesgos_vencimiento ALTER COLUMN id SET DEFAULT nextval('ml.riesgos_vencimiento_id_seq'::regclass);


--
-- TOC entry 5071 (class 2604 OID 23069)
-- Name: alertas id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.alertas ALTER COLUMN id SET DEFAULT nextval('negocio.alertas_id_seq'::regclass);


--
-- TOC entry 5082 (class 2604 OID 23145)
-- Name: auditoria id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.auditoria ALTER COLUMN id SET DEFAULT nextval('negocio.auditoria_id_seq'::regclass);


--
-- TOC entry 5038 (class 2604 OID 22862)
-- Name: catalogo_marcas id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_marcas ALTER COLUMN id SET DEFAULT nextval('negocio.catalogo_marcas_id_seq'::regclass);


--
-- TOC entry 5039 (class 2604 OID 22886)
-- Name: catalogo_valores id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_valores ALTER COLUMN id SET DEFAULT nextval('negocio.catalogo_valores_id_seq'::regclass);


--
-- TOC entry 5034 (class 2604 OID 22830)
-- Name: categorias id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.categorias ALTER COLUMN id SET DEFAULT nextval('negocio.categorias_id_seq'::regclass);


--
-- TOC entry 5059 (class 2604 OID 23007)
-- Name: importaciones_ventas id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.importaciones_ventas ALTER COLUMN id SET DEFAULT nextval('negocio.importaciones_ventas_id_seq'::regclass);


--
-- TOC entry 5045 (class 2604 OID 22933)
-- Name: lotes id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.lotes ALTER COLUMN id SET DEFAULT nextval('negocio.lotes_id_seq'::regclass);


--
-- TOC entry 5050 (class 2604 OID 22953)
-- Name: movimientos_inventario id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.movimientos_inventario ALTER COLUMN id SET DEFAULT nextval('negocio.movimientos_inventario_id_seq'::regclass);


--
-- TOC entry 5075 (class 2604 OID 23097)
-- Name: notificaciones_correo id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.notificaciones_correo ALTER COLUMN id SET DEFAULT nextval('negocio.notificaciones_correo_id_seq'::regclass);


--
-- TOC entry 5066 (class 2604 OID 23045)
-- Name: ordenes_reabastecimiento id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ordenes_reabastecimiento ALTER COLUMN id SET DEFAULT nextval('negocio.ordenes_reabastecimiento_id_seq'::regclass);


--
-- TOC entry 5025 (class 2604 OID 22766)
-- Name: permisos id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.permisos ALTER COLUMN id SET DEFAULT nextval('negocio.permisos_id_seq'::regclass);


--
-- TOC entry 5080 (class 2604 OID 23128)
-- Name: preferencias_usuario id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.preferencias_usuario ALTER COLUMN id SET DEFAULT nextval('negocio.preferencias_usuario_id_seq'::regclass);


--
-- TOC entry 5037 (class 2604 OID 22851)
-- Name: presentaciones id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.presentaciones ALTER COLUMN id SET DEFAULT nextval('negocio.presentaciones_id_seq'::regclass);


--
-- TOC entry 5040 (class 2604 OID 22895)
-- Name: productos id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.productos ALTER COLUMN id SET DEFAULT nextval('negocio.productos_id_seq'::regclass);


--
-- TOC entry 5078 (class 2604 OID 23112)
-- Name: reportes_generados id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.reportes_generados ALTER COLUMN id SET DEFAULT nextval('negocio.reportes_generados_id_seq'::regclass);


--
-- TOC entry 5023 (class 2604 OID 22754)
-- Name: roles id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.roles ALTER COLUMN id SET DEFAULT nextval('negocio.roles_id_seq'::regclass);


--
-- TOC entry 5031 (class 2604 OID 22813)
-- Name: tokens_recuperacion id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.tokens_recuperacion ALTER COLUMN id SET DEFAULT nextval('negocio.tokens_recuperacion_id_seq'::regclass);


--
-- TOC entry 5064 (class 2604 OID 23024)
-- Name: umbrales_configuracion id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.umbrales_configuracion ALTER COLUMN id SET DEFAULT nextval('negocio.umbrales_configuracion_id_seq'::regclass);


--
-- TOC entry 5036 (class 2604 OID 22842)
-- Name: unidades_medida id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.unidades_medida ALTER COLUMN id SET DEFAULT nextval('negocio.unidades_medida_id_seq'::regclass);


--
-- TOC entry 5026 (class 2604 OID 22792)
-- Name: usuarios id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.usuarios ALTER COLUMN id SET DEFAULT nextval('negocio.usuarios_id_seq'::regclass);


--
-- TOC entry 5056 (class 2604 OID 22980)
-- Name: ventas id; Type: DEFAULT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ventas ALTER COLUMN id SET DEFAULT nextval('negocio.ventas_id_seq'::regclass);


--
-- TOC entry 5140 (class 2604 OID 23540)
-- Name: alertas id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.alertas ALTER COLUMN id SET DEFAULT nextval('public.alertas_id_seq'::regclass);


--
-- TOC entry 5148 (class 2604 OID 23608)
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


--
-- TOC entry 5116 (class 2604 OID 23364)
-- Name: catalogo_marcas id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas ALTER COLUMN id SET DEFAULT nextval('public.catalogo_marcas_id_seq'::regclass);


--
-- TOC entry 5117 (class 2604 OID 23373)
-- Name: catalogo_valores id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_valores ALTER COLUMN id SET DEFAULT nextval('public.catalogo_valores_id_seq'::regclass);


--
-- TOC entry 5113 (class 2604 OID 23333)
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- TOC entry 5132 (class 2604 OID 23484)
-- Name: importaciones_ventas id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.importaciones_ventas ALTER COLUMN id SET DEFAULT nextval('public.importaciones_ventas_id_seq'::regclass);


--
-- TOC entry 5122 (class 2604 OID 23418)
-- Name: lotes id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.lotes ALTER COLUMN id SET DEFAULT nextval('public.lotes_id_seq'::regclass);


--
-- TOC entry 5125 (class 2604 OID 23436)
-- Name: movimientos_inventario id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.movimientos_inventario ALTER COLUMN id SET DEFAULT nextval('public.movimientos_inventario_id_seq'::regclass);


--
-- TOC entry 5143 (class 2604 OID 23564)
-- Name: notificaciones_correo id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.notificaciones_correo ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_correo_id_seq'::regclass);


--
-- TOC entry 5137 (class 2604 OID 23520)
-- Name: ordenes_reabastecimiento id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ordenes_reabastecimiento ALTER COLUMN id SET DEFAULT nextval('public.ordenes_reabastecimiento_id_seq'::regclass);


--
-- TOC entry 5109 (class 2604 OID 23292)
-- Name: permisos id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos ALTER COLUMN id SET DEFAULT nextval('public.permisos_id_seq'::regclass);


--
-- TOC entry 5152 (class 2604 OID 39793)
-- Name: precio id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.precio ALTER COLUMN id SET DEFAULT nextval('public.precio_id_seq'::regclass);


--
-- TOC entry 5147 (class 2604 OID 23592)
-- Name: preferencias_usuario id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.preferencias_usuario ALTER COLUMN id SET DEFAULT nextval('public.preferencias_usuario_id_seq'::regclass);


--
-- TOC entry 5115 (class 2604 OID 23353)
-- Name: presentaciones id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones ALTER COLUMN id SET DEFAULT nextval('public.presentaciones_id_seq'::regclass);


--
-- TOC entry 5151 (class 2604 OID 39766)
-- Name: producto_presentacion id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.producto_presentacion ALTER COLUMN id SET DEFAULT nextval('public.producto_presentacion_id_seq'::regclass);


--
-- TOC entry 5118 (class 2604 OID 23382)
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- TOC entry 5146 (class 2604 OID 23578)
-- Name: reportes_generados id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.reportes_generados ALTER COLUMN id SET DEFAULT nextval('public.reportes_generados_id_seq'::regclass);


--
-- TOC entry 5104 (class 2604 OID 23263)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 5149 (class 2604 OID 39755)
-- Name: tipo_envase id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tipo_envase ALTER COLUMN id SET DEFAULT nextval('public.tipo_envase_id_seq'::regclass);


--
-- TOC entry 5110 (class 2604 OID 23318)
-- Name: tokens_recuperacion id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion ALTER COLUMN id SET DEFAULT nextval('public.tokens_recuperacion_id_seq'::regclass);


--
-- TOC entry 5136 (class 2604 OID 23499)
-- Name: umbrales_configuracion id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.umbrales_configuracion ALTER COLUMN id SET DEFAULT nextval('public.umbrales_configuracion_id_seq'::regclass);


--
-- TOC entry 5114 (class 2604 OID 23344)
-- Name: unidades_medida id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida ALTER COLUMN id SET DEFAULT nextval('public.unidades_medida_id_seq'::regclass);


--
-- TOC entry 5105 (class 2604 OID 23274)
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- TOC entry 5130 (class 2604 OID 23459)
-- Name: ventas id; Type: DEFAULT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ventas ALTER COLUMN id SET DEFAULT nextval('public.ventas_id_seq'::regclass);


--
-- TOC entry 6261 (class 0 OID 23239)
-- Dependencies: 276
-- Data for Name: anomalias; Type: TABLE DATA; Schema: ml; Owner: postgres
--

COPY ml.anomalias (id, tipo, entidad, entidad_id, descripcion, severidad, estado, fecha_deteccion) FROM stdin;
\.


--
-- TOC entry 6249 (class 0 OID 23161)
-- Dependencies: 264
-- Data for Name: conjuntos_datos; Type: TABLE DATA; Schema: ml; Owner: postgres
--

COPY ml.conjuntos_datos (id, descripcion, filas, rango_desde, rango_hasta, fecha_preparacion) FROM stdin;
\.


--
-- TOC entry 6253 (class 0 OID 23181)
-- Dependencies: 268
-- Data for Name: entrenamientos; Type: TABLE DATA; Schema: ml; Owner: postgres
--

COPY ml.entrenamientos (id, modelo_id, iniciado_en, finalizado_en, estado, metricas, detalle) FROM stdin;
\.


--
-- TOC entry 6251 (class 0 OID 23169)
-- Dependencies: 266
-- Data for Name: modelos; Type: TABLE DATA; Schema: ml; Owner: postgres
--

COPY ml.modelos (id, nombre, tipo, version, metricas, ruta_artefacto, estado, fecha_entrenamiento) FROM stdin;
\.


--
-- TOC entry 6255 (class 0 OID 23198)
-- Dependencies: 270
-- Data for Name: predicciones_demanda; Type: TABLE DATA; Schema: ml; Owner: postgres
--

COPY ml.predicciones_demanda (id, producto_id, modelo_id, horizonte_dias, cantidad_predicha, intervalo_inferior, intervalo_superior, fecha_prediccion, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6259 (class 0 OID 23226)
-- Dependencies: 274
-- Data for Name: recomendaciones; Type: TABLE DATA; Schema: ml; Owner: postgres
--

COPY ml.recomendaciones (id, producto_id, tipo, descripcion, prioridad, estado, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6257 (class 0 OID 23213)
-- Dependencies: 272
-- Data for Name: riesgos_vencimiento; Type: TABLE DATA; Schema: ml; Owner: postgres
--

COPY ml.riesgos_vencimiento (id, producto_id, lote_id, puntaje_riesgo, nivel_prioridad, dias_para_vencer, factores, fecha_calculo) FROM stdin;
\.


--
-- TOC entry 6239 (class 0 OID 23066)
-- Dependencies: 254
-- Data for Name: alertas; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.alertas (id, tipo, producto_id, lote_id, mensaje, severidad, datos_origen, estado, fecha_creacion, fecha_atendida) FROM stdin;
\.


--
-- TOC entry 6247 (class 0 OID 23142)
-- Dependencies: 262
-- Data for Name: auditoria; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.auditoria (id, usuario_id, accion, entidad, entidad_id, detalle, fecha) FROM stdin;
\.


--
-- TOC entry 6220 (class 0 OID 22859)
-- Dependencies: 235
-- Data for Name: catalogo_marcas; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.catalogo_marcas (id, nombre) FROM stdin;
\.


--
-- TOC entry 6221 (class 0 OID 22867)
-- Dependencies: 236
-- Data for Name: catalogo_marcas_familias; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.catalogo_marcas_familias (marca_id, categoria_id) FROM stdin;
\.


--
-- TOC entry 6223 (class 0 OID 22883)
-- Dependencies: 238
-- Data for Name: catalogo_valores; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.catalogo_valores (id, tipo, valor, etiqueta) FROM stdin;
\.


--
-- TOC entry 6214 (class 0 OID 22827)
-- Dependencies: 229
-- Data for Name: categorias; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.categorias (id, nombre, descripcion, vida_util_dias, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6233 (class 0 OID 23004)
-- Dependencies: 248
-- Data for Name: importaciones_ventas; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.importaciones_ventas (id, usuario_id, nombre_archivo, filas_procesadas, filas_con_error, estado, fecha) FROM stdin;
\.


--
-- TOC entry 6227 (class 0 OID 22930)
-- Dependencies: 242
-- Data for Name: lotes; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.lotes (id, producto_id, numero_lote, cantidad_inicial, cantidad_actual, fecha_ingresso, fecha_vencimiento, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6229 (class 0 OID 22950)
-- Dependencies: 244
-- Data for Name: movimientos_inventario; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.movimientos_inventario (id, lote_id, tipo, origen, cantidad, precio_unitario, precio_total, saldo_cantidad, saldo_precio_unitario, saldo_valorizado, motivo, usuario_id, fecha) FROM stdin;
\.


--
-- TOC entry 6241 (class 0 OID 23094)
-- Dependencies: 256
-- Data for Name: notificaciones_correo; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.notificaciones_correo (id, alerta_id, destinatario, estado, proveedor, fecha_envio) FROM stdin;
\.


--
-- TOC entry 6237 (class 0 OID 23042)
-- Dependencies: 252
-- Data for Name: ordenes_reabastecimiento; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.ordenes_reabastecimiento (id, producto_id, cantidad_sugerida, cantidad_aprobada, estado, generado_por, usuario_id, fecha_creacion, fecha_actualizacion) FROM stdin;
\.


--
-- TOC entry 6207 (class 0 OID 22763)
-- Dependencies: 222
-- Data for Name: permisos; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.permisos (id, codigo, descripcion) FROM stdin;
\.


--
-- TOC entry 6245 (class 0 OID 23125)
-- Dependencies: 260
-- Data for Name: preferencias_usuario; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.preferencias_usuario (id, usuario_id, clave, valor, fecha_actualizacion) FROM stdin;
\.


--
-- TOC entry 6218 (class 0 OID 22848)
-- Dependencies: 233
-- Data for Name: presentaciones; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.presentaciones (id, nombre, descripcion) FROM stdin;
\.


--
-- TOC entry 6225 (class 0 OID 22892)
-- Dependencies: 240
-- Data for Name: productos; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.productos (id, codigo, nombre, categoria_id, unidad_medida_id, presentacion_id, imagen, descripcion, marca_id, precio_venta, caracteristicas, activo, motivo_desactivacion, motivo_desactivacion_detalle, fecha_desactivacion, fecha_creacion, fecha_actualizacion) FROM stdin;
\.


--
-- TOC entry 6243 (class 0 OID 23109)
-- Dependencies: 258
-- Data for Name: reportes_generados; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.reportes_generados (id, usuario_id, tipo, formato, parametros, ruta_archivo, fecha_generacion) FROM stdin;
\.


--
-- TOC entry 6208 (class 0 OID 22773)
-- Dependencies: 223
-- Data for Name: rol_permisos; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.rol_permisos (rol_id, permiso_id) FROM stdin;
\.


--
-- TOC entry 6205 (class 0 OID 22751)
-- Dependencies: 220
-- Data for Name: roles; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.roles (id, nombre, descripcion, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6212 (class 0 OID 22810)
-- Dependencies: 227
-- Data for Name: tokens_recuperacion; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.tokens_recuperacion (id, usuario_id, token, expira_en, usado, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6235 (class 0 OID 23021)
-- Dependencies: 250
-- Data for Name: umbrales_configuracion; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.umbrales_configuracion (id, tipo, producto_id, valor, usuario_id, fecha_actualizacion) FROM stdin;
\.


--
-- TOC entry 6216 (class 0 OID 22839)
-- Dependencies: 231
-- Data for Name: unidades_medida; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.unidades_medida (id, nombre, abreviatura) FROM stdin;
\.


--
-- TOC entry 6210 (class 0 OID 22789)
-- Dependencies: 225
-- Data for Name: usuarios; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.usuarios (id, password, email, rol_id, activo, fecha_creacion, ultimo_acceso, is_staff, nombres, apellidos, dni) FROM stdin;
\.


--
-- TOC entry 6231 (class 0 OID 22977)
-- Dependencies: 246
-- Data for Name: ventas; Type: TABLE DATA; Schema: negocio; Owner: postgres
--

COPY negocio.ventas (id, producto_id, lote_id, cantidad, precio_unitario, fecha_venta, origen, usuario_id, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6296 (class 0 OID 23537)
-- Dependencies: 311
-- Data for Name: alertas; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.alertas (id, tipo, producto_id, lote_id, mensaje, severidad, datos_origen, estado, fecha_creacion, fecha_atendida) FROM stdin;
\.


--
-- TOC entry 6304 (class 0 OID 23605)
-- Dependencies: 319
-- Data for Name: auditoria; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.auditoria (id, usuario_id, accion, entidad, entidad_id, detalle, fecha) FROM stdin;
1	\N	crear	Usuario	1	{"repr": "jararojasjose604@gmail.com"}	2026-09-15 06:10:23.927-05
2	\N	actualizar	Usuario	1	{"repr": "jararojasjose604@gmail.com"}	2026-09-15 06:12:18.55-05
3	\N	actualizar	Usuario	1	{"repr": "jararojasjose604@gmail.com"}	2026-09-16 07:52:40.048-05
4	3	crear	Usuario	2	{"repr": "pedro@cliente.com"}	2026-09-16 08:05:00.942-05
5	\N	actualizar	Usuario	1	{"repr": "jararojasjose604@gmail.com"}	2026-09-16 08:16:37.853-05
6	\N	crear	Producto	1	{"repr": "P-001 - plato n° 16"}	2026-09-17 06:33:53.659-05
7	\N	crear	Lote	1	{"repr": "P-001 / INICIAL"}	2026-09-17 06:33:53.867-05
8	\N	actualizar	Producto	1	{"repr": "P-001 - plato n° 16"}	2026-09-17 06:40:07.647-05
9	\N	actualizar	Producto	1	{"repr": "P-001 - plato n° 16"}	2026-09-17 07:03:11.305-05
10	\N	actualizar	Producto	1	{"repr": "P-001 - plato n° 16"}	2026-09-17 07:04:26.079-05
11	\N	actualizar	Usuario	1	{"repr": "jararojasjose604@gmail.com"}	2026-09-17 21:37:43.138-05
12	\N	crear	Producto	2	{"repr": "P-002 - plato n° 16"}	2026-09-17 21:53:05.467-05
13	\N	crear	Lote	2	{"repr": "P-002 / INICIAL"}	2026-09-17 21:53:05.662-05
14	\N	actualizar	Lote	2	{"repr": "P-002 / INICIAL"}	2026-09-17 21:53:06.041-05
15	\N	actualizar	Producto	2	{"repr": "P-002 - plato n° 16"}	2026-09-17 21:53:26.473-05
16	\N	actualizar	Producto	2	{"repr": "P-002 - plato n° 16"}	2026-09-17 21:59:21.836-05
17	\N	crear	Lote	3	{"repr": "P-001 / GENERAL"}	2026-09-18 06:22:37.958-05
18	\N	actualizar	Lote	3	{"repr": "P-001 / GENERAL"}	2026-09-18 06:22:38.552-05
19	\N	actualizar	Lote	3	{"repr": "P-001 / GENERAL"}	2026-09-18 06:40:19.51-05
20	\N	actualizar	Lote	3	{"repr": "P-001 / GENERAL"}	2026-09-18 06:43:55.352-05
21	\N	crear	Producto	3	{"repr": "P-003 - Caja comino"}	2026-09-18 06:58:16.137-05
22	3	crear	Usuario	3	{"repr": "pedroinventario@cliente.com"}	2026-09-18 08:23:31.558-05
23	\N	actualizar	Lote	3	{"repr": "P-001 / GENERAL"}	2026-09-18 08:26:39.834-05
24	\N	crear	Lote	4	{"repr": "P-003 / GENERAL"}	2026-09-18 08:28:46.583-05
25	\N	actualizar	Lote	4	{"repr": "P-003 / GENERAL"}	2026-09-18 08:28:47.065-05
26	\N	eliminar	Lote	1	{"repr": "P-001 / INICIAL"}	2026-09-18 08:52:09.669-05
27	\N	actualizar	Producto	2	{"repr": "P-002 - plato n° 16"}	2026-09-18 09:04:22.288-05
\.


--
-- TOC entry 6278 (class 0 OID 23361)
-- Dependencies: 293
-- Data for Name: catalogo_marcas; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.catalogo_marcas (id, nombre) FROM stdin;
133	ALACENA
134	ALPESA
3	AJI-NO-MEN
4	AJI-NO-MIX
5	AJI-NO-MOTO
6	AJI-NO-SILLAO
135	EMSAL
136	INDOMIE
137	DOÑA GUSTA
44	MAX SABOR
51	NAKAMITO
58	RICASA
61	SIBARITA
\.


--
-- TOC entry 6280 (class 0 OID 23370)
-- Dependencies: 295
-- Data for Name: catalogo_valores; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.catalogo_valores (id, tipo, valor, etiqueta) FROM stdin;
\.


--
-- TOC entry 6272 (class 0 OID 23330)
-- Dependencies: 287
-- Data for Name: categorias; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.categorias (id, nombre, descripcion, vida_util_dias) FROM stdin;
25	SIBARITA	Familia comercial del catálogo Excel	\N
30	ESPECERIAS-AJINOMOTO	Familia comercial del catálogo Excel	\N
31	BONIFICACIONES	\N	\N
\.


--
-- TOC entry 6290 (class 0 OID 23481)
-- Dependencies: 305
-- Data for Name: importaciones_ventas; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.importaciones_ventas (id, usuario_id, nombre_archivo, filas_procesadas, filas_con_error, estado, fecha) FROM stdin;
\.


--
-- TOC entry 6284 (class 0 OID 23415)
-- Dependencies: 299
-- Data for Name: lotes; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.lotes (id, producto_id, numero_lote, cantidad_inicial, cantidad_actual, fecha_ingreso, fecha_vencimiento, fecha_creacion) FROM stdin;
2	1	GENERAL	0.00	31.00	2026-09-18 00:00:00-05	2100-01-01 00:00:00-05	2026-09-18 06:22:37.632-05
3	2	GENERAL	0.00	1.00	2026-09-18 00:00:00-05	2100-01-01 00:00:00-05	2026-09-18 08:28:46.393-05
1	3	INICIAL	12.00	27.00	2026-09-17 00:00:00-05	2026-09-30 00:00:00-05	2026-09-17 21:53:05.565-05
4	12	GENERAL	0.00	14.00	2026-09-23 16:42:46.668-05	2099-12-31 19:00:00-05	2026-09-23 16:42:46.668-05
\.


--
-- TOC entry 6286 (class 0 OID 23433)
-- Dependencies: 301
-- Data for Name: movimientos_inventario; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.movimientos_inventario (id, lote_id, tipo, origen, cantidad, precio_unitario, precio_total, saldo_cantidad, saldo_precio_unitario, saldo_valorizado, motivo, usuario_id, fecha) FROM stdin;
1	1	ingreso	inicial	12.00	15.00	180.00	12.00	15.00	180.00	Stock inicial al registrar el producto	9	2026-09-17 21:53:06.137-05
2	2	ingreso	compra	12.00	13.00	156.00	12.00	13.00	156.00	Proveedor Pamolsa	9	2026-09-18 06:22:38.648-05
3	2	ingreso	compra	20.00	12.00	240.00	32.00	12.38	396.00	Pamolsa	9	2026-09-18 06:40:19.607-05
4	2	ingreso	compra	1.00	15.00	15.00	33.00	12.45	411.00	Pamolsa	9	2026-09-18 06:43:55.451-05
5	2	salida	venta	2.00	12.45	24.90	31.00	12.45	386.10	Tienda Economica	8	2026-09-18 08:26:39.931-05
6	3	ingreso	compra	1.00	25.00	25.00	1.00	25.00	25.00	Sibarita	8	2026-09-18 08:28:47.159-05
7	1	ingreso	compra	10.00	100.00	1000.00	22.00	53.64	1180.00	Test ingreso	1	2026-09-23 16:51:29.819-05
8	1	ingreso	compra	5.00	100.00	500.00	27.00	62.22	1680.00	Test	1	2026-09-23 16:56:49.541-05
9	4	ingreso	compra	50.00	24.00	1200.00	50.00	24.00	1200.00	Compra	7	2026-09-23 20:27:16.012-05
10	4	salida	venta	12.00	24.00	288.00	38.00	24.00	912.00		7	2026-09-23 20:27:27.241-05
11	4	ajuste	ajuste	24.00	24.00	576.00	14.00	24.00	336.00		7	2026-09-23 20:27:38.635-05
\.


--
-- TOC entry 6298 (class 0 OID 23561)
-- Dependencies: 313
-- Data for Name: notificaciones_correo; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.notificaciones_correo (id, alerta_id, destinatario, estado, proveedor, fecha_envio) FROM stdin;
\.


--
-- TOC entry 6294 (class 0 OID 23517)
-- Dependencies: 309
-- Data for Name: ordenes_reabastecimiento; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.ordenes_reabastecimiento (id, producto_id, cantidad_sugerida, cantidad_aprobada, estado, generado_por, usuario_id, fecha_creacion, fecha_actualizacion) FROM stdin;
\.


--
-- TOC entry 6267 (class 0 OID 23289)
-- Dependencies: 282
-- Data for Name: permisos; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.permisos (id, codigo, descripcion) FROM stdin;
1	gestionar_productos	gestionar_productos
2	gestionar_inventario	gestionar_inventario
3	gestionar_ventas	gestionar_ventas
4	configurar_umbrales	configurar_umbrales
5	gestionar_reabastecimiento	gestionar_reabastecimiento
6	ver_alertas	ver_alertas
7	generar_reportes	generar_reportes
8	ver_kpis	ver_kpis
9	gestionar_usuarios	gestionar_usuarios
10	gestionar_roles	gestionar_roles
11	ver_auditoria	ver_auditoria
\.


--
-- TOC entry 6310 (class 0 OID 39790)
-- Dependencies: 326
-- Data for Name: precio; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.precio (id, producto_id, preciolista, preciodescuento, vigente_desde, creado_en) FROM stdin;
\.


--
-- TOC entry 6302 (class 0 OID 23589)
-- Dependencies: 317
-- Data for Name: preferencias_usuario; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.preferencias_usuario (id, usuario_id, clave, valor, fecha_actualizacion) FROM stdin;
\.


--
-- TOC entry 6276 (class 0 OID 23350)
-- Dependencies: 291
-- Data for Name: presentaciones; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.presentaciones (id, nombre, descripcion) FROM stdin;
1	0.25	\N
2	1	\N
3	12	\N
4	24	\N
5	25	\N
6	50	\N
7	75	\N
8	100	\N
9	15	
10	20	
\.


--
-- TOC entry 6308 (class 0 OID 39763)
-- Dependencies: 323
-- Data for Name: producto_presentacion; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.producto_presentacion (id, producto_id, nivel, envase_id, cantidad) FROM stdin;
\.


--
-- TOC entry 6282 (class 0 OID 23379)
-- Dependencies: 297
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.productos (id, codigo, nombre, descripcion, imagen, precio_venta, caracteristicas, activo, motivo_desactivacion, motivo_desactivacion_detalle, fecha_desactivacion, fecha_creacion, fecha_actualizacion, categoria_id, unidad_medida_id, presentacion_id, marca_id, es_bonificacion, contenido_valor, categoria_paquete_id, contenido_paquete_cantidad, contenido_paquete_envase_id) FROM stdin;
1	P-001	plato n° 16	\N	productos/plato.png	\N	{}	t	\N	\N	\N	2026-09-17 06:33:53.45-05	2026-09-17 07:04:25.978-05	\N	5	9	\N	f	\N	\N	\N	\N
3	P-002	plato n° 16	\N		13.00	{}	f	otro	Duplicado	2026-09-18 09:04:22.199-05	2026-09-17 21:53:05.262-05	2026-09-17 21:53:05.262-05	\N	5	5	\N	f	\N	\N	\N	\N
11	P-004	Aji-no-men carne	\N	\N	37.00	{}	t	\N	\N	\N	2026-09-23 14:36:29.821-05	2026-09-23 14:36:29.821-05	30	5	3	3	f	\N	\N	\N	\N
2	P-003	Caja comino	\N	productos/comino.jpg	12.00	{}	t	\N	\N	\N	2026-09-18 06:58:16.041-05	2026-09-18 06:58:16.041-05	25	2	9	\N	f	\N	\N	\N	\N
12	P-005	AJI-NO-MEN POLLO	\N	\N	23.00	{}	t	\N	\N	\N	2026-09-23 16:37:03.054-05	2026-09-23 16:37:03.054-05	30	2	\N	3	f	23.00	11	24.00	1
\.


--
-- TOC entry 6300 (class 0 OID 23575)
-- Dependencies: 315
-- Data for Name: reportes_generados; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.reportes_generados (id, usuario_id, tipo, formato, parametros, ruta_archivo, fecha_generacion) FROM stdin;
\.


--
-- TOC entry 6268 (class 0 OID 23299)
-- Dependencies: 283
-- Data for Name: rol_permisos; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.rol_permisos (rol_id, permiso_id) FROM stdin;
1	1
1	2
1	3
1	4
1	5
1	6
1	7
1	8
1	9
1	10
1	11
2	1
2	2
2	3
2	4
2	5
2	6
3	2
3	6
4	6
4	7
4	8
\.


--
-- TOC entry 6263 (class 0 OID 23260)
-- Dependencies: 278
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.roles (id, nombre, descripcion, fecha_creacion) FROM stdin;
1	Administrador	\N	2026-09-20 10:01:34.668-05
2	Encargado de Inventario	\N	2026-09-20 10:01:34.692-05
3	Encargado de Almacén	\N	2026-09-20 10:01:34.698-05
4	Jefe de Ventas	\N	2026-09-20 10:01:34.701-05
5	Demo	\N	2026-09-20 11:01:34.668-05
\.


--
-- TOC entry 6306 (class 0 OID 39752)
-- Dependencies: 321
-- Data for Name: tipo_envase; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.tipo_envase (id, nombre, activo, creado_en) FROM stdin;
1	SOBRE	t	2026-09-21 16:27:47.732776-05
2	BOLSA	t	2026-09-21 16:27:47.732776-05
3	TIRA	t	2026-09-21 16:27:47.732776-05
4	CAJA	t	2026-09-21 16:27:47.732776-05
5	BOTELLA	t	2026-09-21 16:27:47.732776-05
6	SACO	t	2026-09-21 16:27:47.732776-05
7	DISPLAY	t	2026-09-21 16:27:47.732776-05
8	PAQUETE	t	2026-09-21 16:27:47.732776-05
9	BALDE	t	2026-09-21 16:27:47.732776-05
10	BIDON	t	2026-09-21 16:27:47.732776-05
11	PLANCHA	t	2026-09-21 16:27:47.732776-05
12	UND	t	2026-09-21 16:27:47.732776-05
\.


--
-- TOC entry 6270 (class 0 OID 23315)
-- Dependencies: 285
-- Data for Name: tokens_recuperacion; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.tokens_recuperacion (id, usuario_id, token, expira_en, usado, fecha_creacion, code_hash, intentos) FROM stdin;
2	7	\N	2026-09-20 18:34:11.642-05	t	2026-09-20 18:24:11.643-05	4b4d8dab118a02c3e292fb15e5d24f8353ca40b755a5289576048d4d020fe940	0
3	7	\N	2026-09-20 18:35:23.853-05	t	2026-09-20 18:25:23.853-05	f4c0556474a036444457f5015a6f677b4613d0adc76755a9611bcafb3bc04735	0
4	7	\N	2026-09-20 18:35:45.442-05	t	2026-09-20 18:25:45.442-05	452579fadc9b83749cbe725e2c3475f496b64efd5c0b6ddcd5b71e3864be0df2	0
5	7	\N	2026-09-20 18:38:20.319-05	t	2026-09-20 18:28:20.319-05	fb5841808a696baf236f95e60ce1c0adb725aa46e6dfeb06c3820ab10e86061d	0
7	7	\N	2026-09-20 18:38:34.108-05	t	2026-09-20 18:28:34.108-05	74214548fe6928f60f7514c6e66400532b6b11df28de0a7ad8d3c6a25c9adcc7	0
6	1	\N	2026-09-20 18:38:25.179-05	t	2026-09-20 18:28:25.179-05	b28b210a938717f6d23ef818f4f318992c09aca7e829bc322daba4b5c3bb328b	0
8	7	\N	2026-09-20 19:16:20.695-05	t	2026-09-20 19:06:20.695-05	f2a77d92b7c78bcdc1869d0201989e3b632aeed574d3e866751d81fc472af704	1
9	1	\N	2026-09-20 19:16:30.723-05	t	2026-09-20 19:06:30.723-05	b3b5fc8e06c37c12b04e3495adda5e154aac65900640d52bff3b97d25d0b203c	0
10	1	\N	2026-09-20 19:18:17.401-05	f	2026-09-20 19:08:17.401-05	3cad7dbd27e82014c037493135036a8735306d0ba47c44c21bcba61cf1b1df8a	0
11	9	\N	2026-09-22 06:50:26.926-05	f	2026-09-22 06:40:26.926-05	7fe2bcd711f74e89cabd72972ee340f78858170fb8ba0b621275553ce3f15a4f	0
12	7	\N	2026-09-22 06:51:22.998-05	t	2026-09-22 06:41:22.998-05	b35664305810fb21a1b7416820fcfc87b05ffe107380d8287c35a102c2435b41	1
13	7	\N	2026-09-28 07:26:30.761-05	t	2026-09-28 07:16:30.761-05	ad70f8a8b68b684e4eaed91514560a90e62c4ffdfbe5db65feca27844343189d	1
\.


--
-- TOC entry 6292 (class 0 OID 23496)
-- Dependencies: 307
-- Data for Name: umbrales_configuracion; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.umbrales_configuracion (id, tipo, producto_id, valor, usuario_id, fecha_actualizacion) FROM stdin;
\.


--
-- TOC entry 6274 (class 0 OID 23341)
-- Dependencies: 289
-- Data for Name: unidades_medida; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.unidades_medida (id, nombre, abreviatura) FROM stdin;
1	Kilogramo	kg
2	Gramo	gr
3	Litro	lt
4	Mililitro	ml
5	Unidad	u
\.


--
-- TOC entry 6265 (class 0 OID 23271)
-- Dependencies: 280
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.usuarios (id, email, rol_id, activo, fecha_creacion, ultimo_acceso, is_staff, password_hash, nombres, apellidos, dni) FROM stdin;
3	jararojasjose@gmail.com	2	t	2026-09-20 18:04:12.709-05	2026-09-25 05:33:22.781-05	f	$2b$10$ZmLhv.ao37bLq/B010lCROA6tNqCM7lwag.5Oqc5tX79D5oY70Nau	Jose Enrique Jara Rojas		\N
4	luffy200010m@gmail.com	2	t	2026-09-20 18:04:30.314-05	2026-09-20 18:23:13.336-05	f	$2b$10$ZmLhv.ao37bLq/B010lCROA6tNqCM7lwag.5Oqc5tX79D5oY70Nau	Luffy Monky		\N
7	jaraj3449@gmail.com	1	t	2026-09-20 18:18:32.576-05	2026-09-28 07:21:30.847-05	f	$2b$10$ZmLhv.ao37bLq/B010lCROA6tNqCM7lwag.5Oqc5tX79D5oY70Nau	Enrique		\N
1	jose@gmail.com	2	t	2026-09-20 17:18:01.997-05	2026-09-20 19:51:37.138-05	f	$2b$10$ZmLhv.ao37bLq/B010lCROA6tNqCM7lwag.5Oqc5tX79D5oY70Nau	Jose		\N
8	pedroinventario@cliente.com	2	t	2026-09-18 08:23:31.435-05	2026-09-18 08:25:17.383-05	f	$2b$10$ZmLhv.ao37bLq/B010lCROA6tNqCM7lwag.5Oqc5tX79D5oY70Nau	Pedro Inventario		\N
10	jararojasjose604@gmail.com	1	t	2026-09-26 14:00:00.741-05	2026-09-26 14:28:25.423-05	f	$2b$10$ZmLhv.ao37bLq/B010lCROA6tNqCM7lwag.5Oqc5tX79D5oY70Nau	Jose Admin		\N
9	pedro@gmail.com	1	t	2026-09-16 08:05:00.831-05	2026-09-28 07:58:31.673-05	f	$2b$10$ZmLhv.ao37bLq/B010lCROA6tNqCM7lwag.5Oqc5tX79D5oY70Nau	Pedro		\N
\.


--
-- TOC entry 6288 (class 0 OID 23456)
-- Dependencies: 303
-- Data for Name: ventas; Type: TABLE DATA; Schema: public; Owner: business_api_role
--

COPY public.ventas (id, producto_id, lote_id, cantidad, precio_unitario, fecha_venta, origen, usuario_id, fecha_creacion) FROM stdin;
\.


--
-- TOC entry 6459 (class 0 OID 0)
-- Dependencies: 275
-- Name: anomalias_id_seq; Type: SEQUENCE SET; Schema: ml; Owner: postgres
--

SELECT pg_catalog.setval('ml.anomalias_id_seq', 1, false);


--
-- TOC entry 6460 (class 0 OID 0)
-- Dependencies: 263
-- Name: conjuntos_datos_id_seq; Type: SEQUENCE SET; Schema: ml; Owner: postgres
--

SELECT pg_catalog.setval('ml.conjuntos_datos_id_seq', 1, false);


--
-- TOC entry 6461 (class 0 OID 0)
-- Dependencies: 267
-- Name: entrenamientos_id_seq; Type: SEQUENCE SET; Schema: ml; Owner: postgres
--

SELECT pg_catalog.setval('ml.entrenamientos_id_seq', 1, false);


--
-- TOC entry 6462 (class 0 OID 0)
-- Dependencies: 265
-- Name: modelos_id_seq; Type: SEQUENCE SET; Schema: ml; Owner: postgres
--

SELECT pg_catalog.setval('ml.modelos_id_seq', 1, false);


--
-- TOC entry 6463 (class 0 OID 0)
-- Dependencies: 269
-- Name: predicciones_demanda_id_seq; Type: SEQUENCE SET; Schema: ml; Owner: postgres
--

SELECT pg_catalog.setval('ml.predicciones_demanda_id_seq', 1, false);


--
-- TOC entry 6464 (class 0 OID 0)
-- Dependencies: 273
-- Name: recomendaciones_id_seq; Type: SEQUENCE SET; Schema: ml; Owner: postgres
--

SELECT pg_catalog.setval('ml.recomendaciones_id_seq', 1, false);


--
-- TOC entry 6465 (class 0 OID 0)
-- Dependencies: 271
-- Name: riesgos_vencimiento_id_seq; Type: SEQUENCE SET; Schema: ml; Owner: postgres
--

SELECT pg_catalog.setval('ml.riesgos_vencimiento_id_seq', 1, false);


--
-- TOC entry 6466 (class 0 OID 0)
-- Dependencies: 253
-- Name: alertas_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.alertas_id_seq', 1, false);


--
-- TOC entry 6467 (class 0 OID 0)
-- Dependencies: 261
-- Name: auditoria_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.auditoria_id_seq', 1, false);


--
-- TOC entry 6468 (class 0 OID 0)
-- Dependencies: 234
-- Name: catalogo_marcas_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.catalogo_marcas_id_seq', 1, false);


--
-- TOC entry 6469 (class 0 OID 0)
-- Dependencies: 237
-- Name: catalogo_valores_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.catalogo_valores_id_seq', 1, false);


--
-- TOC entry 6470 (class 0 OID 0)
-- Dependencies: 228
-- Name: categorias_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.categorias_id_seq', 1, false);


--
-- TOC entry 6471 (class 0 OID 0)
-- Dependencies: 247
-- Name: importaciones_ventas_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.importaciones_ventas_id_seq', 1, false);


--
-- TOC entry 6472 (class 0 OID 0)
-- Dependencies: 241
-- Name: lotes_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.lotes_id_seq', 1, false);


--
-- TOC entry 6473 (class 0 OID 0)
-- Dependencies: 243
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.movimientos_inventario_id_seq', 1, false);


--
-- TOC entry 6474 (class 0 OID 0)
-- Dependencies: 255
-- Name: notificaciones_correo_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.notificaciones_correo_id_seq', 1, false);


--
-- TOC entry 6475 (class 0 OID 0)
-- Dependencies: 251
-- Name: ordenes_reabastecimiento_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.ordenes_reabastecimiento_id_seq', 1, false);


--
-- TOC entry 6476 (class 0 OID 0)
-- Dependencies: 221
-- Name: permisos_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.permisos_id_seq', 1, false);


--
-- TOC entry 6477 (class 0 OID 0)
-- Dependencies: 259
-- Name: preferencias_usuario_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.preferencias_usuario_id_seq', 1, false);


--
-- TOC entry 6478 (class 0 OID 0)
-- Dependencies: 232
-- Name: presentaciones_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.presentaciones_id_seq', 1, false);


--
-- TOC entry 6479 (class 0 OID 0)
-- Dependencies: 239
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.productos_id_seq', 1, false);


--
-- TOC entry 6480 (class 0 OID 0)
-- Dependencies: 257
-- Name: reportes_generados_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.reportes_generados_id_seq', 1, false);


--
-- TOC entry 6481 (class 0 OID 0)
-- Dependencies: 219
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.roles_id_seq', 1, false);


--
-- TOC entry 6482 (class 0 OID 0)
-- Dependencies: 226
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.tokens_recuperacion_id_seq', 1, false);


--
-- TOC entry 6483 (class 0 OID 0)
-- Dependencies: 249
-- Name: umbrales_configuracion_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.umbrales_configuracion_id_seq', 1, false);


--
-- TOC entry 6484 (class 0 OID 0)
-- Dependencies: 230
-- Name: unidades_medida_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.unidades_medida_id_seq', 1, false);


--
-- TOC entry 6485 (class 0 OID 0)
-- Dependencies: 224
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.usuarios_id_seq', 1, false);


--
-- TOC entry 6486 (class 0 OID 0)
-- Dependencies: 245
-- Name: ventas_id_seq; Type: SEQUENCE SET; Schema: negocio; Owner: postgres
--

SELECT pg_catalog.setval('negocio.ventas_id_seq', 1, false);


--
-- TOC entry 6487 (class 0 OID 0)
-- Dependencies: 310
-- Name: alertas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.alertas_id_seq', 1, false);


--
-- TOC entry 6488 (class 0 OID 0)
-- Dependencies: 318
-- Name: auditoria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.auditoria_id_seq', 27, true);


--
-- TOC entry 6489 (class 0 OID 0)
-- Dependencies: 292
-- Name: catalogo_marcas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.catalogo_marcas_id_seq', 137, true);


--
-- TOC entry 6490 (class 0 OID 0)
-- Dependencies: 294
-- Name: catalogo_valores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.catalogo_valores_id_seq', 1, true);


--
-- TOC entry 6491 (class 0 OID 0)
-- Dependencies: 286
-- Name: categorias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.categorias_id_seq', 31, true);


--
-- TOC entry 6492 (class 0 OID 0)
-- Dependencies: 304
-- Name: importaciones_ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.importaciones_ventas_id_seq', 1, false);


--
-- TOC entry 6493 (class 0 OID 0)
-- Dependencies: 298
-- Name: lotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.lotes_id_seq', 4, true);


--
-- TOC entry 6494 (class 0 OID 0)
-- Dependencies: 300
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.movimientos_inventario_id_seq', 11, true);


--
-- TOC entry 6495 (class 0 OID 0)
-- Dependencies: 312
-- Name: notificaciones_correo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.notificaciones_correo_id_seq', 1, false);


--
-- TOC entry 6496 (class 0 OID 0)
-- Dependencies: 308
-- Name: ordenes_reabastecimiento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.ordenes_reabastecimiento_id_seq', 1, false);


--
-- TOC entry 6497 (class 0 OID 0)
-- Dependencies: 281
-- Name: permisos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.permisos_id_seq', 11, true);


--
-- TOC entry 6498 (class 0 OID 0)
-- Dependencies: 325
-- Name: precio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.precio_id_seq', 1, true);


--
-- TOC entry 6499 (class 0 OID 0)
-- Dependencies: 316
-- Name: preferencias_usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.preferencias_usuario_id_seq', 1, false);


--
-- TOC entry 6500 (class 0 OID 0)
-- Dependencies: 290
-- Name: presentaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.presentaciones_id_seq', 10, true);


--
-- TOC entry 6501 (class 0 OID 0)
-- Dependencies: 322
-- Name: producto_presentacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.producto_presentacion_id_seq', 2, true);


--
-- TOC entry 6502 (class 0 OID 0)
-- Dependencies: 296
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.productos_id_seq', 12, true);


--
-- TOC entry 6503 (class 0 OID 0)
-- Dependencies: 314
-- Name: reportes_generados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.reportes_generados_id_seq', 1, false);


--
-- TOC entry 6504 (class 0 OID 0)
-- Dependencies: 277
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- TOC entry 6505 (class 0 OID 0)
-- Dependencies: 320
-- Name: tipo_envase_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.tipo_envase_id_seq', 12, true);


--
-- TOC entry 6506 (class 0 OID 0)
-- Dependencies: 284
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.tokens_recuperacion_id_seq', 13, true);


--
-- TOC entry 6507 (class 0 OID 0)
-- Dependencies: 306
-- Name: umbrales_configuracion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.umbrales_configuracion_id_seq', 1, false);


--
-- TOC entry 6508 (class 0 OID 0)
-- Dependencies: 288
-- Name: unidades_medida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.unidades_medida_id_seq', 5, true);


--
-- TOC entry 6509 (class 0 OID 0)
-- Dependencies: 279
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 10, true);


--
-- TOC entry 6510 (class 0 OID 0)
-- Dependencies: 302
-- Name: ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: business_api_role
--

SELECT pg_catalog.setval('public.ventas_id_seq', 1, false);


--
-- TOC entry 5291 (class 2606 OID 23252)
-- Name: anomalias anomalias_pkey; Type: CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.anomalias
    ADD CONSTRAINT anomalias_pkey PRIMARY KEY (id);


--
-- TOC entry 5277 (class 2606 OID 23167)
-- Name: conjuntos_datos conjuntos_datos_pkey; Type: CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.conjuntos_datos
    ADD CONSTRAINT conjuntos_datos_pkey PRIMARY KEY (id);


--
-- TOC entry 5281 (class 2606 OID 23191)
-- Name: entrenamientos entrenamientos_pkey; Type: CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.entrenamientos
    ADD CONSTRAINT entrenamientos_pkey PRIMARY KEY (id);


--
-- TOC entry 5279 (class 2606 OID 23179)
-- Name: modelos modelos_pkey; Type: CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.modelos
    ADD CONSTRAINT modelos_pkey PRIMARY KEY (id);


--
-- TOC entry 5284 (class 2606 OID 23205)
-- Name: predicciones_demanda predicciones_demanda_pkey; Type: CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.predicciones_demanda
    ADD CONSTRAINT predicciones_demanda_pkey PRIMARY KEY (id);


--
-- TOC entry 5289 (class 2606 OID 23237)
-- Name: recomendaciones recomendaciones_pkey; Type: CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.recomendaciones
    ADD CONSTRAINT recomendaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5287 (class 2606 OID 23223)
-- Name: riesgos_vencimiento riesgos_vencimiento_pkey; Type: CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.riesgos_vencimiento
    ADD CONSTRAINT riesgos_vencimiento_pkey PRIMARY KEY (id);


--
-- TOC entry 5259 (class 2606 OID 23079)
-- Name: alertas alertas_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.alertas
    ADD CONSTRAINT alertas_pkey PRIMARY KEY (id);


--
-- TOC entry 5272 (class 2606 OID 23150)
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- TOC entry 5222 (class 2606 OID 22871)
-- Name: catalogo_marcas_familias catalogo_marcas_familias_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_marcas_familias
    ADD CONSTRAINT catalogo_marcas_familias_pkey PRIMARY KEY (marca_id, categoria_id);


--
-- TOC entry 5218 (class 2606 OID 22866)
-- Name: catalogo_marcas catalogo_marcas_nombre_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key UNIQUE (nombre);


--
-- TOC entry 5220 (class 2606 OID 22864)
-- Name: catalogo_marcas catalogo_marcas_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_pkey PRIMARY KEY (id);


--
-- TOC entry 5224 (class 2606 OID 22888)
-- Name: catalogo_valores catalogo_valores_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_valores
    ADD CONSTRAINT catalogo_valores_pkey PRIMARY KEY (id);


--
-- TOC entry 5226 (class 2606 OID 22890)
-- Name: catalogo_valores catalogo_valores_tipo_valor_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_valores
    ADD CONSTRAINT catalogo_valores_tipo_valor_key UNIQUE (tipo, valor);


--
-- TOC entry 5206 (class 2606 OID 22837)
-- Name: categorias categorias_nombre_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.categorias
    ADD CONSTRAINT categorias_nombre_key UNIQUE (nombre);


--
-- TOC entry 5208 (class 2606 OID 22835)
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- TOC entry 5250 (class 2606 OID 23014)
-- Name: importaciones_ventas importaciones_ventas_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.importaciones_ventas
    ADD CONSTRAINT importaciones_ventas_pkey PRIMARY KEY (id);


--
-- TOC entry 5237 (class 2606 OID 22939)
-- Name: lotes lotes_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.lotes
    ADD CONSTRAINT lotes_pkey PRIMARY KEY (id);


--
-- TOC entry 5239 (class 2606 OID 22941)
-- Name: lotes lotes_producto_id_numero_lote_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.lotes
    ADD CONSTRAINT lotes_producto_id_numero_lote_key UNIQUE (producto_id, numero_lote);


--
-- TOC entry 5244 (class 2606 OID 22962)
-- Name: movimientos_inventario movimientos_inventario_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id);


--
-- TOC entry 5264 (class 2606 OID 23102)
-- Name: notificaciones_correo notificaciones_correo_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.notificaciones_correo
    ADD CONSTRAINT notificaciones_correo_pkey PRIMARY KEY (id);


--
-- TOC entry 5257 (class 2606 OID 23053)
-- Name: ordenes_reabastecimiento ordenes_reabastecimiento_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ordenes_reabastecimiento
    ADD CONSTRAINT ordenes_reabastecimiento_pkey PRIMARY KEY (id);


--
-- TOC entry 5188 (class 2606 OID 22772)
-- Name: permisos permisos_codigo_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.permisos
    ADD CONSTRAINT permisos_codigo_key UNIQUE (codigo);


--
-- TOC entry 5190 (class 2606 OID 22770)
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (id);


--
-- TOC entry 5268 (class 2606 OID 23133)
-- Name: preferencias_usuario preferencias_usuario_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 5270 (class 2606 OID 23135)
-- Name: preferencias_usuario preferencias_usuario_usuario_id_clave_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_usuario_id_clave_key UNIQUE (usuario_id, clave);


--
-- TOC entry 5214 (class 2606 OID 22857)
-- Name: presentaciones presentaciones_nombre_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key UNIQUE (nombre);


--
-- TOC entry 5216 (class 2606 OID 22855)
-- Name: presentaciones presentaciones_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.presentaciones
    ADD CONSTRAINT presentaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5231 (class 2606 OID 22905)
-- Name: productos productos_codigo_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.productos
    ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);


--
-- TOC entry 5233 (class 2606 OID 22903)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- TOC entry 5266 (class 2606 OID 23118)
-- Name: reportes_generados reportes_generados_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.reportes_generados
    ADD CONSTRAINT reportes_generados_pkey PRIMARY KEY (id);


--
-- TOC entry 5192 (class 2606 OID 22777)
-- Name: rol_permisos rol_permisos_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.rol_permisos
    ADD CONSTRAINT rol_permisos_pkey PRIMARY KEY (rol_id, permiso_id);


--
-- TOC entry 5184 (class 2606 OID 22761)
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- TOC entry 5186 (class 2606 OID 22759)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 5202 (class 2606 OID 22817)
-- Name: tokens_recuperacion tokens_recuperacion_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_pkey PRIMARY KEY (id);


--
-- TOC entry 5204 (class 2606 OID 22819)
-- Name: tokens_recuperacion tokens_recuperacion_token_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key UNIQUE (token);


--
-- TOC entry 5252 (class 2606 OID 23028)
-- Name: umbrales_configuracion umbrales_configuracion_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_pkey PRIMARY KEY (id);


--
-- TOC entry 5254 (class 2606 OID 23030)
-- Name: umbrales_configuracion umbrales_configuracion_tipo_producto_id_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_tipo_producto_id_key UNIQUE (tipo, producto_id);


--
-- TOC entry 5210 (class 2606 OID 22846)
-- Name: unidades_medida unidades_medida_nombre_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key UNIQUE (nombre);


--
-- TOC entry 5212 (class 2606 OID 22844)
-- Name: unidades_medida unidades_medida_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.unidades_medida
    ADD CONSTRAINT unidades_medida_pkey PRIMARY KEY (id);


--
-- TOC entry 5197 (class 2606 OID 22801)
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- TOC entry 5199 (class 2606 OID 22799)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5248 (class 2606 OID 22985)
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- TOC entry 5961 (class 2606 OID 23546)
-- Name: alertas alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_pkey PRIMARY KEY (id);


--
-- TOC entry 5975 (class 2606 OID 23612)
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- TOC entry 5786 (class 2606 OID 41281)
-- Name: catalogo_marcas catalogo_marcas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key UNIQUE (nombre);


--
-- TOC entry 5788 (class 2606 OID 41283)
-- Name: catalogo_marcas catalogo_marcas_nombre_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key1 UNIQUE (nombre);


--
-- TOC entry 5790 (class 2606 OID 41271)
-- Name: catalogo_marcas catalogo_marcas_nombre_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key10 UNIQUE (nombre);


--
-- TOC entry 5792 (class 2606 OID 41293)
-- Name: catalogo_marcas catalogo_marcas_nombre_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key11 UNIQUE (nombre);


--
-- TOC entry 5794 (class 2606 OID 41269)
-- Name: catalogo_marcas catalogo_marcas_nombre_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key12 UNIQUE (nombre);


--
-- TOC entry 5796 (class 2606 OID 41295)
-- Name: catalogo_marcas catalogo_marcas_nombre_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key13 UNIQUE (nombre);


--
-- TOC entry 5798 (class 2606 OID 41267)
-- Name: catalogo_marcas catalogo_marcas_nombre_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key14 UNIQUE (nombre);


--
-- TOC entry 5800 (class 2606 OID 41297)
-- Name: catalogo_marcas catalogo_marcas_nombre_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key15 UNIQUE (nombre);


--
-- TOC entry 5802 (class 2606 OID 41265)
-- Name: catalogo_marcas catalogo_marcas_nombre_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key16 UNIQUE (nombre);


--
-- TOC entry 5804 (class 2606 OID 41299)
-- Name: catalogo_marcas catalogo_marcas_nombre_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key17 UNIQUE (nombre);


--
-- TOC entry 5806 (class 2606 OID 41263)
-- Name: catalogo_marcas catalogo_marcas_nombre_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key18 UNIQUE (nombre);


--
-- TOC entry 5808 (class 2606 OID 41235)
-- Name: catalogo_marcas catalogo_marcas_nombre_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key19 UNIQUE (nombre);


--
-- TOC entry 5810 (class 2606 OID 41285)
-- Name: catalogo_marcas catalogo_marcas_nombre_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key2 UNIQUE (nombre);


--
-- TOC entry 5812 (class 2606 OID 41261)
-- Name: catalogo_marcas catalogo_marcas_nombre_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key20 UNIQUE (nombre);


--
-- TOC entry 5814 (class 2606 OID 41237)
-- Name: catalogo_marcas catalogo_marcas_nombre_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key21 UNIQUE (nombre);


--
-- TOC entry 5816 (class 2606 OID 41259)
-- Name: catalogo_marcas catalogo_marcas_nombre_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key22 UNIQUE (nombre);


--
-- TOC entry 5818 (class 2606 OID 41239)
-- Name: catalogo_marcas catalogo_marcas_nombre_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key23 UNIQUE (nombre);


--
-- TOC entry 5820 (class 2606 OID 41257)
-- Name: catalogo_marcas catalogo_marcas_nombre_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key24 UNIQUE (nombre);


--
-- TOC entry 5822 (class 2606 OID 41241)
-- Name: catalogo_marcas catalogo_marcas_nombre_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key25 UNIQUE (nombre);


--
-- TOC entry 5824 (class 2606 OID 41255)
-- Name: catalogo_marcas catalogo_marcas_nombre_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key26 UNIQUE (nombre);


--
-- TOC entry 5826 (class 2606 OID 41243)
-- Name: catalogo_marcas catalogo_marcas_nombre_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key27 UNIQUE (nombre);


--
-- TOC entry 5828 (class 2606 OID 41253)
-- Name: catalogo_marcas catalogo_marcas_nombre_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key28 UNIQUE (nombre);


--
-- TOC entry 5830 (class 2606 OID 41245)
-- Name: catalogo_marcas catalogo_marcas_nombre_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key29 UNIQUE (nombre);


--
-- TOC entry 5832 (class 2606 OID 41279)
-- Name: catalogo_marcas catalogo_marcas_nombre_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key3 UNIQUE (nombre);


--
-- TOC entry 5834 (class 2606 OID 41251)
-- Name: catalogo_marcas catalogo_marcas_nombre_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key30 UNIQUE (nombre);


--
-- TOC entry 5836 (class 2606 OID 41247)
-- Name: catalogo_marcas catalogo_marcas_nombre_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key31 UNIQUE (nombre);


--
-- TOC entry 5838 (class 2606 OID 41249)
-- Name: catalogo_marcas catalogo_marcas_nombre_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key32 UNIQUE (nombre);


--
-- TOC entry 5840 (class 2606 OID 41233)
-- Name: catalogo_marcas catalogo_marcas_nombre_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key33 UNIQUE (nombre);


--
-- TOC entry 5842 (class 2606 OID 41287)
-- Name: catalogo_marcas catalogo_marcas_nombre_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key4 UNIQUE (nombre);


--
-- TOC entry 5844 (class 2606 OID 41277)
-- Name: catalogo_marcas catalogo_marcas_nombre_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key5 UNIQUE (nombre);


--
-- TOC entry 5846 (class 2606 OID 41275)
-- Name: catalogo_marcas catalogo_marcas_nombre_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key6 UNIQUE (nombre);


--
-- TOC entry 5848 (class 2606 OID 41289)
-- Name: catalogo_marcas catalogo_marcas_nombre_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key7 UNIQUE (nombre);


--
-- TOC entry 5850 (class 2606 OID 41273)
-- Name: catalogo_marcas catalogo_marcas_nombre_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key8 UNIQUE (nombre);


--
-- TOC entry 5852 (class 2606 OID 41291)
-- Name: catalogo_marcas catalogo_marcas_nombre_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_nombre_key9 UNIQUE (nombre);


--
-- TOC entry 5854 (class 2606 OID 23366)
-- Name: catalogo_marcas catalogo_marcas_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_marcas
    ADD CONSTRAINT catalogo_marcas_pkey PRIMARY KEY (id);


--
-- TOC entry 5856 (class 2606 OID 23375)
-- Name: catalogo_valores catalogo_valores_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_valores
    ADD CONSTRAINT catalogo_valores_pkey PRIMARY KEY (id);


--
-- TOC entry 5858 (class 2606 OID 41303)
-- Name: catalogo_valores catalogo_valores_tipo_valor_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.catalogo_valores
    ADD CONSTRAINT catalogo_valores_tipo_valor_key UNIQUE (tipo, valor);


--
-- TOC entry 5576 (class 2606 OID 41057)
-- Name: categorias categorias_nombre_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key UNIQUE (nombre);


--
-- TOC entry 5578 (class 2606 OID 41059)
-- Name: categorias categorias_nombre_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key1 UNIQUE (nombre);


--
-- TOC entry 5580 (class 2606 OID 41047)
-- Name: categorias categorias_nombre_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key10 UNIQUE (nombre);


--
-- TOC entry 5582 (class 2606 OID 41069)
-- Name: categorias categorias_nombre_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key11 UNIQUE (nombre);


--
-- TOC entry 5584 (class 2606 OID 41045)
-- Name: categorias categorias_nombre_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key12 UNIQUE (nombre);


--
-- TOC entry 5586 (class 2606 OID 41071)
-- Name: categorias categorias_nombre_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key13 UNIQUE (nombre);


--
-- TOC entry 5588 (class 2606 OID 41043)
-- Name: categorias categorias_nombre_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key14 UNIQUE (nombre);


--
-- TOC entry 5590 (class 2606 OID 41073)
-- Name: categorias categorias_nombre_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key15 UNIQUE (nombre);


--
-- TOC entry 5592 (class 2606 OID 41041)
-- Name: categorias categorias_nombre_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key16 UNIQUE (nombre);


--
-- TOC entry 5594 (class 2606 OID 41075)
-- Name: categorias categorias_nombre_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key17 UNIQUE (nombre);


--
-- TOC entry 5596 (class 2606 OID 41039)
-- Name: categorias categorias_nombre_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key18 UNIQUE (nombre);


--
-- TOC entry 5598 (class 2606 OID 41077)
-- Name: categorias categorias_nombre_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key19 UNIQUE (nombre);


--
-- TOC entry 5600 (class 2606 OID 41061)
-- Name: categorias categorias_nombre_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key2 UNIQUE (nombre);


--
-- TOC entry 5602 (class 2606 OID 41037)
-- Name: categorias categorias_nombre_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key20 UNIQUE (nombre);


--
-- TOC entry 5604 (class 2606 OID 41079)
-- Name: categorias categorias_nombre_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key21 UNIQUE (nombre);


--
-- TOC entry 5606 (class 2606 OID 41035)
-- Name: categorias categorias_nombre_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key22 UNIQUE (nombre);


--
-- TOC entry 5608 (class 2606 OID 41081)
-- Name: categorias categorias_nombre_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key23 UNIQUE (nombre);


--
-- TOC entry 5610 (class 2606 OID 41033)
-- Name: categorias categorias_nombre_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key24 UNIQUE (nombre);


--
-- TOC entry 5612 (class 2606 OID 41083)
-- Name: categorias categorias_nombre_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key25 UNIQUE (nombre);


--
-- TOC entry 5614 (class 2606 OID 41031)
-- Name: categorias categorias_nombre_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key26 UNIQUE (nombre);


--
-- TOC entry 5616 (class 2606 OID 41085)
-- Name: categorias categorias_nombre_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key27 UNIQUE (nombre);


--
-- TOC entry 5618 (class 2606 OID 41029)
-- Name: categorias categorias_nombre_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key28 UNIQUE (nombre);


--
-- TOC entry 5620 (class 2606 OID 41087)
-- Name: categorias categorias_nombre_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key29 UNIQUE (nombre);


--
-- TOC entry 5622 (class 2606 OID 41055)
-- Name: categorias categorias_nombre_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key3 UNIQUE (nombre);


--
-- TOC entry 5624 (class 2606 OID 41027)
-- Name: categorias categorias_nombre_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key30 UNIQUE (nombre);


--
-- TOC entry 5626 (class 2606 OID 41089)
-- Name: categorias categorias_nombre_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key31 UNIQUE (nombre);


--
-- TOC entry 5628 (class 2606 OID 41025)
-- Name: categorias categorias_nombre_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key32 UNIQUE (nombre);


--
-- TOC entry 5630 (class 2606 OID 41023)
-- Name: categorias categorias_nombre_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key33 UNIQUE (nombre);


--
-- TOC entry 5632 (class 2606 OID 41063)
-- Name: categorias categorias_nombre_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key4 UNIQUE (nombre);


--
-- TOC entry 5634 (class 2606 OID 41053)
-- Name: categorias categorias_nombre_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key5 UNIQUE (nombre);


--
-- TOC entry 5636 (class 2606 OID 41051)
-- Name: categorias categorias_nombre_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key6 UNIQUE (nombre);


--
-- TOC entry 5638 (class 2606 OID 41065)
-- Name: categorias categorias_nombre_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key7 UNIQUE (nombre);


--
-- TOC entry 5640 (class 2606 OID 41049)
-- Name: categorias categorias_nombre_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key8 UNIQUE (nombre);


--
-- TOC entry 5642 (class 2606 OID 41067)
-- Name: categorias categorias_nombre_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key9 UNIQUE (nombre);


--
-- TOC entry 5644 (class 2606 OID 23337)
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- TOC entry 5949 (class 2606 OID 23489)
-- Name: importaciones_ventas importaciones_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.importaciones_ventas
    ADD CONSTRAINT importaciones_ventas_pkey PRIMARY KEY (id);


--
-- TOC entry 5936 (class 2606 OID 23422)
-- Name: lotes lotes_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_pkey PRIMARY KEY (id);


--
-- TOC entry 5939 (class 2606 OID 41408)
-- Name: lotes lotes_producto_id_numero_lote_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_producto_id_numero_lote_key UNIQUE (producto_id, numero_lote);


--
-- TOC entry 5943 (class 2606 OID 23442)
-- Name: movimientos_inventario movimientos_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id);


--
-- TOC entry 5965 (class 2606 OID 23568)
-- Name: notificaciones_correo notificaciones_correo_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.notificaciones_correo
    ADD CONSTRAINT notificaciones_correo_pkey PRIMARY KEY (id);


--
-- TOC entry 5958 (class 2606 OID 23524)
-- Name: ordenes_reabastecimiento ordenes_reabastecimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ordenes_reabastecimiento
    ADD CONSTRAINT ordenes_reabastecimiento_pkey PRIMARY KEY (id);


--
-- TOC entry 5434 (class 2606 OID 40928)
-- Name: permisos permisos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key UNIQUE (codigo);


--
-- TOC entry 5436 (class 2606 OID 40930)
-- Name: permisos permisos_codigo_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key1 UNIQUE (codigo);


--
-- TOC entry 5438 (class 2606 OID 40918)
-- Name: permisos permisos_codigo_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key10 UNIQUE (codigo);


--
-- TOC entry 5440 (class 2606 OID 40880)
-- Name: permisos permisos_codigo_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key11 UNIQUE (codigo);


--
-- TOC entry 5442 (class 2606 OID 40916)
-- Name: permisos permisos_codigo_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key12 UNIQUE (codigo);


--
-- TOC entry 5444 (class 2606 OID 40882)
-- Name: permisos permisos_codigo_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key13 UNIQUE (codigo);


--
-- TOC entry 5446 (class 2606 OID 40914)
-- Name: permisos permisos_codigo_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key14 UNIQUE (codigo);


--
-- TOC entry 5448 (class 2606 OID 40884)
-- Name: permisos permisos_codigo_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key15 UNIQUE (codigo);


--
-- TOC entry 5450 (class 2606 OID 40904)
-- Name: permisos permisos_codigo_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key16 UNIQUE (codigo);


--
-- TOC entry 5452 (class 2606 OID 40886)
-- Name: permisos permisos_codigo_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key17 UNIQUE (codigo);


--
-- TOC entry 5454 (class 2606 OID 40902)
-- Name: permisos permisos_codigo_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key18 UNIQUE (codigo);


--
-- TOC entry 5456 (class 2606 OID 40888)
-- Name: permisos permisos_codigo_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key19 UNIQUE (codigo);


--
-- TOC entry 5458 (class 2606 OID 40932)
-- Name: permisos permisos_codigo_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key2 UNIQUE (codigo);


--
-- TOC entry 5460 (class 2606 OID 40900)
-- Name: permisos permisos_codigo_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key20 UNIQUE (codigo);


--
-- TOC entry 5462 (class 2606 OID 40890)
-- Name: permisos permisos_codigo_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key21 UNIQUE (codigo);


--
-- TOC entry 5464 (class 2606 OID 40898)
-- Name: permisos permisos_codigo_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key22 UNIQUE (codigo);


--
-- TOC entry 5466 (class 2606 OID 40892)
-- Name: permisos permisos_codigo_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key23 UNIQUE (codigo);


--
-- TOC entry 5468 (class 2606 OID 40896)
-- Name: permisos permisos_codigo_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key24 UNIQUE (codigo);


--
-- TOC entry 5470 (class 2606 OID 40894)
-- Name: permisos permisos_codigo_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key25 UNIQUE (codigo);


--
-- TOC entry 5472 (class 2606 OID 40912)
-- Name: permisos permisos_codigo_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key26 UNIQUE (codigo);


--
-- TOC entry 5474 (class 2606 OID 40906)
-- Name: permisos permisos_codigo_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key27 UNIQUE (codigo);


--
-- TOC entry 5476 (class 2606 OID 40910)
-- Name: permisos permisos_codigo_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key28 UNIQUE (codigo);


--
-- TOC entry 5478 (class 2606 OID 40908)
-- Name: permisos permisos_codigo_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key29 UNIQUE (codigo);


--
-- TOC entry 5480 (class 2606 OID 40926)
-- Name: permisos permisos_codigo_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key3 UNIQUE (codigo);


--
-- TOC entry 5482 (class 2606 OID 40878)
-- Name: permisos permisos_codigo_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key30 UNIQUE (codigo);


--
-- TOC entry 5484 (class 2606 OID 40940)
-- Name: permisos permisos_codigo_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key31 UNIQUE (codigo);


--
-- TOC entry 5486 (class 2606 OID 40876)
-- Name: permisos permisos_codigo_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key32 UNIQUE (codigo);


--
-- TOC entry 5488 (class 2606 OID 40874)
-- Name: permisos permisos_codigo_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key33 UNIQUE (codigo);


--
-- TOC entry 5490 (class 2606 OID 40934)
-- Name: permisos permisos_codigo_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key4 UNIQUE (codigo);


--
-- TOC entry 5492 (class 2606 OID 40924)
-- Name: permisos permisos_codigo_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key5 UNIQUE (codigo);


--
-- TOC entry 5494 (class 2606 OID 40922)
-- Name: permisos permisos_codigo_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key6 UNIQUE (codigo);


--
-- TOC entry 5496 (class 2606 OID 40936)
-- Name: permisos permisos_codigo_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key7 UNIQUE (codigo);


--
-- TOC entry 5498 (class 2606 OID 40920)
-- Name: permisos permisos_codigo_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key8 UNIQUE (codigo);


--
-- TOC entry 5500 (class 2606 OID 40938)
-- Name: permisos permisos_codigo_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_codigo_key9 UNIQUE (codigo);


--
-- TOC entry 5502 (class 2606 OID 23296)
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (id);


--
-- TOC entry 5996 (class 2606 OID 39799)
-- Name: precio precio_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.precio
    ADD CONSTRAINT precio_pkey PRIMARY KEY (id);


--
-- TOC entry 5969 (class 2606 OID 23596)
-- Name: preferencias_usuario preferencias_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 5971 (class 2606 OID 41526)
-- Name: preferencias_usuario preferencias_usuario_usuario_id_clave_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_usuario_id_clave_key UNIQUE (usuario_id, clave);


--
-- TOC entry 5716 (class 2606 OID 41215)
-- Name: presentaciones presentaciones_nombre_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key UNIQUE (nombre);


--
-- TOC entry 5718 (class 2606 OID 41217)
-- Name: presentaciones presentaciones_nombre_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key1 UNIQUE (nombre);


--
-- TOC entry 5720 (class 2606 OID 41197)
-- Name: presentaciones presentaciones_nombre_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key10 UNIQUE (nombre);


--
-- TOC entry 5722 (class 2606 OID 41219)
-- Name: presentaciones presentaciones_nombre_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key11 UNIQUE (nombre);


--
-- TOC entry 5724 (class 2606 OID 41195)
-- Name: presentaciones presentaciones_nombre_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key12 UNIQUE (nombre);


--
-- TOC entry 5726 (class 2606 OID 41221)
-- Name: presentaciones presentaciones_nombre_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key13 UNIQUE (nombre);


--
-- TOC entry 5728 (class 2606 OID 41193)
-- Name: presentaciones presentaciones_nombre_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key14 UNIQUE (nombre);


--
-- TOC entry 5730 (class 2606 OID 41175)
-- Name: presentaciones presentaciones_nombre_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key15 UNIQUE (nombre);


--
-- TOC entry 5732 (class 2606 OID 41191)
-- Name: presentaciones presentaciones_nombre_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key16 UNIQUE (nombre);


--
-- TOC entry 5734 (class 2606 OID 41177)
-- Name: presentaciones presentaciones_nombre_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key17 UNIQUE (nombre);


--
-- TOC entry 5736 (class 2606 OID 41189)
-- Name: presentaciones presentaciones_nombre_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key18 UNIQUE (nombre);


--
-- TOC entry 5738 (class 2606 OID 41179)
-- Name: presentaciones presentaciones_nombre_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key19 UNIQUE (nombre);


--
-- TOC entry 5740 (class 2606 OID 41199)
-- Name: presentaciones presentaciones_nombre_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key2 UNIQUE (nombre);


--
-- TOC entry 5742 (class 2606 OID 41187)
-- Name: presentaciones presentaciones_nombre_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key20 UNIQUE (nombre);


--
-- TOC entry 5744 (class 2606 OID 41181)
-- Name: presentaciones presentaciones_nombre_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key21 UNIQUE (nombre);


--
-- TOC entry 5746 (class 2606 OID 41185)
-- Name: presentaciones presentaciones_nombre_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key22 UNIQUE (nombre);


--
-- TOC entry 5748 (class 2606 OID 41183)
-- Name: presentaciones presentaciones_nombre_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key23 UNIQUE (nombre);


--
-- TOC entry 5750 (class 2606 OID 41173)
-- Name: presentaciones presentaciones_nombre_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key24 UNIQUE (nombre);


--
-- TOC entry 5752 (class 2606 OID 41223)
-- Name: presentaciones presentaciones_nombre_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key25 UNIQUE (nombre);


--
-- TOC entry 5754 (class 2606 OID 41171)
-- Name: presentaciones presentaciones_nombre_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key26 UNIQUE (nombre);


--
-- TOC entry 5756 (class 2606 OID 41225)
-- Name: presentaciones presentaciones_nombre_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key27 UNIQUE (nombre);


--
-- TOC entry 5758 (class 2606 OID 41169)
-- Name: presentaciones presentaciones_nombre_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key28 UNIQUE (nombre);


--
-- TOC entry 5760 (class 2606 OID 41227)
-- Name: presentaciones presentaciones_nombre_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key29 UNIQUE (nombre);


--
-- TOC entry 5762 (class 2606 OID 41213)
-- Name: presentaciones presentaciones_nombre_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key3 UNIQUE (nombre);


--
-- TOC entry 5764 (class 2606 OID 41167)
-- Name: presentaciones presentaciones_nombre_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key30 UNIQUE (nombre);


--
-- TOC entry 5766 (class 2606 OID 41229)
-- Name: presentaciones presentaciones_nombre_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key31 UNIQUE (nombre);


--
-- TOC entry 5768 (class 2606 OID 41165)
-- Name: presentaciones presentaciones_nombre_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key32 UNIQUE (nombre);


--
-- TOC entry 5770 (class 2606 OID 41163)
-- Name: presentaciones presentaciones_nombre_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key33 UNIQUE (nombre);


--
-- TOC entry 5772 (class 2606 OID 41201)
-- Name: presentaciones presentaciones_nombre_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key4 UNIQUE (nombre);


--
-- TOC entry 5774 (class 2606 OID 41211)
-- Name: presentaciones presentaciones_nombre_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key5 UNIQUE (nombre);


--
-- TOC entry 5776 (class 2606 OID 41209)
-- Name: presentaciones presentaciones_nombre_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key6 UNIQUE (nombre);


--
-- TOC entry 5778 (class 2606 OID 41203)
-- Name: presentaciones presentaciones_nombre_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key7 UNIQUE (nombre);


--
-- TOC entry 5780 (class 2606 OID 41207)
-- Name: presentaciones presentaciones_nombre_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key8 UNIQUE (nombre);


--
-- TOC entry 5782 (class 2606 OID 41205)
-- Name: presentaciones presentaciones_nombre_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_nombre_key9 UNIQUE (nombre);


--
-- TOC entry 5784 (class 2606 OID 23357)
-- Name: presentaciones presentaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.presentaciones
    ADD CONSTRAINT presentaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5989 (class 2606 OID 39770)
-- Name: producto_presentacion producto_presentacion_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.producto_presentacion
    ADD CONSTRAINT producto_presentacion_pkey PRIMARY KEY (id);


--
-- TOC entry 5993 (class 2606 OID 41550)
-- Name: producto_presentacion producto_presentacion_producto_id_nivel_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.producto_presentacion
    ADD CONSTRAINT producto_presentacion_producto_id_nivel_key UNIQUE (producto_id, nivel);


--
-- TOC entry 5865 (class 2606 OID 41341)
-- Name: productos productos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);


--
-- TOC entry 5867 (class 2606 OID 41343)
-- Name: productos productos_codigo_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key1 UNIQUE (codigo);


--
-- TOC entry 5869 (class 2606 OID 41331)
-- Name: productos productos_codigo_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key10 UNIQUE (codigo);


--
-- TOC entry 5871 (class 2606 OID 41353)
-- Name: productos productos_codigo_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key11 UNIQUE (codigo);


--
-- TOC entry 5873 (class 2606 OID 41329)
-- Name: productos productos_codigo_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key12 UNIQUE (codigo);


--
-- TOC entry 5875 (class 2606 OID 41355)
-- Name: productos productos_codigo_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key13 UNIQUE (codigo);


--
-- TOC entry 5877 (class 2606 OID 41327)
-- Name: productos productos_codigo_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key14 UNIQUE (codigo);


--
-- TOC entry 5879 (class 2606 OID 41357)
-- Name: productos productos_codigo_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key15 UNIQUE (codigo);


--
-- TOC entry 5881 (class 2606 OID 41325)
-- Name: productos productos_codigo_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key16 UNIQUE (codigo);


--
-- TOC entry 5883 (class 2606 OID 41359)
-- Name: productos productos_codigo_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key17 UNIQUE (codigo);


--
-- TOC entry 5885 (class 2606 OID 41323)
-- Name: productos productos_codigo_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key18 UNIQUE (codigo);


--
-- TOC entry 5887 (class 2606 OID 41361)
-- Name: productos productos_codigo_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key19 UNIQUE (codigo);


--
-- TOC entry 5889 (class 2606 OID 41345)
-- Name: productos productos_codigo_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key2 UNIQUE (codigo);


--
-- TOC entry 5891 (class 2606 OID 41321)
-- Name: productos productos_codigo_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key20 UNIQUE (codigo);


--
-- TOC entry 5893 (class 2606 OID 41365)
-- Name: productos productos_codigo_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key21 UNIQUE (codigo);


--
-- TOC entry 5895 (class 2606 OID 41319)
-- Name: productos productos_codigo_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key22 UNIQUE (codigo);


--
-- TOC entry 5897 (class 2606 OID 41367)
-- Name: productos productos_codigo_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key23 UNIQUE (codigo);


--
-- TOC entry 5899 (class 2606 OID 41317)
-- Name: productos productos_codigo_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key24 UNIQUE (codigo);


--
-- TOC entry 5901 (class 2606 OID 41369)
-- Name: productos productos_codigo_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key25 UNIQUE (codigo);


--
-- TOC entry 5903 (class 2606 OID 41315)
-- Name: productos productos_codigo_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key26 UNIQUE (codigo);


--
-- TOC entry 5905 (class 2606 OID 41363)
-- Name: productos productos_codigo_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key27 UNIQUE (codigo);


--
-- TOC entry 5907 (class 2606 OID 41313)
-- Name: productos productos_codigo_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key28 UNIQUE (codigo);


--
-- TOC entry 5909 (class 2606 OID 41371)
-- Name: productos productos_codigo_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key29 UNIQUE (codigo);


--
-- TOC entry 5911 (class 2606 OID 41339)
-- Name: productos productos_codigo_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key3 UNIQUE (codigo);


--
-- TOC entry 5913 (class 2606 OID 41311)
-- Name: productos productos_codigo_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key30 UNIQUE (codigo);


--
-- TOC entry 5915 (class 2606 OID 41373)
-- Name: productos productos_codigo_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key31 UNIQUE (codigo);


--
-- TOC entry 5917 (class 2606 OID 41309)
-- Name: productos productos_codigo_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key32 UNIQUE (codigo);


--
-- TOC entry 5919 (class 2606 OID 41307)
-- Name: productos productos_codigo_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key33 UNIQUE (codigo);


--
-- TOC entry 5921 (class 2606 OID 41347)
-- Name: productos productos_codigo_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key4 UNIQUE (codigo);


--
-- TOC entry 5923 (class 2606 OID 41337)
-- Name: productos productos_codigo_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key5 UNIQUE (codigo);


--
-- TOC entry 5925 (class 2606 OID 41335)
-- Name: productos productos_codigo_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key6 UNIQUE (codigo);


--
-- TOC entry 5927 (class 2606 OID 41349)
-- Name: productos productos_codigo_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key7 UNIQUE (codigo);


--
-- TOC entry 5929 (class 2606 OID 41333)
-- Name: productos productos_codigo_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key8 UNIQUE (codigo);


--
-- TOC entry 5931 (class 2606 OID 41351)
-- Name: productos productos_codigo_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key9 UNIQUE (codigo);


--
-- TOC entry 5933 (class 2606 OID 23388)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- TOC entry 5967 (class 2606 OID 23582)
-- Name: reportes_generados reportes_generados_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.reportes_generados
    ADD CONSTRAINT reportes_generados_pkey PRIMARY KEY (id);


--
-- TOC entry 5504 (class 2606 OID 23303)
-- Name: rol_permisos rol_permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_pkey PRIMARY KEY (rol_id, permiso_id);


--
-- TOC entry 5293 (class 2606 OID 40715)
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- TOC entry 5295 (class 2606 OID 40717)
-- Name: roles roles_nombre_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key1 UNIQUE (nombre);


--
-- TOC entry 5297 (class 2606 OID 40707)
-- Name: roles roles_nombre_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key10 UNIQUE (nombre);


--
-- TOC entry 5299 (class 2606 OID 40729)
-- Name: roles roles_nombre_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key11 UNIQUE (nombre);


--
-- TOC entry 5301 (class 2606 OID 40705)
-- Name: roles roles_nombre_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key12 UNIQUE (nombre);


--
-- TOC entry 5303 (class 2606 OID 40731)
-- Name: roles roles_nombre_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key13 UNIQUE (nombre);


--
-- TOC entry 5305 (class 2606 OID 40703)
-- Name: roles roles_nombre_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key14 UNIQUE (nombre);


--
-- TOC entry 5307 (class 2606 OID 40733)
-- Name: roles roles_nombre_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key15 UNIQUE (nombre);


--
-- TOC entry 5309 (class 2606 OID 40701)
-- Name: roles roles_nombre_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key16 UNIQUE (nombre);


--
-- TOC entry 5311 (class 2606 OID 40735)
-- Name: roles roles_nombre_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key17 UNIQUE (nombre);


--
-- TOC entry 5313 (class 2606 OID 40699)
-- Name: roles roles_nombre_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key18 UNIQUE (nombre);


--
-- TOC entry 5315 (class 2606 OID 40737)
-- Name: roles roles_nombre_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key19 UNIQUE (nombre);


--
-- TOC entry 5317 (class 2606 OID 40719)
-- Name: roles roles_nombre_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key2 UNIQUE (nombre);


--
-- TOC entry 5319 (class 2606 OID 40697)
-- Name: roles roles_nombre_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key20 UNIQUE (nombre);


--
-- TOC entry 5321 (class 2606 OID 40739)
-- Name: roles roles_nombre_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key21 UNIQUE (nombre);


--
-- TOC entry 5323 (class 2606 OID 40695)
-- Name: roles roles_nombre_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key22 UNIQUE (nombre);


--
-- TOC entry 5325 (class 2606 OID 40741)
-- Name: roles roles_nombre_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key23 UNIQUE (nombre);


--
-- TOC entry 5327 (class 2606 OID 40693)
-- Name: roles roles_nombre_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key24 UNIQUE (nombre);


--
-- TOC entry 5329 (class 2606 OID 40691)
-- Name: roles roles_nombre_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key25 UNIQUE (nombre);


--
-- TOC entry 5331 (class 2606 OID 40689)
-- Name: roles roles_nombre_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key26 UNIQUE (nombre);


--
-- TOC entry 5333 (class 2606 OID 40687)
-- Name: roles roles_nombre_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key27 UNIQUE (nombre);


--
-- TOC entry 5335 (class 2606 OID 40685)
-- Name: roles roles_nombre_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key28 UNIQUE (nombre);


--
-- TOC entry 5337 (class 2606 OID 40743)
-- Name: roles roles_nombre_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key29 UNIQUE (nombre);


--
-- TOC entry 5339 (class 2606 OID 40713)
-- Name: roles roles_nombre_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key3 UNIQUE (nombre);


--
-- TOC entry 5341 (class 2606 OID 40683)
-- Name: roles roles_nombre_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key30 UNIQUE (nombre);


--
-- TOC entry 5343 (class 2606 OID 40745)
-- Name: roles roles_nombre_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key31 UNIQUE (nombre);


--
-- TOC entry 5345 (class 2606 OID 40681)
-- Name: roles roles_nombre_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key32 UNIQUE (nombre);


--
-- TOC entry 5347 (class 2606 OID 40679)
-- Name: roles roles_nombre_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key33 UNIQUE (nombre);


--
-- TOC entry 5349 (class 2606 OID 40721)
-- Name: roles roles_nombre_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key4 UNIQUE (nombre);


--
-- TOC entry 5351 (class 2606 OID 40723)
-- Name: roles roles_nombre_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key5 UNIQUE (nombre);


--
-- TOC entry 5353 (class 2606 OID 40711)
-- Name: roles roles_nombre_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key6 UNIQUE (nombre);


--
-- TOC entry 5355 (class 2606 OID 40725)
-- Name: roles roles_nombre_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key7 UNIQUE (nombre);


--
-- TOC entry 5357 (class 2606 OID 40709)
-- Name: roles roles_nombre_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key8 UNIQUE (nombre);


--
-- TOC entry 5359 (class 2606 OID 40727)
-- Name: roles roles_nombre_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key9 UNIQUE (nombre);


--
-- TOC entry 5361 (class 2606 OID 23267)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 5978 (class 2606 OID 41539)
-- Name: tipo_envase tipo_envase_nombre_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tipo_envase
    ADD CONSTRAINT tipo_envase_nombre_key UNIQUE (nombre);


--
-- TOC entry 5980 (class 2606 OID 41541)
-- Name: tipo_envase tipo_envase_nombre_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tipo_envase
    ADD CONSTRAINT tipo_envase_nombre_key1 UNIQUE (nombre);


--
-- TOC entry 5982 (class 2606 OID 41537)
-- Name: tipo_envase tipo_envase_nombre_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tipo_envase
    ADD CONSTRAINT tipo_envase_nombre_key2 UNIQUE (nombre);


--
-- TOC entry 5984 (class 2606 OID 39759)
-- Name: tipo_envase tipo_envase_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tipo_envase
    ADD CONSTRAINT tipo_envase_pkey PRIMARY KEY (id);


--
-- TOC entry 5506 (class 2606 OID 23321)
-- Name: tokens_recuperacion tokens_recuperacion_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_pkey PRIMARY KEY (id);


--
-- TOC entry 5508 (class 2606 OID 40983)
-- Name: tokens_recuperacion tokens_recuperacion_token_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key UNIQUE (token);


--
-- TOC entry 5510 (class 2606 OID 40985)
-- Name: tokens_recuperacion tokens_recuperacion_token_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key1 UNIQUE (token);


--
-- TOC entry 5512 (class 2606 OID 40973)
-- Name: tokens_recuperacion tokens_recuperacion_token_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key10 UNIQUE (token);


--
-- TOC entry 5514 (class 2606 OID 40995)
-- Name: tokens_recuperacion tokens_recuperacion_token_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key11 UNIQUE (token);


--
-- TOC entry 5516 (class 2606 OID 40971)
-- Name: tokens_recuperacion tokens_recuperacion_token_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key12 UNIQUE (token);


--
-- TOC entry 5518 (class 2606 OID 40997)
-- Name: tokens_recuperacion tokens_recuperacion_token_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key13 UNIQUE (token);


--
-- TOC entry 5520 (class 2606 OID 40969)
-- Name: tokens_recuperacion tokens_recuperacion_token_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key14 UNIQUE (token);


--
-- TOC entry 5522 (class 2606 OID 40999)
-- Name: tokens_recuperacion tokens_recuperacion_token_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key15 UNIQUE (token);


--
-- TOC entry 5524 (class 2606 OID 40967)
-- Name: tokens_recuperacion tokens_recuperacion_token_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key16 UNIQUE (token);


--
-- TOC entry 5526 (class 2606 OID 41001)
-- Name: tokens_recuperacion tokens_recuperacion_token_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key17 UNIQUE (token);


--
-- TOC entry 5528 (class 2606 OID 40965)
-- Name: tokens_recuperacion tokens_recuperacion_token_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key18 UNIQUE (token);


--
-- TOC entry 5530 (class 2606 OID 41003)
-- Name: tokens_recuperacion tokens_recuperacion_token_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key19 UNIQUE (token);


--
-- TOC entry 5532 (class 2606 OID 40987)
-- Name: tokens_recuperacion tokens_recuperacion_token_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key2 UNIQUE (token);


--
-- TOC entry 5534 (class 2606 OID 40963)
-- Name: tokens_recuperacion tokens_recuperacion_token_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key20 UNIQUE (token);


--
-- TOC entry 5536 (class 2606 OID 41005)
-- Name: tokens_recuperacion tokens_recuperacion_token_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key21 UNIQUE (token);


--
-- TOC entry 5538 (class 2606 OID 40961)
-- Name: tokens_recuperacion tokens_recuperacion_token_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key22 UNIQUE (token);


--
-- TOC entry 5540 (class 2606 OID 41007)
-- Name: tokens_recuperacion tokens_recuperacion_token_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key23 UNIQUE (token);


--
-- TOC entry 5542 (class 2606 OID 40959)
-- Name: tokens_recuperacion tokens_recuperacion_token_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key24 UNIQUE (token);


--
-- TOC entry 5544 (class 2606 OID 41009)
-- Name: tokens_recuperacion tokens_recuperacion_token_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key25 UNIQUE (token);


--
-- TOC entry 5546 (class 2606 OID 40957)
-- Name: tokens_recuperacion tokens_recuperacion_token_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key26 UNIQUE (token);


--
-- TOC entry 5548 (class 2606 OID 41011)
-- Name: tokens_recuperacion tokens_recuperacion_token_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key27 UNIQUE (token);


--
-- TOC entry 5550 (class 2606 OID 40955)
-- Name: tokens_recuperacion tokens_recuperacion_token_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key28 UNIQUE (token);


--
-- TOC entry 5552 (class 2606 OID 41013)
-- Name: tokens_recuperacion tokens_recuperacion_token_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key29 UNIQUE (token);


--
-- TOC entry 5554 (class 2606 OID 40981)
-- Name: tokens_recuperacion tokens_recuperacion_token_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key3 UNIQUE (token);


--
-- TOC entry 5556 (class 2606 OID 40953)
-- Name: tokens_recuperacion tokens_recuperacion_token_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key30 UNIQUE (token);


--
-- TOC entry 5558 (class 2606 OID 41015)
-- Name: tokens_recuperacion tokens_recuperacion_token_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key31 UNIQUE (token);


--
-- TOC entry 5560 (class 2606 OID 40951)
-- Name: tokens_recuperacion tokens_recuperacion_token_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key32 UNIQUE (token);


--
-- TOC entry 5562 (class 2606 OID 40949)
-- Name: tokens_recuperacion tokens_recuperacion_token_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key33 UNIQUE (token);


--
-- TOC entry 5564 (class 2606 OID 40989)
-- Name: tokens_recuperacion tokens_recuperacion_token_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key4 UNIQUE (token);


--
-- TOC entry 5566 (class 2606 OID 40979)
-- Name: tokens_recuperacion tokens_recuperacion_token_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key5 UNIQUE (token);


--
-- TOC entry 5568 (class 2606 OID 40977)
-- Name: tokens_recuperacion tokens_recuperacion_token_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key6 UNIQUE (token);


--
-- TOC entry 5570 (class 2606 OID 40991)
-- Name: tokens_recuperacion tokens_recuperacion_token_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key7 UNIQUE (token);


--
-- TOC entry 5572 (class 2606 OID 40975)
-- Name: tokens_recuperacion tokens_recuperacion_token_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key8 UNIQUE (token);


--
-- TOC entry 5574 (class 2606 OID 40993)
-- Name: tokens_recuperacion tokens_recuperacion_token_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_key9 UNIQUE (token);


--
-- TOC entry 5951 (class 2606 OID 23501)
-- Name: umbrales_configuracion umbrales_configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_pkey PRIMARY KEY (id);


--
-- TOC entry 5955 (class 2606 OID 41463)
-- Name: umbrales_configuracion umbrales_configuracion_tipo_producto_id_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_tipo_producto_id_key UNIQUE (tipo, producto_id);


--
-- TOC entry 5646 (class 2606 OID 41127)
-- Name: unidades_medida unidades_medida_nombre_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key UNIQUE (nombre);


--
-- TOC entry 5648 (class 2606 OID 41129)
-- Name: unidades_medida unidades_medida_nombre_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key1 UNIQUE (nombre);


--
-- TOC entry 5650 (class 2606 OID 41117)
-- Name: unidades_medida unidades_medida_nombre_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key10 UNIQUE (nombre);


--
-- TOC entry 5652 (class 2606 OID 41139)
-- Name: unidades_medida unidades_medida_nombre_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key11 UNIQUE (nombre);


--
-- TOC entry 5654 (class 2606 OID 41115)
-- Name: unidades_medida unidades_medida_nombre_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key12 UNIQUE (nombre);


--
-- TOC entry 5656 (class 2606 OID 41141)
-- Name: unidades_medida unidades_medida_nombre_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key13 UNIQUE (nombre);


--
-- TOC entry 5658 (class 2606 OID 41113)
-- Name: unidades_medida unidades_medida_nombre_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key14 UNIQUE (nombre);


--
-- TOC entry 5660 (class 2606 OID 41143)
-- Name: unidades_medida unidades_medida_nombre_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key15 UNIQUE (nombre);


--
-- TOC entry 5662 (class 2606 OID 41111)
-- Name: unidades_medida unidades_medida_nombre_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key16 UNIQUE (nombre);


--
-- TOC entry 5664 (class 2606 OID 41145)
-- Name: unidades_medida unidades_medida_nombre_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key17 UNIQUE (nombre);


--
-- TOC entry 5666 (class 2606 OID 41109)
-- Name: unidades_medida unidades_medida_nombre_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key18 UNIQUE (nombre);


--
-- TOC entry 5668 (class 2606 OID 41147)
-- Name: unidades_medida unidades_medida_nombre_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key19 UNIQUE (nombre);


--
-- TOC entry 5670 (class 2606 OID 41131)
-- Name: unidades_medida unidades_medida_nombre_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key2 UNIQUE (nombre);


--
-- TOC entry 5672 (class 2606 OID 41107)
-- Name: unidades_medida unidades_medida_nombre_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key20 UNIQUE (nombre);


--
-- TOC entry 5674 (class 2606 OID 41149)
-- Name: unidades_medida unidades_medida_nombre_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key21 UNIQUE (nombre);


--
-- TOC entry 5676 (class 2606 OID 41105)
-- Name: unidades_medida unidades_medida_nombre_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key22 UNIQUE (nombre);


--
-- TOC entry 5678 (class 2606 OID 41151)
-- Name: unidades_medida unidades_medida_nombre_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key23 UNIQUE (nombre);


--
-- TOC entry 5680 (class 2606 OID 41103)
-- Name: unidades_medida unidades_medida_nombre_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key24 UNIQUE (nombre);


--
-- TOC entry 5682 (class 2606 OID 41153)
-- Name: unidades_medida unidades_medida_nombre_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key25 UNIQUE (nombre);


--
-- TOC entry 5684 (class 2606 OID 41101)
-- Name: unidades_medida unidades_medida_nombre_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key26 UNIQUE (nombre);


--
-- TOC entry 5686 (class 2606 OID 41155)
-- Name: unidades_medida unidades_medida_nombre_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key27 UNIQUE (nombre);


--
-- TOC entry 5688 (class 2606 OID 41099)
-- Name: unidades_medida unidades_medida_nombre_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key28 UNIQUE (nombre);


--
-- TOC entry 5690 (class 2606 OID 41157)
-- Name: unidades_medida unidades_medida_nombre_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key29 UNIQUE (nombre);


--
-- TOC entry 5692 (class 2606 OID 41125)
-- Name: unidades_medida unidades_medida_nombre_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key3 UNIQUE (nombre);


--
-- TOC entry 5694 (class 2606 OID 41097)
-- Name: unidades_medida unidades_medida_nombre_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key30 UNIQUE (nombre);


--
-- TOC entry 5696 (class 2606 OID 41159)
-- Name: unidades_medida unidades_medida_nombre_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key31 UNIQUE (nombre);


--
-- TOC entry 5698 (class 2606 OID 41095)
-- Name: unidades_medida unidades_medida_nombre_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key32 UNIQUE (nombre);


--
-- TOC entry 5700 (class 2606 OID 41093)
-- Name: unidades_medida unidades_medida_nombre_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key33 UNIQUE (nombre);


--
-- TOC entry 5702 (class 2606 OID 41133)
-- Name: unidades_medida unidades_medida_nombre_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key4 UNIQUE (nombre);


--
-- TOC entry 5704 (class 2606 OID 41123)
-- Name: unidades_medida unidades_medida_nombre_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key5 UNIQUE (nombre);


--
-- TOC entry 5706 (class 2606 OID 41121)
-- Name: unidades_medida unidades_medida_nombre_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key6 UNIQUE (nombre);


--
-- TOC entry 5708 (class 2606 OID 41135)
-- Name: unidades_medida unidades_medida_nombre_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key7 UNIQUE (nombre);


--
-- TOC entry 5710 (class 2606 OID 41119)
-- Name: unidades_medida unidades_medida_nombre_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key8 UNIQUE (nombre);


--
-- TOC entry 5712 (class 2606 OID 41137)
-- Name: unidades_medida unidades_medida_nombre_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_nombre_key9 UNIQUE (nombre);


--
-- TOC entry 5714 (class 2606 OID 23346)
-- Name: unidades_medida unidades_medida_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.unidades_medida
    ADD CONSTRAINT unidades_medida_pkey PRIMARY KEY (id);


--
-- TOC entry 5364 (class 2606 OID 40791)
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- TOC entry 5366 (class 2606 OID 40793)
-- Name: usuarios usuarios_email_key1; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key1 UNIQUE (email);


--
-- TOC entry 5368 (class 2606 OID 40781)
-- Name: usuarios usuarios_email_key10; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key10 UNIQUE (email);


--
-- TOC entry 5370 (class 2606 OID 40779)
-- Name: usuarios usuarios_email_key11; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key11 UNIQUE (email);


--
-- TOC entry 5372 (class 2606 OID 40775)
-- Name: usuarios usuarios_email_key12; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key12 UNIQUE (email);


--
-- TOC entry 5374 (class 2606 OID 40801)
-- Name: usuarios usuarios_email_key13; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key13 UNIQUE (email);


--
-- TOC entry 5376 (class 2606 OID 40773)
-- Name: usuarios usuarios_email_key14; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key14 UNIQUE (email);


--
-- TOC entry 5378 (class 2606 OID 40803)
-- Name: usuarios usuarios_email_key15; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key15 UNIQUE (email);


--
-- TOC entry 5380 (class 2606 OID 40771)
-- Name: usuarios usuarios_email_key16; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key16 UNIQUE (email);


--
-- TOC entry 5382 (class 2606 OID 40765)
-- Name: usuarios usuarios_email_key17; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key17 UNIQUE (email);


--
-- TOC entry 5384 (class 2606 OID 40769)
-- Name: usuarios usuarios_email_key18; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key18 UNIQUE (email);


--
-- TOC entry 5386 (class 2606 OID 40767)
-- Name: usuarios usuarios_email_key19; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key19 UNIQUE (email);


--
-- TOC entry 5388 (class 2606 OID 40795)
-- Name: usuarios usuarios_email_key2; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key2 UNIQUE (email);


--
-- TOC entry 5390 (class 2606 OID 40763)
-- Name: usuarios usuarios_email_key20; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key20 UNIQUE (email);


--
-- TOC entry 5392 (class 2606 OID 40805)
-- Name: usuarios usuarios_email_key21; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key21 UNIQUE (email);


--
-- TOC entry 5394 (class 2606 OID 40761)
-- Name: usuarios usuarios_email_key22; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key22 UNIQUE (email);


--
-- TOC entry 5396 (class 2606 OID 40807)
-- Name: usuarios usuarios_email_key23; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key23 UNIQUE (email);


--
-- TOC entry 5398 (class 2606 OID 40759)
-- Name: usuarios usuarios_email_key24; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key24 UNIQUE (email);


--
-- TOC entry 5400 (class 2606 OID 40809)
-- Name: usuarios usuarios_email_key25; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key25 UNIQUE (email);


--
-- TOC entry 5402 (class 2606 OID 40757)
-- Name: usuarios usuarios_email_key26; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key26 UNIQUE (email);


--
-- TOC entry 5404 (class 2606 OID 40811)
-- Name: usuarios usuarios_email_key27; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key27 UNIQUE (email);


--
-- TOC entry 5406 (class 2606 OID 40755)
-- Name: usuarios usuarios_email_key28; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key28 UNIQUE (email);


--
-- TOC entry 5408 (class 2606 OID 40813)
-- Name: usuarios usuarios_email_key29; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key29 UNIQUE (email);


--
-- TOC entry 5410 (class 2606 OID 40789)
-- Name: usuarios usuarios_email_key3; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key3 UNIQUE (email);


--
-- TOC entry 5412 (class 2606 OID 40753)
-- Name: usuarios usuarios_email_key30; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key30 UNIQUE (email);


--
-- TOC entry 5414 (class 2606 OID 40815)
-- Name: usuarios usuarios_email_key31; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key31 UNIQUE (email);


--
-- TOC entry 5416 (class 2606 OID 40751)
-- Name: usuarios usuarios_email_key32; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key32 UNIQUE (email);


--
-- TOC entry 5418 (class 2606 OID 40749)
-- Name: usuarios usuarios_email_key33; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key33 UNIQUE (email);


--
-- TOC entry 5420 (class 2606 OID 40797)
-- Name: usuarios usuarios_email_key4; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key4 UNIQUE (email);


--
-- TOC entry 5422 (class 2606 OID 40787)
-- Name: usuarios usuarios_email_key5; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key5 UNIQUE (email);


--
-- TOC entry 5424 (class 2606 OID 40785)
-- Name: usuarios usuarios_email_key6; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key6 UNIQUE (email);


--
-- TOC entry 5426 (class 2606 OID 40799)
-- Name: usuarios usuarios_email_key7; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key7 UNIQUE (email);


--
-- TOC entry 5428 (class 2606 OID 40783)
-- Name: usuarios usuarios_email_key8; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key8 UNIQUE (email);


--
-- TOC entry 5430 (class 2606 OID 40777)
-- Name: usuarios usuarios_email_key9; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key9 UNIQUE (email);


--
-- TOC entry 5432 (class 2606 OID 23280)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5946 (class 2606 OID 23462)
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- TOC entry 5282 (class 1259 OID 23211)
-- Name: idx_predicciones_producto; Type: INDEX; Schema: ml; Owner: postgres
--

CREATE INDEX idx_predicciones_producto ON ml.predicciones_demanda USING btree (producto_id, fecha_prediccion DESC);


--
-- TOC entry 5285 (class 1259 OID 23224)
-- Name: idx_riesgos_producto; Type: INDEX; Schema: ml; Owner: postgres
--

CREATE INDEX idx_riesgos_producto ON ml.riesgos_vencimiento USING btree (producto_id, fecha_calculo DESC);


--
-- TOC entry 5260 (class 1259 OID 23091)
-- Name: idx_alertas_estado; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_alertas_estado ON negocio.alertas USING btree (estado);


--
-- TOC entry 5261 (class 1259 OID 23090)
-- Name: idx_alertas_producto; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_alertas_producto ON negocio.alertas USING btree (producto_id);


--
-- TOC entry 5262 (class 1259 OID 23092)
-- Name: idx_alertas_severidad; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_alertas_severidad ON negocio.alertas USING btree (severidad);


--
-- TOC entry 5273 (class 1259 OID 23156)
-- Name: idx_auditoria_entidad; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_auditoria_entidad ON negocio.auditoria USING btree (entidad);


--
-- TOC entry 5274 (class 1259 OID 23158)
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_auditoria_fecha ON negocio.auditoria USING btree (fecha);


--
-- TOC entry 5275 (class 1259 OID 23157)
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_auditoria_usuario ON negocio.auditoria USING btree (usuario_id);


--
-- TOC entry 5234 (class 1259 OID 22947)
-- Name: idx_lotes_producto; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_lotes_producto ON negocio.lotes USING btree (producto_id);


--
-- TOC entry 5235 (class 1259 OID 22948)
-- Name: idx_lotes_vencimiento; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_lotes_vencimiento ON negocio.lotes USING btree (fecha_vencimiento);


--
-- TOC entry 5240 (class 1259 OID 22974)
-- Name: idx_movimientos_fecha; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_movimientos_fecha ON negocio.movimientos_inventario USING btree (fecha);


--
-- TOC entry 5241 (class 1259 OID 22973)
-- Name: idx_movimientos_lote; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_movimientos_lote ON negocio.movimientos_inventario USING btree (lote_id);


--
-- TOC entry 5242 (class 1259 OID 22975)
-- Name: idx_movimientos_producto; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_movimientos_producto ON negocio.movimientos_inventario USING btree (lote_id);


--
-- TOC entry 5255 (class 1259 OID 23064)
-- Name: idx_ordenes_estado; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_ordenes_estado ON negocio.ordenes_reabastecimiento USING btree (estado);


--
-- TOC entry 5227 (class 1259 OID 22928)
-- Name: idx_productos_activo; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_productos_activo ON negocio.productos USING btree (activo);


--
-- TOC entry 5228 (class 1259 OID 22927)
-- Name: idx_productos_categoria; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_productos_categoria ON negocio.productos USING btree (categoria_id);


--
-- TOC entry 5229 (class 1259 OID 22926)
-- Name: idx_productos_codigo; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_productos_codigo ON negocio.productos USING btree (codigo);


--
-- TOC entry 5200 (class 1259 OID 22825)
-- Name: idx_tokens_usuario; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_tokens_usuario ON negocio.tokens_recuperacion USING btree (usuario_id);


--
-- TOC entry 5193 (class 1259 OID 41582)
-- Name: idx_usuarios_dni; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE UNIQUE INDEX idx_usuarios_dni ON negocio.usuarios USING btree (dni) WHERE (dni IS NOT NULL);


--
-- TOC entry 5194 (class 1259 OID 22807)
-- Name: idx_usuarios_email; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_usuarios_email ON negocio.usuarios USING btree (email);


--
-- TOC entry 5195 (class 1259 OID 22808)
-- Name: idx_usuarios_rol; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_usuarios_rol ON negocio.usuarios USING btree (rol_id);


--
-- TOC entry 5245 (class 1259 OID 23002)
-- Name: idx_ventas_fecha; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_ventas_fecha ON negocio.ventas USING btree (fecha_venta);


--
-- TOC entry 5246 (class 1259 OID 23001)
-- Name: idx_ventas_producto; Type: INDEX; Schema: negocio; Owner: postgres
--

CREATE INDEX idx_ventas_producto ON negocio.ventas USING btree (producto_id);


--
-- TOC entry 5959 (class 1259 OID 41505)
-- Name: alertas_estado; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX alertas_estado ON public.alertas USING btree (estado);


--
-- TOC entry 5962 (class 1259 OID 23557)
-- Name: alertas_producto_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX alertas_producto_id ON public.alertas USING btree (producto_id);


--
-- TOC entry 5963 (class 1259 OID 41502)
-- Name: alertas_severidad; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX alertas_severidad ON public.alertas USING btree (severidad);


--
-- TOC entry 5972 (class 1259 OID 41532)
-- Name: auditoria_entidad; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX auditoria_entidad ON public.auditoria USING btree (entidad);


--
-- TOC entry 5973 (class 1259 OID 41533)
-- Name: auditoria_fecha; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX auditoria_fecha ON public.auditoria USING btree (fecha);


--
-- TOC entry 5976 (class 1259 OID 23619)
-- Name: auditoria_usuario_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX auditoria_usuario_id ON public.auditoria USING btree (usuario_id);


--
-- TOC entry 5994 (class 1259 OID 39805)
-- Name: idx_precio_producto; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX idx_precio_producto ON public.precio USING btree (producto_id);


--
-- TOC entry 5985 (class 1259 OID 39784)
-- Name: idx_productopresentacion_envase; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX idx_productopresentacion_envase ON public.producto_presentacion USING btree (envase_id);


--
-- TOC entry 5986 (class 1259 OID 39783)
-- Name: idx_productopresentacion_producto; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX idx_productopresentacion_producto ON public.producto_presentacion USING btree (producto_id);


--
-- TOC entry 5859 (class 1259 OID 41577)
-- Name: idx_productos_categoria_paquete; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX idx_productos_categoria_paquete ON public.productos USING btree (categoria_paquete_id);


--
-- TOC entry 5860 (class 1259 OID 41578)
-- Name: idx_productos_contenido_envase; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX idx_productos_contenido_envase ON public.productos USING btree (contenido_paquete_envase_id);


--
-- TOC entry 5362 (class 1259 OID 41584)
-- Name: idx_usuarios_dni; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE UNIQUE INDEX idx_usuarios_dni ON public.usuarios USING btree (dni) WHERE (dni IS NOT NULL);


--
-- TOC entry 5934 (class 1259 OID 41413)
-- Name: lotes_fecha_vencimiento; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX lotes_fecha_vencimiento ON public.lotes USING btree (fecha_vencimiento);


--
-- TOC entry 5937 (class 1259 OID 23430)
-- Name: lotes_producto_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX lotes_producto_id ON public.lotes USING btree (producto_id);


--
-- TOC entry 5940 (class 1259 OID 41432)
-- Name: movimientos_inventario_fecha; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX movimientos_inventario_fecha ON public.movimientos_inventario USING btree (fecha);


--
-- TOC entry 5941 (class 1259 OID 23453)
-- Name: movimientos_inventario_lote_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX movimientos_inventario_lote_id ON public.movimientos_inventario USING btree (lote_id);


--
-- TOC entry 5956 (class 1259 OID 41482)
-- Name: ordenes_reabastecimiento_estado; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX ordenes_reabastecimiento_estado ON public.ordenes_reabastecimiento USING btree (estado);


--
-- TOC entry 5997 (class 1259 OID 41563)
-- Name: precio_producto_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX precio_producto_id ON public.precio USING btree (producto_id);


--
-- TOC entry 5987 (class 1259 OID 41561)
-- Name: producto_presentacion_envase_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX producto_presentacion_envase_id ON public.producto_presentacion USING btree (envase_id);


--
-- TOC entry 5990 (class 1259 OID 41560)
-- Name: producto_presentacion_producto_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX producto_presentacion_producto_id ON public.producto_presentacion USING btree (producto_id);


--
-- TOC entry 5991 (class 1259 OID 41562)
-- Name: producto_presentacion_producto_id_nivel; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE UNIQUE INDEX producto_presentacion_producto_id_nivel ON public.producto_presentacion USING btree (producto_id, nivel);


--
-- TOC entry 5861 (class 1259 OID 41379)
-- Name: productos_activo; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX productos_activo ON public.productos USING btree (activo);


--
-- TOC entry 5862 (class 1259 OID 23412)
-- Name: productos_categoria_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX productos_categoria_id ON public.productos USING btree (categoria_id);


--
-- TOC entry 5863 (class 1259 OID 41374)
-- Name: productos_codigo; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX productos_codigo ON public.productos USING btree (codigo);


--
-- TOC entry 5952 (class 1259 OID 23515)
-- Name: umbrales_configuracion_producto_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX umbrales_configuracion_producto_id ON public.umbrales_configuracion USING btree (producto_id);


--
-- TOC entry 5953 (class 1259 OID 41464)
-- Name: umbrales_configuracion_tipo; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX umbrales_configuracion_tipo ON public.umbrales_configuracion USING btree (tipo);


--
-- TOC entry 5944 (class 1259 OID 41443)
-- Name: ventas_fecha_venta; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX ventas_fecha_venta ON public.ventas USING btree (fecha_venta);


--
-- TOC entry 5947 (class 1259 OID 23478)
-- Name: ventas_producto_id; Type: INDEX; Schema: public; Owner: business_api_role
--

CREATE INDEX ventas_producto_id ON public.ventas USING btree (producto_id);


--
-- TOC entry 6025 (class 2606 OID 23192)
-- Name: entrenamientos entrenamientos_modelo_id_fkey; Type: FK CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.entrenamientos
    ADD CONSTRAINT entrenamientos_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES ml.modelos(id);


--
-- TOC entry 6026 (class 2606 OID 23206)
-- Name: predicciones_demanda predicciones_demanda_modelo_id_fkey; Type: FK CONSTRAINT; Schema: ml; Owner: postgres
--

ALTER TABLE ONLY ml.predicciones_demanda
    ADD CONSTRAINT predicciones_demanda_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES ml.modelos(id);


--
-- TOC entry 6019 (class 2606 OID 23085)
-- Name: alertas alertas_lote_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.alertas
    ADD CONSTRAINT alertas_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES negocio.lotes(id) ON DELETE SET NULL;


--
-- TOC entry 6020 (class 2606 OID 23080)
-- Name: alertas alertas_producto_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.alertas
    ADD CONSTRAINT alertas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES negocio.productos(id) ON DELETE CASCADE;


--
-- TOC entry 6024 (class 2606 OID 23151)
-- Name: auditoria auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.auditoria
    ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 6002 (class 2606 OID 22877)
-- Name: catalogo_marcas_familias catalogo_marcas_familias_categoria_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_marcas_familias
    ADD CONSTRAINT catalogo_marcas_familias_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES negocio.categorias(id) ON DELETE CASCADE;


--
-- TOC entry 6003 (class 2606 OID 22872)
-- Name: catalogo_marcas_familias catalogo_marcas_familias_marca_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.catalogo_marcas_familias
    ADD CONSTRAINT catalogo_marcas_familias_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES negocio.catalogo_marcas(id) ON DELETE CASCADE;


--
-- TOC entry 6014 (class 2606 OID 23015)
-- Name: importaciones_ventas importaciones_ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.importaciones_ventas
    ADD CONSTRAINT importaciones_ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 6008 (class 2606 OID 22942)
-- Name: lotes lotes_producto_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.lotes
    ADD CONSTRAINT lotes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES negocio.productos(id) ON DELETE CASCADE;


--
-- TOC entry 6009 (class 2606 OID 22963)
-- Name: movimientos_inventario movimientos_inventario_lote_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES negocio.lotes(id) ON DELETE CASCADE;


--
-- TOC entry 6010 (class 2606 OID 22968)
-- Name: movimientos_inventario movimientos_inventario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 6021 (class 2606 OID 23103)
-- Name: notificaciones_correo notificaciones_correo_alerta_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.notificaciones_correo
    ADD CONSTRAINT notificaciones_correo_alerta_id_fkey FOREIGN KEY (alerta_id) REFERENCES negocio.alertas(id) ON DELETE SET NULL;


--
-- TOC entry 6017 (class 2606 OID 23054)
-- Name: ordenes_reabastecimiento ordenes_reabastecimiento_producto_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ordenes_reabastecimiento
    ADD CONSTRAINT ordenes_reabastecimiento_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES negocio.productos(id) ON DELETE CASCADE;


--
-- TOC entry 6018 (class 2606 OID 23059)
-- Name: ordenes_reabastecimiento ordenes_reabastecimiento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ordenes_reabastecimiento
    ADD CONSTRAINT ordenes_reabastecimiento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 6023 (class 2606 OID 23136)
-- Name: preferencias_usuario preferencias_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE CASCADE;


--
-- TOC entry 6004 (class 2606 OID 22906)
-- Name: productos productos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.productos
    ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES negocio.categorias(id) ON DELETE SET NULL;


--
-- TOC entry 6005 (class 2606 OID 22921)
-- Name: productos productos_marca_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.productos
    ADD CONSTRAINT productos_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES negocio.catalogo_marcas(id) ON DELETE SET NULL;


--
-- TOC entry 6006 (class 2606 OID 22916)
-- Name: productos productos_presentacion_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.productos
    ADD CONSTRAINT productos_presentacion_id_fkey FOREIGN KEY (presentacion_id) REFERENCES negocio.presentaciones(id) ON DELETE SET NULL;


--
-- TOC entry 6007 (class 2606 OID 22911)
-- Name: productos productos_unidad_medida_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.productos
    ADD CONSTRAINT productos_unidad_medida_id_fkey FOREIGN KEY (unidad_medida_id) REFERENCES negocio.unidades_medida(id) ON DELETE SET NULL;


--
-- TOC entry 6022 (class 2606 OID 23119)
-- Name: reportes_generados reportes_generados_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.reportes_generados
    ADD CONSTRAINT reportes_generados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 5998 (class 2606 OID 22783)
-- Name: rol_permisos rol_permisos_permiso_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.rol_permisos
    ADD CONSTRAINT rol_permisos_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES negocio.permisos(id) ON DELETE CASCADE;


--
-- TOC entry 5999 (class 2606 OID 22778)
-- Name: rol_permisos rol_permisos_rol_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.rol_permisos
    ADD CONSTRAINT rol_permisos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES negocio.roles(id) ON DELETE CASCADE;


--
-- TOC entry 6001 (class 2606 OID 22820)
-- Name: tokens_recuperacion tokens_recuperacion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE CASCADE;


--
-- TOC entry 6015 (class 2606 OID 23031)
-- Name: umbrales_configuracion umbrales_configuracion_producto_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES negocio.productos(id) ON DELETE CASCADE;


--
-- TOC entry 6016 (class 2606 OID 23036)
-- Name: umbrales_configuracion umbrales_configuracion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 6000 (class 2606 OID 22802)
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES negocio.roles(id) ON DELETE RESTRICT;


--
-- TOC entry 6011 (class 2606 OID 22991)
-- Name: ventas ventas_lote_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ventas
    ADD CONSTRAINT ventas_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES negocio.lotes(id) ON DELETE SET NULL;


--
-- TOC entry 6012 (class 2606 OID 22986)
-- Name: ventas ventas_producto_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ventas
    ADD CONSTRAINT ventas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES negocio.productos(id) ON DELETE CASCADE;


--
-- TOC entry 6013 (class 2606 OID 22996)
-- Name: ventas ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: negocio; Owner: postgres
--

ALTER TABLE ONLY negocio.ventas
    ADD CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES negocio.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 6048 (class 2606 OID 41495)
-- Name: alertas alertas_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6049 (class 2606 OID 41490)
-- Name: alertas alertas_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE;


--
-- TOC entry 6053 (class 2606 OID 41527)
-- Name: auditoria auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6043 (class 2606 OID 41451)
-- Name: importaciones_ventas importaciones_ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.importaciones_ventas
    ADD CONSTRAINT importaciones_ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6037 (class 2606 OID 41402)
-- Name: lotes lotes_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6038 (class 2606 OID 41414)
-- Name: movimientos_inventario movimientos_inventario_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6039 (class 2606 OID 41427)
-- Name: movimientos_inventario movimientos_inventario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6050 (class 2606 OID 41506)
-- Name: notificaciones_correo notificaciones_correo_alerta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.notificaciones_correo
    ADD CONSTRAINT notificaciones_correo_alerta_id_fkey FOREIGN KEY (alerta_id) REFERENCES public.alertas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6046 (class 2606 OID 41475)
-- Name: ordenes_reabastecimiento ordenes_reabastecimiento_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ordenes_reabastecimiento
    ADD CONSTRAINT ordenes_reabastecimiento_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE;


--
-- TOC entry 6047 (class 2606 OID 41485)
-- Name: ordenes_reabastecimiento ordenes_reabastecimiento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ordenes_reabastecimiento
    ADD CONSTRAINT ordenes_reabastecimiento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6056 (class 2606 OID 39800)
-- Name: precio precio_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.precio
    ADD CONSTRAINT precio_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- TOC entry 6052 (class 2606 OID 41520)
-- Name: preferencias_usuario preferencias_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.preferencias_usuario
    ADD CONSTRAINT preferencias_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE;


--
-- TOC entry 6054 (class 2606 OID 41552)
-- Name: producto_presentacion producto_presentacion_envase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.producto_presentacion
    ADD CONSTRAINT producto_presentacion_envase_id_fkey FOREIGN KEY (envase_id) REFERENCES public.tipo_envase(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6055 (class 2606 OID 41544)
-- Name: producto_presentacion producto_presentacion_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.producto_presentacion
    ADD CONSTRAINT producto_presentacion_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6031 (class 2606 OID 41380)
-- Name: productos productos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6032 (class 2606 OID 41565)
-- Name: productos productos_categoria_paquete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_categoria_paquete_id_fkey FOREIGN KEY (categoria_paquete_id) REFERENCES public.tipo_envase(id);


--
-- TOC entry 6033 (class 2606 OID 41571)
-- Name: productos productos_contenido_paquete_envase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_contenido_paquete_envase_id_fkey FOREIGN KEY (contenido_paquete_envase_id) REFERENCES public.tipo_envase(id);


--
-- TOC entry 6034 (class 2606 OID 41395)
-- Name: productos productos_marca_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES public.catalogo_marcas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6035 (class 2606 OID 41390)
-- Name: productos productos_presentacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_presentacion_id_fkey FOREIGN KEY (presentacion_id) REFERENCES public.presentaciones(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6036 (class 2606 OID 41385)
-- Name: productos productos_unidad_medida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_unidad_medida_id_fkey FOREIGN KEY (unidad_medida_id) REFERENCES public.unidades_medida(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6051 (class 2606 OID 41515)
-- Name: reportes_generados reportes_generados_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.reportes_generados
    ADD CONSTRAINT reportes_generados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6028 (class 2606 OID 23309)
-- Name: rol_permisos rol_permisos_permiso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES public.permisos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6029 (class 2606 OID 23304)
-- Name: rol_permisos rol_permisos_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6030 (class 2606 OID 40941)
-- Name: tokens_recuperacion tokens_recuperacion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6044 (class 2606 OID 41465)
-- Name: umbrales_configuracion umbrales_configuracion_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6045 (class 2606 OID 41470)
-- Name: umbrales_configuracion umbrales_configuracion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.umbrales_configuracion
    ADD CONSTRAINT umbrales_configuracion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6027 (class 2606 OID 40816)
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6040 (class 2606 OID 41438)
-- Name: ventas ventas_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6041 (class 2606 OID 41433)
-- Name: ventas ventas_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 6042 (class 2606 OID 41446)
-- Name: ventas ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: business_api_role
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6316 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA ml; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON SCHEMA ml TO ml_service_role;


--
-- TOC entry 6317 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA negocio; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON SCHEMA negocio TO business_api_role;
GRANT USAGE ON SCHEMA negocio TO ml_service_role;


--
-- TOC entry 6318 (class 0 OID 0)
-- Dependencies: 7
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO business_api_role;


--
-- TOC entry 6320 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE anomalias; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON TABLE ml.anomalias TO ml_service_role;


--
-- TOC entry 6322 (class 0 OID 0)
-- Dependencies: 275
-- Name: SEQUENCE anomalias_id_seq; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON SEQUENCE ml.anomalias_id_seq TO ml_service_role;


--
-- TOC entry 6324 (class 0 OID 0)
-- Dependencies: 264
-- Name: TABLE conjuntos_datos; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON TABLE ml.conjuntos_datos TO ml_service_role;


--
-- TOC entry 6326 (class 0 OID 0)
-- Dependencies: 263
-- Name: SEQUENCE conjuntos_datos_id_seq; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON SEQUENCE ml.conjuntos_datos_id_seq TO ml_service_role;


--
-- TOC entry 6328 (class 0 OID 0)
-- Dependencies: 268
-- Name: TABLE entrenamientos; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON TABLE ml.entrenamientos TO ml_service_role;


--
-- TOC entry 6330 (class 0 OID 0)
-- Dependencies: 267
-- Name: SEQUENCE entrenamientos_id_seq; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON SEQUENCE ml.entrenamientos_id_seq TO ml_service_role;


--
-- TOC entry 6332 (class 0 OID 0)
-- Dependencies: 266
-- Name: TABLE modelos; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON TABLE ml.modelos TO ml_service_role;


--
-- TOC entry 6334 (class 0 OID 0)
-- Dependencies: 265
-- Name: SEQUENCE modelos_id_seq; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON SEQUENCE ml.modelos_id_seq TO ml_service_role;


--
-- TOC entry 6336 (class 0 OID 0)
-- Dependencies: 270
-- Name: TABLE predicciones_demanda; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON TABLE ml.predicciones_demanda TO ml_service_role;


--
-- TOC entry 6338 (class 0 OID 0)
-- Dependencies: 269
-- Name: SEQUENCE predicciones_demanda_id_seq; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON SEQUENCE ml.predicciones_demanda_id_seq TO ml_service_role;


--
-- TOC entry 6340 (class 0 OID 0)
-- Dependencies: 274
-- Name: TABLE recomendaciones; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON TABLE ml.recomendaciones TO ml_service_role;


--
-- TOC entry 6342 (class 0 OID 0)
-- Dependencies: 273
-- Name: SEQUENCE recomendaciones_id_seq; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON SEQUENCE ml.recomendaciones_id_seq TO ml_service_role;


--
-- TOC entry 6344 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE riesgos_vencimiento; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON TABLE ml.riesgos_vencimiento TO ml_service_role;


--
-- TOC entry 6346 (class 0 OID 0)
-- Dependencies: 271
-- Name: SEQUENCE riesgos_vencimiento_id_seq; Type: ACL; Schema: ml; Owner: postgres
--

GRANT ALL ON SEQUENCE ml.riesgos_vencimiento_id_seq TO ml_service_role;


--
-- TOC entry 6348 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE alertas; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.alertas TO business_api_role;


--
-- TOC entry 6350 (class 0 OID 0)
-- Dependencies: 253
-- Name: SEQUENCE alertas_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.alertas_id_seq TO business_api_role;


--
-- TOC entry 6352 (class 0 OID 0)
-- Dependencies: 262
-- Name: TABLE auditoria; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.auditoria TO business_api_role;


--
-- TOC entry 6354 (class 0 OID 0)
-- Dependencies: 261
-- Name: SEQUENCE auditoria_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.auditoria_id_seq TO business_api_role;


--
-- TOC entry 6356 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE catalogo_marcas; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.catalogo_marcas TO business_api_role;


--
-- TOC entry 6358 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE catalogo_marcas_familias; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.catalogo_marcas_familias TO business_api_role;


--
-- TOC entry 6360 (class 0 OID 0)
-- Dependencies: 234
-- Name: SEQUENCE catalogo_marcas_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.catalogo_marcas_id_seq TO business_api_role;


--
-- TOC entry 6362 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE catalogo_valores; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.catalogo_valores TO business_api_role;


--
-- TOC entry 6364 (class 0 OID 0)
-- Dependencies: 237
-- Name: SEQUENCE catalogo_valores_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.catalogo_valores_id_seq TO business_api_role;


--
-- TOC entry 6366 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE categorias; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.categorias TO business_api_role;


--
-- TOC entry 6368 (class 0 OID 0)
-- Dependencies: 228
-- Name: SEQUENCE categorias_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.categorias_id_seq TO business_api_role;


--
-- TOC entry 6370 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE importaciones_ventas; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.importaciones_ventas TO business_api_role;


--
-- TOC entry 6372 (class 0 OID 0)
-- Dependencies: 247
-- Name: SEQUENCE importaciones_ventas_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.importaciones_ventas_id_seq TO business_api_role;


--
-- TOC entry 6374 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE lotes; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.lotes TO business_api_role;
GRANT SELECT ON TABLE negocio.lotes TO ml_service_role;


--
-- TOC entry 6376 (class 0 OID 0)
-- Dependencies: 241
-- Name: SEQUENCE lotes_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.lotes_id_seq TO business_api_role;


--
-- TOC entry 6378 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE movimientos_inventario; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.movimientos_inventario TO business_api_role;


--
-- TOC entry 6380 (class 0 OID 0)
-- Dependencies: 243
-- Name: SEQUENCE movimientos_inventario_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.movimientos_inventario_id_seq TO business_api_role;


--
-- TOC entry 6382 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE notificaciones_correo; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.notificaciones_correo TO business_api_role;


--
-- TOC entry 6384 (class 0 OID 0)
-- Dependencies: 255
-- Name: SEQUENCE notificaciones_correo_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.notificaciones_correo_id_seq TO business_api_role;


--
-- TOC entry 6386 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE ordenes_reabastecimiento; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.ordenes_reabastecimiento TO business_api_role;


--
-- TOC entry 6388 (class 0 OID 0)
-- Dependencies: 251
-- Name: SEQUENCE ordenes_reabastecimiento_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.ordenes_reabastecimiento_id_seq TO business_api_role;


--
-- TOC entry 6390 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE permisos; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.permisos TO business_api_role;


--
-- TOC entry 6392 (class 0 OID 0)
-- Dependencies: 221
-- Name: SEQUENCE permisos_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.permisos_id_seq TO business_api_role;


--
-- TOC entry 6394 (class 0 OID 0)
-- Dependencies: 260
-- Name: TABLE preferencias_usuario; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.preferencias_usuario TO business_api_role;


--
-- TOC entry 6396 (class 0 OID 0)
-- Dependencies: 259
-- Name: SEQUENCE preferencias_usuario_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.preferencias_usuario_id_seq TO business_api_role;


--
-- TOC entry 6398 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE presentaciones; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.presentaciones TO business_api_role;


--
-- TOC entry 6400 (class 0 OID 0)
-- Dependencies: 232
-- Name: SEQUENCE presentaciones_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.presentaciones_id_seq TO business_api_role;


--
-- TOC entry 6402 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE productos; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.productos TO business_api_role;
GRANT SELECT ON TABLE negocio.productos TO ml_service_role;


--
-- TOC entry 6404 (class 0 OID 0)
-- Dependencies: 239
-- Name: SEQUENCE productos_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.productos_id_seq TO business_api_role;


--
-- TOC entry 6406 (class 0 OID 0)
-- Dependencies: 258
-- Name: TABLE reportes_generados; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.reportes_generados TO business_api_role;


--
-- TOC entry 6408 (class 0 OID 0)
-- Dependencies: 257
-- Name: SEQUENCE reportes_generados_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.reportes_generados_id_seq TO business_api_role;


--
-- TOC entry 6410 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE rol_permisos; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.rol_permisos TO business_api_role;


--
-- TOC entry 6412 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE roles; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.roles TO business_api_role;


--
-- TOC entry 6414 (class 0 OID 0)
-- Dependencies: 219
-- Name: SEQUENCE roles_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.roles_id_seq TO business_api_role;


--
-- TOC entry 6416 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE tokens_recuperacion; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.tokens_recuperacion TO business_api_role;


--
-- TOC entry 6418 (class 0 OID 0)
-- Dependencies: 226
-- Name: SEQUENCE tokens_recuperacion_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.tokens_recuperacion_id_seq TO business_api_role;


--
-- TOC entry 6420 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE umbrales_configuracion; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.umbrales_configuracion TO business_api_role;


--
-- TOC entry 6422 (class 0 OID 0)
-- Dependencies: 249
-- Name: SEQUENCE umbrales_configuracion_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.umbrales_configuracion_id_seq TO business_api_role;


--
-- TOC entry 6424 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE unidades_medida; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.unidades_medida TO business_api_role;


--
-- TOC entry 6426 (class 0 OID 0)
-- Dependencies: 230
-- Name: SEQUENCE unidades_medida_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.unidades_medida_id_seq TO business_api_role;


--
-- TOC entry 6428 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE usuarios; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.usuarios TO business_api_role;


--
-- TOC entry 6430 (class 0 OID 0)
-- Dependencies: 224
-- Name: SEQUENCE usuarios_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.usuarios_id_seq TO business_api_role;


--
-- TOC entry 6432 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE ventas; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON TABLE negocio.ventas TO business_api_role;
GRANT SELECT ON TABLE negocio.ventas TO ml_service_role;


--
-- TOC entry 6434 (class 0 OID 0)
-- Dependencies: 245
-- Name: SEQUENCE ventas_id_seq; Type: ACL; Schema: negocio; Owner: postgres
--

GRANT ALL ON SEQUENCE negocio.ventas_id_seq TO business_api_role;


--
-- TOC entry 2324 (class 826 OID 23258)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: ml; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ml GRANT ALL ON SEQUENCES TO ml_service_role;


--
-- TOC entry 2323 (class 826 OID 23257)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: ml; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ml GRANT ALL ON TABLES TO ml_service_role;


--
-- TOC entry 2322 (class 826 OID 23256)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: negocio; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA negocio GRANT ALL ON SEQUENCES TO business_api_role;


--
-- TOC entry 2321 (class 826 OID 23255)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: negocio; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA negocio GRANT ALL ON TABLES TO business_api_role;


-- Completed on 2026-09-28 08:40:20

--
-- PostgreSQL database dump complete
--

\unrestrict Hvr6qKjnSQAsRdcWnAZUPfJzbkfVHmnrsSv4cLBo2Tw4kQRZRycAze8x2yXUYHn

