import { enviarMensaje, hayConexion } from "./api.js";
import { HILO_DEMO, REGISTRO_DEMO, TAREAS, TAREAS_HECHAS, SENSORES, COLOR_SENSOR } from "./data.js";
import { iniciarSincronizacionSensores } from "./sheetSensores.js";

const navButtons = document.querySelectorAll(".csb-nav [data-page]");
const pages = document.querySelectorAll(".page");

let booting = true;

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

function cargarHilo() {
  hilo = HILO_DEMO.map((h, i) => ({ ...h, ancla: "acc-" + i }));
}

function acciones() {
  return hilo.filter((h) => h.tipo === "accion");
}

function modoDe(h) {
  return decisiones[h.ancla] || h.modo;
}

function decidir(ancla, valor) {
  decisiones[ancla] = valor;
  renderAcciones();
  renderTimeline();
  renderSugerencias();
}
window.decidir = decidir;

document.body.classList.add("is-booting");

const demoState = {
  home: {
    moisture: 64,
    temperature: 27,
    wind: "NE",
    tasks: 12,
    risk: 72,
    connectivity: 98,
  },
  sensors: [
    {
      label: "Nodo A-12",
      title: "Humedad suelo",
      value: "64%",
      meta: "Lote A · Cacao",
      tone: "stable",
    },
    {
      label: "Nodo B-07",
      title: "Humedad suelo",
      value: "41%",
      meta: "Lote B · Mango",
      tone: "warning",
    },
    {
      label: "Estación 01",
      title: "Temperatura",
      value: "27°C",
      meta: "Humedad ambiente 71%",
      tone: "blue",
    },
    {
      label: "Gateway",
      title: "Conectividad",
      value: "Online",
      meta: "Último paquete hace 18 s",
      tone: "danger",
    },
  ],
  pipeline: [
    {
      title: "Sensores",
      text: "Humedad, temperatura, lluvia, batería, GPS",
    },
    {
      title: "Gateway",
      text: "ESP32 / Raspberry Pi / módem 4G",
    },
    {
      title: "Servidor",
      text: "API, base de datos y reglas de alerta",
    },
    {
      title: "Dashboard",
      text: "Cards, gráficas, historial y mensajería",
    },
  ],
  readings: [
    {
      title: "Lote B · humedad",
      text: "41% · 08:12 · alerta amarilla",
    },
    {
      title: "Lote A · temperatura",
      text: "27°C · 08:11 · estable",
    },
    {
      title: "Zona hídrica · lluvia",
      text: "0.2 mm · 08:10 · sin riesgo",
    },
    {
      title: "Gateway principal",
      text: "98% batería · 08:09 · online",
    },
  ],
  features: [
    {
      title: "Estado por lote",
      text: "Un resumen rápido de cada lote con sensores, fotos y alertas.",
    },
    {
      title: "Trazabilidad completa",
      text: "Registro de labores, insumos, clima y eventos de campo.",
    },
    {
      title: "Acción sugerida",
      text: "El sistema puede proponer tareas y mensajes para el equipo.",
    },
  ],
  trend: {
    moisture: [62, 63, 61, 60, 58, 57, 59, 61, 64, 66, 67, 65],
    temperature: [26, 26, 25, 25, 26, 27, 27, 28, 28, 27, 27, 26],
  },
};

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

function mockFetchTelemetry() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(demoState)), 220);
  });
}

function renderSensorCard(containerId, sensor) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <span class="pill ${sensor.tone === "warning" ? "yellow" : sensor.tone === "blue" ? "blue" : sensor.tone === "danger" ? "red" : ""}">${sensor.label}</span>
    <h3>${sensor.title}</h3>
    <p>${sensor.value}</p>
    <small>${sensor.meta}</small>
  `;
}

function renderList(containerId, items, className) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = items
    .map(
      (item) => `
        <div class="${className}">
          <strong>${item.title}</strong>
          <span>${item.text}</span>
        </div>
      `,
    )
    .join("");
}

function renderTrendChart(svg, state) {
  if (!svg) return;

  const width = 860;
  const height = 240;
  const padding = 30;

  const mapPoint = (series, index) => {
    const x = padding + (index / (series.length - 1)) * (width - padding * 2);
    const max = 70;
    const min = 20;
    const normalized = (series[index] - min) / (max - min);
    const y = height - padding - normalized * (height - padding * 2);
    return `${x},${y}`;
  };

  const moisturePoints = state.trend.moisture.map((_, index) => mapPoint(state.trend.moisture, index)).join(" ");
  const temperaturePoints = state.trend.temperature.map((_, index) => mapPoint(state.trend.temperature, index)).join(" ");

  svg.innerHTML = `
    <defs>
      <linearGradient id="moistureFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(139, 144, 34, 0.36)" />
        <stop offset="100%" stop-color="rgba(139, 144, 34, 0.04)" />
      </linearGradient>
      <linearGradient id="temperatureFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(93, 131, 118, 0.34)" />
        <stop offset="100%" stop-color="rgba(93, 131, 118, 0.04)" />
      </linearGradient>
    </defs>
    <g opacity="0.32">
      <path d="M30 40 H830" stroke="currentColor" stroke-width="1" />
      <path d="M30 96 H830" stroke="currentColor" stroke-width="1" />
      <path d="M30 152 H830" stroke="currentColor" stroke-width="1" />
      <path d="M30 208 H830" stroke="currentColor" stroke-width="1" />
    </g>
    <polyline points="${moisturePoints}" fill="none" stroke="var(--olive)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <polyline points="${temperaturePoints}" fill="none" stroke="var(--blue)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  `;
}

function renderDemoDashboard(state) {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText("homeMoisture", `${state.home.moisture}%`);
  setText("homeAverageMoisture", `${state.home.moisture}%`);
  setText("homeTemperature", `${state.home.temperature}°C`);
  setText("homeAverageTemperature", `${state.home.temperature}°`);
  setText("homeWind", state.home.wind);
  setText("homeTasks", String(state.home.tasks));

  if (booting) {
    document.body.classList.remove("is-booting");
    booting = false;
  }

  renderSensorCard("sensorCardOne", state.sensors[0]);
  renderSensorCard("sensorCardTwo", state.sensors[1]);
  renderSensorCard("sensorCardThree", state.sensors[2]);
  renderSensorCard("sensorCardFour", state.sensors[3]);
  renderList("sensorPipeline", state.pipeline, "pipeline-step");
  renderList("readingList", state.readings, "reading");
  renderList("featureList", state.features, "feature-item");
  renderTrendChart(document.getElementById("sensorTrendChart"), state);

  const status = document.querySelector(".live");
  if (status) {
    status.textContent = `Actualizado hace ${Math.round(18 + Math.random() * 14)} s`;
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

const liaHistorial = [];

async function preguntarLia(prompt) {
  const insight = document.getElementById("liaInsight");
  const log = document.getElementById("liaLog");
  if (!insight) return;

  insight.textContent = "Consultando…";
  liaHistorial.push({ rol: "yo", texto: prompt });

  const agregarLog = (texto) => {
    if (!log) return;
    const fila = document.createElement("div");
    fila.textContent = texto;
    log.prepend(fila);
  };

  agregarLog(`Vos: ${prompt}`);

  try {
    const reply = await enviarMensaje(liaHistorial, {});
    liaHistorial.push({ rol: "lia", texto: reply });
    insight.innerHTML = renderMarkdown(reply);
    agregarLog(`LIA: ${reply}`);
    actualizarEstadoAgente(true);
  } catch (error) {
    const fallback = getReply(prompt);
    liaHistorial.push({ rol: "lia", texto: fallback });
    insight.innerHTML = renderMarkdown(fallback);
    agregarLog(`LIA: ${fallback}`);
    actualizarEstadoAgente(false);
  }
}

function enviarPreguntaLia() {
  const input = document.getElementById("chatInput");
  if (!input) return;
  const texto = input.value.trim();
  if (!texto) return;
  input.value = "";
  preguntarLia(texto);
}

document.getElementById("chatSend")?.addEventListener("click", enviarPreguntaLia);
document.getElementById("chatInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") enviarPreguntaLia();
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
  cont.innerHTML = pendientes.length
    ? pendientes.map((h) => {
      const [texto, color] = prioridad[h.tono] || prioridad.wheat;
      return `
        <div class="csb-sug">
          <div class="csb-sug-icon" style="background:${color}">●</div>
          <div>
            <strong>${escapeHtml(h.lead)}</strong>
            <em style="color:${color}">${texto}</em>
          </div>
        </div>`;
    }).join("")
    : `<div class="csb-sug"><div class="csb-sug-icon" style="background:var(--olive)">✓</div><div><strong>Sin sugerencias pendientes.</strong></div></div>`;
}

// ═══════════ Resumen: listas de sensores y tareas ═══════════

function renderResumenSensores() {
  const cont = document.getElementById("resumenSensores");
  if (!cont) return;
  cont.innerHTML = SENSORES.slice(0, 4).map((s) => `
    <div class="c-list-row">
      <div><strong>${escapeHtml(s.id)}</strong><span>${escapeHtml(s.lugar)}</span></div>
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

function renderSaludTrend() {
  const svg = document.getElementById("saludTrend");
  if (!svg) return;
  const serie = [64, 66, 68, 67, 70, 73, 75, 74, 76, 77, 78, 78];
  const w = 300, h = 90, pad = 6;
  const max = Math.max(...serie), min = Math.min(...serie), span = (max - min) || 1;
  const puntos = serie.map((v, i) => {
    const x = pad + (i / (serie.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  svg.innerHTML = `<polyline points="${puntos}" fill="none" stroke="var(--olive)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
}

// ═══════════ Asistente: propuestas reales + registro de decisiones ═══════════

function renderAcciones() {
  const cont = document.querySelector(".agent-actions");
  if (!cont) return;

  const pendientes = acciones().filter((h) => modoDe(h) === "pendiente");
  cont.innerHTML = pendientes.length
    ? pendientes.map((h) => `
      <div class="agent-action">
        <span class="pill ${h.tono === "clay" ? "red" : h.tono === "wheat" ? "yellow" : "blue"}">${escapeHtml(h.tag)}</span>
        <div>
          <strong>${escapeHtml(h.lead)}</strong>
          <span>${escapeHtml(h.texto)}</span>
          <div class="agent-action-botones">
            <button class="btn" onclick="decidir('${h.ancla}','aprobada')">Hazlo</button>
            <button class="btn secondary" onclick="decidir('${h.ancla}','descartada')">No</button>
          </div>
        </div>
      </div>`).join("")
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
renderResumenSensores();
renderTareas("resumenTareas", 4);
renderTareas("taskListFull", null);
renderSaludTrend();
hayConexion().then(actualizarEstadoAgente);
iniciarSincronizacionSensores(SENSORES, renderResumenSensores);

mockFetchTelemetry().then(renderDemoDashboard);

setInterval(() => {
  demoState.home.moisture = Math.max(52, Math.min(72, demoState.home.moisture + (Math.random() > 0.5 ? 1 : -1)));
  demoState.home.temperature = Math.max(24, Math.min(31, demoState.home.temperature + (Math.random() > 0.5 ? 1 : -1)));
  demoState.home.risk = Math.max(58, Math.min(82, demoState.home.risk + (Math.random() > 0.5 ? 1 : -1)));
  renderDemoDashboard(demoState);
}, 12000);