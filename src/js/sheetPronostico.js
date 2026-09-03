// ─────────────────────────────────────────────────────────────
//  Agromyss · pronóstico del clima desde hoja de cálculo
//
//  Igual que sheetSensores.js: no hay estación meteorológica conectada,
//  así que alguien en la finca anota el pronóstico (del SENAMHI, una app
//  del clima, etc) en dos pestañas de la misma hoja de Google Sheets.
//
//  Cómo configurar (una sola vez):
//   1. Pestaña "Pronostico" — UNA sola fila de datos con encabezados:
//        temp | condicion | humedad | viento_dir | viento_kmh |
//        lluvia_prob | lluvia_texto | pluviometria_mm | ventana | actualizado
//      Ej: 27 | Parcialmente nublado | 64 | NE | 12 | 32 | Posible tarde |
//          2 | 9:00 a.m. a 1:30 p.m. | 08:12
//   2. Pestaña "PronosticoHoras" — una fila por chip de la franja horaria,
//      con encabezados: hora | temp | nota
//      Ej: 08:00 | 24 | Nublado
//   3. Publicar cada pestaña por separado (Archivo → Compartir → Publicar
//      en la Web → elegir la pestaña → CSV) y pegar las dos URLs abajo.
//
//  Si las URL están vacías o la hoja no responde, el sitio se queda con
//  el contenido de ejemplo que ya trae index.html — nunca se rompe por esto.
// ─────────────────────────────────────────────────────────────

import { leerCSV, indexarEncabezados } from "./csv.js";

const PRONOSTICO_CSV_URL = "";
const PRONOSTICO_HORAS_CSV_URL = "";

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && v !== "" ? n : fallback;
}

function filaAPronostico(filas) {
  const col = indexarEncabezados(filas[0]);
  const fila = filas[1];
  if (!fila) return null;

  const get = (nombre) => (fila[col(nombre)] ?? "").trim();

  return {
    temp: num(get("temp")),
    condicion: get("condicion"),
    humedad: num(get("humedad")),
    vientoDir: get("viento_dir"),
    vientoKmh: num(get("viento_kmh")),
    lluviaProb: num(get("lluvia_prob")),
    lluviaTexto: get("lluvia_texto"),
    pluviometriaMm: num(get("pluviometria_mm")),
    ventana: get("ventana"),
    actualizado: get("actualizado")
  };
}

function filasAHoras(filas) {
  const col = indexarEncabezados(filas[0]);
  const iHora = col("hora"), iTemp = col("temp"), iNota = col("nota");
  if (iHora === -1) return [];

  return filas.slice(1)
    .map((fila) => ({
      hora: (fila[iHora] ?? "").trim(),
      temp: num(fila[iTemp]),
      nota: (fila[iNota] ?? "").trim()
    }))
    .filter((h) => h.hora);
}

/** Descarga las dos pestañas y devuelve { actual, horas }, o null si no hay
 *  hojas configuradas o no se pudo leer nada útil. */
export async function leerPronosticoDeHoja() {
  const [filasActual, filasHoras] = await Promise.all([
    leerCSV(PRONOSTICO_CSV_URL),
    leerCSV(PRONOSTICO_HORAS_CSV_URL)
  ]);

  const actual = filasActual ? filaAPronostico(filasActual) : null;
  const horas = filasHoras ? filasAHoras(filasHoras) : [];

  if (!actual && !horas.length) return null;
  return { actual, horas };
}

const INTERVALO_MS = 5 * 60 * 1000;

/** Igual patrón que iniciarSincronizacionSensores: ahora, cada
 *  INTERVALO_MS, y al volver a la pestaña. `onActualizado(datos)` recibe
 *  { actual, horas } sólo cuando hay algo nuevo que pintar. */
export function iniciarSincronizacionPronostico(onActualizado) {
  async function sincronizar() {
    const datos = await leerPronosticoDeHoja();
    if (datos) onActualizado?.(datos);
  }
  sincronizar();
  setInterval(sincronizar, INTERVALO_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sincronizar();
  });
}
