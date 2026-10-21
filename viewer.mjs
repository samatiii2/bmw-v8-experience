const $ = (selector) => document.querySelector(selector);
const partButtons = [...document.querySelectorAll("[data-part]")];
const cameraButtons = [...document.querySelectorAll("[data-view]")];
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const parts = {
  intake: ["01 / ADMISSION", "Huit cylindres. Huit papillons.", "Chaque cylindre possède son papillon. L’accélérateur commande leur ouverture ; l’air admis augmente et l’injection adapte la quantité de carburant. Regardez les disques pivoter dans les conduits.", "8 PAPILLONS INDIVIDUELS", "top"],
  heads: ["02 / CULASSES", "Au-dessus, tout se décide.", "Les deux culasses ferment les chambres de combustion. Elles accueillent les conduits, les bougies et la distribution. Désactivez « Voir l’intérieur » pour retrouver leurs volumes, ou démontez pour les dégager.", "2 CULASSES · 4 CYLINDRES PAR BANC", "front"],
  valves: ["03 / DISTRIBUTION", "Une chorégraphie à mi-vitesse.", "Quatre arbres à cames commandent 32 soupapes : deux d’admission et deux d’échappement par cylindre. Les cames tournent deux fois moins vite que le vilebrequin. Le modèle illustre les quatre temps, sans reproduire le calage variable du double VANOS.", "4 ARBRES À CAMES · 32 SOUPAPES", "top"],
  pistons: ["04 / PISTONS", "La pression devient mouvement.", "Huit pistons coulissent dans les deux bancs à 90°. Leurs segments assurent l’étanchéité. L’éclair orange représente l’allumage : la combustion pousse le piston et produit le temps moteur.", "ALÉSAGE 92 MM · COURSE 82 MM", "front"],
  rods: ["05 / BIELLES", "Entre translation et rotation.", "Chaque bielle relie l’axe du piston à un maneton du vilebrequin. Elle oscille pendant que le piston coulisse : c’est cette liaison qui transforme la poussée en couple moteur.", "8 BIELLES · UN EFFORT TRANSMIS", "side"],
  crank: ["06 / VILEBREQUIN", "Le point de rencontre.", "Le S65 possède un vilebrequin en croix, et non à plan plat. Ses manetons sont répartis à 90° ; ses contrepoids équilibrent les masses en mouvement. Deux tours correspondent à un cycle complet de chaque cylindre.", "CROSS-PLANE · 720° PAR CYCLE", "crank"],
  exhaust: ["07 / ÉCHAPPEMENT", "Après le feu, les gaz.", "Pendant l’échappement, le piston remonte avec les soupapes de sortie ouvertes. Les collecteurs recueillent les gaz brûlés de chaque banc. Les particules illustrent leur trajet, pas une simulation de pression.", "2 BANCS · COLLECTEURS SIMPLIFIÉS", "side"],
  block: ["08 / BLOC MOTEUR", "L’architecture du V.", "Le bloc en alliage d’aluminium porte les huit cylindres et les paliers du vilebrequin. Il maintient l’alignement de la mécanique. La vue intérieure retire les surfaces qui cacheraient les pièces mobiles.", "V À 90° · 4 361 CM³", "front"],
  sump: ["09 / CARTER D’HUILE", "Sous la mécanique, la protection.", "Le carter inférieur recueille l’huile qui revient du moteur. Le circuit de lubrification alimente les paliers et réduit frottements et échauffement. Le volume est représenté ici ; le circuit d’huile n’est pas simulé.", "LUBRIFIER · REFROIDIR · PROTÉGER", "crank"],
  flywheel: ["10 / VOLANT MOTEUR", "La rotation continue.", "Solidaire du vilebrequin, le volant stocke de l’énergie cinétique et lisse les variations entre les combustions. C’est du côté de cette sortie moteur que le couple est transmis à l’embrayage puis à la boîte.", "SORTIE MOTEUR · INERTIE", "side"],
};
const tour = [
  { view: "hero", explode: 0, cutaway: false, part: null, copy: "01 / L’ensemble — deux bancs de quatre cylindres, ouverts à 90°. Faites le tour de l’architecture." },
  { view: "top", explode: .3, cutaway: true, part: "intake", copy: "02 / Respirer — les huit papillons dosent l’air. Essayez l’accélérateur pour les voir s’ouvrir." },
  { view: "front", explode: .55, cutaway: true, part: "valves", copy: "03 / Synchroniser — les culasses se dégagent. Les cames commandent les soupapes à la moitié de la vitesse du vilebrequin." },
  { view: "side", explode: .25, cutaway: true, part: "pistons", copy: "04 / Transformer — admission, compression, détente, échappement : huit pistons, un même cycle décalé." },
  { view: "crank", explode: .7, cutaway: true, part: "crank", copy: "05 / Transmettre — les bielles entraînent le vilebrequin en croix. Le mouvement alternatif devient rotation." },
  { view: "hero", explode: 1, cutaway: false, part: null, copy: "06 / Décomposer — les dix ensembles se séparent. Cliquez sur une pièce pour prendre la main." },
  { view: "hero", explode: 0, cutaway: true, part: null, copy: "07 / Réunir — tout reprend sa place. À vous de manipuler le moteur." },
];

let viewer;
let selectedPart = null;
let tourIndex = -1;
let tourElapsed = 0;
let lastTimestamp = 0;
let tourFrame = 0;
let available = false;
let observed = true;

function stopTour() {
  tourIndex = -1;
  cancelAnimationFrame(tourFrame);
  $("#tourPanel").hidden = true;
  $("#tourButton").textContent = "Visite guidée ↗";
  $("#tourButton").setAttribute("aria-pressed", "false");
}

function setView(name) {
  viewer.setView(name);
  cameraButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === name)));
}

function setExplode(value) {
  $("#explode").value = String(Math.round(value * 100));
  $("#explodeValue").textContent = `${Math.round(value * 100)} %`;
  viewer.setExplode(value);
}

function selectPart(id, moveCamera = true) {
  selectedPart = id;
  const part = parts[id];
  $("#isolatePart").disabled = !part;
  if (!part) $("#isolatePart").checked = false;
  viewer.setPart(id, $("#isolatePart").checked);
  partButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.part === id)));
  $("#partNumber").textContent = part?.[0] ?? "MODE EXPLORATION / S65B44";
  $("#partTitle").textContent = part?.[1] ?? "Chaque pièce a quelque chose à raconter.";
  $("#partCopy").textContent = part?.[2] ?? "Cliquez sur le moteur ou choisissez un ensemble. Isolez-le, tournez autour et découvrez comment il participe au cycle.";
  $("#partFact").textContent = part?.[3] ?? "8 CYLINDRES · 4 TEMPS · 2 TOURS";
  if (part && moveCamera) setView(part[4]);
}

function tourStep(index) {
  tourIndex = index;
  tourElapsed = 0;
  const step = tour[index];
  $("#cutaway").checked = step.cutaway;
  viewer.setCutaway(step.cutaway);
  $("#isolatePart").checked = false;
  selectPart(step.part, false);
  setExplode(step.explode);
  setView(step.view);
  $("#tourCopy").textContent = step.copy;
  $("#tourNext").textContent = index === tour.length - 1 ? "Terminer la visite" : "Étape suivante →";
}

function nextTourStep() {
  if (tourIndex >= tour.length - 1) stopTour();
  else tourStep(tourIndex + 1);
}

function tickTour(timestamp) {
  const elapsed = lastTimestamp ? Math.min(timestamp - lastTimestamp, 100) : 0;
  lastTimestamp = timestamp;
  if (!document.hidden && observed && !motion.matches && window.bmwEngineState?.running) tourElapsed += elapsed;
  if (tourElapsed > 7500) nextTourStep();
  if (tourIndex !== -1) tourFrame = requestAnimationFrame(tickTour);
}

function failViewer() {
  available = false;
  stopTour();
  viewer?.dispose();
  $("#modelStatus").hidden = false;
  $("#modelStatus").textContent = "La 3D n’est pas disponible sur ce navigateur. La coupe animée ci-dessous reste interactive.";
  $("#diagramFallback").open = true;
  ["cameraControls", "assemblyControls", "partControls", "inspectorControls"].forEach((id) => { $(`#${id}`).disabled = true; });
  $("#viewerHelp").textContent = "Retrouvez l’accélérateur, les quatre temps et les fiches des composants ci-dessous.";
}

async function initialize() {
  try {
    const { createEngineViewer } = await import("./engine3d.mjs");
    viewer = createEngineViewer({
      container: $("#engineCanvas"),
      onSelect(id) { stopTour(); selectPart(id, false); },
      onError: failViewer,
    });
    if (!viewer) throw new Error("3D renderer unavailable");
    available = true;
    if (window.bmwEngineState) viewer.update(window.bmwEngineState);
    $("#modelStatus").hidden = true;
    $("#diagramFallback").open = false;
    ["cameraControls", "assemblyControls", "partControls", "inspectorControls"].forEach((id) => { $(`#${id}`).disabled = false; });
  } catch {
    failViewer();
    return;
  }

  window.addEventListener("bmw:engine-state", ({ detail }) => {
    if (available) viewer.update(detail);
  });
  cameraButtons.forEach((button) => button.addEventListener("click", () => {
    stopTour();
    setView(button.dataset.view);
  }));
  $("#explode").addEventListener("input", (event) => {
    stopTour();
    setExplode(Number(event.target.value) / 100);
  });
  $("#assembleButton").addEventListener("click", () => { stopTour(); setExplode(0); });
  $("#explodeButton").addEventListener("click", () => { stopTour(); setExplode(1); });
  $("#cutaway").addEventListener("change", (event) => {
    stopTour();
    viewer.setCutaway(event.target.checked);
  });
  $("#autoRotate").addEventListener("change", (event) => {
    stopTour();
    viewer.setAutoRotate(event.target.checked);
  });
  partButtons.forEach((button) => button.addEventListener("click", () => {
    stopTour();
    selectPart(button.dataset.part);
  }));
  $("#isolatePart").addEventListener("change", () => {
    stopTour();
    viewer.setPart(selectedPart, $("#isolatePart").checked);
  });
  $("#showAll").addEventListener("click", () => { stopTour(); selectPart(null); });
  $("#engineCanvas").addEventListener("pointerdown", stopTour);
  $("#engineCanvas").addEventListener("wheel", stopTour, { passive: true });
  $("#engineCanvas").addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "="].includes(event.key)) stopTour();
  });
  $("#tourButton").addEventListener("click", () => {
    if (tourIndex !== -1) return stopTour();
    $("#autoRotate").checked = false;
    viewer.setAutoRotate(false);
    $("#tourPanel").hidden = false;
    $("#tourButton").textContent = "Arrêter la visite ×";
    $("#tourButton").setAttribute("aria-pressed", "true");
    tourStep(0);
    lastTimestamp = 0;
    tourFrame = requestAnimationFrame(tickTour);
  });
  $("#tourNext").addEventListener("click", nextTourStep);
  window.addEventListener("bmw:reset", () => {
    if (!available) return;
    stopTour();
    viewer.reset();
    $("#autoRotate").checked = false;
    $("#cutaway").checked = true;
    $("#isolatePart").checked = false;
    selectPart(null);
    setExplode(0);
    setView("hero");
  });
  motion.addEventListener("change", () => {
    if (motion.matches) {
      $("#autoRotate").checked = false;
      if (available) viewer.setAutoRotate(false);
    }
  });
  const observer = new IntersectionObserver(([entry]) => { observed = entry.isIntersecting; });
  observer.observe($("#engineCanvas"));
}

initialize();
