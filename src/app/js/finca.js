// ─────────────────────────────────────────────────────────────
//  Agromyss · pintado de los bloques que salen de los informes de
//  laboratorio (suelos, foliares y catación).
//
//  Todo lo de acá lee data.js y nada más: si mañana los análisis
//  llegan de una API, se cambian esas constantes y este archivo
//  sigue igual.
// ─────────────────────────────────────────────────────────────

import { LOTES, SUELOS, FOLIARES, CALIDAD, REFERENCIA_SUELO, COLOR_SENSOR, SENSORES } from "./data.js";

const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Coma decimal, que es como se leen los informes en Colombia.
 *  `null` (valor no reportado por el laboratorio) se pinta como guion. */
const num = (v, dec = 1) =>
  v === null || v === undefined ? "–" : v.toFixed(dec).replace(".", ",");

/** Último análisis disponible de un lote: 2023 si se remuestreó, si no 2022. */
function ultimoSuelo(loteId) {
  return SUELOS.filter((s) => s.lote === loteId).sort((a, b) => b.anio - a.anio)[0];
}

/** Bandas de acidez usadas en las tarjetas de lote. */
const BANDAS = [
  { nombre: "Deseable", min: 5.5, color: "var(--olive)" },
  { nombre: "Ligeramente ácido", min: 5.0, color: "var(--gold)", texto: "#84601b" },
  { nombre: "Ácido", min: 0, color: "var(--danger)" }
];

function bandaDe(pH) {
  return BANDAS.find((b) => pH >= b.min) ?? BANDAS[BANDAS.length - 1];
}

// ═══════════ Página de lotes ═══════════

export function renderLotes() {
  const cont = document.getElementById("lotesGrid");
  if (!cont) return;

  cont.innerHTML = LOTES.map((l) => {
    const s = ultimoSuelo(l.id);
    const previo = SUELOS.filter((x) => x.lote === l.id && x.anio < s.anio).sort((a, b) => b.anio - a.anio)[0];
    const foliar = FOLIARES.find((f) => f.lote === l.id);
    const banda = bandaDe(s.pH);
    const clase = banda.nombre === "Deseable" ? "" : banda.nombre === "Ácido" ? " danger" : " warning";
    const pill = banda.nombre === "Deseable" ? "pill" : banda.nombre === "Ácido" ? "pill red" : "pill yellow";

    // Sensores que la hoja de campo reporta para este lote.
    const propios = SENSORES.filter((x) => x.lugar === `${l.id} ${l.nombre}`);
    const lectura = propios.length
      ? propios.map((x) => `<span class="lote-lectura"><i style="background:${COLOR_SENSOR[x.estado]}"></i>${esc(x.tipo)} ${x.valor}${esc(x.unidad)}</span>`).join("")
      : `<span class="muted" style="font-size:11.5px">Sin lecturas en la hoja de campo.</span>`;

    const tendencia = previo
      ? `pH ${num(previo.pH, 1)} en ${previo.anio}, ${num(s.pH, 1)} en ${s.anio}. CICE ${num(previo.cice, 2)} a ${num(s.cice, 2)}.`
      : `Último muestreo en ${s.anio}. Sin remuestreo para comparar.`;

    // El % de la barra es la posición del pH dentro del rango deseable,
    // acotado a [0, 100]: 5,5 marca el arranque del rango bueno.
    const [pMin, pMax] = REFERENCIA_SUELO.pH;
    const pct = Math.max(0, Math.min(100, Math.round(((s.pH - 4.0) / (pMax - 4.0)) * 100)));

    return `
      <article class="lote-card${clase}">
        <div class="lote-head">
          <div>
            <span class="${pill}">${esc(banda.nombre)}</span>
            <h3>${esc(l.id)} · ${esc(l.nombre)}</h3>
          </div>
          <span class="mono lote-codigo">${esc(s.codigo)}</span>
        </div>

        <div class="lote-stats">
          <div><small>pH</small><strong>${num(s.pH, 1)}</strong></div>
          <div><small>Materia orgánica</small><strong>${num(s.mo, 2)}%</strong></div>
          <div><small>CICE</small><strong>${num(s.cice, 2)}</strong></div>
        </div>

        <div class="lote-progress">
          <span>pH frente al mínimo deseable (${num(pMin, 1)})</span>
          <div class="progress-bar"><span style="width:${pct}%;background:${banda.color}"></span></div>
        </div>

        <p>Textura ${esc(s.textura)} · ${s.arena}% arena, ${s.limo}% limo, ${s.arcilla}% arcilla. ${esc(tendencia)}</p>

        <div class="lote-lecturas">${lectura}</div>

        <p class="muted" style="font-size:11.5px">
          ${foliar
            ? `Foliar 2023: nitrógeno ${num(foliar.n, 2)}%, manganeso ${num(foliar.mn, 0)} mg/kg.`
            : "Sin análisis foliar. Muestreo pendiente."}
        </p>
      </article>`;
  }).join("");
}

// ═══════════ Laboratorio ═══════════

export function renderCalidad() {
  const cont = document.getElementById("calidadGrid");
  if (!cont) return;

  cont.innerHTML = CALIDAD.map((m) => {
    // FEDECACAO califica de 0 a 10; por debajo de 5 la muestra se considera
    // con defectos que sacan el grano del mercado de cacao fino.
    const color = m.global >= 6 ? "var(--olive)" : m.global >= 5 ? "var(--gold)" : "var(--danger)";
    const perfil = Object.entries(m.perfil);
    const maxPerfil = Math.max(...perfil.map(([, v]) => v), 1);

    return `
      <article class="calidad-card">
        <div class="calidad-head">
          <div>
            <h4>${esc(m.material)}</h4>
            <span class="mono">Muestra ${esc(m.codigo)} · ${esc(m.fecha)}</span>
          </div>
          <div class="calidad-nota" style="color:${color}">
            <strong>${num(m.global, 1)}</strong><span>de 10</span>
          </div>
        </div>

        <div class="lote-stats">
          <div><small>Fermentación</small><strong>${m.fermentacion}%</strong></div>
          <div><small>Humedad</small><strong>${num(m.humedad, 1)}%</strong></div>
          <div><small>Índice de grano</small><strong>${num(m.indiceGrano, 1)} g</strong></div>
        </div>

        <div class="calidad-perfil">
          ${perfil.map(([clave, valor]) => `
            <div class="calidad-fila">
              <span>${esc(clave)}</span>
              <div class="progress-bar"><span style="width:${(valor / maxPerfil) * 100}%;background:${color}"></span></div>
              <b>${num(valor, 1)}</b>
            </div>`).join("")}
        </div>

        <p>${esc(m.notas)}</p>
        <p class="muted" style="font-size:11.5px">
          Prueba de corte: ${m.violetas}% violetas, ${m.pizarrosos}% pizarrosos, ${m.mohosos}% mohosos.
        </p>
      </article>`;
  }).join("");
}

/** Pinta una tabla `<thead>/<tbody>` a partir de columnas [titulo, fn]. */
function tabla(id, columnas, filas) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML =
    `<thead><tr>${columnas.map(([t]) => `<th>${esc(t)}</th>`).join("")}</tr></thead>` +
    `<tbody>${filas.map((f) => `<tr>${columnas.map(([, fn]) => `<td>${esc(fn(f))}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

const nombreLote = (id) => {
  const l = LOTES.find((x) => x.id === id);
  return l ? `${l.id} ${l.nombre}` : id;
};

export function renderTablasLab() {
  tabla("tablaSuelos", [
    ["Lote", (s) => nombreLote(s.lote)],
    ["Año", (s) => s.anio],
    ["Textura", (s) => s.textura],
    ["pH", (s) => num(s.pH, 1)],
    ["MO %", (s) => num(s.mo, 2)],
    ["CO %", (s) => num(s.co, 2)],
    ["Al", (s) => num(s.al, 1)],
    ["Ca", (s) => num(s.ca, 2)],
    ["Mg", (s) => num(s.mg, 2)],
    ["K", (s) => num(s.k, 2)],
    ["CICE", (s) => num(s.cice, 2)],
    ["P", (s) => num(s.p, 2)]
  ], [...SUELOS].sort((a, b) => a.lote.localeCompare(b.lote) || a.anio - b.anio));

  tabla("tablaFoliares", [
    ["Lote", (f) => nombreLote(f.lote)],
    ["N %", (f) => num(f.n, 2)],
    ["Ca %", (f) => num(f.ca, 2)],
    ["Mg %", (f) => num(f.mg, 2)],
    ["K %", (f) => num(f.k, 2)],
    ["P %", (f) => num(f.p, 2)],
    ["S %", (f) => num(f.s, 2)],
    ["Fe", (f) => num(f.fe, 2)],
    ["Mn", (f) => num(f.mn, 1)],
    ["Cu", (f) => num(f.cu, 2)],
    ["Zn", (f) => num(f.zn, 2)],
    ["B", (f) => num(f.b, 2)]
  ], FOLIARES);
}

/** Un solo punto de entrada para main.js. Se puede volver a llamar cuando la
 *  hoja de campo trae lecturas nuevas: las tarjetas de lote las muestran. */
export function renderFinca() {
  renderLotes();
  renderCalidad();
  renderTablasLab();
}
