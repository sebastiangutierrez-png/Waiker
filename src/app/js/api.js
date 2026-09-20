// ─────────────────────────────────────────────────────────────
//  Cliente de API · Waiker
//
//  ⚠️  IMPORTANTE — NO PONER NINGÚN TOKEN EN ESTE ARCHIVO.
//
//  Waiker es una página estática: todo lo que esté aquí es visible
//  para cualquiera que abra las herramientas de desarrollo. Ningún
//  secreto (ni el del gateway de OpenClaw ni el del agent-bridge)
//  puede vivir en el navegador.
//
//  Por eso este cliente llama a rutas del MISMO ORIGEN (/api/...),
//  que resuelve el Worker de Cloudflare. El Worker guarda el secreto
//  del puente y hace de intermediario hacia el agente real:
//
//     navegador → Worker (guarda el secreto) → agent-bridge (nemoclaw) → agente OpenClaw
//
//  Ver worker/index.js y, del lado del servidor, worker/README.md
//  del proyecto (arquitectura de la API) para el resto de la cadena.
// ─────────────────────────────────────────────────────────────

/** Prefijo de las rutas del Worker. Mismo origen: sin CORS, sin credenciales. */
const BASE = "/api";

/** Corta cualquier petición que tarde demasiado. */
const TIMEOUT_MS = 60000; // turnos reales de 19-41 s; el Worker corta a 85 s

/**
 * Envuelve fetch con timeout y errores legibles.
 * @returns {Promise<any>} cuerpo JSON de la respuesta
 */
async function pedir(ruta, opciones = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(BASE + ruta, {
      ...opciones,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(opciones.headers || {}) }
    });

    if (!res.ok) {
      // Un 404 del hosting devuelve una página HTML: no sirve como detalle
      // y terminaba impresa tal cual en el chat.
      const esHtml = (res.headers.get("content-type") || "").includes("html");
      const detalle = esHtml ? "" : await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${detalle ? " · " + detalle.slice(0, 200) : ""}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`La petición superó ${TIMEOUT_MS / 1000} s sin respuesta.`);
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Pregunta libre al asistente LIA.
 *
 * Va sólo el mensaje nuevo, no el historial: el puente mantiene una sesión
 * de agente por identidad, así que la conversación previa ya la tiene él.
 * Lo guardado en el navegador es para repintar la página, no para el agente.
 *
 * @param {string} mensaje pregunta del usuario
 * @param {object} contexto estado actual del panel (lote y sensor seleccionados, etc.)
 * @returns {Promise<string>} respuesta del asistente
 */
export async function enviarMensaje(mensaje, contexto = {}) {
  const datos = await pedir("/chat", {
    method: "POST",
    body: JSON.stringify({ mensaje, contexto })
  });

  const texto = datos && typeof datos.respuesta === "string" ? datos.respuesta.trim() : "";
  if (!texto) throw new Error("La API respondió sin contenido.");
  return texto;
}

/**
 * Propuestas de acción generadas por el agente.
 *
 * Forma esperada: { propuestas: [{ id, titulo, lote, motivo, tono }] }
 * `tono` ∈ {"clay","leaf","wheat"} y decide el color del borde.
 *
 * @returns {Promise<Array>} lista de propuestas
 */
export async function obtenerPropuestas(contexto = {}) {
  const params = new URLSearchParams();
  if (contexto.cultivo) params.set("cultivo", contexto.cultivo);
  if (contexto.lote) params.set("lote", contexto.lote);

  const sufijo = params.toString() ? `?${params}` : "";
  const datos = await pedir(`/propuestas${sufijo}`);

  if (!datos || !Array.isArray(datos.propuestas)) {
    throw new Error("La API devolvió propuestas con un formato inesperado.");
  }
  return datos.propuestas;
}

/**
 * Registra la decisión humana sobre una propuesta.
 * Se llama al pulsar Aprobar / Descartar.
 *
 * @param {string} id identificador de la propuesta
 * @param {"aprobada"|"descartada"} decision
 */
export async function registrarDecision(id, decision) {
  return pedir("/propuestas/decision", {
    method: "POST",
    body: JSON.stringify({ id, decision })
  });
}

/**
 * Lecturas de sensores de la hoja del formulario, ya parseadas por el Worker.
 *
 * El navegador no habla con Google: la URL de la hoja vive sólo en el Worker
 * (una copia, no dos) y allí se cachea, así que abrir el panel no dispara una
 * descarga del CSV por pestaña.
 *
 * @returns {Promise<Array|null>} sensores, o null si no hay hoja o falló
 */
export async function obtenerSensores() {
  try {
    const datos = await pedir("/sensores");
    return Array.isArray(datos?.sensores) && datos.sensores.length ? datos.sensores : null;
  } catch (err) {
    console.warn("No se pudieron leer los sensores:", err.message);
    return null;
  }
}

/**
 * Comprueba si hay camino completo hasta el agente.
 *
 * No basta con que responda el Worker: /salud le pregunta al puente, porque
 * un Worker sano con nemoclaw caído seguiría diciendo "conectada" mientras
 * cada pregunta falla.
 *
 * @returns {Promise<boolean>}
 */
export async function hayConexion() {
  try {
    const datos = await pedir("/salud");
    return datos?.puente === true;
  } catch {
    return false;
  }
}
