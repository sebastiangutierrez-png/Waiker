// Comprobación del cierre de rutas privadas del Worker.
//     node worker/acceso.test.mjs
// Firma JWT reales con una clave RSA de prueba y simula las claves
// públicas de Access y el puente; no hace ninguna llamada de red.
import assert from "node:assert/strict";
import worker from "./index.js";

const EQUIPO = "prueba.cloudflareaccess.com";
const AUD = "aud-de-prueba";
const HOJA = "https://hoja.test/sensores.csv";
const env = { CF_ACCESS_TEAM_DOMAIN: EQUIPO, CF_ACCESS_AUD: AUD, BRIDGE_TOKEN: "x".repeat(24), BRIDGE_URL: "https://puente.test/agent", SHEET_CSV_URL: HOJA };
let csvHoja = [
  "id,lugar,tipo,valor,unidad,estado,ultima_actualizacion,sensor_form_label",
  "S-01,L1 La Casa,Humedad,,%,ok,,S-01 L1 La Casa Humedad",
  'S-04,"L2 La Tira, norte",Humedad,12,%,aviso,2026-09-05 12:29,S-04'
].join("\n");

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]
);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1" };

const b64url = (datos) => Buffer.from(datos).toString("base64url");
async function firmar(carga) {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "RS256", kid: "k1" }));
  const cue = b64url(JSON.stringify({ aud: [AUD], iss: `https://${EQUIPO}`, email: "yo@finca.test", iat: ahora, exp: ahora + 300, ...carga }));
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${cab}.${cue}`));
  return `${cab}.${cue}.${b64url(firma)}`;
}

let llamadasPuente = [];
let mensajeAlPuente = null;
globalThis.fetch = async (url, opciones = {}) => {
  url = String(url);
  if (url === `https://${EQUIPO}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
  if (url === HOJA) return csvHoja === null ? new Response("caída", { status: 500 }) : new Response(csvHoja);
  llamadasPuente.push({ url, actor: opciones.headers?.["x-agromyss-actor"] });
  if (url.endsWith("/chat")) {
    mensajeAlPuente = JSON.parse(opciones.body).mensaje;
    return Response.json({ respuesta: "ok" });
  }
  return Response.json({ propuestas: [] });
};

let assetsServidos = 0;
const conAssets = (e) => ({ ...e, ASSETS: { fetch: async () => (assetsServidos++, new Response("estatico")) } });
const pedir = (ruta, jwt, e = env) =>
  worker.fetch(new Request(`https://panel.test${ruta}`, { headers: jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {} }), conAssets(e));

const valido = await firmar({});

// Público.
assert.equal((await pedir("/")).status, 200);
assert.equal((await pedir("/css/styles.css")).status, 200);

// Privado sin JWT, con JWT roto, de otra app o caducado → nunca llega a ASSETS ni al puente.
assetsServidos = 0; llamadasPuente = [];
assert.equal((await pedir("/app/js/data.js")).status, 403);
assert.equal((await pedir("/app")).status, 403);
assert.equal((await pedir("/app/js/data.js", "basura")).status, 403);
assert.equal((await pedir("/app/js/data.js", await firmar({ aud: ["otra-app"] }))).status, 403);
assert.equal((await pedir("/app/js/data.js", await firmar({ exp: 1 }))).status, 403);
assert.equal((await pedir("/api/propuestas")).status, 401);
assert.equal((await pedir("/api/propuestas", valido.slice(0, -4) + "AAAA")).status, 401);
assert.equal(assetsServidos, 0);
assert.equal(llamadasPuente.length, 0);

// Sin configuración de Access → 503, no "anon".
const sinAccess = { ...env, CF_ACCESS_AUD: "" };
assert.equal((await pedir("/app/", valido, sinAccess)).status, 503);
assert.equal((await pedir("/api/propuestas", valido, sinAccess)).status, 503);
assert.equal(llamadasPuente.length, 0);

// Con JWT válido → se sirve y el puente recibe el email verificado.
assert.equal((await pedir("/app/js/data.js", valido)).status, 200);
assert.equal((await pedir("/api/propuestas", valido)).status, 200);
assert.deepEqual(llamadasPuente, [{ url: "https://puente.test/agent/propuestas", actor: "yo@finca.test" }]);

// Chat: la hoja va adjunta, compacta, y todo cabe en los 4000 del puente.
const preguntar = (texto, contexto = {}) => worker.fetch(new Request("https://panel.test/api/chat", {
  method: "POST",
  headers: { "Cf-Access-Jwt-Assertion": valido, "content-type": "application/json" },
  body: JSON.stringify({ mensajes: [{ rol: "yo", texto }], contexto })
}), conAssets(env));

assert.equal((await preguntar("¿cómo está la humedad?")).status, 200);
assert.match(mensajeAlPuente, /^¿cómo está la humedad\?/);
assert.match(mensajeAlPuente, /S-04 L2 La Tira, norte · Humedad: 12% \(aviso, 2026-09-05 12:29\)/);
assert.match(mensajeAlPuente, /1 sensores más sin lectura/);
assert.doesNotMatch(mensajeAlPuente, /S-01/);

assert.equal((await preguntar("x".repeat(5000), { lote: "L".repeat(5000) })).status, 200);
assert.ok(mensajeAlPuente.length <= 4000, `mensaje de ${mensajeAlPuente.length} caracteres`);
assert.match(mensajeAlPuente, /S-04/);

csvHoja = null; // hoja caída → el chat sigue, sin lecturas
assert.equal((await preguntar("hola")).status, 200);
assert.equal(mensajeAlPuente, "hola");

// Enlace viejo.
const viejo = await pedir("/agente.html");
assert.equal(viejo.status, 301);
assert.equal(viejo.headers.get("location"), "https://panel.test/app/agente.html");

console.log("ok: rutas privadas cerradas sin JWT válido");
