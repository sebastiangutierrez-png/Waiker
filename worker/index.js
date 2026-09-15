// ─────────────────────────────────────────────────────────────
//  Worker intermediario de Waiker
//
//  Único punto del sistema que conoce el BRIDGE_TOKEN.
//
//     navegador → ESTE Worker → api.agromyss.com/agent/chat → agent-bridge:7353 → agente OpenClaw
//
//  El navegador nunca ve el token ni llama a api.agromyss.com
//  directamente. El agent-bridge (nemoclaw:7353) es quien de verdad
//  invoca al agente; este Worker sólo reenvía con su propio secreto,
//  distinto del token de operador del gateway.
//
//  ── Configuración ──────────────────────────────────────────
//  Secreto (NUNCA en el repositorio):
//      wrangler secret put BRIDGE_TOKEN
//
//  Variables (wrangler.toml, no son sensibles):
//      BRIDGE_URL            por defecto https://api.agromyss.com/agent
//      CF_ACCESS_TEAM_DOMAIN  ej. "midominio.cloudflareaccess.com" (opcional)
//      CF_ACCESS_AUD          Application Audience Tag de Access (opcional)
//
//  Rutas privadas (/app y /api/*): el Worker exige un JWT de Access
//  válido aunque Access ya esté delante. Si Access se configura mal
//  (una ruta de más en Bypass, un dominio nuevo sin proteger), esto
//  sigue sin servir datos ni llamar al puente. Sin CF_ACCESS_* → 503,
//  nunca "anon". La portada (/) y css/assets son públicos.
// ─────────────────────────────────────────────────────────────

// El mismo parser que usa la web para la hoja; wrangler lo empaqueta.
import { parseCSV, indexarEncabezados } from "../src/app/js/csv.js";

const TIMEOUT_MS = 85000;     // por debajo del límite de borde de Cloudflare (~100s);
                               // por encima del timeout interno del puente (120s lo excede,
                               // pero el turno más lento medido fue 25s — hay margen amplio)
const MAX_CUERPO = 32 * 1024; // 32 KB de entrada como máximo
const MAX_MENSAJE = 4000;     // el puente también lo limita; recortamos aquí primero

/** Respuesta JSON breve. */
const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const error = (mensaje, estado = 500) => json({ error: mensaje }, estado);

// ── Cloudflare Access: verificación de JWT ──────────────────────
//
// La cabecera Cf-Access-Authenticated-User-Email es SÓLO informativa:
// cualquiera que hable directo con el Worker (sin pasar por Access)
// podría falsificarla. La prueba real es el JWT firmado en
// Cf-Access-Jwt-Assertion, verificado aquí contra las claves públicas
// de tu equipo de Access. Nunca leemos el email de la cabecera sin
// antes validar el JWT.

let cacheJwks = null; // { claves: Map<kid, CryptoKey>, expira: number } — vive mientras dure el isolate

async function obtenerJwks(env) {
  if (cacheJwks && cacheJwks.expira > Date.now()) return cacheJwks.claves;

  const url = `https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudieron obtener las claves de Access (${res.status}).`);
  const { keys = [] } = await res.json();

  const claves = new Map();
  for (const jwk of keys) {
    if (jwk.kty !== "RSA" || !jwk.kid) continue;
    const clave = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    claves.set(jwk.kid, clave);
  }

  cacheJwks = { claves, expira: Date.now() + 10 * 60 * 1000 }; // 10 min
  return claves;
}

function base64UrlADatos(segmento) {
  const b64 = segmento.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Verifica el JWT de Cloudflare Access y devuelve el email autenticado,
 * o null si Access no está configurado, no hay JWT, o la verificación falla.
 * Nunca lanza: el enrutador convierte null en 401/403.
 */
async function verificarAccess(request, env) {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;

  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return null;

  const partes = jwt.split(".");
  if (partes.length !== 3) return null;
  const [cabeceraB64, cargaB64, firmaB64] = partes;

  try {
    const cabecera = JSON.parse(new TextDecoder().decode(base64UrlADatos(cabeceraB64)));
    const carga = JSON.parse(new TextDecoder().decode(base64UrlADatos(cargaB64)));

    if (cabecera.alg !== "RS256" || !cabecera.kid) return null;

    const ahora = Math.floor(Date.now() / 1000);
    if (typeof carga.exp !== "number" || carga.exp < ahora) return null;
    if (typeof carga.iat === "number" && carga.iat > ahora + 60) return null;

    const aud = Array.isArray(carga.aud) ? carga.aud : [carga.aud];
    if (!aud.includes(env.CF_ACCESS_AUD)) return null;

    const issEsperado = `https://${env.CF_ACCESS_TEAM_DOMAIN}`;
    if (carga.iss !== issEsperado) return null;

    if (!carga.email || typeof carga.email !== "string") return null;

    const claves = await obtenerJwks(env);
    const clave = claves.get(cabecera.kid);
    if (!clave) return null;

    const datosFirmados = new TextEncoder().encode(`${cabeceraB64}.${cargaB64}`);
    const firma = base64UrlADatos(firmaB64);
    const valido = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", clave, firma, datosFirmados
    );

    return valido ? carga.email : null;
  } catch (err) {
    console.error("access: verificación fallida", err?.message || err);
    return null;
  }
}

// ── puente ───────────────────────────────────────────────────

/** Llama al agent-bridge con su token propio; nunca con el del gateway. */
async function llamarPuente(env, mensaje, identidad) {
  const base = (env.BRIDGE_URL || "https://api.agromyss.com/agent").replace(/\/+$/, "");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.BRIDGE_TOKEN}`
      },
      body: JSON.stringify({ mensaje, identidad })
    });

    if (!res.ok) {
      // El detalle del puente puede incluir rutas internas: al log, no al navegador.
      const detalle = await res.text().catch(() => "");
      console.error("puente", res.status, detalle.slice(0, 500));
      throw new Error(`El agente respondió ${res.status}.`);
    }

    const datos = await res.json();
    const texto = datos?.respuesta;
    if (typeof texto !== "string" || !texto.trim()) {
      throw new Error("El agente respondió sin contenido.");
    }
    return texto.trim();
  } catch (err) {
    if (err.name === "AbortError") throw new Error("El agente tardó demasiado.");
    throw err;
  } finally {
    clearTimeout(t);
  }
}

/** Proxy JSON estrecho para el registro compartido de propuestas. */
async function llamarPuenteJson(env, ruta, metodo, cuerpo, actor) {
  const base = (env.BRIDGE_URL || "https://api.agromyss.com/agent").replace(/\/+$/, "");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${env.BRIDGE_TOKEN}`,
        "x-agromyss-actor": actor,
        ...(cuerpo ? { "content-type": "application/json" } : {})
      },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {})
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("propuestas", res.status, datos?.error || "respuesta no válida");
      return json(datos?.error ? { error: datos.error, propuesta: datos.propuesta } : { error: "No se pudo actualizar la propuesta." }, res.status);
    }
    return json(datos);
  } catch (err) {
    if (err.name === "AbortError") return error("El registro de propuestas tardó demasiado.", 504);
    throw err;
  } finally {
    clearTimeout(t);
  }
}

/** Lee y valida el cuerpo JSON de la petición. */
async function leerJson(request) {
  const bruto = await request.text();
  if (bruto.length > MAX_CUERPO) throw new Error("Petición demasiado grande.");
  try {
    return JSON.parse(bruto || "{}");
  } catch {
    throw new Error("JSON inválido.");
  }
}

// ── hoja de sensores ─────────────────────────────────────────
//
// Formulario → Google Sheets → CSV publicado. Se lee en cada turno para
// que el agente vea lo mismo que el panel en ese momento. El puente
// rechaza mensajes de más de MAX_MENSAJE, así que va compacta: sólo las
// filas con lectura.

const MAX_SENSORES = 1500; // caracteres de MAX_MENSAJE reservados para la hoja
const MAX_PISTA = 400;     // el contexto del panel lo manda el navegador: se acota

/** Lecturas de la hoja en texto compacto, o null si no hay hoja o falló. */
async function contextoSensores(env) {
  if (!env.SHEET_CSV_URL) return null;
  try {
    const res = await fetch(env.SHEET_CSV_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const [cabecera = [], ...filas] = parseCSV(await res.text());
    const col = indexarEncabezados(cabecera);
    const [iId, iLugar, iTipo, iValor, iUnidad, iEstado, iFecha] =
      ["id", "lugar", "tipo", "valor", "unidad", "estado", "ultima_actualizacion"].map(col);
    if (iId === -1 || iValor === -1) return null;

    const c = (fila, i) => (i === -1 ? "" : String(fila[i] ?? "").trim());
    const lineas = filas.filter((f) => c(f, iValor)).map((f) => {
      const cuando = c(f, iFecha) ? `, ${c(f, iFecha)}` : "";
      return `${c(f, iId)} ${c(f, iLugar)} · ${c(f, iTipo)}: ${c(f, iValor)}${c(f, iUnidad)} (${c(f, iEstado) || "ok"}${cuando})`;
    });
    const sinLectura = filas.length - lineas.length;

    let texto = lineas.length ? lineas.join("\n") : "Ningún sensor tiene lectura anotada todavía.";
    if (lineas.length && sinLectura) texto += `\n(${sinLectura} sensores más sin lectura anotada)`;
    // ponytail: recorte duro; si la hoja crece mucho, pasarla como archivo del workspace del agente.
    return texto.slice(0, MAX_SENSORES);
  } catch (err) {
    // Sin hoja el chat sigue funcionando; sólo pierde este contexto.
    console.error("hoja de sensores", err?.message || err);
    return null;
  }
}

// ── /api/chat ────────────────────────────────────────────────
//
// El puente mantiene el historial por su cuenta (una sesión de agente
// por identidad), así que sólo hace falta el último mensaje del
// usuario, no la conversación completa. El cliente sigue mandando
// `mensajes` con todo el historial local — aquí sólo se usa el último.

async function manejarChat(request, env, email) {
  const { mensajes = [], contexto = {} } = await leerJson(request);

  const ultimo = [...mensajes].reverse().find(
    (m) => m && m.rol === "yo" && typeof m.texto === "string" && m.texto.trim()
  );
  if (!ultimo) return error("Falta el mensaje.", 400);

  const pista = [
    contexto.lote && `Lote seleccionado: ${contexto.lote}.`,
    contexto.sensor && `Sensor seleccionado: ${contexto.sensor}.`,
    contexto.cultivo && contexto.cultivo !== "Todos" && `Filtro de cultivo: ${contexto.cultivo}.`,
    contexto.rango && `Rango de tiempo: ${contexto.rango}.`
  ].filter(Boolean).join(" ").slice(0, MAX_PISTA);

  const sensores = await contextoSensores(env);
  const extra =
    (pista ? `\n\n[Contexto del panel: ${pista}]` : "") +
    (sensores ? `\n\n[Lecturas de sensores de la finca (hoja del formulario, leída ahora):\n${sensores}]` : "");

  // El puente devuelve 400 por encima de MAX_MENSAJE: se recorta la pregunta, no el contexto.
  const mensaje = String(ultimo.texto).slice(0, MAX_MENSAJE - extra.length) + extra;

  const respuesta = await llamarPuente(env, mensaje, email);
  return json({ respuesta });
}

async function manejarPropuestas(env, email) {
  return llamarPuenteJson(env, "/propuestas", "GET", null, email);
}

async function manejarDecisionPropuesta(request, env, email) {
  const { id, decision } = await leerJson(request);
  if (typeof id !== "string" || !["aprobada", "descartada"].includes(decision)) {
    return error("Decisión inválida.", 400);
  }
  return llamarPuenteJson(env, "/propuestas/decision", "POST", { id, decision }, email);
}

/**
 * 403 con cara: la portada del 403 es pública (/403.html), así que servirla
 * no filtra nada. Es el único estático que se toca en una denegación.
 */
async function paginaSinAcceso(env, url) {
  const cabeceras = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
  if (!env.ASSETS) return new Response("No autorizado.", { status: 403, headers: cabeceras });
  const res = await env.ASSETS.fetch(new Request(new URL("/403.html", url)));
  return new Response(res.body, { status: 403, headers: cabeceras });
}

/** El panel y la API: nada aquí se sirve sin JWT de Access verificado. */
const esPrivada = (ruta) => ruta === "/app" || ruta.startsWith("/app/") || ruta.startsWith("/api/");

// ── enrutador ────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Enlaces viejos, de antes de mover el panel a /app/.
    if (url.pathname === "/agente.html") {
      return Response.redirect(new URL("/app/agente.html", url), 301);
    }

    // Falla cerrado: Access delante es la primera barrera, esto la segunda.
    // Para que /app/* llegue aquí y no lo sirva ASSETS directamente hace
    // falta run_worker_first en wrangler.toml.
    let email = null;
    if (esPrivada(url.pathname)) {
      if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
        return error("Cloudflare Access no está configurado en el Worker.", 503);
      }
      email = await verificarAccess(request, env);
      if (!email) {
        return url.pathname.startsWith("/api/")
          ? error("No autorizado.", 401)
          : await paginaSinAcceso(env, url);
      }
    }

    // Todo lo que no sea /api/ es la web estática.
    if (!url.pathname.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("No hay binding ASSETS configurado.", { status: 500 });
    }

    if (!env.BRIDGE_TOKEN) {
      return error("Falta el secreto BRIDGE_TOKEN en el Worker.", 503);
    }

    try {
      const ruta = url.pathname.replace(/\/+$/, "");

      if (ruta === "/api/salud") {
        // No comprueba el puente en sí (esa ruta no está publicada por
        // Caddy); confirma que el Worker tiene lo necesario para intentarlo.
        return json({ ok: true });
      }

      if (ruta === "/api/chat") {
        if (request.method !== "POST") return error("Usa POST.", 405);
        return await manejarChat(request, env, email);
      }

      if (ruta === "/api/propuestas") {
        if (request.method !== "GET") return error("Usa GET.", 405);
        return await manejarPropuestas(env, email);
      }

      if (ruta === "/api/propuestas/decision") {
        if (request.method !== "POST") return error("Usa POST.", 405);
        return await manejarDecisionPropuesta(request, env, email);
      }

      return error("Ruta no encontrada.", 404);
    } catch (err) {
      console.error("api", err?.stack || err);
      // Nunca devolvemos el error crudo: podría incluir cabeceras internas.
      return error(err?.message || "Error interno.", 500);
    }
  }
};
