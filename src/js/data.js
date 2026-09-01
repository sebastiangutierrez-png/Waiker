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
  { id: "S-01", lugar: "A-1 · cabecera", tipo: "humedad suelo", valor: 34, unidad: "%", bateria: 92, visto: "hace 4 m", estado: "ok", serie: [31, 33, 36, 34, 32, 35, 34, 33, 34] },
  { id: "S-02", lugar: "A-2 · media ladera", tipo: "humedad suelo", valor: 29, unidad: "%", bateria: 78, visto: "hace 6 m", estado: "ok", serie: [27, 28, 30, 31, 29, 28, 29, 30, 29] },
  { id: "S-03", lugar: "A-3 · sombra alta", tipo: "humedad suelo", valor: 41, unidad: "%", bateria: 41, visto: "hace 11 m", estado: "aviso", serie: [38, 39, 42, 44, 41, 40, 41, 42, 41] },
  { id: "S-04", lugar: "B-1 · vega, junto acequia", tipo: "humedad suelo", valor: 52, unidad: "%", bateria: 66, visto: "hace 3 m", estado: "alerta", serie: [44, 47, 50, 54, 53, 51, 52, 53, 52] },
  { id: "S-05", lugar: "B-2 · vivero", tipo: "temp. hoja", valor: 23, unidad: "°C", bateria: 88, visto: "hace 8 m", estado: "ok", serie: [21, 22, 24, 25, 24, 23, 23, 24, 23] },
  { id: "S-06", lugar: "C-1 · depósito", tipo: "caudal riego", valor: 0, unidad: "l/m", bateria: 12, visto: "hace 2 h", estado: "sin señal", serie: [4, 4, 3, 2, 1, 0, 0, 0, 0] }
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

/**
 * Propuestas de respaldo del agente.
 * Se muestran cuando la API no responde; si responde, se reemplazan.
 * Ver api.js → obtenerPropuestas().
 */
export const PROPUESTAS_DEMO = [
  { titulo: "Pausar riego 48 h", lote: "B-1", motivo: "Humedad 52% y 18 mm de lluvia previstos.", tono: "clay" },
  { titulo: "Adelantar corte a mañana", lote: "A-2", motivo: "Madurez 84% y ventana seca de 2 días.", tono: "leaf" },
  { titulo: "Sustituir batería sensor", lote: "C-1", motivo: "S-06 al 12% y sin caudal desde ayer.", tono: "wheat" }
];

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
