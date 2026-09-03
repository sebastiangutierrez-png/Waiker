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
//        id | lugar | tipo | valor | unidad | estado
//      Cada fila siguiente es un sensor. `lugar` debe coincidir con las
//      zonas que ya aparecen en el Resumen (Lote A · Cacao, Lote B · Mango,
//      Lote C · Café, Lote D · Cacao, Vivero, Zona hídrica). Cada lote suele
//      tener tres filas — una por `tipo`: Humedad, Humedad de suelo,
//      Temperatura. `estado` debe ser una de: ok · aviso · alerta · sin señal
//   2. Archivo → Compartir → Publicar en la Web → elegir la pestaña
//      correcta → formato "Valores separados por comas (.csv)" → Publicar.
//   3. Pega la URL que te da Google Sheets en SHEET_CSV_URL, abajo.
//
//  Si SHEET_CSV_URL está vacío, o la hoja no responde (privada, borrada,
//  sin red), el sitio se queda con los datos de muestra de data.js — nunca
//  se rompe por esto.
// ─────────────────────────────────────────────────────────────

import { leerCSV, normalizarTexto, indexarEncabezados } from "./csv.js";

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQY-EaYV4j-bkTMKs9MAmSH1UiQQApq0dR_WU0MqP9356af0nHCBQywbZfL5tCgbTHZBnjt-UcqHKbU/pub?gid=1737731176&single=true&output=csv";

const ESTADOS_VALIDOS = ["ok", "aviso", "alerta", "sin señal"];

/** Convierte filas crudas del CSV en objetos con la forma que ya usa SENSORES en data.js. */
function filasAObjetos(filas) {
  const col = indexarEncabezados(filas[0]);
  const iId = col("id"), iLugar = col("lugar"), iTipo = col("tipo"), iValor = col("valor"),
    iUnidad = col("unidad"), iEstado = col("estado");
  if (iId === -1) return [];

  return filas.slice(1).map((fila) => {
    // Comparamos normalizado (sin acentos/mayúsculas) pero guardamos el valor
    // canónico con ñ/acentos intactos, para no perder "sin señal" al comparar.
    const estadoCrudo = normalizarTexto(fila[iEstado] ?? "");
    const estado = ESTADOS_VALIDOS.find((e) => normalizarTexto(e) === estadoCrudo) ?? "ok";
    return {
      id: (fila[iId] ?? "").trim(),
      lugar: (fila[iLugar] ?? "").trim(),
      tipo: (fila[iTipo] ?? "").trim(),
      valor: Number(String(fila[iValor] ?? "0").replace(",", ".")) || 0,
      unidad: (fila[iUnidad] ?? "").trim(),
      estado
    };
  }).filter((s) => s.id);
}

/** Descarga la hoja publicada y devuelve los sensores, o null si no hay hoja
 *  configurada o algo falló (sin conexión, hoja privada, etc). */
export async function leerSensoresDeHoja() {
  const filas = await leerCSV(SHEET_CSV_URL);
  if (!filas) return null;
  const sensores = filasAObjetos(filas);
  return sensores.length ? sensores : null;
}

/** Reemplaza el contenido de un array (p.ej. SENSORES de data.js) en el sitio,
 *  para que todo lo que ya lo importa vea los datos nuevos sin más cambios.
 *  Si la hoja todavía no tiene columna `tipo`, conserva la que ya había por id
 *  en vez de dejarla en blanco. */
export function aplicarSensores(destino, nuevos) {
  const tipoPrevio = Object.fromEntries(destino.map((s) => [s.id, s.tipo]));
  destino.length = 0;
  destino.push(...nuevos.map((s) => ({ ...s, tipo: s.tipo || tipoPrevio[s.id] || "" })));
}

const INTERVALO_MS = 2 * 60 * 1000;

/** Sincroniza ahora mismo, cada INTERVALO_MS después, y cada vez que la
 *  pestaña vuelve a estar visible (para no esperar el intervalo completo
 *  si alguien deja la pestaña abierta y vuelve más tarde). `onActualizado`
 *  se llama tras cada sincronización exitosa para que la página se repinte. */
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
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sincronizar();
  });
}
