// ─────────────────────────────────────────────────────────────
//  Waiker · LIA, el agente de la finca Agromyss
//
//  Estado en memoria + render completo en cada cambio.
//  Sin framework ni paso de compilación: el Worker sirve estos
//  archivos tal cual.
//
//  El hilo de "hoy" (HILO_DEMO) es contenido de muestra — ver la
//  nota en data.js. El chat de abajo SÍ está conectado de verdad:
//  cada pregunta pasa por enviarMensaje() → Worker → agent-bridge
//  → agente OpenClaw. Las propuestas (aprobar / descartar) todavía
//  viven sólo en el navegador: no hay endpoint que las reciba aún,
//  así que la decisión es local y optimista, igual que antes.
// ─────────────────────────────────────────────────────────────

import {
  C, FINCA, LOTES, SENSORES, COLOR_SENSOR, CLIMA, CUADRILLA,
  TONO_PROPUESTA, SALUDO_LIA, BRIEFING_DEMO, HILO_DEMO, REGISTRO_DEMO, ATAJOS_DEMO
} from "./data.js";

import { enviarMensaje, hayConexion } from "./api.js";

// ═══════════ utilidades ═══════════

const $ = (id) => document.getElementById(id);

/** Escapa texto antes de interpolarlo en HTML.
 *  Obligatorio para todo lo que venga de la API: el agente genera
 *  texto libre y no debe poder inyectar marcado. */
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Recorta y añade elipsis para las listas compactas de la barra lateral. */
const corto = (v, n) => (v.length > n ? v.slice(0, n) + "…" : v);

/** Marcado inline: negrita, cursiva, código. Opera sobre texto ya escapado. */
const mdInline = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");

/** Markdown mínimo (negrita/cursiva/código, listas "- item", párrafos) para
 *  texto libre del agente. Escapa primero, así que sigue siendo seguro para
 *  cualquier texto que venga de la API. */
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

/** Convierte una serie de valores en puntos de polilínea SVG. */
function spark(serie, w, h) {
  const max = Math.max(...serie), min = Math.min(...serie), span = (max - min) || 1;
  return serie
    .map((v, i) => `${(i * (w / (serie.length - 1))).toFixed(1)},${((h - 1) - ((v - min) / span) * (h - 3)).toFixed(1)}`)
    .join(" ");
}

const HORA_FMT = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

// ═══════════ estado ═══════════

const S = {
  tema: null,           // "light" | "dark" — null usa el guardado o "light"
  vista: "chat",         // "chat" | "historial"
  drawer: false,
  filtro: "espera",      // "espera" | "hecho" | "todo"
  datos: false,
  lote: "B-1",
  hilo: [],               // ver cargarHilo() — hoy es HILO_DEMO, mañana un fetch
  decisiones: {},         // ancla -> "aprobada" | "descartada" | "pendiente"
  chips: {},              // clave -> chip desplegado
  conectado: null,
  chat: {
    mensajes: [{ rol: "lia", texto: SALUDO_LIA }],
    enviando: false,
    etapa: 0
  }
};

/**
 * El puente no manda ningún progreso real (ver agent-bridge-service):
 * es un solo POST que responde entero al final, entre 6 y 25s. Estas
 * etapas son cosméticas — turnos de tiempo, no señales del agente —
 * para que la espera no se sienta como una página colgada.
 */
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

/**
 * Único punto de entrada del hilo de hoy (notas + propuestas del agente).
 *
 * TODO: cuando exista un endpoint real para propuestas/historial, esta es
 * la función a cambiar — reemplazar el valor de HILO_DEMO por la respuesta
 * de la API, conservando la forma de cada entrada (ver el comentario junto
 * a HILO_DEMO en data.js). El resto de main.js sólo lee S.hilo / acciones(),
 * así que no debería hacer falta tocar nada más.
 */
async function cargarHilo() {
  S.hilo = HILO_DEMO.map((h, i) => ({ ...h, ancla: "acc-" + i }));
}

/** Sólo las entradas del hilo que son propuestas del agente (no notas). */
function acciones() {
  return S.hilo.filter((h) => h.tipo === "accion");
}

function set(parche) {
  Object.assign(S, parche);
  render();
}

function temaActual() {
  return S.tema || "light";
}

function modoDe(ancla, modoOriginal) {
  return S.decisiones[ancla] || modoOriginal;
}

// ═══════════ chips (sensor / lote / clima) ═══════════

function chip(w, ctx) {
  const clave = ctx + ":" + w.kind + ":" + (w.id || "");
  const abierto = !!S.chips[clave];
  const toggle = () => set({ chips: { ...S.chips, [clave]: !abierto } });

  if (w.kind === "sensor") {
    const sn = SENSORES.find((x) => x.id === w.id) || SENSORES[0];
    const color = COLOR_SENSOR[sn.estado];
    return {
      clave, abierto, color, label: sn.id, valor: sn.valor + sn.unidad,
      detalle: `${sn.lugar} · pila ${sn.bateria}% · leído ${sn.visto}`,
      spark: spark(sn.serie, 34, 12)
    };
  }
  if (w.kind === "lote") {
    const l = LOTES.find((x) => x.id === w.id) || LOTES[0];
    return {
      clave, abierto, color: estadoColor(l.estado), label: l.id, valor: l.humedad + "%",
      detalle: `${l.nombre} · ${l.cultivo.toLowerCase()} · ${l.kg} kg en campaña`,
      spark: null
    };
  }
  // clima
  const jue = CLIMA.find(([d]) => d === "Jue");
  return {
    clave, abierto, color: C.water, label: "lluvia 7 d", valor: CLIMA.reduce((a, [, mm]) => a + mm, 0) + " mm",
    detalle: `jue ${jue ? jue[1] : "—"} mm · el resto de la semana por debajo de 12 mm`,
    spark: null
  };
}

function estadoColor(estado) {
  return estado === "Óptima" ? C.leaf : estado === "Límite" ? C.wheat : C.clay;
}

// ═══════════ render: barra lateral ═══════════

function renderTema() {
  const oscuro = temaActual() === "dark";
  document.documentElement.dataset.tema = oscuro ? "dark" : "light";
  const btn = $("wk-tema-btn");
  btn.textContent = oscuro ? "☀" : "☾";
  btn.title = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
}

function renderLiaTarjeta() {
  const pendientes = acciones().filter((h) => modoDe(h.ancla, h.modo) === "pendiente").length;
  const ejecutadas = acciones().filter((h) => ["hecho", "aprobada"].includes(modoDe(h.ancla, h.modo))).length;

  $("wk-lia-tarjeta").innerHTML = `
    <div class="lia-fila">
      <span class="lia-punto"></span>
      <div>
        <div class="lia-nombre">LIA <span class="lia-insignia">IA</span></div>
        <div class="lia-sub mono">openclaw · en turno</div>
      </div>
    </div>
    <p class="lia-estado">Te avisa antes de tocar riego o corte; el resto lo ordena sola y te lo cuenta después.</p>
    <div class="lia-stats">
      <button type="button" data-accion="drawer-filtro" data-valor="espera">
        <span class="lia-stat-num mono" style="color:${C.wheat}">${pendientes}</span>
        <span class="lia-stat-txt">te espera<br />a ti</span>
      </button>
      <button type="button" data-accion="drawer-filtro" data-valor="hecho">
        <span class="lia-stat-num mono" style="color:${C.leaf}">${ejecutadas}</span>
        <span class="lia-stat-txt">ya lo hizo<br />LIA</span>
      </button>
    </div>`;
}

function renderNav() {
  const ejecutadas = acciones().filter((h) => ["hecho", "aprobada"].includes(modoDe(h.ancla, h.modo))).length;
  const items = [
    ["chat", "Chat con LIA", null],
    ["historial", "Historial de acciones", ejecutadas]
  ];
  $("wk-lia-nav").innerHTML = items.map(([id, label, badge]) => `
    <button type="button" data-accion="vista" data-valor="${id}" class="${S.vista === id ? "activo" : ""}">
      <span class="nav-punto"></span>
      <span>${label}</span>
      ${badge != null ? `<span class="nav-insignia">${badge}</span>` : ""}
    </button>`).join("");
}

function renderRecientes() {
  const recientes = S.hilo.filter((h) => h.tipo === "accion").slice().reverse().slice(0, 3);
  $("wk-lia-recientes").innerHTML = `
    <div class="lat-titulo">últimas acciones</div>
    <div class="recientes-lista">
      ${recientes.map((h) => `
        <button type="button" data-accion="ir-hilo" data-ancla="${h.ancla}">
          <i style="background:${modoDe(h.ancla, h.modo) === "descartada" ? C.mute : TONO_PROPUESTA[h.tono]}"></i>
          <span class="mono recientes-hora">${h.hora}</span>
          <span class="recientes-titulo">${esc(corto(h.lead, 30))}</span>
        </button>`).join("")}
    </div>`;
}

function renderPulso() {
  const kgCampana = LOTES.reduce((a, l) => a + l.kg, 0);
  const jueves = CLIMA.find(([d]) => d === "Jue");
  const peorLote = LOTES.slice().sort((a, b) => b.humedad - a.humedad)[0];

  const filas = [
    ["Kg de campaña", C.leaf, kgCampana.toLocaleString("es-CO")],
    ["Lluvia jueves", C.water, (jueves ? jueves[1] : 0) + " mm"],
    ["Lote a vigilar", estadoColor(peorLote.estado), peorLote.id],
    ["Cuadrilla activa", C.wheat, CUADRILLA.length + " personas"]
  ];

  $("wk-lia-pulso").innerHTML = `
    <div class="lat-titulo">la finca ahora</div>
    <div class="pulso-lista">
      ${filas.map(([etq, color, val]) => `
        <div class="pulso-fila">
          <i style="background:${color}"></i>
          <span class="pulso-etiqueta">${etq}</span>
          <span class="mono pulso-valor">${val}</span>
        </div>`).join("")}
    </div>`;
}

function renderUsuario() {
  const { iniciales, nombre } = FINCA.usuario;
  $("wk-lia-usuario").innerHTML = `
    <span class="usuario-avatar">${esc(iniciales)}</span>
    <div>
      <div class="usuario-nombre">${esc(nombre)}</div>
      <div class="mono usuario-finca">${esc(FINCA.nombre)} · ${esc(FINCA.detalle.split(" · ")[0])}</div>
    </div>`;
  $("wk-finca-movil").textContent = FINCA.nombre;
}

// ═══════════ render: aviso de conexión ═══════════

function renderAviso() {
  const el = $("wk-aviso");
  if (S.conectado === null) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = S.conectado
    ? `<i style="background:${C.leaf}"></i> Conectada con el agente vía agent-bridge.`
    : `<i style="background:${C.clay}"></i> Sin conexión con el agente todavía — el chat no va a responder hasta que el Worker /api esté desplegado. El hilo de hoy que ves abajo es de muestra.`;
}

// ═══════════ render: cima del chat + panel de datos ═══════════

function renderChatCima() {
  $("wk-chat-cima").innerHTML = `
    <div class="chat-cima-fila">
      <span class="mono chat-fecha">${esc(HORA_FMT.format(new Date()))}</span>
      <span class="chat-linea"></span>
      <button type="button" class="pastilla" data-accion="datos">${S.datos ? "esconder los números" : "ver los números"}</button>
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
      <line x1="0" y1="34" x2="300" y2="34" stroke="var(--linea-suave)" stroke-width="1"></line>
      ${CLIMA.map(([dia, mm], i) => {
        const h = Math.max(2, (mm / lluviaMax) * 24);
        const x = 8 + i * 42;
        return `<g>
          <rect x="${x}" y="${(34 - h).toFixed(1)}" width="24" height="${h.toFixed(1)}" fill="${C.water}" rx="2"></rect>
          <text x="${x + 12}" y="${(34 - h - 3).toFixed(1)}" text-anchor="middle" font-family="DM Mono" font-size="7.5" fill="${C.water}">${mm}mm</text>
          <text x="${x + 12}" y="44" text-anchor="middle" font-family="DM Mono" font-size="8" fill="var(--apagado)">${dia}</text>
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

// ═══════════ render: hilo del chat ═══════════

function chipsHtml(chips, ctx) {
  if (!chips || !chips.length) return "";
  return `<div class="hilo-chips">
    ${chips.map((w) => {
      const c = chip(w, ctx);
      return `
      <div class="chip-envoltorio">
        <button type="button" class="chip" data-accion="chip" data-clave="${esc(c.clave)}" style="border-color:${c.abierto ? c.color : "var(--linea-fuerte)"}">
          <i style="background:${c.color}"></i>
          <span class="mono">${esc(c.label)}</span>
          <span class="mono" style="color:${c.color}">${esc(c.valor)}</span>
          ${c.spark ? `<svg viewBox="0 0 34 12" class="chip-spark"><polyline fill="none" stroke="${c.color}" stroke-width="1.2" points="${c.spark}"></polyline></svg>` : ""}
          <span class="mono chip-mas">${c.abierto ? "−" : "+"}</span>
        </button>
        ${c.abierto ? `<div class="chip-detalle mono">${esc(c.detalle)}</div>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

const ESTADO_TEXTO = {
  aprobada: "listo, va en camino", descartada: "descartado, no lo toco",
  programado: "agendado para las 15:00", hecho: "hecho · reversible"
};

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
        <div class="hilo-texto hilo-texto-libre">${md(m.texto)}</div>
      </div>
    </div>`;
  }).join("") + (S.chat.enviando ? `<div class="hilo-msg"><span class="hilo-avatar">L</span><div class="hilo-burbuja hilo-pensando mono">${esc(ETAPAS_ESPERA[S.chat.etapa])}</div></div>` : "");

  caja.innerHTML = chatHtml;

  if (alFinal) caja.scrollTop = caja.scrollHeight;
}

function renderChatPie() {
  const oculto = S.vista !== "chat";
  $("wk-chat-pie").hidden = oculto;
  if (oculto) return;

  $("wk-chat-atajos").innerHTML = ATAJOS_DEMO.slice(0, 2).map((a) =>
    `<button type="button" class="pastilla" data-accion="atajo" data-valor="${esc(a)}">${esc(a)}</button>`).join("");

  $("wk-chat-estado") && ($("wk-chat-estado").textContent = S.conectado ? "en línea" : "sin conexión");
  $("wk-chat-input").disabled = S.chat.enviando;
  $("wk-chat-enviar").disabled = S.chat.enviando;
}

// ═══════════ render: historial ═══════════

function renderHistorial() {
  const oculto = S.vista !== "historial";
  $("wk-vista-historial").hidden = oculto;
  if (oculto) return;

  const ejecutadas = acciones().filter((h) => ["hecho", "aprobada"].includes(modoDe(h.ancla, h.modo))).length;
  const pendientes = acciones().filter((h) => modoDe(h.ancla, h.modo) === "pendiente").length;

  const lista = acciones().slice().reverse().map((h) => {
    const modo = modoDe(h.ancla, h.modo);
    const acento = modo === "descartada" ? C.mute : TONO_PROPUESTA[h.tono];
    return `
    <div class="historial-tarjeta" style="border-left-color:${acento}">
      <div class="historial-cab">
        <span class="mono historial-tag" style="color:${acento}">${esc(h.tag)}</span>
        <span class="mono historial-hora">${h.hora}</span>
      </div>
      <button type="button" class="historial-titulo" data-accion="ir-hilo" data-ancla="${h.ancla}">${esc(h.lead)}</button>
      <p class="historial-texto">${esc(h.texto)}</p>
      ${chipsHtml(h.chips, h.ancla)}
      <div class="historial-meta">
        <span class="mono">${modo === "pendiente" ? "esperándote" : esc(ESTADO_TEXTO[modo])}</span>
        <span class="mono" style="color:${acento}; margin-left:auto">seguridad ${h.confianza}%</span>
      </div>
      ${modo === "pendiente" ? `
        <div class="embed-acciones" style="margin-top:9px">
          <button type="button" class="btn btn-hazlo" data-accion="decision" data-ancla="${h.ancla}" data-valor="aprobada">Hazlo</button>
          <button type="button" class="btn btn-no" data-accion="decision" data-ancla="${h.ancla}" data-valor="descartada">No</button>
        </div>` : ""}
    </div>`;
  }).join("");

  const notas = S.hilo.filter((h) => h.tipo === "nota");

  $("wk-vista-historial").innerHTML = `
    <div class="historial-cima">
      <span class="historial-titulo-vista">Historial de acciones</span>
      <span class="mono historial-resumen">${ejecutadas} hechas · ${pendientes} esperando</span>
    </div>
    <div class="historial-resumen-dia">
      <p class="historial-resumen-titulo">${esc(BRIEFING_DEMO.titulo)}</p>
      <p class="historial-resumen-detalle">${esc(BRIEFING_DEMO.detalle)}</p>
      ${notas.map((n) => `<p class="mono historial-resumen-nota"><span class="hilo-nota-hora">${n.hora}</span> ${esc(n.texto)}</p>`).join("")}
    </div>
    <p class="historial-nota">Todo lo que LIA propuso o hizo hoy, de lo más reciente a lo más viejo.</p>
    <div class="historial-lista">${lista}</div>`;
}

// ═══════════ render: propuestas (drawer) ═══════════

function renderDrawer() {
  const pendientes = acciones().filter((h) => modoDe(h.ancla, h.modo) === "pendiente").length;
  const ejecutadas = acciones().filter((h) => ["hecho", "aprobada"].includes(modoDe(h.ancla, h.modo))).length;
  const drawer = $("wk-drawer");
  drawer.classList.toggle("abierto", S.drawer);

  if (!S.drawer) {
    drawer.innerHTML = `
      <button type="button" class="drawer-pestana" data-accion="drawer-toggle" aria-label="Abrir propuestas">
        <span class="drawer-pestana-fila">
          <span class="drawer-insignia mono">${pendientes}</span>
          <span class="drawer-pestana-txt">
            <span class="drawer-pestana-titulo">Propuestas</span>
            <span class="mono drawer-pestana-sub">${ejecutadas} hechas hoy</span>
          </span>
        </span>
        <span class="drawer-puntos">
          ${acciones().map((h) => {
            const modo = modoDe(h.ancla, h.modo);
            const color = modo === "pendiente" ? C.wheat : modo === "descartada" ? "var(--linea-fuerte)" : C.leaf;
            return `<i style="background:${color}; opacity:${modo === "pendiente" ? 1 : 0.45}"></i>`;
          }).join("")}
        </span>
        <span class="mono drawer-pestana-ver">Ver panel ‹</span>
      </button>`;
    return;
  }

  const visible = (m) => S.filtro === "todo" ? true : S.filtro === "espera" ? m === "pendiente" : m !== "pendiente";
  const lista = acciones().filter((h) => visible(modoDe(h.ancla, h.modo))).slice().reverse().map((h) => {
    const modo = modoDe(h.ancla, h.modo);
    const acento = modo === "descartada" ? C.mute : TONO_PROPUESTA[h.tono];
    return `
    <div class="drawer-tarjeta" style="border-left-color:${acento}">
      <div class="drawer-tarjeta-cab">
        <span class="mono" style="color:${acento}">${esc(h.tag)}</span>
        <span class="mono drawer-hora">${h.hora}</span>
      </div>
      <button type="button" class="drawer-titulo" data-accion="ir-hilo" data-ancla="${h.ancla}">${esc(h.lead)}</button>
      <div class="drawer-tarjeta-meta">
        <span class="mono">${modo === "pendiente" ? "esperándote" : esc(ESTADO_TEXTO[modo])}</span>
        <span class="drawer-barra"><span style="width:${h.confianza}%; background:${acento}"></span></span>
        <span class="mono" style="color:${acento}">${h.confianza}%</span>
      </div>
      ${modo === "pendiente" ? `
        <div class="drawer-acciones">
          <button type="button" class="btn btn-hazlo" data-accion="decision" data-ancla="${h.ancla}" data-valor="aprobada">Hazlo</button>
          <button type="button" class="btn btn-no" data-accion="decision" data-ancla="${h.ancla}" data-valor="descartada">No</button>
        </div>` : ""}
    </div>`;
  }).join("");

  drawer.innerHTML = `
    <div class="drawer-panel">
      <div class="drawer-cab">
        <span class="drawer-cab-titulo">Propuestas</span>
        <span class="mono drawer-cab-insignia">${pendientes}</span>
        <button type="button" class="drawer-cerrar" data-accion="drawer-toggle" aria-label="Cerrar propuestas">›</button>
      </div>
      <div class="drawer-filtros">
        ${[["espera", "en espera"], ["hecho", "hechas"], ["todo", "todas"]].map(([id, label]) =>
          `<button type="button" class="${S.filtro === id ? "activo" : ""}" data-accion="drawer-filtro" data-valor="${id}">${label}</button>`).join("")}
      </div>
      <div class="drawer-lista">${lista || `<p class="drawer-vacio mono">nada por aquí</p>`}</div>
      <div class="drawer-registro">
        <div class="lat-titulo">lo que hizo hoy</div>
        ${REGISTRO_DEMO.map((r) => `
          <div class="registro-fila">
            <span class="mono registro-hora">${r.hora}</span>
            <span class="registro-texto">${esc(r.texto)}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

// ═══════════ render maestro ═══════════

function render() {
  renderTema();
  renderLiaTarjeta();
  renderNav();
  renderRecientes();
  renderPulso();
  renderUsuario();
  renderAviso();

  $("wk-vista-chat").hidden = S.vista !== "chat";
  if (S.vista === "chat") {
    renderChatCima();
    renderChatDatos();
    renderChatHilo();
  }
  renderHistorial();
  renderChatPie();
  renderDrawer();
}

// ═══════════ eventos ═══════════

function accionDe(target) {
  const el = target.closest?.("[data-accion]");
  return el ? { el, accion: el.dataset.accion } : null;
}

function irAAncla(ancla) {
  set({ vista: "historial" });
  requestAnimationFrame(() => {
    const el = $(ancla);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("hilo-foco");
      setTimeout(() => el.classList.remove("hilo-foco"), 2200);
    }
  });
}

document.addEventListener("click", (e) => {
  const hit = accionDe(e.target);
  if (!hit) return;
  const { el, accion } = hit;

  switch (accion) {
    case "tema":
      set({ tema: temaActual() === "light" ? "dark" : "light" });
      try { window.localStorage.setItem("waiker-tema", S.tema); } catch { /* modo privado: seguimos sin recordar tema */ }
      break;

    case "vista":
      set({ vista: el.dataset.valor });
      break;

    case "datos":
      set({ datos: !S.datos });
      break;

    case "lote":
      set({ lote: el.dataset.id });
      break;

    case "chip":
      set({ chips: { ...S.chips, [el.dataset.clave]: !S.chips[el.dataset.clave] } });
      break;

    case "decision":
      set({ decisiones: { ...S.decisiones, [el.dataset.ancla]: el.dataset.valor } });
      break;

    case "ir-hilo":
      irAAncla(el.dataset.ancla);
      break;

    case "drawer-toggle":
      set({ drawer: !S.drawer });
      break;

    case "drawer-filtro":
      set({ drawer: true, filtro: el.dataset.valor });
      break;

    case "atajo":
      enviarDesdeInput(el.dataset.valor);
      break;

    case "abrir-menu":
      document.querySelector(".app").classList.add("menu-abierto");
      $("lateral").querySelector("button")?.focus();
      break;

    case "cerrar-menu":
      cerrarMenu();
      break;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarMenu();
});

function cerrarMenu() {
  document.querySelector(".app").classList.remove("menu-abierto");
}

// ── asistente ──

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

// ═══════════ arranque ═══════════

async function iniciar() {
  try {
    const guardado = window.localStorage.getItem("waiker-tema");
    if (guardado === "light" || guardado === "dark") S.tema = guardado;
  } catch { /* modo privado: usamos el tema por defecto */ }

  await cargarHilo();
  render();
  S.conectado = await hayConexion();
  render();
}

iniciar();
