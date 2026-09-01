// ─────────────────────────────────────────────────────────────
//  Waiker · panel de finca Agromyss
//
//  Estado en memoria + render completo en cada cambio.
//  Sin framework ni paso de compilación: el Worker sirve estos
//  archivos tal cual.
// ─────────────────────────────────────────────────────────────

import {
  C, FINCA, CULTIVOS, COLOR_CULTIVO, RANGOS, DIAS,
  LOTES, OBJETIVO_CAMPANA, ESTADO_LOTE,
  SENSORES, COLOR_SENSOR,
  TAREAS, TAREAS_HECHAS,
  PROPUESTAS_DEMO, TONO_PROPUESTA, AUTONOMIA_TOTAL, AUTONOMIA_BASE,
  CUENTAS, CUENTAS_BARRA, CLIMA, LABORES, CUADRILLA, COLOR_AVATAR,
  ANILLOS, SALUDO_LIA
} from "./data.js";

import {
  enviarMensaje, obtenerPropuestas, registrarDecision, hayConexion
} from "./api.js";

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

const nfNum = new Intl.NumberFormat("es-CO");
const nfDec = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfCop = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0
});

const num = (n) => nfNum.format(n);
const dec = (n) => nfDec.format(n);
const cop = (n) => nfCop.format(n);

/** Serie pseudoaleatoria pero estable: mismas entradas → mismo dibujo. */
function generar(n, base, amp, semilla) {
  return Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.round(
      base +
      amp * Math.sin(i * 0.72 + semilla) +
      amp * 0.45 * Math.sin(i * 1.93 + semilla * 2) +
      amp * 0.2 * Math.cos(i * 3.1 + semilla)
    ))
  );
}

/** Convierte una lista de valores en un path SVG. */
function ruta(vals, w, h, pad, max) {
  const m = max || Math.max(...vals) * 1.15 || 1;
  return vals
    .map((v, i) => {
      const x = (i * (w / (vals.length - 1))).toFixed(1);
      const y = (pad + (1 - v / m) * (h - pad * 2)).toFixed(1);
      return (i ? "L" : "M") + x + " " + y;
    })
    .join(" ");
}

const circunf = (r) => 2 * Math.PI * r;
const dash = (pct, r) => `${(circunf(r) * pct / 100).toFixed(1)} ${circunf(r).toFixed(1)}`;

// ═══════════ estado ═══════════

const S = {
  nav: "produccion",
  rango: "7d",
  cultivo: "Todos",
  hover: null,
  lote: "B-1",
  sensor: "S-04",
  hechas: [...TAREAS_HECHAS],
  propuestas: [],
  usandoDemo: true,
  conectado: false,
  chat: {
    mensajes: [{ rol: "lia", texto: SALUDO_LIA }],
    enviando: false
  }
};

function set(parche) {
  Object.assign(S, parche);
  render();
}

// ═══════════ series de producción ═══════════

/** Cultivos visibles según el filtro activo. */
function cultivosVisibles() {
  return S.cultivo === "Todos"
    ? CULTIVOS.slice(1)
    : [S.cultivo];
}

function seriesProduccion() {
  const n = RANGOS[S.rango];
  const escala = S.rango === "24h" ? 0.28 : 1;
  const bases = { Cacao: [96, 34, 1.2], "Café": [58, 22, 3.4], Mango: [34, 14, 5.6] };

  const series = cultivosVisibles().map((cultivo) => {
    const [base, amp, semilla] = bases[cultivo];
    return {
      cultivo,
      color: COLOR_CULTIVO[cultivo],
      valores: generar(n, base * escala, amp * escala, semilla)
    };
  });

  const etiquetas =
    n === 7 ? DIAS.slice()
      : n === 24 ? Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0") + "h")
        : Array.from({ length: 30 }, (_, i) => String(((i + 12) % 31) + 1));

  return { n, series, etiquetas };
}

// ═══════════ render: barra lateral ═══════════

const SECCIONES = [
  ["produccion", "Panel", null],
  ["mapa", "Mapa de lotes", null],
  ["plan", "Plan del día", "tareas"],
  ["sensores", "Sensores", null],
  ["clima", "Clima", null],
  ["openclaw", "Openclaw", "propuestas"],
  ["asistente", "Asistente", null]
];

function renderNav() {
  const pendientes = S.propuestas.filter((p) => !p.decision).length;
  const porHacer = S.hechas.filter((v) => !v).length;

  $("wk-nav").innerHTML = SECCIONES.map(([id, etiqueta, tipo]) => {
    const activo = S.nav === id;
    let insignia = "";
    if (tipo === "propuestas" && pendientes) insignia = String(pendientes);
    if (tipo === "tareas" && porHacer) insignia = String(porHacer);

    return `
      <button type="button" class="${activo ? "activo" : ""}"
              data-accion="ir" data-id="${id}"
              ${activo ? 'aria-current="true"' : ""}>
        <span class="nav-punto"></span>
        <span>${esc(etiqueta)}</span>
        ${insignia ? `<span class="nav-insignia">${insignia}</span>` : ""}
      </button>`;
  }).join("");
}

function renderAutonomia() {
  const aprobadas = AUTONOMIA_BASE + S.propuestas.filter((p) => p.decision === "aprobada").length;
  const pct = Math.round((aprobadas / AUTONOMIA_TOTAL) * 100);

  $("wk-autonomia").innerHTML = `
    <div class="autonomia-titulo">Openclaw · autonomía</div>
    <div class="autonomia-fila">
      <svg viewBox="0 0 56 56" role="img" aria-label="${pct}% de acciones aprobadas">
        <circle cx="28" cy="28" r="23" fill="none" stroke="#453a2f" stroke-width="6"></circle>
        <circle cx="28" cy="28" r="23" fill="none" stroke="${C.wheat}" stroke-width="6"
                stroke-dasharray="${dash(pct, 23)}" transform="rotate(-90 28 28)"></circle>
        <text x="28" y="32" text-anchor="middle" font-family="DM Mono" font-size="12" fill="#f3ece1">${pct}%</text>
      </svg>
      <div class="autonomia-texto">
        Acciones aprobadas<br><strong>${aprobadas} de ${AUTONOMIA_TOTAL}</strong> hoy
      </div>
    </div>
    <div class="autonomia-ticks">
      ${Array.from({ length: AUTONOMIA_TOTAL }, (_, i) =>
        `<span style="background:${i < aprobadas ? C.wheat : "#453a2f"}"></span>`).join("")}
    </div>`;
}

// ═══════════ render: cabecera ═══════════

function renderCabecera() {
  $("wk-finca-nombre").textContent = FINCA.nombre;
  $("wk-finca-detalle").textContent = FINCA.detalle;

  $("wk-perfil").innerHTML = `
    <span class="perfil-avatar">${esc(FINCA.usuario.iniciales)}</span>
    <div>
      <div class="perfil-nombre">${esc(FINCA.usuario.nombre)}</div>
      <div class="perfil-rol">${esc(FINCA.usuario.rol)}</div>
    </div>`;

  $("wk-cultivos").innerHTML = CULTIVOS.map((c) => {
    const on = S.cultivo === c;
    const bg = on ? (COLOR_CULTIVO[c] || C.coffee) : "transparent";
    return `<button type="button" class="${on ? "activo" : ""}"
              style="background:${bg}" data-accion="cultivo" data-valor="${esc(c)}"
              aria-pressed="${on}">${esc(c)}</button>`;
  }).join("");

  $("wk-rangos").innerHTML = Object.keys(RANGOS).map((r) => {
    const on = S.rango === r;
    return `<button type="button" class="mono ${on ? "activo" : ""}"
              style="background:${on ? C.ink : "transparent"}"
              data-accion="rango" data-valor="${r}" aria-pressed="${on}">${r}</button>`;
  }).join("");

  const { n, series } = seriesProduccion();
  const ultimo = series.reduce((a, s) => a + s.valores[n - 1], 0);

  const kpis = [
    ["Kg hoy", num(ultimo), "+6%", C.leaf],
    ["Kg/jornal", "24,8", "+1,2", C.leaf],
    ["Humedad media", "39%", "+7", C.clay],
    ["Lluvia 24 h", "18 mm", "", C.mute],
    ["Cuadrilla", "9/11", "2 faltas", C.clay]
  ];

  $("wk-kpis").innerHTML = kpis.map(([etiqueta, valor, delta, color]) => `
    <div class="kpi">
      <div class="kpi-etiqueta">${esc(etiqueta)}</div>
      <div class="kpi-valor">
        <b>${esc(valor)}</b>
        ${delta ? `<span class="kpi-delta" style="color:${color}">${esc(delta)}</span>` : ""}
      </div>
    </div>`).join("");
}

function renderAviso() {
  const el = $("wk-aviso");
  // El texto va dentro de un único <span>: .aviso es flex y, suelto,
  // cada nodo de texto se convertiría en un elemento flexible aparte.
  if (S.conectado && !S.usandoDemo) {
    el.innerHTML = `<i style="background:${C.leaf}"></i>` +
      `<span>Conectado al agente Openclaw. Las métricas de campo siguen siendo simuladas.</span>`;
  } else {
    el.innerHTML = `<i style="background:${C.wheat}"></i>` +
      `<span>Modo prototipo · datos simulados. El asistente y las propuestas ` +
      `responderán cuando el intermediario <span class="mono">/api</span> esté desplegado.</span>`;
  }
}

// ═══════════ render: recolección ═══════════

function renderProduccion() {
  const { n, series, etiquetas } = seriesProduccion();
  const X0 = 34, X1 = 562, TOP = 20, BOT = 160;

  const todos = series.flatMap((s) => s.valores);
  const max = Math.max(...todos) * 1.18 || 1;
  const px = (i) => X0 + i * ((X1 - X0) / (n - 1));
  const py = (v) => TOP + (1 - v / max) * (BOT - TOP);
  const hi = S.hover == null ? n - 1 : Math.min(S.hover, n - 1);
  const paso = (X1 - X0) / (n - 1);
  const cada = n === 30 ? 5 : n === 24 ? 4 : 1;

  $("wk-rango-label").textContent =
    S.rango === "24h" ? "últimas 24 horas" : S.rango === "7d" ? "últimos 7 días" : "últimos 30 días";

  $("wk-produccion-leyenda").innerHTML = `
    <div class="sub mono">${esc(etiquetas[hi])}</div>
    <div class="series">
      ${series.map((s) => `
        <span class="serie-valor">
          <i class="cuadro" style="background:${s.color}"></i>${num(s.valores[hi])} kg
        </span>`).join("")}
    </div>`;

  const objetivoY = py(max * 0.78);

  $("wk-produccion-svg").innerHTML = `
    <svg viewBox="0 0 570 208" role="img"
         aria-label="Recolección en kg por día por cultivo">
      <g stroke="${C.grid}" stroke-width="1">
        ${[20, 55, 90, 125].map((y) =>
          `<line x1="34" y1="${y}" x2="562" y2="${y}"></line>`).join("")}
      </g>
      <g font-family="DM Mono" font-size="9" fill="${C.faint}">
        ${[0, 1, 2, 3].map((k) => {
          const y = 20 + k * 35 + 3;
          const val = Math.round(max * (1 - (k * 35) / (BOT - TOP)));
          return `<text x="4" y="${y}">${val}</text>`;
        }).join("")}
      </g>
      <line x1="34" y1="160" x2="562" y2="160" stroke="${C.line}" stroke-width="1"></line>

      <line x1="34" y1="${objetivoY.toFixed(1)}" x2="562" y2="${objetivoY.toFixed(1)}"
            stroke="${C.wheat}" stroke-width="1" stroke-dasharray="4 4"></line>
      <text x="540" y="${(objetivoY - 4).toFixed(1)}" text-anchor="end"
            font-family="DM Mono" font-size="9" fill="${C.wheat}">objetivo</text>

      <line x1="${px(hi).toFixed(1)}" y1="14" x2="${px(hi).toFixed(1)}" y2="160"
            stroke="#c2b6a8" stroke-width="1"></line>

      ${series.map((s) => `
        <polyline fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"
                  points="${s.valores.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")}"></polyline>
        <circle cx="${px(hi).toFixed(1)}" cy="${py(s.valores[hi]).toFixed(1)}" r="4"
                fill="#fff" stroke="${s.color}" stroke-width="2"></circle>`).join("")}

      <g font-family="DM Mono" font-size="9" fill="${C.faint}">
        ${etiquetas.map((l, i) => (i % cada === 0
          ? `<text x="${px(i).toFixed(1)}" y="176" text-anchor="middle">${esc(l)}</text>`
          : "")).join("")}
      </g>

      ${Array.from({ length: n }, (_, i) =>
        `<rect x="${(px(i) - paso / 2).toFixed(1)}" y="14" width="${paso.toFixed(1)}" height="146"
               fill="transparent" style="cursor:crosshair"
               data-accion="hover" data-i="${i}"></rect>`).join("")}
    </svg>`;
}

// ═══════════ render: riego / jornales ═══════════

const MINIS = [
  {
    etiqueta: "Riego", valor: "4,2", unidad: "m³", delta: "−0,6 vs plan", deltaColor: C.clay,
    plan: [46, 54, 30, 58, 40, 36, 50], real: [30, 44, 26, 40, 34, 22, 38], color: C.water
  },
  {
    etiqueta: "Jornales", valor: "63", unidad: "h", delta: "+2 h", deltaColor: C.leaf,
    plan: [52, 60, 40, 56, 48, 30, 44], real: [50, 58, 44, 52, 46, 26, 40], color: C.leaf
  }
];

function renderMinis() {
  $("wk-minis").innerHTML = MINIS.map((m) => `
    <div class="mini">
      <div class="mini-cab">
        <span class="mini-etiqueta">${esc(m.etiqueta)}</span>
        <span class="ml-auto" style="font-size:10px;color:${m.deltaColor}">${esc(m.delta)}</span>
      </div>
      <div class="mini-valor">${esc(m.valor)}<small> ${esc(m.unidad)}</small></div>
      <svg viewBox="0 0 150 60" role="img" aria-label="${esc(m.etiqueta)}: plan frente a real">
        ${m.plan.map((p, i) => {
          const r = m.real[i];
          const x = 4 + i * 21;
          return `<rect x="${x}" y="${60 - p * 0.9}" width="14" height="${p * 0.9}" fill="#e0d3bd" rx="1"></rect>
                  <rect x="${x}" y="${60 - r * 0.9}" width="14" height="${r * 0.9}" fill="${m.color}" rx="1"></rect>`;
        }).join("")}
      </svg>
      <div class="mini-leyenda">
        <span><i class="cuadro" style="background:#e0d3bd"></i>plan</span>
        <span><i class="cuadro" style="background:${m.color}"></i>real</span>
      </div>
    </div>`).join("");
}

// ═══════════ render: mapa y detalle de lote ═══════════

function colorEstado(estado) {
  return estado === "Óptima" ? C.leaf : estado === "Límite" ? C.wheat : C.clay;
}

function renderMapa() {
  $("wk-mapa-svg").innerHTML = `
    <svg viewBox="0 0 300 200" role="img" aria-label="Mapa de lotes de la finca">
      <g fill="none" stroke="#f2ebde" stroke-width="1">
        <path d="M4 26 C70 8 140 40 210 22 C250 12 284 28 298 20"></path>
        <path d="M4 62 C70 44 140 76 210 58 C250 48 284 64 298 56"></path>
        <path d="M4 98 C70 80 140 112 210 94 C250 84 284 100 298 92"></path>
        <path d="M4 134 C70 116 140 148 210 130 C250 120 284 136 298 128"></path>
        <path d="M4 170 C70 152 140 184 210 166 C250 156 284 172 298 164"></path>
      </g>
      ${LOTES.map((l) => {
        const on = l.id === S.lote;
        return `
          <g style="cursor:pointer" data-accion="lote" data-id="${l.id}">
            <title>${esc(l.id)} · ${esc(l.nombre)} · ${esc(l.cultivo)} · humedad ${l.humedad}%</title>
            <path d="${l.d}" fill="${on ? "#f0e3cd" : "#faf6ee"}"
                  stroke="${on ? C.coffee : "#c9bda9"}" stroke-width="${on ? 2 : 1}"></path>
            <text x="${l.tx}" y="${l.ty}" font-family="DM Mono" font-size="9.5" fill="#5c5145">${esc(l.id)}</text>
            <circle cx="${l.px}" cy="${l.py}" r="5.5" fill="${colorEstado(l.estado)}"
                    stroke="#fff" stroke-width="1.5"></circle>
          </g>`;
      }).join("")}
    </svg>`;
}

function renderLote() {
  const l = LOTES.find((x) => x.id === S.lote) || LOTES[0];
  const [bg, fg] = ESTADO_LOTE[l.estado];
  const linea = ruta(l.hum, 260, 74, 8, 60);
  const optY = (8 + (1 - 35 / 60) * 58).toFixed(1);

  const stats = [
    ["Cultivo", l.cultivo],
    ["Superficie", dec(l.ha) + " ha"],
    ["Humedad", l.humedad + "%"],
    ["Kg campaña", num(l.kg)]
  ];

  $("wk-lote").innerHTML = `
    <div class="lote-cab">
      <h3>Lote ${esc(l.id)}</h3>
      <span class="sub">${esc(l.nombre)}</span>
      <span class="insignia ml-auto" style="background:${bg};color:${fg}">${esc(l.estado)}</span>
    </div>
    <div class="lote-stats">
      ${stats.map(([k, v]) => `
        <div class="lote-stat">
          <div class="etiqueta-min">${esc(k)}</div>
          <div class="lote-stat-valor">${esc(v)}</div>
        </div>`).join("")}
    </div>
    <div class="lote-titulo-serie">Humedad 7 días</div>
    <svg viewBox="0 0 260 74" role="img" aria-label="Humedad del lote ${esc(l.id)} en 7 días">
      <path d="${linea} L260 74 L0 74 Z" fill="#e8ddc9"></path>
      <path d="${linea}" fill="none" stroke="${C.coffee}" stroke-width="2"></path>
      <line x1="0" y1="${optY}" x2="260" y2="${optY}" stroke="${C.leaf}"
            stroke-width="1" stroke-dasharray="3 3"></line>
    </svg>`;
}

// ═══════════ render: acumulado ═══════════

function renderAcumulado() {
  const total = LOTES.reduce((a, l) => a + l.kg, 0);
  const pct = Math.round((total / OBJETIVO_CAMPANA) * 100);

  $("wk-acumulado").innerHTML = `
    <div style="min-width:0">
      <div class="etiqueta-min">Campaña acumulada</div>
      <div class="acumulado-cifra">${num(total)}</div>
      <div class="acumulado-pie">kg entregados · ${pct}% del objetivo de ${num(OBJETIVO_CAMPANA)} kg</div>
    </div>
    <div class="anillos">
      ${ANILLOS.map(([p, color, etiqueta]) => `
        <div class="anillo">
          <svg viewBox="0 0 72 72" role="img" aria-label="${esc(etiqueta)}: ${p}%">
            <circle cx="36" cy="36" r="29" fill="none" stroke="${C.grid}" stroke-width="7"></circle>
            <circle cx="36" cy="36" r="29" fill="none" stroke="${color}" stroke-width="7"
                    stroke-dasharray="${dash(p, 29)}" transform="rotate(-90 36 36)"></circle>
            <text x="36" y="41" text-anchor="middle" font-family="DM Mono"
                  font-size="15" fill="${C.ink}">${p}%</text>
          </svg>
          <div class="anillo-etiqueta">${esc(etiqueta)}</div>
        </div>`).join("")}
    </div>`;
}

// ═══════════ render: plan del día ═══════════

function renderPlan() {
  const hechas = S.hechas.filter(Boolean).length;
  const pct = Math.round((hechas / TAREAS.length) * 100);

  $("wk-plan-resumen").textContent = `${hechas}/${TAREAS.length} hechas · 16 h`;
  $("wk-plan-barra").style.width = pct + "%";

  $("wk-plan-tareas").innerHTML = TAREAS.map(([etiqueta, lote, horas], i) => {
    const on = S.hechas[i];
    return `
      <button type="button" class="tarea ${on ? "hecha" : ""}"
              data-accion="tarea" data-i="${i}" aria-pressed="${on}">
        <span class="tarea-caja">${on ? "✓" : ""}</span>
        <span class="tarea-texto">${esc(etiqueta)}</span>
        <span class="tarea-lote">${esc(lote)}</span>
        <span class="tarea-horas">${esc(horas)}</span>
      </button>`;
  }).join("");
}

// ═══════════ render: propuestas ═══════════

function renderPropuestas() {
  const pendientes = S.propuestas.filter((p) => !p.decision).length;
  $("wk-openclaw-estado").textContent =
    S.propuestas.length ? `${pendientes} sin revisar` : "sin propuestas";

  if (!S.propuestas.length) {
    $("wk-openclaw-lista").innerHTML =
      `<p class="sub">El agente no ha propuesto acciones todavía.</p>`;
    return;
  }

  $("wk-openclaw-lista").innerHTML = S.propuestas.map((p, i) => {
    const acento = p.decision === "descartada" ? C.mute : (TONO_PROPUESTA[p.tono] || C.mute);
    return `
      <article class="propuesta ${p.decision ? "resuelta" : ""}" style="border-left-color:${acento}">
        <div class="propuesta-cab">
          <span class="propuesta-titulo">${esc(p.titulo)}</span>
          <span class="propuesta-lote">${esc(p.lote)}</span>
        </div>
        <div class="propuesta-motivo">${esc(p.motivo)}</div>
        ${p.decision
          ? `<div class="propuesta-estado" style="color:${acento}">${
              p.decision === "aprobada" ? "Aprobado · enviado a la cuadrilla" : "Descartado"
            }</div>`
          : `<div class="propuesta-acciones">
               <button type="button" class="btn" data-accion="propuesta" data-i="${i}" data-decision="aprobada">Aprobar</button>
               <button type="button" class="btn btn-sec" data-accion="propuesta" data-i="${i}" data-decision="descartada">Descartar</button>
             </div>`}
      </article>`;
  }).join("");
}

// ═══════════ render: cuentas ═══════════

function renderCuentas() {
  const neto = CUENTAS.reduce((a, c) => a + c.valor, 0);

  const netoEl = $("wk-cuentas-neto");
  netoEl.textContent = `${neto >= 0 ? "+" : ""}${cop(neto)} neto`;
  netoEl.style.color = neto >= 0 ? C.leaf : C.clay;

  $("wk-cuentas-lista").innerHTML = CUENTAS.map((c) => {
    const positivo = c.signo > 0;
    return `
      <div class="cuenta">
        <i class="cuadro" style="background:${positivo ? C.leaf : C.clay}"></i>
        <span>${esc(c.etiqueta)}</span>
        <span class="cuenta-valor" style="color:${positivo ? C.ink : C.clay}">${cop(c.valor)}</span>
      </div>`;
  }).join("");

  $("wk-cuentas-barra").innerHTML = CUENTAS_BARRA
    .map(([w, color]) => `<span style="width:${w};background:${color}"></span>`).join("");
}

// ═══════════ render: sensores ═══════════

function renderSensores() {
  const enLinea = SENSORES.filter((s) => s.estado !== "sin señal").length;
  $("wk-sensores-resumen").textContent =
    `${enLinea} en línea · ${SENSORES.length - enLinea} sin señal`;

  $("wk-sensores-lista").innerHTML = SENSORES.map((s) => {
    const on = s.id === S.sensor;
    const color = COLOR_SENSOR[s.estado];
    const valColor = s.estado === "alerta" ? C.clay : s.estado === "sin señal" ? C.mute : C.ink;
    return `
      <button type="button" class="sensor-fila ${on ? "activo" : ""}"
              data-accion="sensor" data-id="${s.id}" aria-pressed="${on}">
        <span class="sensor-id"><i style="background:${color}"></i>${esc(s.id)}</span>
        <span class="sensor-lugar">${esc(s.lugar)}</span>
        <span class="sensor-valor" style="color:${valColor}">${s.valor}${esc(s.unidad)}</span>
        <span class="sensor-bat">${s.bateria}%</span>
        <span class="sensor-visto">${esc(s.visto)}</span>
      </button>`;
  }).join("");

  const s = SENSORES.find((x) => x.id === S.sensor) || SENSORES[0];
  const color = COLOR_SENSOR[s.estado];
  const max = Math.max(...s.serie) * 1.25 || 1;
  const linea = ruta(s.serie, 200, 62, 6, max);
  const media = s.serie.reduce((a, b) => a + b, 0) / s.serie.length;

  $("wk-sensor-detalle").innerHTML = `
    <div class="sensor-detalle-id">${esc(s.id)}</div>
    <div class="sub">${esc(s.lugar)} · ${esc(s.tipo)}</div>
    <div class="sensor-detalle-valor" style="color:${color}">${s.valor}${esc(s.unidad)}</div>
    <svg viewBox="0 0 200 62" role="img" aria-label="Serie reciente del sensor ${esc(s.id)}">
      <path d="${linea} L200 62 L0 62 Z" fill="${C.soft}"></path>
      <path d="${linea}" fill="none" stroke="${color}" stroke-width="1.8"></path>
    </svg>
    <div class="sensor-meta">
      <div><span>Batería</span><span>${s.bateria}%</span></div>
      <div><span>Última lectura</span><span>${esc(s.visto)}</span></div>
      <div><span>Media</span><span>${dec(media)}${esc(s.unidad)}</span></div>
    </div>`;
}

// ═══════════ render: clima ═══════════

function renderClima() {
  const x0 = 40, paso = 74, lluviaMax = 24;
  const tempY = (t) => 96 - ((t - 18) / 14) * 68;

  const puntos = CLIMA.map(([, , tmax], i) =>
    `${x0 + i * paso + 13},${tempY(tmax).toFixed(1)}`).join(" ");

  $("wk-clima-svg").innerHTML = `
    <svg viewBox="0 0 570 150" role="img" aria-label="Clima de los próximos 7 días">
      <line x1="30" y1="112" x2="562" y2="112" stroke="${C.line}" stroke-width="1"></line>
      ${CLIMA.map(([dia, lluvia, tmax, tmin], i) => {
        const cx = x0 + i * paso + 13;
        const h = Math.max(2, (lluvia / lluviaMax) * 62);
        return `
          <rect x="${x0 + i * paso}" y="${(112 - h).toFixed(1)}" width="26"
                height="${h.toFixed(1)}" fill="#a8c4cc" rx="2"></rect>
          <text x="${cx}" y="${(112 - h - 4).toFixed(1)}" text-anchor="middle"
                font-family="DM Mono" font-size="9" fill="#5d7a83">${lluvia} mm</text>
          <text x="${cx}" y="128" text-anchor="middle" font-family="DM Mono"
                font-size="10" fill="#6b6055">${esc(dia)}</text>
          <text x="${cx}" y="143" text-anchor="middle" font-family="DM Mono"
                font-size="9.5" fill="${C.faint}">${tmin}/${tmax}°</text>`;
      }).join("")}
      <polyline fill="none" stroke="${C.wheat}" stroke-width="2.2" points="${puntos}"></polyline>
      ${CLIMA.map(([, , tmax], i) =>
        `<circle cx="${x0 + i * paso + 13}" cy="${tempY(tmax).toFixed(1)}" r="3.4"
                 fill="#fff" stroke="${C.wheat}" stroke-width="1.8"></circle>`).join("")}
    </svg>`;
}

// ═══════════ render: merma ═══════════

function renderMerma() {
  $("wk-merma-svg").innerHTML = `
    <svg viewBox="0 0 340 168" role="img" aria-label="Merma por lote en porcentaje del corte">
      <g stroke="${C.grid}" stroke-width="1">
        ${[20, 52, 84, 116].map((y) => `<line x1="32" y1="${y}" x2="336" y2="${y}"></line>`).join("")}
      </g>
      <g font-family="DM Mono" font-size="9" fill="${C.faint}">
        <text x="2" y="23">12</text><text x="2" y="55">9</text>
        <text x="2" y="87">6</text><text x="2" y="119">3</text>
      </g>
      <line x1="32" y1="140" x2="336" y2="140" stroke="${C.line}" stroke-width="1"></line>
      ${LOTES.map((l, i) => {
        const h = (l.merma / 12) * 120;
        const on = l.id === S.lote;
        const x = 44 + i * 48;
        return `
          <g style="cursor:pointer" data-accion="lote" data-id="${l.id}">
            <title>${esc(l.id)}: ${dec(l.merma)}% de merma</title>
            <rect x="${x}" y="${(140 - h).toFixed(1)}" width="26" height="${h.toFixed(1)}"
                  fill="${on ? C.clay : "#d8c9b2"}" rx="2"></rect>
            <text x="${x + 13}" y="${(140 - h - 4).toFixed(1)}" text-anchor="middle"
                  font-family="DM Mono" font-size="9" fill="#6b6055">${dec(l.merma)}</text>
            <text x="${x + 13}" y="156" text-anchor="middle" font-family="DM Mono"
                  font-size="9.5" fill="${C.faint}">${esc(l.id)}</text>
          </g>`;
      }).join("")}
    </svg>`;
}

// ═══════════ render: labores y cuadrilla ═══════════

function renderLabores() {
  $("wk-labores-lista").innerHTML = LABORES.map((b) => `
    <div>
      <div class="labor-cab">
        <span>${esc(b.etiqueta)}</span>
        <span class="labor-pct">${b.pct}%</span>
      </div>
      <span class="labor-pista">
        <span class="labor-relleno" style="width:${b.pct}%;background:${b.color}"></span>
        <span class="labor-objetivo" style="left:${b.objetivo}%"
              title="objetivo ${b.objetivo}%"></span>
      </span>
    </div>`).join("");
}

function renderCuadrilla() {
  $("wk-cuadrilla-lista").innerHTML = CUADRILLA.map(([nombre, dias, rate], i) => `
    <div class="peon">
      <span class="peon-avatar" style="background:${COLOR_AVATAR[i]}">${
        esc(nombre.split(" ").map((p) => p[0]).join(""))
      }</span>
      <span class="peon-nombre">${esc(nombre)}</span>
      <span class="peon-dias">
        ${Array.from({ length: 6 }, (_, k) =>
          `<span style="background:${k < dias ? C.leaf : C.soft}"></span>`).join("")}
      </span>
      <span class="peon-rate">${esc(rate)}</span>
    </div>`).join("");
}

// ═══════════ render: asistente ═══════════

function renderChat() {
  const caja = $("wk-chat-mensajes");
  const alFinal = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 40;

  caja.innerHTML = S.chat.mensajes.map((m) => {
    const clase = m.rol === "yo" ? "yo" : m.rol === "error" ? "lia error" : "lia";
    return `<div class="msg ${clase}">${esc(m.texto)}</div>`;
  }).join("") + (S.chat.enviando ? `<div class="msg lia escribiendo">LIA está pensando…</div>` : "");

  if (alFinal) caja.scrollTop = caja.scrollHeight;

  $("wk-chat-estado").textContent = S.conectado ? "en línea" : "sin conexión";
  $("wk-chat-input").disabled = S.chat.enviando;
  $("wk-chat-enviar").disabled = S.chat.enviando;
}

// ═══════════ render maestro ═══════════

function render() {
  renderNav();
  renderAutonomia();
  renderCabecera();
  renderAviso();
  renderProduccion();
  renderMinis();
  renderMapa();
  renderLote();
  renderAcumulado();
  renderPlan();
  renderPropuestas();
  renderCuentas();
  renderSensores();
  renderClima();
  renderMerma();
  renderLabores();
  renderCuadrilla();
  renderChat();
}

// ═══════════ eventos ═══════════

/** Sube al elemento con data-accion más cercano. */
function accionDe(target) {
  const el = target.closest?.("[data-accion]");
  return el ? { el, accion: el.dataset.accion } : null;
}

document.addEventListener("click", (e) => {
  const hit = accionDe(e.target);
  if (!hit) return;
  const { el, accion } = hit;

  switch (accion) {
    case "ir": {
      const id = el.dataset.id;
      set({ nav: id });
      const destino = $("wk-" + id);
      if (destino) {
        const y = destino.getBoundingClientRect().top + window.scrollY - 74;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
      cerrarMenu();
      break;
    }

    case "cultivo":
      set({ cultivo: el.dataset.valor, hover: null });
      break;

    case "rango":
      set({ rango: el.dataset.valor, hover: null });
      break;

    case "lote": {
      const id = el.dataset.id;
      const sensor = SENSORES.find((s) => s.lugar.startsWith(id));
      set({ lote: id, sensor: sensor ? sensor.id : S.sensor });
      break;
    }

    case "sensor":
      set({ sensor: el.dataset.id });
      break;

    case "tarea": {
      const i = Number(el.dataset.i);
      const hechas = S.hechas.map((v, k) => (k === i ? !v : v));
      set({ hechas });
      break;
    }

    case "propuesta":
      decidirPropuesta(Number(el.dataset.i), el.dataset.decision);
      break;

    case "abrir-menu":
      document.querySelector(".app").classList.add("menu-abierto");
      $("lateral").querySelector(".nav button")?.focus();
      break;

    case "cerrar-menu":
      cerrarMenu();
      break;
  }
});

document.addEventListener("mouseover", (e) => {
  const hit = accionDe(e.target);
  if (hit && hit.accion === "hover") {
    const i = Number(hit.el.dataset.i);
    if (i !== S.hover) set({ hover: i });
  }
});

$("wk-produccion-svg").addEventListener("mouseleave", () => {
  if (S.hover !== null) set({ hover: null });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarMenu();
});

function cerrarMenu() {
  document.querySelector(".app").classList.remove("menu-abierto");
}

// ── asistente ──

$("wk-chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("wk-chat-input");
  const texto = input.value.trim();
  if (!texto || S.chat.enviando) return;

  input.value = "";
  S.chat.mensajes.push({ rol: "yo", texto });
  S.chat.enviando = true;
  render();

  try {
    const respuesta = await enviarMensaje(S.chat.mensajes, {
      lote: S.lote,
      sensor: S.sensor,
      cultivo: S.cultivo,
      rango: S.rango
    });
    S.chat.mensajes.push({ rol: "lia", texto: respuesta });
    S.conectado = true;
  } catch (err) {
    S.chat.mensajes.push({
      rol: "error",
      texto:
        "No pude contactar al agente. " +
        "Comprueba que el intermediario /api esté desplegado en el Worker.\n\n" +
        "Detalle: " + err.message
    });
    S.conectado = false;
  } finally {
    S.chat.enviando = false;
    render();
    $("wk-chat-input").focus();
  }
});

// ── propuestas ──

async function decidirPropuesta(i, decision) {
  const p = S.propuestas[i];
  if (!p || p.decision) return;

  // Actualización optimista: la interfaz responde de inmediato.
  p.decision = decision;
  render();

  if (S.usandoDemo || !p.id) return; // propuestas de muestra: nada que registrar

  try {
    await registrarDecision(p.id, decision);
  } catch (err) {
    console.warn("No se pudo registrar la decisión:", err.message);
    S.conectado = false;
    render();
  }
}

// ═══════════ scroll-spy ═══════════

function iniciarScrollSpy() {
  const ids = SECCIONES.map(([id]) => id);
  const nodos = ids.map((id) => $("wk-" + id)).filter(Boolean);
  if (!("IntersectionObserver" in window) || !nodos.length) return;

  const obs = new IntersectionObserver(
    (entradas) => {
      const visible = entradas
        .filter((x) => x.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      const id = visible.target.id.replace(/^wk-/, "");
      if (id !== S.nav) {
        S.nav = id;
        renderNav();
      }
    },
    { rootMargin: "-80px 0px -55% 0px", threshold: [0.15, 0.5] }
  );

  nodos.forEach((n) => obs.observe(n));
}

// ═══════════ arranque ═══════════

/** Carga propuestas reales; si falla, deja las de muestra. */
async function cargarPropuestas() {
  try {
    const lista = await obtenerPropuestas({ cultivo: S.cultivo, lote: S.lote });
    S.propuestas = lista.map((p, i) => ({
      id: p.id ?? String(i),
      titulo: p.titulo ?? "(sin título)",
      lote: p.lote ?? "—",
      motivo: p.motivo ?? "",
      tono: p.tono ?? "wheat",
      decision: p.decision ?? null
    }));
    S.usandoDemo = false;
    S.conectado = true;
  } catch {
    S.propuestas = PROPUESTAS_DEMO.map((p, i) => ({ ...p, id: null, decision: null, _i: i }));
    S.usandoDemo = true;
  }
}

async function iniciar() {
  // Pinta de inmediato con datos de muestra: nada espera a la red.
  S.propuestas = PROPUESTAS_DEMO.map((p) => ({ ...p, id: null, decision: null }));
  render();
  iniciarScrollSpy();

  S.conectado = await hayConexion();
  if (S.conectado) await cargarPropuestas();
  render();
}

iniciar();
