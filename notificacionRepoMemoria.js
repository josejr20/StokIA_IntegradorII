'use strict';

/**
 * Repositorio en memoria con la misma interfaz que `notificacionCriticaRepositorio`.
 * Permite probar la US-32 sin base de datos ni SMTP.
 */
function crearRepoMemoria({ roles = [], usuarios = [], configuracion = [], alertas = [], productos = {}, lotes = {} } = {}) {
  const estado = {
    roles: roles.map((rol) => ({ ...rol })),
    usuarios: usuarios.map((usuario) => ({ ...usuario })),
    configuracion: configuracion.map((fila) => ({ ...fila })),
    alertas: alertas.map((alerta) => ({ ...alerta })),
    registros: [],
    siguienteId: 1,
  };
  const nombreRol = (id) => estado.roles.find((rol) => Number(rol.id) === Number(id))?.nombre;

  const repo = {
    estado,

    async rolesConfigurados(tipo) {
      const filas = estado.configuracion.filter((fila) => fila.tipo_alerta === tipo);
      return {
        hayConfiguracion: filas.length > 0,
        roles: filas.filter((fila) => fila.activo).map((fila) => nombreRol(fila.rol_id)).filter(Boolean),
      };
    },
    async usuariosActivosPorRol(nombres) {
      const buscados = new Set(nombres.map((nombre) => nombre.toLowerCase()));
      return estado.usuarios
        .filter((usuario) => usuario.activo !== false && buscados.has(String(nombreRol(usuario.rol_id)).toLowerCase()))
        .map((usuario) => ({ email: usuario.email, rol: nombreRol(usuario.rol_id) }));
    },
    async listarRoles() { return estado.roles.map((rol) => ({ ...rol })); },
    async listarConfiguracion() { return estado.configuracion.map((fila) => ({ ...fila })); },
    async guardarConfiguracion(filas) {
      for (const fila of filas) {
        const actual = estado.configuracion.find(
          (existente) => existente.rol_id === fila.rol_id && existente.tipo_alerta === fila.tipo_alerta,
        );
        if (actual) actual.activo = fila.activo;
        else estado.configuracion.push({ ...fila });
      }
    },

    async buscarRegistro(alertaId, destinatario) {
      const registro = estado.registros.find((r) => r.alerta_id === alertaId && r.destinatario === destinatario);
      return registro ? { ...registro } : null;
    },
    async crearRegistro(datos) {
      const registro = { id: estado.siguienteId++, fecha_envio: null, ultimo_error: null, fecha_creacion: new Date(), ...datos };
      estado.registros.push(registro);
      return { ...registro };
    },
    async actualizarRegistro(registro, cambios) {
      Object.assign(estado.registros.find((r) => r.id === registro.id), cambios);
      Object.assign(registro, cambios);
      return registro;
    },
    async pendientesDeReintento(momento, limite) {
      return estado.registros
        .filter((r) => ['pendiente', 'fallido'].includes(r.estado) && r.proximo_reintento && r.proximo_reintento <= momento)
        .sort((a, b) => a.proximo_reintento - b.proximo_reintento)
        .slice(0, limite)
        .map((r) => ({ ...r }));
    },
    async reservarRegistro(id, momento, nuevoProximo) {
      const r = estado.registros.find((fila) => fila.id === id);
      if (!r || !['pendiente', 'fallido'].includes(r.estado) || !r.proximo_reintento || r.proximo_reintento > momento) {
        return false;
      }
      r.proximo_reintento = nuevoProximo;
      return true;
    },
    async buscarAlerta(id) {
      const alerta = estado.alertas.find((a) => a.id === id);
      return alerta ? { ...alerta } : null;
    },
    async contextoAlerta(alerta) {
      return { producto: productos[alerta.producto_id], lote: lotes[alerta.lote_id] };
    },
    async historial({ estado: estadoFiltro, alertaId, destinatario, desde, hasta, pagina, limite }) {
      let filas = [...estado.registros];
      if (estadoFiltro) filas = filas.filter((r) => r.estado === estadoFiltro);
      if (alertaId) filas = filas.filter((r) => r.alerta_id === alertaId);
      if (destinatario) filas = filas.filter((r) => r.destinatario === destinatario);
      if (desde) filas = filas.filter((r) => r.fecha_creacion >= desde);
      if (hasta) filas = filas.filter((r) => r.fecha_creacion <= hasta);
      filas.sort((a, b) => b.id - a.id);
      return { filas: filas.slice((pagina - 1) * limite, pagina * limite), total: filas.length };
    },
  };
  return repo;
}

/** Escenario típico: 3 roles, un usuario por rol (+ un encargado inactivo) y config inicial del SQL. */
function escenarioBase(extra = {}) {
  return crearRepoMemoria({
    roles: [
      { id: 1, nombre: 'Administrador' },
      { id: 2, nombre: 'Encargado de Inventario' },
      { id: 3, nombre: 'Encargado de Almacén' },
      { id: 4, nombre: 'Jefe de Ventas' },
    ],
    usuarios: [
      { id: 10, email: 'Admin@Empresa.com', rol_id: 1 },
      { id: 11, email: 'inventario@empresa.com', rol_id: 2 },
      { id: 12, email: 'almacen@empresa.com', rol_id: 3 },
      { id: 13, email: 'almacen2@empresa.com', rol_id: 3 },
      { id: 14, email: 'baja@empresa.com', rol_id: 3, activo: false },
      { id: 15, email: 'sin-correo-valido', rol_id: 3 },
      { id: 16, email: 'ventas@empresa.com', rol_id: 4 },
    ],
    productos: { 4: { codigo: 'P-004', nombre: 'Leche Entera 1L' } },
    lotes: { 12: { numero_lote: 'L-12', fecha_vencimiento: '2026-12-01', cantidad_actual: 20 } },
    ...extra,
  });
}

module.exports = { crearRepoMemoria, escenarioBase };
