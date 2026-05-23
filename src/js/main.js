const navButtons = document.querySelectorAll(".nav button");
const pages = document.querySelectorAll(".page");

const API_BASE = "https://openclaw-proxy.sebas-guterrez0.workers.dev";
let cachedModelId = null;
let aiMessageLocked = false;

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

function openPage(pageId) {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  pages.forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
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

  const aiMessage = document.getElementById("aiMessage");
  if (aiMessage && !aiMessageLocked) {
    aiMessage.innerHTML = `<strong>Resumen de hoy:</strong><br>Humedad promedio ${state.home.moisture}%, temperatura ${state.home.temperature}°C y riesgo fitosanitario ${state.home.risk}%. El Lote B sigue en atención por humedad baja.`;
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

async function getModelId() {
  if (cachedModelId) return cachedModelId;

  const response = await fetch(`${API_BASE}/v1/models`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("No se pudo obtener el modelo.");
  }

  const data = await response.json();
  const firstModel = Array.isArray(data?.data) ? data.data[0] : null;
  cachedModelId = firstModel?.id || null;

  if (!cachedModelId) {
    throw new Error("No hay modelos disponibles.");
  }

  return cachedModelId;
}

async function requestAiReply(prompt) {
  const model = await getModelId();
  const response = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Eres LIA, asistente agrícola. Responde en español, con tono claro y práctico.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 240,
    }),
  });

  if (!response.ok) {
    throw new Error("La API no respondió correctamente.");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Respuesta vacía del modelo.");
  }

  return content;
}

async function askAi(prompt, targetId) {
  const element = document.getElementById(targetId);
  if (!element) return;

  aiMessageLocked = true;
  element.innerHTML = "<strong>LIA:</strong><br>Consultando...";

  try {
    const reply = await requestAiReply(prompt);
    element.innerHTML = `<strong>LIA:</strong><br>${escapeHtml(reply)}`;
  } catch (error) {
    const fallback = getReply(prompt);
    element.innerHTML = `<strong>LIA:</strong><br>${escapeHtml(fallback)}`;
  }
}

function askPreset(type) {
  const prompts = {
    hoy: "¿Qué hacemos hoy?",
    riesgos: "Riesgos activos",
    lote: "Estado Lote B",
    whatsapp: "Mensaje WhatsApp"
  };

  askAi(prompts[type], "aiMessage");
}

function sendQuestion() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  askAi(text, "aiMessage");
  input.value = "";
}

function askBigPreset(type) {
  const prompts = {
    plan: "Plan de mañana",
    mango: "Analizar mango",
    trabajadores: "Asignar trabajadores",
    resumen: "Resumen ejecutivo"
  };

  askAi(prompts[type], "bigAiMessage");
}

function sendBigQuestion() {
  const input = document.getElementById("bigChatInput");
  const text = input.value.trim();
  if (!text) return;

  askAi(text, "bigAiMessage");
  input.value = "";
}

document.getElementById("chatInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendQuestion();
});

document.getElementById("bigChatInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendBigQuestion();
});

mockFetchTelemetry().then(renderDemoDashboard);

setInterval(() => {
  demoState.home.moisture = Math.max(52, Math.min(72, demoState.home.moisture + (Math.random() > 0.5 ? 1 : -1)));
  demoState.home.temperature = Math.max(24, Math.min(31, demoState.home.temperature + (Math.random() > 0.5 ? 1 : -1)));
  demoState.home.risk = Math.max(58, Math.min(82, demoState.home.risk + (Math.random() > 0.5 ? 1 : -1)));
  renderDemoDashboard(demoState);
}, 12000);