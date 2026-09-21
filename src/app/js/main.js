import "./nav.js";
import { enviarMensaje, hayConexion, obtenerPropuestas, registrarDecision } from "./api.js";
import { HILO_DEMO, REGISTRO_DEMO, TAREAS, TAREAS_HECHAS, SENSORES, COLOR_SENSOR } from "./data.js";
import { iniciarSincronizacionSensores } from "./sheetSensores.js";
import { esc as escapeHtml, cargarConversacion, guardarConversacion } from "./chat.js";
import { iniciarSincronizacionClima } from "./climaApi.js";
import { renderFinca, renderLotes } from "./finca.js";

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

function openPage(pageId, moverFoco = true) {
  navButtons.forEach((button) => {
    const activo = button.dataset.page === pageId;
    button.classList.toggle("active", activo);
    if (activo) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  pages.forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelector(".csb-main")?.scrollTo({ top: 0, behavior: "smooth" });

  // Lleva el foco al título de la página nueva para que lectores de pantalla
  // y teclado sepan que el contenido cambió.
  const titulo = document.getElementById(pageId)?.querySelector("h1, h2");
  if (moverFoco && titulo) {
    titulo.tabIndex = -1;
    titulo.focus({ preventScroll: true });
  }
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
  const hora = new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const resumen = document.getElementById("resumenSync");
  if (resumen) resumen.textContent = `Hoja de campo · ${hora}`;
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

    climaActual = actual;
    renderResumen();
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

/** Refleja el estado real de conexión con el agente en la pestaña Asistente. */
function actualizarEstadoAgente(conectado) {
  const estado = document.querySelector(".agent-status");
  if (estado) {
    estado.innerHTML = conectado
      ? `<span class="status-dot"></span> Conectada con el agente`
      : `<span class="status-dot"></span> Sin conexión con el agente`;
  }
}

// ═══════════ panel LIA (sidebar derecho) ═══════════

const MAX_SIDEBAR_CHARS = 180;
const liaHistorial = cargarConversacion();
let liaOcupado = false;

const guardar = () => guardarConversacion(liaHistorial);

function textoCorto(texto, limite = MAX_SIDEBAR_CHARS) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  return limpio.length > limite ? `${limpio.slice(0, limite).trimEnd()}…` : limpio;
}

function renderSidebarLog() {
  const log = document.getElementById("liaLog");
  if (!log) return;
  log.innerHTML = liaHistorial.slice(-4).reverse().map((m) => `
    <div class="lia-log-entry">
      <span class="lia-log-role">${m.rol === "yo" ? "Tú" : m.rol === "error" ? "Sin conexión" : "LIA"}</span>
      <span title="${escapeHtml(m.texto)}">${escapeHtml(textoCorto(m.texto))}</span>
    </div>`).join("");
}

async function preguntarLia(prompt) {
  const insight = document.getElementById("liaInsight");
  const log = document.getElementById("liaLog");
  const input = document.getElementById("chatInput");
  const send = document.getElementById("chatSend");
  const connection = document.getElementById("liaConnection");
  if (!insight || liaOcupado) return;

  liaOcupado = true;
  delete insight.dataset.origen;
  insight.innerHTML = '<span class="csb-lia-insight-label"><i class="ph ph-spinner lia-spin"></i> LIA está revisando</span><span class="csb-lia-loading-lines"><i></i><i></i><i></i></span>';
  if (input) input.disabled = true;
  if (send) {
    send.disabled = true;
    send.innerHTML = '<i class="ph ph-spinner lia-spin"></i>';
  }
  if (connection) connection.innerHTML = '<i class="csb-lia-connection-dot is-thinking"></i><span>Procesando pregunta…</span>';
  liaHistorial.push({ rol: "yo", texto: prompt });
  guardar();
  renderSidebarLog();

  try {
    const reply = await enviarMensaje(prompt, {});
    liaHistorial.push({ rol: "lia", texto: reply });
    guardar();
    insight.innerHTML = `<span class="csb-lia-insight-label"><i class="ph ph-sparkle"></i> Respuesta de LIA</span><span>${escapeHtml(textoCorto(reply))}</span>`;
    renderSidebarLog();
    actualizarEstadoAgente(true);
    if (connection) connection.innerHTML = '<i class="csb-lia-connection-dot"></i><span>Conectada al agente</span>';
  } catch (error) {
    // NUNCA una respuesta inventada: esto es un panel de finca y lo que se
    // guarda aquí se relee después sin la etiqueta de "muestra" al lado.
    // Si el agente no contesta, se dice que no contestó.
    const detalle = `No pude contactar al agente, así que no hay respuesta a esta pregunta.\n\nDetalle: ${error.message}`;
    liaHistorial.push({ rol: "error", texto: detalle });
    guardar();
    insight.innerHTML = `<span class="csb-lia-insight-label"><i class="ph ph-warning"></i> Sin respuesta</span><span>${escapeHtml(textoCorto(detalle))}</span>`;
    renderSidebarLog();
    actualizarEstadoAgente(false);
    if (connection) connection.innerHTML = '<i class="csb-lia-connection-dot is-error"></i><span>Sin conexión con el agente</span>';
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

/** Sugerencias = preguntas para LIA armadas con lo que pasa ahora (sensores
 *  fuera de rango y pronóstico). No repiten las propuestas: esas ya tienen
 *  su tarjeta en el Resumen y su página. */
function renderSugerencias() {
  const cont = document.getElementById("liaSugerencias");
  if (!cont) return;

  const lista = fueraDeRango().slice(0, 2).map((s) => ({
    icono: "ph-warning",
    color: s.estado === "alerta" ? "var(--danger)" : "var(--gold)",
    titulo: `${s.tipo || s.id} en ${s.lugar}: ${s.valor}${s.unidad}`,
    pregunta: `El sensor ${s.id} (${s.tipo || "sin tipo"}) en ${s.lugar} marca ${s.valor}${s.unidad}, en estado ${s.estado}. ¿Qué debería revisar en campo?`
  }));
  const c = climaActual;
  if (c && c.lluviaProb >= 50) {
    lista.push({
      icono: "ph-cloud-rain", color: "var(--blue)",
      titulo: `${c.notaLluvia} (${c.lluviaProb}%)`,
      pregunta: `El pronóstico da ${c.lluviaProb}% de lluvia hoy (${c.notaLluvia.toLowerCase()}). ¿Qué labores conviene mover o proteger?`
    });
  } else if (c?.ventana) {
    lista.push({
      icono: "ph-spray-bottle", color: "#7f9b4a",
      titulo: `Ventana seca de ${c.ventana}`,
      pregunta: `Hay una ventana sin lluvia de ${c.ventana}. ¿Qué aplicaciones o labores caben en ese tramo?`
    });
  }
  if (!lista.length) {
    lista.push({
      icono: "ph-chat-circle-dots", color: "var(--olive)",
      titulo: "Resumen del estado de la finca",
      pregunta: "Dame un resumen corto del estado de la finca hoy con los sensores y el clima."
    });
  }

  const contador = document.getElementById("liaSuggestionCount");
  if (contador) contador.textContent = lista.length;
  cont.innerHTML = lista.map((x) => `
    <button type="button" class="csb-sug" data-pregunta="${escapeHtml(x.pregunta)}" aria-label="Preguntar a LIA: ${escapeHtml(x.titulo)}">
      <span class="csb-sug-icon" style="background:${x.color}"><i class="ph ${x.icono}"></i></span>
      <div>
        <strong>${escapeHtml(x.titulo)}</strong>
        <em style="color:${x.color}">Preguntar a LIA</em>
      </div>
      <i class="ph ph-arrow-up-right csb-sug-arrow"></i>
    </button>`).join("");
}

document.getElementById("liaSugerencias")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pregunta]");
  if (button && !liaOcupado) preguntarLia(button.dataset.pregunta);
});

// ═══════════ Resumen: listas de sensores y tareas ═══════════

const RANGO_ESTADO = { alerta: 3, aviso: 2, "sin señal": 1, ok: 0 };
const ETIQUETA_ESTADO = { alerta: "Alerta", aviso: "Aviso", "sin señal": "Sin señal", ok: "En rango" };
let climaActual = null;

const fueraDeRango = () =>
  SENSORES.filter((s) => s.estado !== "ok").sort((a, b) => RANGO_ESTADO[b.estado] - RANGO_ESTADO[a.estado]);

/** Resumen = lo que pasa ahora: pronóstico real y la hoja de sensores.
 *  Nada de informes de laboratorio aquí; esos viven en Lotes y Laboratorio. */
function renderResumen() {
  const fuera = fueraDeRango();
  const alertas = fuera.filter((s) => s.estado === "alerta").length;

  const stats = document.getElementById("resumenStats");
  if (stats) {
    const c = climaActual;
    const tarjetas = [
      ["ph-thermometer-simple", "var(--olive)", "Ahora en la finca", c ? `${c.temp}°C` : "–", c ? c.condicion : "Consultando pronóstico"],
      ["ph-cloud-rain", "var(--blue)", "Lluvia hoy", c ? `${c.lluviaProb}%` : "–", c ? c.notaLluvia : ""],
      ["ph-spray-bottle", "#7f9b4a", "Ventana de aplicación", c ? c.ventana || "Sin ventana" : "–", "Tramo seco de 2 h o más"],
      ["ph-warning", fuera.length ? (alertas ? "var(--danger)" : "var(--gold)") : "var(--olive)", "Lecturas fuera de rango",
        `${fuera.length} de ${SENSORES.length}`, alertas ? `${alertas} en alerta` : fuera.length ? "Ninguna en alerta" : "Todo en rango"]
    ];
    stats.innerHTML = tarjetas.map(([icono, color, titulo, valor, nota]) => `
      <div class="c-stat">
        <div class="c-stat-icon" style="background:${color}"><i class="ph ${icono}"></i></div>
        <div><small>${escapeHtml(titulo)}</small><strong>${escapeHtml(valor)}</strong><span>${escapeHtml(nota)}</span></div>
      </div>`).join("");
  }

  const atencion = document.getElementById("resumenAtencion");
  if (atencion) {
    atencion.innerHTML = fuera.length
      ? fuera.slice(0, 5).map((s) => `
        <div class="c-list-row">
          <div><strong>${escapeHtml(s.lugar)}</strong><span>${escapeHtml(s.tipo || s.id)} · ${ETIQUETA_ESTADO[s.estado]}${s.fecha ? ` · ${escapeHtml(s.fecha)}` : ""}</span></div>
          <span style="color:${s.estado === "aviso" ? "#84601b" : COLOR_SENSOR[s.estado]};font-weight:800">${s.valor}${escapeHtml(s.unidad)}</span>
        </div>`).join("") + (fuera.length > 5 ? `<span class="muted">Y ${fuera.length - 5} más en Sensores.</span>` : "")
      : '<p class="muted">Todas las lecturas están en rango.</p>';
  }

  const mapa = document.getElementById("mapaLotes");
  if (mapa) {
    const porLugar = new Map();
    SENSORES.forEach((s) => porLugar.set(s.lugar, [...(porLugar.get(s.lugar) || []), s]));
    mapa.innerHTML = [...porLugar].map(([lugar, sensores]) => {
      const peor = sensores.reduce((a, s) => (RANGO_ESTADO[s.estado] > RANGO_ESTADO[a] ? s.estado : a), "ok");
      const clase = { alerta: " danger", aviso: " warning" }[peor] || "";
      const pill = { alerta: "pill red", aviso: "pill yellow" }[peor] || "pill";
      return `
        <div class="map-card${clase}">
          <span class="${pill}">${ETIQUETA_ESTADO[peor]}</span>
          <h4>${escapeHtml(lugar)}</h4>
          <p>${sensores.map((s) => `${escapeHtml(s.tipo || s.id)} ${s.valor}${escapeHtml(s.unidad)}`).join(", ")}</p>
        </div>`;
    }).join("");
  }

  // La lectura rápida sale de los sensores hasta que LIA conteste algo.
  const insight = document.getElementById("liaInsightTexto");
  if (insight && document.getElementById("liaInsight")?.dataset.origen === "sensores") {
    const s = fuera[0];
    insight.textContent = s
      ? `${fuera.length} ${fuera.length === 1 ? "lectura fuera" : "lecturas fuera"} de rango. La primera: ${s.tipo || s.id} en ${s.lugar}, ${s.valor}${s.unidad} (${ETIQUETA_ESTADO[s.estado].toLowerCase()}).`
      : "Todas las lecturas de los sensores están en rango.";
  }

  renderSugerencias();
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
    ${compacta ? "" : `<div class="proposal-card-actions">${decision ? `<span class="proposal-decision ${decision}">${estadoPropuesta(h)}</span>` : `<button class="btn" onclick="decidir('${h.ancla}','aprobada')">Aprobar para seguimiento</button><button class="btn secondary" onclick="decidir('${h.ancla}','descartada')">Descartar</button>`}</div>`}
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
renderResumenPropuestas();
renderResumen();
renderSensoresPagina();
renderTareas("resumenTareas", 4);
renderTareas("taskListFull", null);
renderFinca();
void sincronizarPropuestas();
hayConexion().then(actualizarEstadoAgente);
iniciarSincronizacionSensores(SENSORES, () => {
  renderResumen();
  renderSensoresPagina();
  renderLotes();
  marcarSincronizado();
});
iniciarSincronizacionClima(renderPronostico);

// agente.html enlaza a index.html#lotes, #clima, etc.
const paginaInicial = location.hash.slice(1);
if (document.getElementById(paginaInicial)?.classList.contains("page")) openPage(paginaInicial, false);

