/**
 * US-36 · QA-01 — Casos de prueba TC-01 a TC-07 de la auditoría de acciones.
 *
 * Es una prueba de integración REAL (HTTP + PostgreSQL). Solo corre contra una BD
 * aislada indicada con TEST_DB_* y se rehúsa a tocar Supabase.
 *
 *   TEST_DB_HOST=localhost TEST_DB_PORT=5432 TEST_DB_NAME=stockia_test \
 *   TEST_DB_USER=stockia_test TEST_DB_PASSWORD=stockia_test \
 *   node --test tests/integration/auditoria-us36.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { assertIsolated } = require('../helpers/testDb');

let aislado = true;
try { assertIsolated(); } catch { aislado = false; }

// La app lee DB_* al cargarse: se apuntan a la BD de pruebas ANTES de requerirla
// (dotenv no pisa variables ya definidas, así que el .env de desarrollo no interfiere).
if (aislado) {
  Object.assign(process.env, {
    DB_HOST: process.env.TEST_DB_HOST,
    DB_PORT: process.env.TEST_DB_PORT || '5432',
    DB_NAME: process.env.TEST_DB_NAME || 'stockia_test',
    DB_USER: process.env.TEST_DB_USER || 'stockia_test',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD || 'stockia_test',
    DB_SSL: process.env.TEST_DB_SSL || 'false',
    JWT_SECRET: process.env.JWT_SECRET || 'test-secret',
    // POST /usuarios exige la clave secreta de creación de usuarios.
    USER_CREATION_SECRET: process.env.USER_CREATION_SECRET || 'clave-qa-us36',
  });
}

const sufijo = Date.now().toString(36);
// La auditoría es inmutable (no se puede limpiar): cada corrida usa su propia entidad.
const ENT_FECHAS = `qa_fechas_${sufijo}`;
let ctx = {};

const esperarRegistro = async (donde, intentos = 40) => {
  // El middleware escribe cuando la respuesta ya terminó: se espera brevemente.
  for (let i = 0; i < intentos; i++) {
    const fila = await ctx.Auditoria.findOne({ where: donde, order: [['id', 'DESC']] });
    if (fila) return fila;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
};
const api = async (metodo, ruta, { token, body } = {}) => {
  const res = await fetch(`${ctx.base}/api${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, json, headers: res.headers };
};

test.before(async () => {
  if (!aislado) return;
  const { app } = require('../../src/app');
  const models = require('../../src/models');
  const { generarToken } = require('../../src/utils/jwt');
  const { sequelize, Usuario, Rol, Permiso, RolPermiso, Auditoria } = models;

  await sequelize.sync();
  await sequelize.query(fs.readFileSync(path.resolve(__dirname, '../../sql/auditoria_us36.sql'), 'utf8'));

  const permiso = async (codigo) => (await Permiso.findOrCreate({ where: { codigo }, defaults: { codigo, descripcion: codigo } }))[0];
  const rol = async (nombre, codigos) => {
    const [r] = await Rol.findOrCreate({ where: { nombre }, defaults: { nombre } });
    for (const c of codigos) {
      const p = await permiso(c);
      await RolPermiso.findOrCreate({ where: { rol_id: r.id, permiso_id: p.id }, defaults: { rol_id: r.id, permiso_id: p.id } });
    }
    return r;
  };
  const usuario = async (nombres, rolId) => Usuario.create({
    nombres, apellidos: 'QA', email: `${nombres.toLowerCase()}-${sufijo}@test.local`,
    password_hash: 'Test1234!', rol_id: rolId, activo: true,
  });

  const admin = await rol('Administrador', ['ver_auditoria', 'gestionar_productos']);
  const operador = await rol('Operador QA', ['gestionar_productos']);
  const uAdmin = await usuario('AdminQA', admin.id);
  const uOperador = await usuario('OperadorQA', operador.id);
  const uOtro = await usuario('OtroQA', operador.id);

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  ctx = {
    server, sequelize, Auditoria, Usuario, uAdmin, uOperador, uOtro,
    base: `http://127.0.0.1:${server.address().port}`,
    tAdmin: generarToken(uAdmin), tOperador: generarToken(uOperador), tOtro: generarToken(uOtro),
  };
});

test.after(async () => {
  if (!aislado) return;
  await new Promise((r) => ctx.server.close(r));
  await ctx.sequelize.close();
});

const dev = { skip: aislado ? false : 'requiere BD aislada (TEST_DB_HOST)' };

// ---------------------------------------------------------------- TC-01 / TC-03 / TC-04
test('TC-01/03/04 · crear, editar y eliminar quedan registrados con usuario, fecha y acción', dev, async () => {
  const antes = Date.now();
  const nombre = `Cat-${sufijo}`;

  const c = await api('POST', '/categorias', { token: ctx.tOperador, body: { nombre } });
  assert.equal(c.status, 201);
  const id = c.json.data.id;

  const crear = await esperarRegistro({ usuario_id: ctx.uOperador.id, accion: 'crear_categorias', entidad_id: id });
  assert.ok(crear, 'debe existir el registro de creación');
  assert.equal(crear.entidad, 'categorias');
  assert.equal(crear.detalle.cuerpo.nombre, nombre, 'el detalle conserva lo enviado');
  assert.ok(new Date(crear.fecha).getTime() >= antes - 1000, 'la fecha la fija el servidor (ahora)');

  const e = await api('PUT', `/categorias/${id}`, { token: ctx.tOperador, body: { descripcion: 'editada' } });
  assert.equal(e.status, 200);
  const editar = await esperarRegistro({ usuario_id: ctx.uOperador.id, accion: 'editar_categorias', entidad_id: id });
  assert.ok(editar, 'debe existir el registro de edición');
  assert.equal(editar.detalle.metodo, 'PUT');

  const d = await api('DELETE', `/categorias/${id}`, { token: ctx.tOperador });
  assert.equal(d.status, 200);
  const eliminar = await esperarRegistro({ usuario_id: ctx.uOperador.id, accion: 'eliminar_categorias', entidad_id: id });
  assert.ok(eliminar, 'debe existir el registro de eliminación');
});

test('TC-01 · una operación rechazada (404/400) no genera registro', dev, async () => {
  const antes = await ctx.Auditoria.count({ where: { usuario_id: ctx.uOtro.id } });
  const r = await api('PUT', '/categorias/99999999', { token: ctx.tOtro, body: { descripcion: 'x' } });
  assert.equal(r.status, 404);
  await new Promise((res) => setTimeout(res, 300));
  assert.equal(await ctx.Auditoria.count({ where: { usuario_id: ctx.uOtro.id } }), antes);
});

test('TC-01 · el detalle nunca guarda contraseñas ni tokens', dev, async () => {
  const secreto = 'Sup3r-Secreta!';
  const r = await api('POST', '/usuarios', {
    token: ctx.tAdmin,
    body: { nombres: 'Nuevo', apellidos: 'Usr', email: `nuevo-${sufijo}@test.local`, password: secreto, rol_id: ctx.uOtro.rol_id, dni: sufijo.slice(0, 8), clave_secreta: process.env.USER_CREATION_SECRET },
  });
  assert.ok([200, 201].includes(r.status), `creación de usuario respondió ${r.status}`);
  const fila = await esperarRegistro({ usuario_id: ctx.uAdmin.id, accion: 'crear_usuarios' });
  assert.ok(fila);
  assert.equal(fila.detalle.cuerpo.password, '[REDACTADO]');
  assert.equal(fila.detalle.cuerpo.clave_secreta, '[REDACTADO]');
  assert.ok(!JSON.stringify(fila.detalle).includes(secreto));
});

// ---------------------------------------------------------------- TC-02 / TC-07
test('TC-02/07 · la consulta devuelve los registros en orden cronológico', dev, async () => {
  const asc = await api('GET', `/auditoria?usuario_id=${ctx.uOperador.id}&orden=asc&limit=200`, { token: ctx.tAdmin });
  assert.equal(asc.status, 200);
  assert.ok(asc.json.data.length >= 3);
  const t = asc.json.data.map((x) => new Date(x.fecha).getTime());
  assert.deepEqual(t, [...t].sort((a, b) => a - b), 'asc = más antiguo primero');

  const desc = await api('GET', `/auditoria?usuario_id=${ctx.uOperador.id}&limit=200`, { token: ctx.tAdmin });
  const td = desc.json.data.map((x) => new Date(x.fecha).getTime());
  assert.deepEqual(td, [...td].sort((a, b) => b - a), 'por defecto, más reciente primero');
  assert.equal(desc.json.meta.orden, 'desc');

  const x = asc.json.data[0];
  for (const campo of ['usuario_id', 'usuario_nombre', 'usuario_email', 'accion', 'fecha', 'detalle']) {
    assert.ok(campo in x, `la respuesta incluye ${campo}`);
  }
  assert.match(x.usuario_nombre, /OperadorQA/);
  assert.ok(!JSON.stringify(desc.json).includes('password_hash'));
});

// ---------------------------------------------------------------- TC-05
test('TC-05 · filtra por usuario', dev, async () => {
  const r = await api('GET', `/auditoria?usuario_id=${ctx.uOperador.id}&limit=200`, { token: ctx.tAdmin });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.length > 0);
  assert.ok(r.json.data.every((x) => x.usuario_id === ctx.uOperador.id));
  const alias = await api('GET', `/auditoria?usuario=${ctx.uOperador.id}&limit=200`, { token: ctx.tAdmin });
  assert.equal(alias.json.meta.total, r.json.meta.total, 'alias ?usuario= equivale a ?usuario_id=');
});

test('TC-05 · filtra por fecha (día completo, hora de Perú, límites inclusivos)', dev, async () => {
  const mk = (iso) => ctx.Auditoria.create({ usuario_id: ctx.uOtro.id, accion: 'prueba_fecha', entidad: ENT_FECHAS, fecha: new Date(iso) });
  const a = await mk('2025-03-10T12:00:00-05:00');
  const b = await mk('2025-03-11T00:00:00-05:00'); // primer instante del 11
  const c = await mk('2025-03-11T23:59:59-05:00'); // último segundo del 11 (ya es 12 en UTC)
  const d = await mk('2025-03-12T00:00:00-05:00'); // ya es el día 12

  const dia11 = await api('GET', `/auditoria?entidad=${ENT_FECHAS}&fecha_desde=2025-03-11&fecha_hasta=2025-03-11&orden=asc`, { token: ctx.tAdmin });
  assert.equal(dia11.status, 200);
  assert.deepEqual(dia11.json.data.map((x) => x.id), [Number(b.id), Number(c.id)]);

  const desde = await api('GET', `/auditoria?entidad=${ENT_FECHAS}&fecha_desde=2025-03-11&orden=asc`, { token: ctx.tAdmin });
  assert.deepEqual(desde.json.data.map((x) => x.id), [Number(b.id), Number(c.id), Number(d.id)]);

  const hasta = await api('GET', `/auditoria?entidad=${ENT_FECHAS}&fecha_hasta=2025-03-10&orden=asc`, { token: ctx.tAdmin });
  assert.deepEqual(hasta.json.data.map((x) => x.id), [Number(a.id)]);

  const combinado = await api('GET', `/auditoria?entidad=${ENT_FECHAS}&usuario_id=${ctx.uOtro.id}&fecha_desde=2025-03-10&fecha_hasta=2025-03-12`, { token: ctx.tAdmin });
  assert.equal(combinado.json.meta.total >= 4, true);
  const vacio = await api('GET', `/auditoria?entidad=${ENT_FECHAS}&fecha_desde=2000-01-01&fecha_hasta=2000-01-02`, { token: ctx.tAdmin });
  assert.equal(vacio.json.data.length, 0);
});

test('TC-05 · rechaza filtros inválidos y pagina', dev, async () => {
  for (const q of ['fecha_desde=ayer', 'fecha_desde=2025-02-31', 'fecha_desde=2025-03-12&fecha_hasta=2025-03-01', 'usuario_id=abc', 'orden=random', 'limit=1000', 'page=0']) {
    const r = await api('GET', `/auditoria?${q}`, { token: ctx.tAdmin });
    assert.equal(r.status, 400, `?${q} debe ser 400`);
  }
  const p1 = await api('GET', '/auditoria?limit=2&page=1&orden=asc', { token: ctx.tAdmin });
  const p2 = await api('GET', '/auditoria?limit=2&page=2&orden=asc', { token: ctx.tAdmin });
  assert.equal(p1.json.data.length, 2);
  assert.ok(p1.json.meta.totalPages >= 2 && p1.json.meta.total >= 4);
  assert.ok(!p2.json.data.some((x) => p1.json.data.map((y) => y.id).includes(x.id)), 'páginas sin solapamiento');
});

test('GET /auditoria/filtros y /auditoria/:id', dev, async () => {
  const f = await api('GET', '/auditoria/filtros', { token: ctx.tAdmin });
  assert.equal(f.status, 200);
  assert.ok(f.json.data.entidades.includes('categorias'));
  assert.ok(f.json.data.usuarios.some((u) => u.id === ctx.uOperador.id && /OperadorQA/.test(u.nombre)));
  const lista = await api('GET', '/auditoria?limit=1', { token: ctx.tAdmin });
  const uno = await api('GET', `/auditoria/${lista.json.data[0].id}`, { token: ctx.tAdmin });
  assert.equal(uno.status, 200);
  assert.equal((await api('GET', '/auditoria/999999999', { token: ctx.tAdmin })).status, 404);
  assert.equal((await api('GET', '/auditoria/abc', { token: ctx.tAdmin })).status, 400);
});

test('seguridad de acceso · sin token 401, sin permiso ver_auditoria 403', dev, async () => {
  assert.equal((await api('GET', '/auditoria')).status, 401);
  assert.equal((await api('GET', '/auditoria', { token: ctx.tOperador })).status, 403);
});

// ---------------------------------------------------------------- TC-06
test('TC-06 · la API no permite modificar ni borrar registros (405)', dev, async () => {
  const { json } = await api('GET', '/auditoria?limit=1', { token: ctx.tAdmin });
  const id = json.data[0].id;
  const antes = await ctx.Auditoria.findByPk(id);
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = await api(m, `/auditoria/${id}`, { token: ctx.tAdmin, body: m === 'DELETE' ? undefined : { accion: 'hackeado' } });
    assert.equal(r.status, 405, `${m} debe ser 405`);
    assert.match(r.headers.get('allow'), /GET/);
  }
  assert.equal((await api('POST', '/auditoria', { token: ctx.tAdmin, body: { accion: 'falsa' } })).status, 405);
  const despues = await ctx.Auditoria.findByPk(id);
  assert.equal(despues.accion, antes.accion);
  assert.equal(await ctx.Auditoria.count({ where: { accion: 'falsa' } }), 0);
});

test('TC-06 · el modelo (ORM) rechaza update, save y destroy', dev, async () => {
  const fila = await ctx.Auditoria.findOne();
  await assert.rejects(() => ctx.Auditoria.update({ accion: 'x' }, { where: { id: fila.id } }), /solo lectura/);
  await assert.rejects(() => ctx.Auditoria.destroy({ where: { id: fila.id } }), /solo lectura/);
  await assert.rejects(() => ctx.Auditoria.destroy({ truncate: true }), /solo lectura/);
  fila.accion = 'cambiada';
  await assert.rejects(() => fila.save(), /solo lectura/);
  await assert.rejects(() => fila.destroy(), /solo lectura/);
});

test('TC-06 · la base de datos rechaza UPDATE, DELETE y TRUNCATE aunque se salte la aplicación', dev, async () => {
  const q = (sql) => ctx.sequelize.query(sql);
  await assert.rejects(() => q("UPDATE auditoria SET accion = 'manipulada'"), /solo lectura/);
  await assert.rejects(() => q('DELETE FROM auditoria'), /solo lectura/);
  await assert.rejects(() => q('TRUNCATE auditoria'), /solo lectura/);
  const [[{ n }]] = await q("SELECT COUNT(*)::int AS n FROM auditoria WHERE accion = 'manipulada'");
  assert.equal(n, 0);
});
