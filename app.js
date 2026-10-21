const throttle = document.querySelector("#throttle");
const throttleValue = document.querySelector("#throttleValue");
const rpmValue = document.querySelector("#rpmValue");
const rpmTrack = document.querySelector("#rpmTrack");
const runButton = document.querySelector("#runButton");
const runLabel = document.querySelector("#runLabel");
const resetButton = document.querySelector("#resetButton");
const engineLed = document.querySelector("#engineLed");
const phaseName = document.querySelector("#phaseName");
const phaseDescription = document.querySelector("#phaseDescription");
const cycleSteps = [...document.querySelectorAll(".cycle-step")];
const cylinderDots = [...document.querySelectorAll(".cylinder-dots i")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const cycleScrub = document.querySelector("#cycleScrub");
const scrubValue = document.querySelector("#scrubValue");

const phases = [
  {
    name: "ADMISSION",
    title: "Le mélange entre.",
    description: "La soupape d’admission s’ouvre. Le piston descend et aspire l’air, mélangé au carburant, dans le cylindre.",
    short: "Le piston descend. Le mélange air-carburant entre dans le cylindre.",
    range: "0° — 180°",
    glyph: "↓",
    intake: "OUVERTE",
    exhaust: "FERMÉE",
  },
  {
    name: "COMPRESSION",
    title: "Le mélange se comprime.",
    description: "Les deux soupapes sont fermées. Le piston remonte et comprime le mélange avant l’allumage par la bougie.",
    short: "Les soupapes ferment. Le piston remonte et comprime le mélange.",
    range: "180° — 360°",
    glyph: "↑",
    intake: "FERMÉE",
    exhaust: "FERMÉE",
  },
  {
    name: "DÉTENTE",
    title: "La combustion pousse.",
    description: "La bougie enflamme le mélange comprimé. La pression pousse le piston vers le bas : c’est le temps moteur.",
    short: "La combustion pousse le piston. L’énergie entraîne la rotation.",
    range: "360° — 540°",
    glyph: "✳",
    intake: "FERMÉE",
    exhaust: "FERMÉE",
  },
  {
    name: "ÉCHAPPEMENT",
    title: "Les gaz s’échappent.",
    description: "La soupape d’échappement s’ouvre. Le piston remonte et expulse les gaz brûlés vers la ligne d’échappement.",
    short: "Le piston remonte. Les gaz brûlés quittent le cylindre.",
    range: "540° — 720°",
    glyph: "↑",
    intake: "FERMÉE",
    exhaust: "OUVERTE",
  },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatNumber = (value) => Math.round(value).toLocaleString("fr-FR");
let running = !reducedMotion.matches;
let phaseDegrees = 0;
let lastFrame = 0;
let lastUiUpdate = 0;

function getRpm() {
  return 850 + (Number(throttle.value) / 100) * 7450;
}

function updateThrottleDisplay() {
  const position = Number(throttle.value);
  throttleValue.textContent = position;
  const rpm = getRpm();
  rpmValue.textContent = formatNumber(rpm);
  rpmTrack.style.width = `${((rpm - 850) / 7450) * 100}%`;
  document.querySelector("#throttleExplanation").textContent = position < 10
    ? "Au ralenti, les papillons sont presque fermés. Un faible débit d’air suffit à entretenir la rotation."
    : position < 65
      ? "Les huit papillons s’ouvrent : davantage d’air entre. L’injection adapte le carburant ; les combustions entretiennent un régime plus élevé."
      : "Les papillons approchent de la pleine ouverture. Le débit d’air augmente et les cycles se succèdent plus vite. Le régime réel dépend aussi de la charge.";
  document.querySelectorAll(".throttle path").forEach((blade) => {
    blade.style.transform = `rotate(${position * 0.55}deg)`;
  });
}

function setPhase(index) {
  const phase = phases[index];
  phaseName.textContent = phase.name;
  phaseDescription.textContent = phase.short;
  document.querySelector("#cycleCounter").textContent = `ÉTAPE 0${index + 1} / 04`;
  document.querySelector("#cycleRange").textContent = phase.range;
  document.querySelector("#cycleGlyph").textContent = phase.glyph;
  document.querySelector("#cycleDetailTitle").textContent = phase.title;
  document.querySelector("#cycleDetailCopy").textContent = phase.description;
  document.querySelector("#intakeStatus").textContent = phase.intake;
  document.querySelector("#exhaustStatus").textContent = phase.exhaust;
  document.querySelector("#intakeValve").classList.toggle("is-open", phase.intake === "OUVERTE");
  document.querySelector("#exhaustValve").classList.toggle("is-open", phase.exhaust === "OUVERTE");
  cycleSteps.forEach((step, stepIndex) => {
    const active = stepIndex === index;
    step.classList.toggle("is-active", active);
    step.setAttribute("aria-selected", String(active));
  });
}

function setPaused(paused) {
  running = !paused;
  runButton.setAttribute("aria-pressed", String(running));
  runLabel.textContent = running ? "Mettre en pause" : "Relancer le moteur";
  runButton.querySelector(".pause-icon").textContent = running ? "Ⅱ" : "▶";
  engineLed.classList.toggle("is-off", paused);
  lastFrame = 0;
}

function updateMechanics() {
  const crankRadians = (phaseDegrees * Math.PI) / 180;
  const crankAngle = phaseDegrees % 360;
  const pinX = 420 + Math.sin(crankRadians) * 34;
  const pinY = 398 - Math.cos(crankRadians) * 34;
  const rodDx = pinX - 420;
  const pistonPinY = pinY - Math.sqrt(174 ** 2 - rodDx ** 2);
  const rodDy = pinY - pistonPinY;
  const rodLength = Math.hypot(rodDx, rodDy);
  const rodAngle = (Math.atan2(-rodDx, rodDy) * 180) / Math.PI;

  document.querySelector("#piston").setAttribute("transform", `translate(0 ${pistonPinY - 25})`);
  document.querySelector("#connectingRod").setAttribute("transform", `translate(420 ${pistonPinY}) rotate(${rodAngle}) scale(1 ${rodLength / 106}) translate(-420 -8)`);
  document.querySelector("#crankWheel").setAttribute("transform", `translate(0 398) rotate(${crankAngle} 420 0)`);
  document.querySelector("#crankPin").setAttribute("cx", pinX);
  document.querySelector("#crankPin").setAttribute("cy", pinY);
  document.querySelector("#crankAngle").textContent = `${String(Math.round(crankAngle)).padStart(3, "0")}°`;
  cycleScrub.value = String(Math.floor(phaseDegrees));
  scrubValue.textContent = `${Math.floor(phaseDegrees)}°`;

  const phaseIndex = Math.floor(phaseDegrees / 180) % phases.length;
  if (phaseIndex !== Number(document.querySelector(".cycle-step.is-active").dataset.phase)) {
    setPhase(phaseIndex);
  }
  const spark = document.querySelector("#sparkPlug");
  spark.classList.toggle("is-sparking", phaseIndex === 2 && phaseDegrees % 180 < 12);
  document.querySelector(".chamber-glow").style.opacity = phaseIndex === 2 ? ".65" : ".18";

  const activeCylinder = Math.floor((phaseDegrees / 720) * cylinderDots.length) % cylinderDots.length;
  cylinderDots.forEach((dot, index) => dot.classList.toggle("active", index === activeCylinder));
}

function animate(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const elapsed = Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;

  if (running && !reducedMotion.matches) {
    phaseDegrees = (phaseDegrees + getRpm() * 6 * elapsed * 0.02) % 720;
  }
  if (timestamp - lastUiUpdate > 40) {
    updateMechanics();
    lastUiUpdate = timestamp;
  }
  window.bmwEngineState = {
    degrees: phaseDegrees,
    throttle: Number(throttle.value) / 100,
    running,
    reducedMotion: reducedMotion.matches,
  };
  window.dispatchEvent(new CustomEvent("bmw:engine-state", { detail: window.bmwEngineState }));
  requestAnimationFrame(animate);
}

throttle.addEventListener("input", updateThrottleDisplay);
runButton.addEventListener("click", () => setPaused(running));
resetButton.addEventListener("click", () => {
  throttle.value = "0";
  phaseDegrees = 0;
  setPaused(reducedMotion.matches);
  updateThrottleDisplay();
  updateMechanics();
  window.dispatchEvent(new Event("bmw:reset"));
});
cycleScrub.addEventListener("input", () => {
  setPaused(true);
  phaseDegrees = Number(cycleScrub.value);
  setPhase(Math.floor(phaseDegrees / 180));
  updateMechanics();
});
cycleSteps.forEach((step) => {
  step.addEventListener("click", () => {
    const index = Number(step.dataset.phase);
    setPaused(true);
    phaseDegrees = index * 180;
    setPhase(index);
    updateMechanics();
  });
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) setPaused(true);
  lastFrame = 0;
  updateMechanics();
});

updateThrottleDisplay();
setPaused(!running);
setPhase(0);
updateMechanics();
requestAnimationFrame(animate);
