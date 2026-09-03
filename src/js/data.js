// ─────────────────────────────────────────────────────────────
//  Datos de muestra · prototipo Waiker / Agromyss
//
//  TODO: TODAS las cifras de este archivo son simuladas.
//  Reemplazar por lecturas reales (PostgreSQL / API Agromyss)
//  conservando la forma de los objetos: main.js sólo depende
//  de estas estructuras, no de los valores.
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
  nombre: "Agromyss",
  detalle: "14,8 ha · campaña 25/26",
  usuario: { iniciales: "SG", nombre: "Sebastián", rol: "Administrador finca" }
};

/** Cultivos de la finca. El primero ("Todos") es el filtro neutro. */
export const CULTIVOS = ["Todos", "Cacao", "Café", "Mango"];

/** Color de serie por cultivo, usado en gráficas y leyendas. */
export const COLOR_CULTIVO = {
  Cacao: C.leaf,
  Café: C.coffee,
  Mango: C.wheat
};

export const RANGOS = { "24h": 24, "7d": 7, "30d": 30 };

export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Lotes de la finca.
 * `d` / `tx` / `ty` / `px` / `py` son la geometría del mapa SVG (viewBox 300x200).
 * `hum` es la serie de humedad de los últimos 7 días.
 */
export const LOTES = [
  {
    id: "A-1", nombre: "Alto Palmar", cultivo: "Cacao",
    ha: 2.4, humedad: 34, estado: "Óptima", merma: 7.2, kg: 412, plantas: 3100,
    d: "M14 26 L92 16 L104 66 L26 78 Z", tx: 26, ty: 46, px: 58, py: 48,
    hum: [31, 33, 36, 34, 32, 35, 34]
  },
  {
    id: "A-2", nombre: "Cañada Honda", cultivo: "Cacao",
    ha: 3.1, humedad: 29, estado: "Óptima", merma: 9.4, kg: 508, plantas: 3980,
    d: "M110 64 L98 16 L176 10 L192 58 Z", tx: 122, ty: 40, px: 148, py: 40,
    hum: [27, 28, 30, 31, 29, 28, 29]
  },
  {
    id: "A-3", nombre: "Loma del Sur", cultivo: "Café",
    ha: 1.8, humedad: 41, estado: "Límite", merma: 5.1, kg: 274, plantas: 1620,
    d: "M198 56 L184 10 L288 16 L292 58 Z", tx: 212, ty: 38, px: 240, py: 36,
    hum: [38, 39, 42, 44, 41, 40, 41]
  },
  {
    id: "B-1", nombre: "Vega Baja", cultivo: "Mango",
    ha: 2.9, humedad: 52, estado: "Saturada", merma: 11.6, kg: 366, plantas: 840,
    d: "M28 84 L106 72 L118 134 L38 146 Z", tx: 42, ty: 112, px: 74, py: 110,
    hum: [44, 47, 50, 54, 53, 51, 52]
  },
  {
    id: "B-2", nombre: "El Guamal", cultivo: "Mango",
    ha: 2.2, humedad: 36, estado: "Óptima", merma: 6.3, kg: 198, plantas: 720,
    d: "M124 132 L112 72 L196 64 L212 126 Z", tx: 138, ty: 106, px: 164, py: 102,
    hum: [33, 34, 36, 38, 37, 36, 36]
  },
  {
    id: "C-1", nombre: "Corral Nuevo", cultivo: "Café",
    ha: 2.4, humedad: 45, estado: "Límite", merma: 8.0, kg: 312, plantas: 2870,
    d: "M218 124 L204 64 L292 68 L294 124 Z", tx: 232, ty: 100, px: 254, py: 96,
    hum: [40, 42, 44, 47, 46, 44, 45]
  }
];

/** Objetivo de campaña en kg, usado por el bloque de acumulado. */
export const OBJETIVO_CAMPANA = 2280;

/** Estado de humedad → [fondo, texto] de la insignia. */
export const ESTADO_LOTE = {
  "Óptima": ["#e4ecdd", C.leaf],
  "Límite": ["#f6ebd8", "#8a6220"],
  "Saturada": ["#f6e2d8", C.clay]
};

export const SENSORES = [
  { id: "S-01", lugar: "Lote A · Cacao", tipo: "Humedad", valor: 64, unidad: "%", bateria: 92, visto: "hace 4 m", estado: "ok", serie: [61, 63, 66, 64, 62, 65, 64, 63, 64] },
  { id: "S-02", lugar: "Lote A · Cacao", tipo: "Humedad de suelo", valor: 34, unidad: "%", bateria: 92, visto: "hace 4 m", estado: "ok", serie: [31, 33, 36, 34, 32, 35, 34, 33, 34] },
  { id: "S-03", lugar: "Lote A · Cacao", tipo: "Temperatura", valor: 25, unidad: "°C", bateria: 92, visto: "hace 4 m", estado: "ok", serie: [24, 24, 25, 26, 25, 24, 25, 25, 25] },

  { id: "S-04", lugar: "Lote B · Mango", tipo: "Humedad", valor: 41, unidad: "%", bateria: 78, visto: "hace 6 m", estado: "alerta", serie: [27, 28, 30, 31, 29, 28, 29, 30, 29] },
  { id: "S-05", lugar: "Lote B · Mango", tipo: "Humedad de suelo", valor: 22, unidad: "%", bateria: 78, visto: "hace 6 m", estado: "alerta", serie: [25, 24, 23, 22, 22, 21, 22, 22, 22] },
  { id: "S-06", lugar: "Lote B · Mango", tipo: "Temperatura", valor: 29, unidad: "°C", bateria: 78, visto: "hace 6 m", estado: "aviso", serie: [27, 28, 28, 29, 29, 28, 29, 29, 29] },

  { id: "S-07", lugar: "Lote C · Café", tipo: "Humedad", valor: 58, unidad: "%", bateria: 41, visto: "hace 11 m", estado: "ok", serie: [55, 56, 58, 57, 58, 59, 58, 57, 58] },
  { id: "S-08", lugar: "Lote C · Café", tipo: "Humedad de suelo", valor: 29, unidad: "%", bateria: 41, visto: "hace 11 m", estado: "ok", serie: [26, 27, 30, 29, 28, 29, 29, 28, 29] },
  { id: "S-09", lugar: "Lote C · Café", tipo: "Temperatura", valor: 22, unidad: "°C", bateria: 41, visto: "hace 11 m", estado: "ok", serie: [21, 21, 22, 22, 23, 22, 22, 22, 22] },

  { id: "S-10", lugar: "Lote D · Cacao", tipo: "Humedad", valor: 71, unidad: "%", bateria: 66, visto: "hace 3 m", estado: "aviso", serie: [66, 68, 70, 71, 70, 71, 72, 71, 71] },
  { id: "S-11", lugar: "Lote D · Cacao", tipo: "Humedad de suelo", valor: 52, unidad: "%", bateria: 66, visto: "hace 3 m", estado: "aviso", serie: [44, 47, 50, 54, 53, 51, 52, 53, 52] },
  { id: "S-12", lugar: "Lote D · Cacao", tipo: "Temperatura", valor: 24, unidad: "°C", bateria: 66, visto: "hace 3 m", estado: "ok", serie: [23, 23, 24, 24, 25, 24, 24, 24, 24] },

  { id: "S-13", lugar: "Vivero", tipo: "Temperatura", valor: 23, unidad: "°C", bateria: 88, visto: "hace 8 m", estado: "ok", serie: [21, 22, 24, 25, 24, 23, 23, 24, 23] },
  { id: "S-14", lugar: "Zona hídrica", tipo: "Caudal riego", valor: 0, unidad: "l/m", bateria: 12, visto: "hace 2 h", estado: "sin señal", serie: [4, 4, 3, 2, 1, 0, 0, 0, 0] }
];

export const COLOR_SENSOR = {
  ok: C.leaf,
  aviso: C.wheat,
  alerta: C.clay,
  "sin señal": C.mute
};

/** [etiqueta, lote, horas] */
export const TAREAS = [
  ["Revisar goteo sector norte", "A-1", "1,5 h"],
  ["Recolección selectiva", "A-2", "6 h"],
  ["Aplicar sombra al vivero", "B-2", "2 h"],
  ["Drenar surco encharcado", "B-1", "3 h"],
  ["Pesaje y registro tarde", "Patio", "1 h"],
  ["Trampas de broca", "C-1", "2,5 h"]
];

/** Estado inicial de las tareas completadas. */
export const TAREAS_HECHAS = [true, true, false, false, true, false];

/** Color por tono de propuesta/acción del agente. Usado por el hilo de HILO_DEMO. */
export const TONO_PROPUESTA = { clay: C.clay, leaf: C.leaf, wheat: C.wheat };

/** Total de acciones que el agente puede proponer en el día (gauge de autonomía). */
export const AUTONOMIA_TOTAL = 19;
export const AUTONOMIA_BASE = 11;

/**
 * Cuentas del mes, en pesos colombianos (COP).
 * `valor` en unidades enteras; el formato se aplica en main.js.
 */
export const CUENTAS = [
  { etiqueta: "Venta de cacao", valor: 8940000, signo: 1 },
  { etiqueta: "Venta de café", valor: 6120000, signo: 1 },
  { etiqueta: "Venta de mango", valor: 2340000, signo: 1 },
  { etiqueta: "Jornales cuadrilla", valor: -5480000, signo: -1 },
  { etiqueta: "Insumos y fitosanitarios", valor: -3210000, signo: -1 },
  { etiqueta: "Combustible y transporte", valor: -1150000, signo: -1 }
];

/** Reparto visual de la barra de cuentas: [ancho, color]. */
export const CUENTAS_BARRA = [
  ["48%", C.leaf],
  ["22%", "#7d9b62"],
  ["19%", C.clay],
  ["11%", C.wheat]
];

/** [día, lluvia mm, temp máx, temp mín] */
export const CLIMA = [
  ["Lun", 4, 27, 14],
  ["Mar", 0, 29, 15],
  ["Mié", 12, 24, 13],
  ["Jue", 18, 21, 12],
  ["Vie", 6, 23, 12],
  ["Sáb", 0, 26, 14],
  ["Dom", 2, 28, 15]
];

/** Avance de labores de la campaña. */
export const LABORES = [
  { etiqueta: "Poda A-1 / A-2", pct: 47, objetivo: 60, color: C.coffee },
  { etiqueta: "Riego por goteo", pct: 64, objetivo: 70, color: C.water },
  { etiqueta: "Control de broca", pct: 82, objetivo: 75, color: C.leaf },
  { etiqueta: "Abonado de fondo", pct: 38, objetivo: 50, color: C.wheat },
  { etiqueta: "Mantenimiento vías", pct: 23, objetivo: 40, color: "#b3a693" }
];

/** [nombre, jornales de 6, kg por jornal] */
export const CUADRILLA = [
  ["Juan Carlos", 6, "31 kg"],
  ["María R.", 5, "28 kg"],
  ["Daniel L.", 5, "24 kg"],
  ["Rosa P.", 4, "22 kg"],
  ["Andrés D.", 3, "19 kg"],
  ["Nelson S.", 2, "15 kg"]
];

export const COLOR_AVATAR = [C.coffee, C.leaf, C.water, C.wheat, C.clay, "#6b6055"];

/** Anillos de progreso de la campaña: [pct, color, etiqueta] */
export const ANILLOS = [
  [76, C.coffee, "Corte"],
  [53, C.leaf, "Secado"],
  [37, C.wheat, "Envío"],
  [88, C.water, "Calidad"]
];

/** Mensaje inicial del asistente LIA. */
export const SALUDO_LIA =
  "Hola. Soy LIA, el asistente de la finca. Puedo explicarte el estado de los " +
  "lotes, las alertas de humedad o el plan del día. Pregúntame lo que necesites.";

// ─────────────────────────────────────────────────────────────
//  Hilo de hoy · prototipo del panel agéntico
//
//  TODO: esto es contenido de muestra, igual que PROPUESTAS_DEMO.
//  Cuenta la misma historia que PROPUESTAS_DEMO (pausar riego en
//  B-1, adelantar corte en A-2, cambiar batería en C-1) pero en
//  forma de hilo de chat. Cuando exista un backend para el hilo,
//  reemplazar por la respuesta real conservando la forma de cada
//  entrada: main.js sólo depende de estos campos, no de los valores.
// ─────────────────────────────────────────────────────────────

/** Resumen que abre la vista de chat cada día. */
export const BRIEFING_DEMO = {
  titulo:
    "Vega Baja sigue encharcada y el jueves entran 18 mm, así que apagué el riego y puse el " +
    "drenaje de primero. Lo que necesito de ti es el corte de Cañada Honda: si lo pasamos a " +
    "mañana, aprovechamos el último día seco.",
  detalle:
    "Del resto no te preocupes: el plan del día ya quedó ordenado, la cuadrilla está avisada " +
    "y el sensor de Corral Nuevo tiene su cita en la tarde. Si algo se sale de lo normal te " +
    "escribo yo primero."
};

/**
 * Hilo de hoy: notas del sistema y propuestas del agente, en orden cronológico.
 * `tag` decide la insignia mostrada; `tono` ∈ TONO_PROPUESTA decide el color.
 * `chips` referencia SENSORES / LOTES por id para el detalle desplegable.
 */
export const HILO_DEMO = [
  { tipo: "nota", hora: "05:30", texto: "LIA revisó los 6 lotes y los 6 sensores." },
  {
    tipo: "accion", modo: "hecho", tag: "plan", hora: "05:58", tono: "wheat", confianza: 96,
    lead: "Moví el drenaje de Vega Baja a las 6:00.",
    texto: "El sensor S-04 sigue marcando 52% de humedad, por encima de lo que aguanta el mango. " +
      "Puse el drenaje de primero en el plan, antes de que apriete el calor.",
    impacto: "2 tareas reordenadas", chips: [{ kind: "sensor", id: "S-04" }]
  },
  {
    tipo: "accion", modo: "hecho", tag: "aviso", hora: "05:59", tono: "leaf", confianza: 99,
    lead: "Avisé a la cuadrilla de la entrada.",
    texto: "Le escribí a los que están activos hoy: entrada 6:00 en Vega Baja, botas y pala.",
    impacto: "6 avisados"
  },
  {
    tipo: "accion", modo: "pendiente", tag: "riego", hora: "06:12", tono: "clay", confianza: 91,
    lead: "Pausemos el riego de Vega Baja 48 horas.",
    texto: "B-1 lleva varios días con la humedad por encima del límite y el jueves entran 18 mm " +
      "de lluvia. Si riegas hoy, el surco se vuelve a encharcar y se daña fruta al cortar.",
    impacto: "ahorra riego y un jornal", chips: [{ kind: "sensor", id: "S-04" }, { kind: "clima" }]
  },
  {
    tipo: "accion", modo: "pendiente", tag: "corte", hora: "06:12", tono: "leaf", confianza: 84,
    lead: "Adelantemos el corte de Cañada Honda a mañana.",
    texto: "El cacao de A-2 ya está en punto y mañana es el último día seco antes de la lluvia " +
      "del jueves. Reparto la cuadrilla y lo cerramos en el día.",
    impacto: "evita perder la ventana seca", chips: [{ kind: "lote", id: "A-2" }]
  },
  {
    tipo: "accion", modo: "programado", tag: "mantenimiento", hora: "06:03", tono: "wheat", confianza: 72,
    lead: "Agendé cambio de batería para el sensor de Corral Nuevo.",
    texto: "S-06 está al 12% de batería y sin caudal desde ayer. No mandé a nadie solo por eso: " +
      "lo dejé pegado al pesaje de la tarde.",
    impacto: "20 minutos, una persona", chips: [{ kind: "sensor", id: "S-06" }]
  }
];

/** Bandeja "lo que hizo hoy" al pie del panel de propuestas. */
export const REGISTRO_DEMO = [
  { hora: "06:12", texto: "Dos cosas quedaron a tu nombre: el riego de Vega Baja y el corte de Cañada Honda." },
  { hora: "06:07", texto: "Cambió el pronóstico: el jueves pasa de 12 a 18 mm de lluvia." },
  { hora: "06:03", texto: "Cambio de batería del sensor de Corral Nuevo agendado con el pesaje de la tarde." },
  { hora: "05:59", texto: "Aviso de entrada enviado a la cuadrilla activa de hoy." },
  { hora: "05:58", texto: "Plan del día reordenado: drenaje de Vega Baja a las 6:00." },
  { hora: "05:30", texto: "Barrido de los 6 lotes y 6 sensores: uno sin señal." }
];

/** Preguntas rápidas sugeridas debajo del cuadro de chat. */
export const ATAJOS_DEMO = [
  "¿riego hoy Vega Baja?",
  "¿cómo está el sensor de Vega Baja?",
  "¿qué hago mañana?",
  "¿cómo va la plata del mes?"
];
