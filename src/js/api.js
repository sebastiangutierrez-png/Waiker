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
const TIMEOUT_MS = 20000;

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
      const detalle = await res.text().catch(() => "");
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
 * @param {{rol: string, texto: string}[]} historial conversación previa
 * @param {object} contexto estado actual del panel (lote y sensor seleccionados, etc.)
 * @returns {Promise<string>} respuesta del asistente
 */
export async function enviarMensaje(historial, contexto = {}) {
  const datos = await pedir("/chat", {
    method: "POST",
    body: JSON.stringify({
      mensajes: historial.map((m) => ({ rol: m.rol, texto: m.texto })),
      contexto
    })
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
 * Comprueba si el Worker intermediario está disponible.
 * Permite mostrar "modo prototipo" sin lanzar errores en consola.
 *
 * @returns {Promise<boolean>}
 */
export async function hayConexion() {
  try {
    await pedir("/salud");
    return true;
  } catch {
    return false;
  }
}
