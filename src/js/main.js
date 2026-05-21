const navButtons = document.querySelectorAll(".nav button");
const pages = document.querySelectorAll(".page");

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

function askPreset(type) {
  const prompts = {
    hoy: "¿Qué hacemos hoy?",
    riesgos: "Riesgos activos",
    lote: "Estado Lote B",
    whatsapp: "Mensaje WhatsApp"
  };

  document.getElementById("aiMessage").innerHTML = "<strong>LIA:</strong><br>" + getReply(prompts[type]);
}

function sendQuestion() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  document.getElementById("aiMessage").innerHTML = "<strong>LIA:</strong><br>" + getReply(text);
  input.value = "";
}

function askBigPreset(type) {
  const prompts = {
    plan: "Plan de mañana",
    mango: "Analizar mango",
    trabajadores: "Asignar trabajadores",
    resumen: "Resumen ejecutivo"
  };

  document.getElementById("bigAiMessage").innerHTML = "<strong>LIA:</strong><br>" + getReply(prompts[type]);
}

function sendBigQuestion() {
  const input = document.getElementById("bigChatInput");
  const text = input.value.trim();
  if (!text) return;

  document.getElementById("bigAiMessage").innerHTML = "<strong>LIA:</strong><br>" + getReply(text);
  input.value = "";
}

document.getElementById("chatInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendQuestion();
});

document.getElementById("bigChatInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendBigQuestion();
});