// ─────────────────────────────────────────────────────────────
//  Datos de la finca · Hacienda Mesetas (Agromyss)
//
//  Las cifras de suelo, foliares y de calidad son REALES: provienen de
//  los informes del Laboratorio de Suelos de la Universidad Nacional
//  (sede Medellín) y del Laboratorio de Análisis Físico y Sensorial de
//  FEDECACAO (San Vicente de Chucurí). La fuente de cada bloque está
//  anotada arriba de la constante.
//
//  Lo que sigue siendo de muestra está marcado con "MUESTRA": son los
//  bloques para los que todavía no hay registro. Las lecturas de sensores
//  no viven acá: llegan de la hoja de cálculo compartida (sheetSensores.js)
//  y sobrescriben SENSORES en caliente.
//
//  Nada de este archivo debe contener NIT, teléfonos, correos ni la
//  dirección exacta de la finca: el repositorio es público.
// ─────────────────────────────────────────────────────────────

/** Paleta compartida con styles.css. Los SVG necesitan los valores en JS. */
export const C = {
  coffee: "#7b4b26",
  leaf: "#4b6b3a",
  clay: "#a8552a",
  wheat: "#c98b3a",
  water: "#5d7a83",
  ink: "#2a221a",
  mute: "#8a7d6e",
  faint: "#a3968a",
  grid: "#f0e9dc",
  line: "#ddd3c2",
  soft: "#eee5d7"
};

export const FINCA = {
  nombre: "Hacienda Mesetas",
  empresa: "Agromyss",
  ubicacion: "Vereda Santa Bárbara · Maceo, Antioquia",
  paisaje: "Cañón del río Alicante",
  detalle: "6 lotes en cacao · campaña 25/26"
};

/** Material vegetal llevado a catación en abril de 2026 (ver CALIDAD). */
export const CLONES = ["FEAR 5", "FSV 41", "CCN 51"];

export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Lotes de la finca, con los nombres que usa la gente en campo.
 * `id` coincide con el código del laboratorio (L1…L7; no hay L5 en muestreo).
 * `d` / `tx` / `ty` / `px` / `py` son la geometría del mapa SVG (viewBox 300x200).
 *
 * `humedad` y `estado` todavía NO son medidos: son el arranque de la página
 * hasta que la hoja de campo traiga lecturas por lote.
 */
export const LOTES = [
  {
    id: "L1", nombre: "La Casa", cultivo: "Cacao",
    humedad: 34, estado: "Óptima",
    d: "M14 26 L92 16 L104 66 L26 78 Z", tx: 26, ty: 46, px: 58, py: 48,
    hum: [31, 33, 36, 34, 32, 35, 34]
  },
  {
    id: "L2", nombre: "La Tira", cultivo: "Cacao",
    humedad: 29, estado: "Óptima",
    d: "M110 64 L98 16 L176 10 L192 58 Z", tx: 122, ty: 40, px: 148, py: 40,
    hum: [27, 28, 30, 31, 29, 28, 29]
  },
  {
    id: "L3", nombre: "El Huevo", cultivo: "Cacao",
    humedad: 41, estado: "Saturada",
    d: "M198 56 L184 10 L288 16 L292 58 Z", tx: 212, ty: 38, px: 240, py: 36,
    hum: [38, 39, 42, 44, 41, 40, 41]
  },
  {
    id: "L4", nombre: "El Mandarino", cultivo: "Cacao",
    humedad: 52, estado: "Óptima",
    d: "M28 84 L106 72 L118 134 L38 146 Z", tx: 42, ty: 112, px: 74, py: 110,
    hum: [44, 47, 50, 54, 53, 51, 52]
  },
  {
    id: "L6", nombre: "La Corraleja", cultivo: "Cacao",
    humedad: 36, estado: "Óptima",
    d: "M124 132 L112 72 L196 64 L212 126 Z", tx: 138, ty: 106, px: 164, py: 102,
    hum: [33, 34, 36, 38, 37, 36, 36]
  },
  {
    id: "L7", nombre: "La Roca", cultivo: "Cacao",
    humedad: 45, estado: "Límite",
    d: "M218 124 L204 64 L292 68 L294 124 Z", tx: 232, ty: 100, px: 254, py: 96,
    hum: [40, 42, 44, 47, 46, 44, 45]
  }
];

/** Estado de humedad → [fondo, texto] de la insignia. */
export const ESTADO_LOTE = {
  "Óptima": ["#e4ecdd", C.leaf],
  "Límite": ["#f6ebd8", "#8a6220"],
  "Saturada": ["#f6e2d8", C.clay]
};

// ─────────────────────────────────────────────────────────────
//  Análisis de suelo · Laboratorio de Suelos, Universidad Nacional
//  de Colombia (sede Medellín). Muestreo 2022-03-10, informe 2022-03-17.
//  Los tres primeros lotes se remuestrearon el 2023-10-02.
//
//  Unidades: pH sin unidad · MO y CO en % · Al, Ca, Mg, K, CICE en
//  cmol(+)/kg · P en mg/kg · textura en % arena/limo/arcilla.
//  null = el informe no reporta ese valor para ese lote.
// ─────────────────────────────────────────────────────────────
export const SUELOS = [
  { lote: "L1", codigo: "SP06257", anio: 2022, arena: 57, limo: 14, arcilla: 29, textura: "FArA", pH: 5.2, mo: 1.68, co: 0.98, al: 1.2, ca: 1.85, mg: 0.79, k: 0.06, cice: 3.92, p: 0.74 },
  { lote: "L2", codigo: "SP06258", anio: 2022, arena: 47, limo: 18, arcilla: 35, textura: "ArA", pH: 5.3, mo: 1.95, co: 1.13, al: 0.5, ca: 4.31, mg: 0.68, k: 0.05, cice: 5.56, p: 1.09 },
  { lote: "L3", codigo: "SP06259", anio: 2022, arena: 51, limo: 12, arcilla: 37, textura: "ArA", pH: 5.0, mo: 1.61, co: 0.94, al: 2.6, ca: 1.64, mg: 0.56, k: 0.04, cice: 4.86, p: 3.58 },
  { lote: "L4", codigo: "SP06260", anio: 2022, arena: 42, limo: 15, arcilla: 43, textura: "Ar", pH: 5.5, mo: 1.66, co: 0.96, al: null, ca: 2.56, mg: 1.30, k: 0.27, cice: 4.17, p: 2.44 },
  { lote: "L6", codigo: "SP06261", anio: 2022, arena: 57, limo: 18, arcilla: 25, textura: "FArA", pH: 5.8, mo: 1.21, co: 0.70, al: null, ca: null, mg: null, k: null, cice: null, p: null },
  { lote: "L7", codigo: "SP06262", anio: 2022, arena: 40, limo: 23, arcilla: 37, textura: "FAr", pH: 5.4, mo: 2.19, co: 1.27, al: 1.3, ca: 4.31, mg: 2.17, k: 0.08, cice: 7.91, p: 2.78 },

  { lote: "L1", codigo: "SP16040", anio: 2023, arena: 54, limo: 14, arcilla: 32, textura: "FArA", pH: 5.2, mo: 1.98, co: 1.15, al: 0.3, ca: 2.07, mg: 1.40, k: 0.26, cice: 4.03, p: 3.29 },
  { lote: "L2", codigo: "SP16041", anio: 2023, arena: 56, limo: 18, arcilla: 26, textura: "FArA", pH: 5.2, mo: 1.66, co: 0.96, al: 0.2, ca: 3.26, mg: 0.86, k: 0.04, cice: 4.36, p: 2.08 },
  { lote: "L3", codigo: "SP16042", anio: 2023, arena: 58, limo: 14, arcilla: 28, textura: "FArA", pH: 4.9, mo: 2.06, co: 1.19, al: 0.9, ca: 1.36, mg: 0.47, k: 0.08, cice: 2.81, p: 2.25 }
];

/** Análisis foliar · mismo laboratorio, muestreo 2023-10-02.
 *  N, Ca, Mg, K, P, S en % · Fe, Mn, Cu, Zn, B en mg/kg. */
export const FOLIARES = [
  { lote: "L1", codigo: "FP16043", n: 1.75, ca: 1.76, mg: 0.61, k: 0.95, p: 0.17, s: 0.19, fe: 38.91, mn: 491.3, cu: 5.56, zn: 83.36, b: 39.83 },
  { lote: "L2", codigo: "FP16044", n: 1.96, ca: 0.80, mg: null, k: 1.22, p: 0.14, s: 0.15, fe: 44.22, mn: 493.8, cu: 6.00, zn: 182.1, b: 33.13 },
  { lote: "L3", codigo: "FP16045", n: 1.54, ca: null, mg: null, k: null, p: 0.13, s: 0.12, fe: 44.85, mn: 910.5, cu: 3.06, zn: 110.4, b: 29.93 }
];

/** Intervalo agronómicamente deseable para cacao, usado para colorear. */
export const REFERENCIA_SUELO = {
  pH: [5.5, 6.5],
  mo: [3, 10],
  cice: [6, 30]
};

// ─────────────────────────────────────────────────────────────
//  Calidad · Laboratorio de Análisis Físico y Sensorial de cacao,
//  FEDECACAO, San Vicente de Chucurí. Informes del 17 de abril de 2026.
//  Escala sensorial de 0 a 10.
// ─────────────────────────────────────────────────────────────
export const CALIDAD = [
  {
    codigo: "347-26", material: "FEAR 5 · FSV 41", fecha: "17 abr 2026",
    humedad: 7.9, indiceGrano: 1.6, fermentacion: 90,
    violetas: 9, pizarrosos: 0, mohosos: 1,
    global: 6.2,
    perfil: { Cacao: 5.5, Acidez: 3.0, Astringencia: 3.2, Amargo: 3.0, "Fruta fresca": 3.2, "Fruta seca": 2.3, Floral: 0.7, Nuez: 3.2, Dulce: 1.5, Verde: 1.8 },
    notas: "Especias y fruto rojo."
  },
  {
    codigo: "582-26", material: "CCN 51", fecha: "17 abr 2026",
    humedad: 7.5, indiceGrano: 1.5, fermentacion: 92,
    violetas: 8, pizarrosos: 0, mohosos: 0,
    global: 3.0,
    perfil: { Cacao: 3.6, Acidez: 4.7, Astringencia: 4.7, Amargo: 4.7, "Fruta fresca": 0.7, "Fruta seca": 0.7, Floral: 0.0, Nuez: 1.0, Dulce: 0.9, Verde: 3.7 },
    notas: "Color marrón medio. Aroma a fruta sobremadura, acidez acética, moho y sobrefermentación. En boca, amargor y astringencia sostenidos con notas verdes, picantes y terrosas."
  }
];

// ─────────────────────────────────────────────────────────────
//  Sensores · los valores acá son sólo el arranque de la página.
//  sheetSensores.js reemplaza este arreglo en caliente con lo que anote
//  la gente de la finca en la hoja compartida. `lugar` tiene que coincidir
//  con el nombre del lote para que ambas fuentes se crucen.
// ─────────────────────────────────────────────────────────────
export const SENSORES = [
  { id: "S-01", lugar: "L1 La Casa", tipo: "Humedad", valor: 64, unidad: "%", estado: "ok" },
  { id: "S-02", lugar: "L1 La Casa", tipo: "Humedad de suelo", valor: 34, unidad: "%", estado: "ok" },
  { id: "S-03", lugar: "L1 La Casa", tipo: "Temperatura", valor: 25, unidad: "°C", estado: "ok" },

  { id: "S-04", lugar: "L2 La Tira", tipo: "Humedad", valor: 61, unidad: "%", estado: "ok" },
  { id: "S-05", lugar: "L2 La Tira", tipo: "Humedad de suelo", valor: 29, unidad: "%", estado: "ok" },
  { id: "S-06", lugar: "L2 La Tira", tipo: "Temperatura", valor: 26, unidad: "°C", estado: "ok" },

  { id: "S-07", lugar: "L3 El Huevo", tipo: "Humedad", valor: 71, unidad: "%", estado: "aviso" },
  { id: "S-08", lugar: "L3 El Huevo", tipo: "Humedad de suelo", valor: 41, unidad: "%", estado: "aviso" },
  { id: "S-09", lugar: "L3 El Huevo", tipo: "Temperatura", valor: 24, unidad: "°C", estado: "ok" },

  { id: "S-10", lugar: "L4 El Mandarino", tipo: "Humedad", valor: 58, unidad: "%", estado: "ok" },
  { id: "S-11", lugar: "L4 El Mandarino", tipo: "Humedad de suelo", valor: 52, unidad: "%", estado: "aviso" },
  { id: "S-12", lugar: "L4 El Mandarino", tipo: "Temperatura", valor: 25, unidad: "°C", estado: "ok" },

  { id: "S-13", lugar: "L6 La Corraleja", tipo: "Humedad", valor: 55, unidad: "%", estado: "ok" },
  { id: "S-14", lugar: "L6 La Corraleja", tipo: "Humedad de suelo", valor: 36, unidad: "%", estado: "ok" },
  { id: "S-15", lugar: "L6 La Corraleja", tipo: "Temperatura", valor: 27, unidad: "°C", estado: "ok" },

  { id: "S-16", lugar: "L7 La Roca", tipo: "Humedad", valor: 66, unidad: "%", estado: "ok" },
  { id: "S-17", lugar: "L7 La Roca", tipo: "Humedad de suelo", valor: 45, unidad: "%", estado: "ok" },
  { id: "S-18", lugar: "L7 La Roca", tipo: "Temperatura", valor: 24, unidad: "°C", estado: "ok" },

  { id: "S-19", lugar: "Beneficiadero", tipo: "Humedad de grano", valor: 7.9, unidad: "%", estado: "ok" },
  { id: "S-20", lugar: "Beneficiadero", tipo: "Temperatura", valor: 31, unidad: "°C", estado: "aviso" }
];

export const COLOR_SENSOR = {
  ok: C.leaf,
  aviso: C.wheat,
  alerta: C.clay,
  "sin señal": C.mute
};

/** Plan del día. MUESTRA: todavía no hay origen de tareas conectado.
 *  [etiqueta, lote, horas] */
export const TAREAS = [
  ["Encalado de corrección en El Huevo", "L3", "4 h"],
  ["Poda de formación", "L7", "6 h"],
  ["Volteo de la masa en fermentación", "Beneficiadero", "1 h"],
  ["Monitoreo de monilia y escoba de bruja", "L2", "3 h"],
  ["Aplicación de abono orgánico", "L1", "5 h"],
  ["Registro de secado y humedad de grano", "Beneficiadero", "1 h"]
];

/** Estado inicial de las tareas completadas. */
export const TAREAS_HECHAS = [true, true, false, false, true, false];

/** Mensaje inicial del asistente LIA. */
export const SALUDO_LIA =
  "Hola. Soy LIA, la asistente de Hacienda Mesetas. Puedo explicarte los " +
  "análisis de suelo y foliares de cada lote, los resultados de catación, " +
  "el clima del cañón o el plan del día. Pregúntame lo que necesites.";

/** [día, lluvia mm, temp máx, temp mín]
 *  MUESTRA: el pronóstico real lo trae climaApi.js desde Open-Meteo. */
export const CLIMA = [
  ["Lun", 4, 27, 14],
  ["Mar", 0, 29, 15],
  ["Mié", 12, 24, 13],
  ["Jue", 18, 21, 12],
  ["Vie", 6, 23, 12],
  ["Sáb", 0, 26, 14],
  ["Dom", 2, 28, 15]
];

// ─────────────────────────────────────────────────────────────
//  Hilo del agente · MUESTRA
//
//  El contenido es de muestra, pero cuenta una historia sacada de los
//  informes reales: El Huevo tiene el pH más bajo y el aluminio más alto
//  de la finca, y el lote de CCN 51 salió con 3,0 en catación.
//  Cuando exista un backend para el hilo, reemplazar conservando la forma.
// ─────────────────────────────────────────────────────────────

export const HILO_DEMO = [
  { tipo: "nota", hora: "05:30", texto: "LIA revisó los 6 lotes y las lecturas de la hoja de campo." },
  {
    tipo: "accion", modo: "hecho", tag: "suelo", hora: "05:58", tono: "clay", confianza: 94,
    lead: "Puse el encalado de El Huevo de primero en el plan.",
    texto: "L3 bajó de pH 5,0 a 4,9 entre 2022 y 2023, y la CICE cayó de 4,86 a 2,81. " +
      "Es el único lote de la finca por debajo de pH 5,0.",
    impacto: "2 tareas reordenadas", chips: [{ kind: "lote", id: "L3" }]
  },
  {
    tipo: "accion", modo: "hecho", tag: "aviso", hora: "05:59", tono: "leaf", confianza: 99,
    lead: "Avisé a la cuadrilla de la entrada.",
    texto: "Le escribí a los que están activos hoy: entrada 6:00 en El Huevo, cal dolomita lista en bodega.",
    impacto: "6 avisados"
  },
  {
    tipo: "accion", modo: "pendiente", tag: "calidad", hora: "06:12", tono: "clay", confianza: 88,
    lead: "Separemos el CCN 51 del lote de exportación.",
    texto: "La catación de abril le dio 3,0 sobre 10, con moho, sobrefermentación y notas terrosas. " +
      "El FEAR 5 y FSV 41 sacaron 6,2 en la misma tanda, así que mezclarlos arrastra el precio de todo.",
    impacto: "protege el precio de la tanda"
  },
  {
    tipo: "accion", modo: "pendiente", tag: "beneficio", hora: "06:12", tono: "wheat", confianza: 81,
    lead: "Revisemos el protocolo de fermentación del CCN 51.",
    texto: "El defecto no está en el grano: 92% de fermentación y cero pizarrosos. " +
      "El moho y la sobrefermentación apuntan al manejo en cajón y al secado, no al material vegetal.",
    impacto: "una tarde de revisión en el beneficiadero"
  },
  {
    tipo: "accion", modo: "programado", tag: "nutrición", hora: "06:03", tono: "wheat", confianza: 76,
    lead: "Agendé muestreo foliar para los lotes que faltan.",
    texto: "Sólo L1, L2 y L3 tienen foliar de 2023. El Mandarino, La Corraleja y La Roca nunca se han muestreado.",
    impacto: "3 lotes sin cubrir"
  }
];

export const REGISTRO_DEMO = [
  { hora: "06:12", texto: "Dos cosas quedaron a tu nombre: separar el CCN 51 y revisar la fermentación." },
  { hora: "06:07", texto: "Cambió el pronóstico del cañón: el jueves pasa de 12 a 18 mm de lluvia." },
  { hora: "06:03", texto: "Muestreo foliar agendado para El Mandarino, La Corraleja y La Roca." },
  { hora: "05:59", texto: "Aviso de entrada enviado a la cuadrilla activa de hoy." },
  { hora: "05:58", texto: "Plan del día reordenado: encalado de El Huevo a las 6:00." },
  { hora: "05:30", texto: "Barrido de los 6 lotes y de la hoja de campo." }
];

/** Preguntas rápidas sugeridas debajo del cuadro de chat. */
export const ATAJOS_DEMO = [
  "¿por qué El Huevo está ácido?",
  "¿cómo salió la catación de abril?",
  "¿qué hago mañana?",
  "¿qué lotes faltan por foliar?"
];
