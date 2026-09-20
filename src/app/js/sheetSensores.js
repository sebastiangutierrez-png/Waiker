// ─────────────────────────────────────────────────────────────
//  Agromyss · sensores desde hoja de cálculo
//
//  No hay sensores físicos conectados todavía. Mientras tanto, alguien
//  en la finca anota las lecturas a mano en una hoja de Google Sheets
//  y el sitio la lee como si fuera la fuente de datos real.
//
//  El navegador NO descarga la hoja: pide /api/sensores y el Worker se
//  encarga de bajar el CSV, parsearlo y cachearlo. La URL de la hoja
//  (SHEET_CSV_URL) vive sólo en wrangler.toml — una copia, no dos.
//
//  Cómo configurar la hoja (una sola vez):
//   1. En Google Sheets, la primera fila debe tener estos encabezados
//      (en cualquier orden, sin acentos ni mayúsculas importa):
//        id | lugar | tipo | valor | unidad | estado
//      Cada fila siguiente es un sensor. `lugar` debe coincidir con las
//      zonas que ya aparecen en el Resumen. Cada lote suele tener tres
//      filas — una por `tipo`: Humedad, Humedad de suelo, Temperatura.
//      `estado` debe ser una de: ok · aviso · alerta · sin señal
//   2. Archivo → Compartir → Publicar en la Web → elegir la pestaña
//      correcta → formato "Valores separados por comas (.csv)" → Publicar.
//   3. Pega la URL que te da Google Sheets en SHEET_CSV_URL (wrangler.toml).
//
//  Si SHEET_CSV_URL está vacío, o la hoja no responde (privada, borrada,
//  sin red), el sitio se queda con los datos de muestra de data.js — nunca
//  se rompe por esto.
// ─────────────────────────────────────────────────────────────

import { obtenerSensores } from "./api.js";

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
  let ultima = 0;

  async function sincronizar() {
    // Volver a la pestaña no debe pedir la hoja otra vez si acabamos de
    // hacerlo: alt-tabear rápido disparaba una petición por cambio de foco.
    if (Date.now() - ultima < 10000) return;
    ultima = Date.now();

    const nuevos = await obtenerSensores();
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
