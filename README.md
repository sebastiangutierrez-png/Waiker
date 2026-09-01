# Waiker

Panel de operaciones y monitoreo agronómico de la finca **Agromyss**.

Interfaz densa de una sola página: recolección, mapa de lotes, plan del día,
sensores, clima, cuentas, cuadrilla y un asistente conversacional (LIA) con
cola de propuestas del agente Openclaw.

## Estructura

```
src/                sitio estático (lo que se despliega)
  index.html        estructura y contenedores
  css/styles.css    sistema visual + reglas responsive
  js/data.js        datos de muestra (TODO: reemplazar por datos reales)
  js/api.js         cliente HTTP hacia /api (sin credenciales)
  js/main.js        estado, render y eventos
worker/             intermediario de Cloudflare
  index.js          rutas /api/* + servido de src/
  wrangler.toml.example
```

Sin framework y sin paso de compilación: los archivos se sirven tal cual.
`js/` usa módulos ES nativos (`<script type="module">`).

## Desarrollo

Los módulos ES no funcionan por `file://`; hace falta un servidor:

```bash
npx http-server src -p 8777
```

Luego abre <http://127.0.0.1:8777>. Sin el Worker delante, la interfaz
funciona en **modo prototipo**: muestra los datos de muestra y avisa de que el
asistente y las propuestas no están conectados.

## Arquitectura de la API

El asistente es un agente real de OpenClaw (hoy `waykao`), no un modelo suelto.
El gateway de OpenClaw sólo habla WebSocket y su token es de **operador**
(puede borrar agentes, tocar cron, cambiar config): no puede salir de la
máquina bajo ninguna circunstancia. Por eso existe un intermediario propio en
nemoclaw, el **agent-bridge**, que es lo único autorizado a invocar agentes, y
que expone una única ruta HTTP estrecha con su propio secreto:

```
navegador ──/api/chat──▶ Worker ──Bearer BRIDGE_TOKEN──▶ api.agromyss.com/agent/chat ──▶ agent-bridge:7353 ──▶ agente waykao
             (sin token)      (secreto propio)                    (Caddy)                (nemoclaw, loopback)
```

`api.agromyss.com/v1/*` sigue existiendo y sigue yendo a modelrelay
(127.0.0.1:7352) tal como antes — es una API distinta, sin agente detrás, y
esta página ya no la usa. El Caddyfile no perdió nada: sólo ganó un bloque
`/agent/*` nuevo, con su propio matcher CORS (que lo excluye explícitamente:
esta ruta la llama el Worker, servidor a servidor, nunca el navegador).

El puente deriva la clave de sesión del agente a partir de la identidad de
quien pregunta — nunca la acepta del cliente — así que cada persona tiene su
propia conversación persistente, no una compartida. Ver `worker/index.js`
(`verificarAccess`) para cómo se obtiene esa identidad de forma segura.

### Identidad: Cloudflare Access

Como la página vive detrás de Cloudflare Access, el Worker puede saber quién
pregunta sin pedir login propio. Pero la cabecera
`Cf-Access-Authenticated-User-Email` es sólo informativa — cualquiera que le
hable al Worker sin pasar por Access podría falsificarla. Por eso el Worker
verifica el JWT firmado (`Cf-Access-Jwt-Assertion`) contra las claves
públicas de tu equipo antes de confiar en el email.

Esto es opcional y se activa con `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` en
`[vars]` (ver `wrangler.toml.example`). **Sin configurar, todo el mundo
comparte una sola sesión "anon"** — sirve para probar, pero no es el estado
final: sácalos del panel Zero Trust → Access → Applications antes de
considerar esto listo para todos los administradores.

### Rutas del Worker

| Ruta          | Método | Para qué                                       |
| ------------- | ------ | ----------------------------------------------- |
| `/api/salud`  | GET    | ¿tiene el Worker lo necesario para intentarlo?  |
| `/api/chat`   | POST   | pregunta libre al asistente (agente `waykao`)   |

`/api/propuestas` y `/api/propuestas/decision` se retiraron a propósito: por
ahora no hay sensores reales detrás, y prometer una cola de acciones sin datos
reales era peor que no tenerla. La interfaz ya cae sola a las propuestas de
muestra si estas rutas no existen — no hizo falta tocar `main.js`. Vuelven
cuando OpenClaw esté sincronizado con los sensores de campo.

### Despliegue

El sitio se publica por *commits a GitHub*. Antes del primer despliegue con
API hay que dar de alta el secreto una sola vez:

```bash
wrangler secret put BRIDGE_TOKEN
```

El valor es el mismo que usa el agent-bridge en su propio `bridge.env`
(`/home/usuario/agent-bridge/` en nemoclaw). **No es**
`OPENCLAW_GATEWAY_TOKEN` — ese es del operador del gateway y no debe salir de
la máquina bajo ninguna circunstancia. **No lo escribas en `wrangler.toml`**,
que sí se versiona.

## Estado actual

- **Interfaz** — completa y navegable.
- **Datos de campo** — simulados. Viven en `src/js/data.js`, aislados a
  propósito: `main.js` depende de la forma de los objetos, no de los valores,
  así que conectarlos a PostgreSQL no toca el render.
- **API** — `api.agromyss.com` está en el aire con certificado válido y las
  rutas `/v1/*` y `/agent/*` respondiendo. Falta dar de alta `BRIDGE_TOKEN`
  como secreto del Worker para que `/api/chat` funcione de punta a punta.
- **El agente no sabe de la finca todavía.** `waykao` no tiene identidad ni
  memoria de Agromyss cargada — hoy respondería como asistente genérico.
  Eso es trabajo aparte, deliberadamente no incluido aquí.
- **Propuestas** — desconectadas a propósito (ver arriba). La interfaz sigue
  mostrando muestras.
