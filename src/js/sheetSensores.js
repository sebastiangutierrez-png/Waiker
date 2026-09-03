// ─────────────────────────────────────────────────────────────
//  Agromyss · sensores desde hoja de cálculo
//
//  No hay sensores físicos conectados todavía. Mientras tanto, alguien
//  en la finca anota las lecturas a mano en una hoja de Google Sheets
//  y el sitio la lee como si fuera la fuente de datos real.
//
//  Cómo configurar la hoja (una sola vez):
//   1. En Google Sheets, la primera fila debe tener estos encabezados
//      (en cualquier orden, sin acentos ni mayúsculas importa):
//        id | lugar | valor | unidad | estado
//      Cada fila siguiente es un sensor. `estado` debe ser una de:
//        ok · aviso · alerta · sin señal
//   2. Archivo → Compartir → Publicar en la Web → elegir la pestaña
//      correcta → formato "Valores separados por comas (.csv)" → Publicar.
//   3. Pega la URL que te da Google Sheets en SHEET_CSV_URL, abajo.
//
//  Si SHEET_CSV_URL está vacío, o la hoja no responde (privada, borrada,
//  sin red), el sitio se queda con los datos de muestra de data.js — nunca
//  se rompe por esto.
// ─────────────────────────────────────────────────────────────

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQY-EaYV4j-bkTMKs9MAmSH1UiQQApq0dR_WU0MqP9356af0nHCBQywbZfL5tCgbTHZBnjt-UcqHKbU/pub?gid=1737731176&single=true&output=csv";

const ESTADOS_VALIDOS = new Set(["ok", "aviso", "alerta", "sin señal"]);

function parseCSV(texto) {
  const filas = [];
  let fila = [], campo = "", enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') { enComillas = false; }
      else { campo += c; }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      fila.push(campo); campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((v) => v.trim() !== "")) filas.push(fila);
      fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }

  return filas;
}

function normalizarEncabezado(s) {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, ""); // quita acentos
}

/** Convierte filas crudas del CSV en objetos con la forma que ya usa SENSORES en data.js. */
function filasAObjetos(filas) {
  if (!filas.length) return [];
  const encabezados = filas[0].map(normalizarEncabezado);
  const col = (nombre) => encabezados.indexOf(nombre);

  const iId = col("id"), iLugar = col("lugar"), iValor = col("valor"),
    iUnidad = col("unidad"), iEstado = col("estado");
  if (iId === -1) return [];

  return filas.slice(1).map((fila) => {
    const estadoCrudo = normalizarEncabezado(fila[iEstado] ?? "");
    return {
      id: (fila[iId] ?? "").trim(),
      lugar: (fila[iLugar] ?? "").trim(),
      valor: Number(String(fila[iValor] ?? "0").replace(",", ".")) || 0,
      unidad: (fila[iUnidad] ?? "").trim(),
      estado: ESTADOS_VALIDOS.has(estadoCrudo) ? estadoCrudo : "ok"
    };
  }).filter((s) => s.id);
}

/** Descarga la hoja publicada y devuelve los sensores, o null si no hay hoja
 *  configurada o algo falló (sin conexión, hoja privada, etc). */
export async function leerSensoresDeHoja() {
  if (!SHEET_CSV_URL) return null;
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const texto = await res.text();
    const sensores = filasAObjetos(parseCSV(texto));
    return sensores.length ? sensores : null;
  } catch (err) {
    console.warn("No se pudo leer la hoja de sensores, usando datos de muestra:", err.message);
    return null;
  }
}

/** Reemplaza el contenido de un array (p.ej. SENSORES de data.js) en el sitio,
 *  para que todo lo que ya lo importa vea los datos nuevos sin más cambios. */
export function aplicarSensores(destino, nuevos) {
  destino.length = 0;
  destino.push(...nuevos);
}

const INTERVALO_MS = 2 * 60 * 1000;

/** Sincroniza ahora mismo y cada INTERVALO_MS después. `onActualizado` se
 *  llama tras cada sincronización exitosa para que la página se vuelva a pintar. */
export function iniciarSincronizacionSensores(destino, onActualizado) {
  async function sincronizar() {
    const nuevos = await leerSensoresDeHoja();
    if (nuevos) {
      aplicarSensores(destino, nuevos);
      onActualizado?.();
    }
  }
  sincronizar();
  setInterval(sincronizar, INTERVALO_MS);
}
