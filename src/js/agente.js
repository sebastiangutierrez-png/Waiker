// ─────────────────────────────────────────────────────────────
//  Agromyss · página Asistente (LIA)
//
//  El hilo de chat "real" del rediseño v2 (main), reutilizado tal
//  cual pero con el sidebar del concepto en vez del lateral propio
//  de esa página — Propuestas/Historial ya viven en el dashboard
//  (index.html), así que esta página es sólo la conversación.
// ─────────────────────────────────────────────────────────────

import { C, LOTES, SENSORES, COLOR_SENSOR, CLIMA, SALUDO_LIA, ATAJOS_DEMO } from "./data.js";
import { enviarMensaje, hayConexion } from "./api.js";
import { iniciarSincronizacionSensores } from "./sheetSensores.js";

const $ = (id) => document.getElementById(id);

/** Escapa texto antes de interpolarlo en HTML. Obligatorio para todo lo que
 *  venga de la API: el agente genera texto libre y no debe poder inyectar marcado. */
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const mdInline = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");

function md(raw) {
  const lineas = esc(raw).split("\n");
  let html = "";
  let enLista = false;
  for (const linea of lineas) {
    const item = linea.match(/^\s*[-*]\s+(.*)/);
    if (item) {
      if (!enLista) { html += "<ul>"; enLista = true; }
      html += `<li>${mdInline(item[1])}</li>`;
      continue;
    }
    if (enLista) { html += "</ul>"; enLista = false; }
    html += linea.trim() === "" ? "" : `<p>${mdInline(linea)}</p>`;
  }
  if (enLista) html += "</ul>";
  return html;
}

const HORA_FMT = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

const S = {
  datos: false,
  lote: "B-1",
  conectado: null,
  chat: {
    mensajes: [{ rol: "lia", texto: SALUDO_LIA }],
    enviando: false,
    etapa: 0
  }
};

/** El puente no manda progreso real: un solo POST que responde entero al
 *  final, entre 6 y 25s. Estas etapas son cosméticas — turnos de tiempo,
 *  no señales del agente — para que la espera no se sienta colgada. */
const ETAPAS_ESPERA = [
  "LIA está pensando…",
  "Revisando los sensores…",
  "Cruzando el clima y el plan del día…",
  "Redactando la respuesta…"
];
const ETAPA_MS = 4500;
let etapaTimer = null;

function iniciarEtapas() {
  S.chat.etapa = 0;
  clearInterval(etapaTimer);
  etapaTimer = setInterval(() => {
    if (S.chat.etapa < ETAPAS_ESPERA.length - 1) {
      S.chat.etapa += 1;
      render();
    }
  }, ETAPA_MS);
}

function detenerEtapas() {
  clearInterval(etapaTimer);
  etapaTimer = null;
}

function estadoColor(estado) {
  return estado === "Óptima" ? C.leaf : estado === "Límite" ? C.wheat : C.clay;
}

function renderAviso() {
  const el = $("wk-aviso");
  if (S.conectado === null) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = S.conectado
    ? `<i style="background:${C.leaf}"></i> Conectada con el agente vía agent-bridge.`
    : `<i style="background:${C.clay}"></i> Sin conexión con el agente todavía — el chat responde con datos de muestra hasta que el Worker /api esté desplegado.`;
}

function renderChatCima() {
  $("wk-chat-cima").innerHTML = `
    <div class="chat-cima-fila">
      <span class="mono chat-fecha">${esc(HORA_FMT.format(new Date()))}</span>
      <span class="chat-linea"></span>
      <button type="button" class="va-pastilla" data-accion="datos">${S.datos ? "esconder los números" : "ver los números"}</button>
    </div>`;
}

function renderChatDatos() {
  const panel = $("wk-chat-datos");
  panel.hidden = !S.datos;
  if (!S.datos) return;

  const l = LOTES.find((x) => x.id === S.lote) || LOTES[0];
  const lluviaMax = Math.max(...CLIMA.map(([, mm]) => mm), 1);
  const enLinea = SENSORES.filter((s) => s.estado !== "sin señal").length;

  panel.innerHTML = `
    <div class="datos-cab">
      <span class="mono datos-titulo">lotes · humedad</span>
      <span class="mono datos-nota">${esc(l.id)} · ${l.humedad}%</span>
    </div>
    <div class="datos-lotes">
      ${LOTES.map((x) => `
        <button type="button" class="datos-lote ${x.id === S.lote ? "activo" : ""}" data-accion="lote" data-id="${x.id}">
          <i style="background:${estadoColor(x.estado)}"></i>
          <span class="mono">${x.id}</span>
          <span class="datos-lote-nombre">${esc(x.nombre)}</span>
          <span class="datos-lote-barra"><span style="width:${Math.min(100, Math.round((x.humedad / 60) * 100))}%; background:${estadoColor(x.estado)}"></span></span>
          <span class="mono">${x.humedad}%</span>
        </button>`).join("")}
    </div>

    <div class="datos-cab" style="margin-top:12px">
      <span class="mono datos-titulo">lluvia · 7 días</span>
      <span class="mono datos-nota" style="color:${C.water}">${CLIMA.reduce((a, [, mm]) => a + mm, 0)} mm</span>
    </div>
    <svg viewBox="0 0 300 46" class="datos-clima" preserveAspectRatio="none">
      <line x1="0" y1="34" x2="300" y2="34" stroke="var(--va-linea-suave)" stroke-width="1"></line>
      ${CLIMA.map(([dia, mm], i) => {
        const h = Math.max(2, (mm / lluviaMax) * 24);
        const x = 8 + i * 42;
        return `<g>
          <rect x="${x}" y="${(34 - h).toFixed(1)}" width="24" height="${h.toFixed(1)}" fill="${C.water}" rx="2"></rect>
          <text x="${x + 12}" y="${(34 - h - 3).toFixed(1)}" text-anchor="middle" font-family="DM Mono" font-size="7.5" fill="${C.water}">${mm}mm</text>
          <text x="${x + 12}" y="44" text-anchor="middle" font-family="DM Mono" font-size="8" fill="var(--va-tinta-tenue)">${dia}</text>
        </g>`;
      }).join("")}
    </svg>

    <div class="datos-sensores">
      <span class="mono datos-titulo">sensores</span>
      <span class="datos-sensores-puntos">
        ${SENSORES.map((s) => `<i title="${esc(s.id + " · " + s.lugar + " · " + s.valor + s.unidad)}" style="background:${COLOR_SENSOR[s.estado]}"></i>`).join("")}
      </span>
      <span class="mono datos-sensores-resumen">${enLinea} en línea · ${SENSORES.length - enLinea} sin señal</span>
    </div>`;
}

function renderChatHilo() {
  const caja = $("wk-chat-hilo");
  const alFinal = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 60;

  const chatHtml = S.chat.mensajes.map((m) => {
    const clase = m.rol === "yo" ? "yo" : m.rol === "error" ? "lia error" : "lia";
    if (m.rol === "yo") {
      return `<div class="hilo-yo"><div class="hilo-burbuja-yo">${esc(m.texto)}</div></div>`;
    }
    return `<div class="hilo-msg">
      <span class="hilo-avatar">L</span>
      <div class="hilo-burbuja ${clase === "lia error" ? "hilo-burbuja-error" : ""}">
        <div class="hilo-burbuja-cab"><span class="hilo-quien">LIA</span><span class="mono hilo-hora">ahora</span></div>
        <div class="hilo-texto-libre">${md(m.texto)}</div>
      </div>
    </div>`;
  }).join("") + (S.chat.enviando ? `<div class="hilo-msg"><span class="hilo-avatar">L</span><div class="hilo-burbuja hilo-pensando mono">${esc(ETAPAS_ESPERA[S.chat.etapa])}</div></div>` : "");

  caja.innerHTML = chatHtml;

  if (alFinal) caja.scrollTop = caja.scrollHeight;
}

function renderChatPie() {
  $("wk-chat-atajos").innerHTML = ATAJOS_DEMO.map((a) =>
    `<button type="button" class="va-pastilla" data-accion="atajo" data-valor="${esc(a)}">${esc(a)}</button>`).join("");

  $("wk-chat-input").disabled = S.chat.enviando;
  $("wk-chat-enviar").disabled = S.chat.enviando;
}

function render() {
  renderAviso();
  renderChatCima();
  renderChatDatos();
  renderChatHilo();
  renderChatPie();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest?.("[data-accion]");
  if (!el) return;

  switch (el.dataset.accion) {
    case "datos":
      S.datos = !S.datos;
      render();
      break;
    case "lote":
      S.lote = el.dataset.id;
      render();
      break;
    case "atajo":
      enviarDesdeInput(el.dataset.valor);
      break;
  }
});

async function enviarDesdeInput(textoForzado) {
  const input = $("wk-chat-input");
  const texto = (textoForzado ?? input.value).trim();
  if (!texto || S.chat.enviando) return;

  input.value = "";
  S.chat.mensajes.push({ rol: "yo", texto });
  S.chat.enviando = true;
  iniciarEtapas();
  render();
  $("wk-chat-hilo").scrollTop = $("wk-chat-hilo").scrollHeight;

  try {
    const respuesta = await enviarMensaje(S.chat.mensajes, { lote: S.lote });
    S.chat.mensajes.push({ rol: "lia", texto: respuesta });
    S.conectado = true;
  } catch (err) {
    S.chat.mensajes.push({
      rol: "error",
      texto:
        "No pude contactar al agente. Comprueba que el intermediario /api esté desplegado en el Worker.\n\n" +
        "Detalle: " + err.message
    });
    S.conectado = false;
  } finally {
    detenerEtapas();
    S.chat.enviando = false;
    render();
    $("wk-chat-input").focus();
  }
}

$("wk-chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  enviarDesdeInput();
});

async function iniciar() {
  render();
  S.conectado = await hayConexion();
  render();
  iniciarSincronizacionSensores(SENSORES, renderChatDatos);
}

iniciar();
