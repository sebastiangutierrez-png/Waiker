// Nav inferior en teléfonos (botón "Más") y panel LIA como cajón en
// pantallas de menos de 1024px. Lo usan index.html y agente.html.
const csb = document.querySelector(".csb");
const mas = document.querySelector(".csb-mas");
const lia = document.getElementById("liaPanel");
const abrirLia = document.querySelector(".lia-abrir");

// En la barra inferior sólo caben los primeros 4 ítems; si la página activa
// está entre los demás, "Más" lleva el estado activo.
function marcarMas() {
  mas?.classList.toggle("active", !!csb.querySelector(".csb-nav > :nth-child(n+5).active"));
}

function cerrarNav() {
  if (!csb.classList.contains("nav-abierta")) return;
  csb.classList.remove("nav-abierta");
  mas.setAttribute("aria-expanded", "false");
  mas.querySelector("span").textContent = "Más";
}

function cerrarLia(devolverFoco = true) {
  if (!lia?.classList.contains("abierta")) return;
  lia.classList.remove("abierta");
  abrirLia.setAttribute("aria-expanded", "false");
  if (devolverFoco) abrirLia.focus();
}

mas?.addEventListener("click", () => {
  const abierta = csb.classList.toggle("nav-abierta");
  mas.setAttribute("aria-expanded", String(abierta));
  mas.querySelector("span").textContent = abierta ? "Cerrar" : "Más";
});

csb.querySelector(".csb-nav").addEventListener("click", (e) => {
  if (!e.target.closest("button, a")) return;
  cerrarNav();
  setTimeout(marcarMas);
});

abrirLia?.addEventListener("click", () => {
  lia.classList.add("abierta");
  abrirLia.setAttribute("aria-expanded", "true");
  document.getElementById("chatInput")?.focus();
});
lia?.querySelector(".lia-cerrar").addEventListener("click", () => cerrarLia());
// Las sugerencias y el enlace llevan a otra vista: el cajón no debe taparla.
lia?.addEventListener("click", (e) => {
  if (e.target.closest(".csb-sug, .csb-lia-full")) cerrarLia(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  cerrarNav();
  cerrarLia();
});
document.addEventListener("click", (e) => {
  if (!csb.contains(e.target)) cerrarNav();
  if (lia && !lia.contains(e.target) && !abrirLia.contains(e.target)) cerrarLia(false);
});

// En el riel de sólo íconos (1024–1180px) el nombre queda como tooltip.
csb.querySelectorAll(".csb-nav button, .csb-nav a").forEach((el) => {
  el.title ||= el.textContent.trim();
});
requestAnimationFrame(marcarMas);
