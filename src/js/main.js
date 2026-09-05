import { enviarMensaje, hayConexion, obtenerPropuestas, registrarDecision } from "./api.js";
import { HILO_DEMO, REGISTRO_DEMO, TAREAS, TAREAS_HECHAS, SENSORES, COLOR_SENSOR } from "./data.js";
import { iniciarSincronizacionSensores } from "./sheetSensores.js";
import { iniciarSincronizacionClima } from "./climaApi.js";
import { renderFinca, renderLotes, renderMapaLotes } from "./finca.js";

const navButtons = document.querySelectorAll(".csb-nav [data-page]");
const pages = document.querySelectorAll(".page");

/**
 * Hilo de propuestas del agente + registro de decisiones, para la pestaña
 * Asistente ("Acciones sugeridas" / "Rastreo de decisiones").
 *
 * TODO: cuando exista un endpoint real para propuestas/historial, éste es
 * el punto a cambiar — reemplazar HILO_DEMO/REGISTRO_DEMO (ver data.js) por
 * la respuesta de la API. El resto del archivo sólo lee hilo()/decisiones,
 * así que no debería hacer falta tocar nada más.
 */
let hilo = [];
const decisiones = {};
let propuestaSeleccionada = null;
let origenPropuestas = "muestra";

function cargarHilo() {
  hilo = HILO_DEMO.map((h, i) => ({ ...h, ancla: "acc-" + i }));
}

function acciones() {
  return hilo.filter((h) => h.tipo === "accion");
}

function modoDe(h) {
  return decisiones[h.ancla] || h.modo;
}

async function decidir(ancla, valor) {
  if (origenPropuestas === "api") {
    try {
      await registrarDecision(ancla, valor);
      await sincronizarPropuestas();
    } catch (err) {
      console.error("No se pudo registrar la decisión de la propuesta.", err);
      const aviso = document.querySelector(".proposal-demo-notice");
      if (aviso) aviso.innerHTML = '<i class="ph ph-warning"></i><span>No se pudo guardar la decisión. La propuesta no fue modificada.</span>';
    }
    return;
  }
  decisiones[ancla] = valor;
  renderAcciones();
  renderTimeline();
  renderSugerencias();
  renderResumenPropuestas();
  renderDetallePropuesta();
}
window.decidir = decidir;

function abrirPropuesta(ancla) {
  propuestaSeleccionada = ancla;
  openPage("propuestas");
  renderDetallePropuesta();
}
window.abrirPropuesta = abrirPropuesta;

function tonoDeImportancia(importancia) {
  return importancia === "high" ? "clay" : importancia === "medium" ? "wheat" : "leaf";
}

function modoDeEstado(estado) {
  return estado === "pending_approval" ? "pendiente" : estado === "approved" ? "aprobada" : estado === "rejected" ? "descartada" : "hecho";
}

async function sincronizarPropuestas() {
  try {
    const propuestas = await obtenerPropuestas();
    if (!propuestas.length) return;
    origenPropuestas = "api";
    hilo = propuestas.map((p) => ({
      tipo: "accion", ancla: p.id, modo: modoDeEstado(p.estado), tag: p.categoria || "revisión",
      tono: tonoDeImportancia(p.importancia), lead: p.titulo, texto: p.descripcion || p.motivo || "Sin descripción.",
      impacto: p.faltantes || p.resultado || "Requiere revisión humana", chips: p.lote ? [{ kind: "lote", id: p.lote }] : []
    }));
    renderAcciones();
    renderTimeline();
    renderSugerencias();
    renderResumenPropuestas();
    renderDetallePropuesta();
    const aviso = document.querySelector(".proposal-demo-notice");
    if (aviso) aviso.innerHTML = '<i class="ph ph-link"></i><span>Propuestas sincronizadas con Waykao. Aprobar o descartar actualiza el registro compartido; no ejecuta trabajo de campo.</span>';
  } catch (err) {
    // La muestra local permite explorar el diseño sin que un fallo temporal
    // de conectividad se confunda con una decisión real.
    console.warn("Propuestas remotas no disponibles; se muestra la muestra local.", err);
  }
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openPage(button.dataset.page);
  });
});

// "Ver todas" en la tarjeta Tareas del Resumen también navega, pero no es
// parte del sidebar así que no debe recibir el estado "active" de la nav.
document.querySelectorAll("[data-page]:not(.csb-nav [data-page])").forEach((el) => {
  if (el.closest(".csb-nav")) return;
  el.addEventListener("click", () => openPage(el.dataset.page));
});

function openPage(pageId) {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  pages.forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelector(".csb-main")?.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSensoresPagina() {
  const cards = document.getElementById("sensorCards");
  // Si SENSORES está vacío (p.ej. una sincronización llegó a mitad de una
  // edición en la hoja y trajo cero filas válidas), no se borra lo que ya
  // había pintado — mejor mostrar datos viejos que una página en blanco.
  if (!cards || !SENSORES.length) return;

  const porLugar = new Map();
  SENSORES.forEach((s) => {
    if (!porLugar.has(s.lugar)) porLugar.set(s.lugar, []);
    porLugar.get(s.lugar).push(s);
  });

  cards.innerHTML = [...porLugar.entries()].map(([lugar, sensores]) => `
    <div class="sensor-lote-card">
      <h3>${escapeHtml(lugar)}</h3>
      ${sensores.map((s) => `
        <div class="sensor-metric-row" title="${escapeHtml(s.id)} · ${escapeHtml(s.estado)}">
          <span class="sensor-dot" style="background:${COLOR_SENSOR[s.estado]}"></span>
          <span class="sensor-tipo">${escapeHtml(s.tipo || s.id)}</span>
          <span class="sensor-valor">${s.valor}${escapeHtml(s.unidad)}</span>
        </div>`).join("")}
    </div>`).join("");
}

function marcarSincronizado() {
  const pill = document.getElementById("sensoresEstadoSync");
  if (pill) pill.textContent = "Sincronizado con la hoja";
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (el && valor !== undefined && valor !== null && valor !== "") el.textContent = valor;
}

function renderPronostico({ actual, horas, dias }) {
  if (actual) {
    setTexto("climaHoy", `${actual.temp}°C · ${actual.condicion}`);
    setTexto("climaVentana", actual.ventana ? `Ventana recomendada de aplicaciones: ${actual.ventana}` : undefined);
    setTexto("climaLluviaAviso", actual.notaLluvia);
    setTexto("climaLluviaProb", `${actual.lluviaProb}%`);
    setTexto("climaActualizado", `Actualizado ${actual.actualizado}`);
    setTexto("climaTempCard", `${actual.temp}°C`);
    setTexto("climaHumCard", `${actual.humedad}%`);
    setTexto("climaVientoCard", `${actual.vientoDir} · ${actual.vientoKmh} km/h`);
    setTexto("climaLluviaCard", actual.lluviaTexto);
    setTexto("climaPluvCard", `${actual.pluviometriaMm} mm`);

    // Mismo dato en la tarjeta compacta de Clima del Resumen — antes era
    // texto fijo, nunca conectado al pronóstico real.
    setTexto("homeAverageTemperature2", `${actual.temp}°C`);
    setTexto("homeCondicion", actual.condicion);
  }

  if (horas.length) {
    const franja = document.getElementById("climaStrip");
    if (franja) {
      franja.innerHTML = horas.map((h, i) => `
        <div class="clima-chip ${i === 0 ? "active" : ""}">
          <strong>${escapeHtml(h.hora)}</strong>
          <span>${h.temp}°</span>
          <small>${escapeHtml(h.nota)}</small>
        </div>`).join("");
    }
  }

  if (dias?.length) {
    const franja = document.getElementById("homeClimaDias");
    if (franja) {
      franja.innerHTML = dias.map((d) => `
        <div class="c-clima-dia">${escapeHtml(d.etiqueta)}<strong>${d.max}°</strong>${d.min}°</div>`).join("");
    }
  }
}

function getReply(text) {
  const value = text.toLowerCase();

  if (value.includes("hoy") || value.includes("tarea") || value.includes("plan")) {
    return "Plan sugerido: 1) revisar humedad del Lote B, 2) tomar fotos del Lote C, 3) registrar lluvia real, 4) validar fertilizante, 5) no hacer aplicación foliar si llueve en la tarde.";
  }

  if (value.includes("riesgo") || value.includes("alerta")) {
    return "Riesgos activos: humedad baja en Lote B, posible lluvia en la tarde y fotos pendientes para diagnóstico fitosanitario en Lote C.";
  }

  if (value.includes("lote") || value.includes("mango")) {
    return "El Lote B de mango está marcado en atención por humedad baja. La recomendación demo es revisar suelo manualmente antes de programar riego o fertilización.";
  }

  if (value.includes("whatsapp") || value.includes("mensaje")) {
    return "Mensaje sugerido: “Buenos días. Por favor revise humedad del Lote B antes de las 8:00 a.m. y reporte foto del suelo. No programar aplicación foliar si se confirma lluvia.”";
  }

  if (value.includes("trabajador") || value.includes("equipo")) {
    return "Asignación demo: Juan Carlos revisa Lote B; Daniel sube fotos del Lote C; María registra lluvia real y confirma cierre de tarea pendiente.";
  }

  if (value.includes("resumen")) {
    return "Resumen ejecutivo: la finca está operativa, con riesgo fitosanitario medio. El principal foco es Lote B por humedad baja y posible lluvia que afecta labores foliares.";
  }

  return "Respuesta demo: en la versión real responderé con datos de OpenCloud, documentos agronómicos, clima, fotos, tareas y trazabilidad completa.";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInlineMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(value) {
  const escaped = escapeHtml(value);
  const lines = escaped.split("\n");
  let html = "";
  let inList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isListItem = /^[-*]\s+/.test(trimmed);

    if (isListItem) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      const item = trimmed.replace(/^[-*]\s+/, "");
      html += `<li>${formatInlineMarkdown(item)}</li>`;
      return;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    if (!trimmed) {
      html += "<br>";
      return;
    }

    html += `${formatInlineMarkdown(line)}<br>`;
  });

  if (inList) {
    html += "</ul>";
  }

  return html.replace(/<br>$/u, "");
}

/** Refleja el estado real de conexión con el agente en la pestaña Asistente. */
function actualizarEstadoAgente(conectado) {
  const estado = document.querySelector(".agent-status");
  if (estado) {
    estado.innerHTML = conectado
      ? `<span class="status-dot"></span> Conectada con el agente`
      : `<span class="status-dot"></span> Sin conexión — respuestas de muestra`;
  }
}

// ═══════════ panel LIA (sidebar derecho) ═══════════

const CHAT_STORAGE_KEY = "agromyss-lia-conversation";
const MAX_SIDEBAR_CHARS = 180;
const liaHistorial = cargarConversacion();
let liaOcupado = false;

function cargarConversacion() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]");
    return Array.isArray(guardada) ? guardada.filter((m) => m && (m.rol === "yo" || m.rol === "lia" || m.rol === "error") && typeof m.texto === "string") : [];
  } catch {
    return [];
  }
}

function guardarConversacion() {
  try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(liaHistorial.slice(-40))); } catch { /* almacenamiento opcional */ }
}

function textoCorto(texto, limite = MAX_SIDEBAR_CHARS) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  return limpio.length > limite ? `${limpio.slice(0, limite).trimEnd()}…` : limpio;
}

function renderSidebarLog() {
  const log = document.getElementById("liaLog");
  if (!log) return;
  log.innerHTML = liaHistorial.slice(-4).reverse().map((m) => `
    <div class="lia-log-entry">
      <span class="lia-log-role">${m.rol === "yo" ? "Tú" : m.rol === "error" ? "Modo demo" : "LIA"}</span>
      <span title="${escapeHtml(m.texto)}">${escapeHtml(textoCorto(m.texto))}</span>
    </div>`).join("");
}

function iconoSugerencia(tono) {
  return tono === "clay" ? "ph-warning" : tono === "leaf" ? "ph-calendar-check" : "ph-cloud-rain";
}

async function preguntarLia(prompt) {
  const insight = document.getElementById("liaInsight");
  const log = document.getElementById("liaLog");
  const input = document.getElementById("chatInput");
  const send = document.getElementById("chatSend");
  const connection = document.getElementById("liaConnection");
  if (!insight || liaOcupado) return;

  liaOcupado = true;
  insight.innerHTML = '<span class="csb-lia-insight-label"><i class="ph ph-spinner lia-spin"></i> LIA está revisando</span><span class="csb-lia-loading-lines"><i></i><i></i><i></i></span>';
  if (input) input.disabled = true;
  if (send) {
    send.disabled = true;
    send.innerHTML = '<i class="ph ph-spinner lia-spin"></i>';
  }
  if (connection) connection.innerHTML = '<i class="csb-lia-connection-dot is-thinking"></i><span>Procesando pregunta…</span>';
  liaHistorial.push({ rol: "yo", texto: prompt });
  guardarConversacion();
  renderSidebarLog();

  try {
    const reply = await enviarMensaje(liaHistorial, {});
    liaHistorial.push({ rol: "lia", texto: reply });
    guardarConversacion();
    insight.innerHTML = `<span class="csb-lia-insight-label"><i class="ph ph-sparkle"></i> Respuesta de LIA</span><span>${escapeHtml(textoCorto(reply))}</span>`;
    renderSidebarLog();
    actualizarEstadoAgente(true);
    if (connection) connection.innerHTML = '<i class="csb-lia-connection-dot"></i><span>Conectada al agente</span>';
  } catch (error) {
    const fallback = getReply(prompt);
    liaHistorial.push({ rol: "lia", texto: fallback });
    guardarConversacion();
    insight.innerHTML = `<span class="csb-lia-insight-label"><i class="ph ph-sparkle"></i> Respuesta de LIA</span><span>${escapeHtml(textoCorto(fallback))}</span>`;
    renderSidebarLog();
    actualizarEstadoAgente(false);
    if (connection) connection.innerHTML = '<i class="csb-lia-connection-dot is-error"></i><span>Respuesta de muestra</span>';
  } finally {
    liaOcupado = false;
    renderSugerencias();
    if (input) input.disabled = false;
    if (send) {
      send.disabled = false;
      send.innerHTML = '<i class="ph ph-arrow-up"></i>';
    }
  }
}

function enviarPreguntaLia() {
  const input = document.getElementById("chatInput");
  if (!input) return;
  const texto = input.value.trim();
  if (!texto || liaOcupado) return;
  input.value = "";
  preguntarLia(texto);
}

document.getElementById("liaChatForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  enviarPreguntaLia();
});
document.getElementById("chatInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    enviarPreguntaLia();
  }
});

function renderSugerencias() {
  const cont = document.getElementById("liaSugerencias");
  if (!cont) return;

  const prioridad = {
    clay: ["Prioridad alta", "var(--danger)"],
    wheat: ["Prioridad media", "var(--gold)"],
    leaf: ["Prioridad baja", "var(--olive)"],
  };

  const pendientes = acciones().filter((h) => modoDe(h) === "pendiente");
  const visibles = liaHistorial.some((m) => m.rol === "yo") ? pendientes.slice(0, 2) : pendientes;
  const contador = document.getElementById("liaSuggestionCount");
  if (contador) contador.textContent = visibles.length;
  cont.innerHTML = visibles.length
    ? visibles.map((h) => {
      const [texto, color] = prioridad[h.tono] || prioridad.wheat;
      return `
        <button type="button" class="csb-sug" data-propuesta="${escapeHtml(h.ancla)}" aria-label="Ver propuesta: ${escapeHtml(h.lead)}">
          <span class="csb-sug-icon" style="background:${color}"><i class="ph ${iconoSugerencia(h.tono)}"></i></span>
          <div>
            <strong>${escapeHtml(h.lead)}</strong>
            <em style="color:${color}">${texto}</em>
          </div>
          <i class="ph ph-arrow-up-right csb-sug-arrow"></i>
        </button>`;
    }).join("")
    : `<div class="csb-sug csb-sug-empty"><span class="csb-sug-icon" style="background:var(--olive)"><i class="ph ph-check"></i></span><div><strong>Sin sugerencias pendientes.</strong><em>Todo está al día</em></div></div>`;
}

renderSidebarLog();

document.getElementById("liaSugerencias")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-propuesta]");
  if (button) {
    abrirPropuesta(button.dataset.propuesta);
  }
});

// ═══════════ Resumen: listas de sensores y tareas ═══════════

function renderResumenSensores() {
  const cont = document.getElementById("resumenSensores");
  if (!cont || !SENSORES.length) return;
  cont.innerHTML = SENSORES.slice(0, 4).map((s) => `
    <div class="c-list-row">
      <div><strong>${escapeHtml(s.lugar)}</strong><span>${escapeHtml(s.tipo || s.id)}</span></div>
      <span style="color:${COLOR_SENSOR[s.estado]};font-weight:800">${s.valor}${s.unidad}</span>
    </div>`).join("");
}

function renderTareas(containerId, limite) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  const lista = limite ? TAREAS.slice(0, limite) : TAREAS;
  cont.innerHTML = lista.map(([etiqueta, lote, horas], i) => `
    <div class="c-list-row">
      <div>
        <strong style="${TAREAS_HECHAS[i] ? "text-decoration:line-through;color:var(--muted)" : ""}">${escapeHtml(etiqueta)}</strong>
        <span>${escapeHtml(lote)} · ${escapeHtml(horas)}</span>
      </div>
    </div>`).join("");
}

function prioridadPropuesta(h) {
  if (h.tono === "clay") return { etiqueta: "Alta", clase: "high", icono: "ph-warning-circle" };
  if (h.tono === "leaf") return { etiqueta: "Baja", clase: "low", icono: "ph-chat-circle-dots" };
  return { etiqueta: "Media", clase: "medium", icono: "ph-magnifying-glass" };
}

function iconoCategoria(tag) {
  const iconos = { suelo: "ph-plant", calidad: "ph-medal", beneficio: "ph-drop-half-bottom", nutrición: "ph-flask", aviso: "ph-users-three" };
  return iconos[tag] || "ph-lightbulb";
}

function lotesDe(h) {
  const lotes = (h.chips || []).filter((chip) => chip.kind === "lote").map((chip) => chip.id);
  if (lotes.length) return lotes.join(", ");
  if (h.tag === "nutrición") return "L4, L6 y L7";
  if (h.tag === "calidad" || h.tag === "beneficio") return "Beneficiadero · CCN 51";
  return "Por confirmar";
}

function estadoPropuesta(h) {
  const decision = decisiones[h.ancla];
  return decision === "aprobada" ? "Aprobada para seguimiento" : decision === "descartada" ? "Descartada" : "Pendiente de revisión";
}

function tarjetaPropuesta(h, compacta = false) {
  const prioridad = prioridadPropuesta(h);
  const decision = decisiones[h.ancla];
  return `<article class="proposal-card ${compacta ? "proposal-card-compact" : ""}">
    <button type="button" class="proposal-card-main" onclick="abrirPropuesta('${h.ancla}')">
      <span class="proposal-category-icon"><i class="ph ${iconoCategoria(h.tag)}"></i></span>
      <span class="proposal-card-copy"><span class="proposal-card-meta"><span class="proposal-importance ${prioridad.clase}">${prioridad.etiqueta}</span><span>${escapeHtml(h.tag)}</span></span><strong>${escapeHtml(h.lead)}</strong><span>${escapeHtml(lotesDe(h))}</span></span>
      <i class="ph ph-caret-right proposal-card-arrow"></i>
    </button>
    ${compacta ? "" : `<div class="proposal-card-actions">${decision ? `<span class="proposal-decision ${decision}">${estadoPropuesta(h)}</span>` : `<><button class="btn" onclick="decidir('${h.ancla}','aprobada')">Aprobar para seguimiento</button><button class="btn secondary" onclick="decidir('${h.ancla}','descartada')">Descartar</button></>`}</div>`}
  </article>`;
}

function renderResumenPropuestas() {
  const cont = document.getElementById("resumenPropuestas");
  const pendientes = acciones().filter((h) => modoDe(h) === "pendiente");
  const badge = document.getElementById("propuestasCount");
  if (badge) badge.textContent = pendientes.length;
  if (cont) cont.innerHTML = pendientes.slice(0, 3).map((h) => tarjetaPropuesta(h, true)).join("") || '<span class="muted">No hay propuestas pendientes.</span>';
}

function renderDetallePropuesta() {
  const cont = document.getElementById("proposalDetail");
  const h = acciones().find((item) => item.ancla === propuestaSeleccionada);
  if (!cont) return;
  if (!h) { cont.hidden = true; return; }
  const prioridad = prioridadPropuesta(h);
  cont.hidden = false;
  cont.innerHTML = `<div class="proposal-detail-head"><span class="proposal-category-icon"><i class="ph ${iconoCategoria(h.tag)}"></i></span><div><div class="proposal-card-meta"><span class="proposal-importance ${prioridad.clase}">${prioridad.etiqueta}</span><span>${escapeHtml(h.tag)}</span></div><h2>${escapeHtml(h.lead)}</h2><p>${escapeHtml(h.texto)}</p></div><button type="button" class="proposal-close" onclick="cerrarPropuesta()" aria-label="Cerrar detalle"><i class="ph ph-x"></i></button></div><dl class="proposal-facts"><div><dt>Lote afectado</dt><dd>${escapeHtml(lotesDe(h))}</dd></div><div><dt>Impacto esperado</dt><dd>${escapeHtml(h.impacto)}</dd></div><div><dt>Estado</dt><dd>${estadoPropuesta(h)}</dd></div></dl>`;
}

function cerrarPropuesta() { propuestaSeleccionada = null; renderDetallePropuesta(); }
window.cerrarPropuesta = cerrarPropuesta;

function renderAcciones() {
  const cont = document.querySelector(".agent-actions");
  if (!cont) return;

  const pendientes = acciones().filter((h) => modoDe(h) === "pendiente");
  cont.innerHTML = pendientes.length
    ? pendientes.map((h) => tarjetaPropuesta(h)).join("")
    : `<div class="agent-item"><span>Sin propuestas pendientes por ahora.</span></div>`;
}

function renderTimeline() {
  const cont = document.querySelector(".agent-timeline");
  if (!cont) return;

  const resueltas = acciones()
    .filter((h) => decisiones[h.ancla])
    .map((h) => ({ hora: h.hora, texto: `${decisiones[h.ancla] === "aprobada" ? "Aprobada" : "Descartada"}: ${h.lead}` }));

  const eventos = [...REGISTRO_DEMO, ...resueltas].sort((a, b) => a.hora.localeCompare(b.hora));

  cont.innerHTML = eventos.map((e) => `
    <div class="agent-event">
      <span>${escapeHtml(e.hora)}</span>
      <strong>${escapeHtml(e.texto)}</strong>
    </div>`).join("");
}

cargarHilo();
renderAcciones();
renderTimeline();
renderSugerencias();
renderResumenPropuestas();
renderResumenSensores();
renderSensoresPagina();
renderTareas("resumenTareas", 4);
renderTareas("taskListFull", null);
renderFinca();
void sincronizarPropuestas();
hayConexion().then(actualizarEstadoAgente);
iniciarSincronizacionSensores(SENSORES, () => {
  renderResumenSensores();
  renderSensoresPagina();
  renderLotes();
  renderMapaLotes();
  marcarSincronizado();
});
iniciarSincronizacionClima(renderPronostico);

