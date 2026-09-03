// ─────────────────────────────────────────────────────────────
//  Agromyss · utilidades CSV compartidas
//  Usadas por sheetSensores.js y sheetPronostico.js para leer hojas
//  de Google Sheets publicadas como CSV.
// ─────────────────────────────────────────────────────────────

export function parseCSV(texto) {
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

/** Minúsculas y sin acentos, para comparar encabezados/valores sin
 *  depender de cómo los haya escrito quien llena la hoja. */
export function normalizarTexto(s) {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Descarga y parsea un CSV publicado de Google Sheets. Devuelve las filas
 *  crudas (incluida la de encabezados), o null si algo falló. */
export async function leerCSV(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const texto = await res.text();
    const filas = parseCSV(texto);
    return filas.length ? filas : null;
  } catch (err) {
    console.warn("No se pudo leer la hoja:", url, err.message);
    return null;
  }
}

/** Índice de columnas por nombre normalizado, a partir de la fila de
 *  encabezados. `col("valor")` da el índice o -1 si no existe. */
export function indexarEncabezados(filaEncabezados) {
  const encabezados = filaEncabezados.map(normalizarTexto);
  return (nombre) => encabezados.indexOf(nombre);
}
