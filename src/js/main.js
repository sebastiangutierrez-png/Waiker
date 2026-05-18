const buttons = document.querySelectorAll(".nav button");
const sections = document.querySelectorAll(".section");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    goToSection(button.dataset.section);
  });
});

function goToSection(sectionId) {
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });
}

const date = new Date();
const formatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long"
});

document.getElementById("todayLabel").textContent = formatter.format(date);

function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();

  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  setTimeout(() => {
    addMessage(getBotReply(text), "bot");
  }, 450);
}

function addMessage(text, type) {
  const messages = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function getBotReply(text) {
  const value = text.toLowerCase();

  if (value.includes("hoy") || value.includes("tarea")) {
    return "Para hoy priorizaría: revisar humedad del Lote B, tomar fotos de árboles con manchas, registrar lluvia real y validar inventario de fertilizante.";
  }

  if (value.includes("lote b") || value.includes("mango")) {
    return "El Lote B aparece con humedad baja y requiere atención. En una versión real, revisaría historial, clima, fotos y últimas labores antes de recomendar riego o cobertura.";
  }

  if (value.includes("alerta") || value.includes("riesgo")) {
    return "Hay dos alertas demo: humedad baja en Lote B y posible lluvia en la tarde. Se debería evitar aplicación foliar si hay lluvia próxima.";
  }

  if (value.includes("ia") || value.includes("opencloud")) {
    return "En la versión real me conectaría al agente de OpenCloud, a la base de datos y a documentos agronómicos para responder con contexto real de la finca.";
  }

  return "Respuesta demo: todavía no estoy conectado a datos reales, pero esta sería la zona donde el agente LIA explicaría el estado de la finca y propondría acciones.";
}

document.getElementById("chatInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

window.sendMessage = sendMessage;
