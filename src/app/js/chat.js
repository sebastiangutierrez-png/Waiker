// ─────────────────────────────────────────────────────────────
//  Agromyss · utilidades compartidas del chat de LIA
//
//  El panel (index.html) y la página del asistente (agente.html)
//  comparten la MISMA conversación guardada: lo que se escribe en
//  uno aparece en el otro. Por eso la clave, el escapado y el
//  guardado viven aquí y no duplicados en cada página.
// ─────────────────────────────────────────────────────────────

const CHAT_STORAGE_KEY = "agromyss-lia-conversation";
const MAX_GUARDADOS = 40;

/** Roles que se aceptan al releer lo guardado. */
const ROLES = ["yo", "lia", "error"];

/** Escapa texto antes de interpolarlo en HTML. Obligatorio para todo lo que
 *  venga de la API: el agente genera texto libre y no debe poder inyectar marcado. */
export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Conversación guardada, o `porDefecto` si no hay nada utilizable. */
export function cargarConversacion(porDefecto = []) {
  try {
    const guardada = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]");
    if (!Array.isArray(guardada)) return porDefecto;
    const limpia = guardada.filter(
      (m) => m && ROLES.includes(m.rol) && typeof m.texto === "string"
    );
    return limpia.length ? limpia : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function guardarConversacion(mensajes) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(mensajes.slice(-MAX_GUARDADOS)));
  } catch {
    /* almacenamiento opcional */
  }
}
