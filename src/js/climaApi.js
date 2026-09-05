// ─────────────────────────────────────────────────────────────
//  Agromyss · pronóstico real vía Open-Meteo
//
//  A diferencia de los sensores (que nadie puede medir sin hardware), el
//  clima sí es un dato público — así que en vez de pedirle a alguien en la
//  finca que lo anote a mano, lo traemos de una API gratuita y sin API key:
//  https://open-meteo.com/
//
//  Coordenadas de la finca: 6°32'22"N 74°37'49"W (Magdalena Medio, Antioquia).
//  Si la finca cambia de ubicación, sólo hay que actualizar LAT/LON abajo.
// ─────────────────────────────────────────────────────────────

const LAT = 6.5394;
const LON = -74.6303;
const ZONA_HORARIA = "America/Bogota";

const URL_PRONOSTICO =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code` +
  `&hourly=temperature_2m,weather_code,precipitation_probability` +
  `&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code` +
  `&timezone=${encodeURIComponent(ZONA_HORARIA)}&forecast_days=5`;

// Códigos WMO que usa Open-Meteo → texto corto en español.
const CONDICIONES = {
  0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
  45: "Niebla", 48: "Niebla helada",
  51: "Llovizna ligera", 53: "Llovizna", 55: "Llovizna densa",
  61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia fuerte",
  66: "Lluvia helada", 67: "Lluvia helada fuerte",
  71: "Nieve ligera", 73: "Nieve", 75: "Nieve fuerte", 77: "Granizo fino",
  80: "Chubascos ligeros", 81: "Chubascos", 82: "Chubascos fuertes",
  85: "Chubascos de nieve", 86: "Chubascos de nieve fuertes",
  95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta con granizo fuerte"
};

function condicionDe(codigo) {
  return CONDICIONES[codigo] ?? "Sin datos";
}

function direccionCompass(grados) {
  const puntos = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return puntos[Math.round(grados / 45) % 8];
}

const HORA_FMT = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA_HORARIA });
const DIA_FMT = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: ZONA_HORARIA });
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Convierte la respuesta de Open-Meteo a la misma forma { actual, horas }
 *  que ya consume renderPronostico() en main.js, para no duplicar lógica
 *  de pintado entre esta fuente y la hoja de cálculo. */
function aFormato(json) {
  const c = json.current;
  const d = json.daily;

  const ahoraISO = c.time;
  const idxAhora = json.hourly.time.indexOf(ahoraISO.slice(0, 14) + "00");
  const desde = idxAhora === -1 ? 0 : idxAhora;

  const horas = json.hourly.time.slice(desde, desde + 16)
    .filter((_, i) => i % 4 === 0)
    .slice(0, 4)
    .map((iso, i) => {
      const j = desde + i * 4;
      return {
        hora: HORA_FMT.format(new Date(iso)),
        temp: Math.round(json.hourly.temperature_2m[j]),
        nota: condicionDe(json.hourly.weather_code[j])
      };
    });

  // Ventana recomendada: primer tramo de 2h+ con poca probabilidad de lluvia.
  const probs = json.hourly.precipitation_probability.slice(desde, desde + 16);
  let inicio = -1, mejorIni = null, mejorFin = null;
  probs.forEach((p, i) => {
    if (p < 30) {
      if (inicio === -1) inicio = i;
    } else if (inicio !== -1) {
      if (i - inicio >= 2 && mejorIni === null) { mejorIni = inicio; mejorFin = i; }
      inicio = -1;
    }
  });
  if (inicio !== -1 && probs.length - inicio >= 2 && mejorIni === null) { mejorIni = inicio; mejorFin = probs.length - 1; }
  const ventana = mejorIni !== null
    ? `${HORA_FMT.format(new Date(json.hourly.time[desde + mejorIni]))} a ${HORA_FMT.format(new Date(json.hourly.time[desde + mejorFin]))}`
    : "";

  const probMaxHoy = d.precipitation_probability_max[0] ?? 0;

  // Aviso de lluvia: si ya está lloviendo, decirlo; si no, buscar la próxima
  // hora con probabilidad alta y avisar a qué hora se espera.
  let notaLluvia;
  if (c.precipitation > 0) {
    notaLluvia = "Lluvia en curso";
  } else {
    const iProxima = probs.findIndex((p) => p >= 50);
    notaLluvia = iProxima !== -1
      ? `Lluvia esperada a las ${HORA_FMT.format(new Date(json.hourly.time[desde + iProxima]))}`
      : "Sin lluvia prevista en las próximas horas";
  }

  const dias = d.time.map((iso, i) => ({
    etiqueta: i === 0 ? "Hoy" : capitalizar(DIA_FMT.format(new Date(iso + "T12:00:00"))).replace(/\.$/, ""),
    max: Math.round(d.temperature_2m_max[i]),
    min: Math.round(d.temperature_2m_min[i])
  }));

  return {
    actual: {
      temp: Math.round(c.temperature_2m),
      condicion: condicionDe(c.weather_code),
      humedad: Math.round(c.relative_humidity_2m),
      vientoDir: direccionCompass(c.wind_direction_10m),
      vientoKmh: Math.round(c.wind_speed_10m),
      lluviaProb: Math.round(probMaxHoy),
      lluviaTexto: probMaxHoy >= 50 ? "Probable hoy" : probMaxHoy >= 20 ? "Posible más tarde" : "Sin lluvia prevista",
      pluviometriaMm: Math.round((d.precipitation_sum[0] ?? 0) * 10) / 10,
      ventana,
      notaLluvia,
      actualizado: HORA_FMT.format(new Date())
    },
    horas,
    dias
  };
}

export async function leerPronosticoReal() {
  try {
    const res = await fetch(URL_PRONOSTICO, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return aFormato(await res.json());
  } catch (err) {
    console.warn("No se pudo obtener el pronóstico de Open-Meteo:", err.message);
    return null;
  }
}

const INTERVALO_MS = 15 * 60 * 1000;

/** Igual patrón que los sensores: ahora, cada 15 min, y al volver a la
 *  pestaña. `onActualizado({ actual, horas })` sólo se llama con datos
 *  buenos — si la API falla, la página se queda con lo que ya tenía. */
export function iniciarSincronizacionClima(onActualizado) {
  async function sincronizar() {
    const datos = await leerPronosticoReal();
    if (datos) onActualizado?.(datos);
  }
  sincronizar();
  setInterval(sincronizar, INTERVALO_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sincronizar();
  });
}
