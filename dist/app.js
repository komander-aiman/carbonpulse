const FACTOR = 0.740;
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const BASE_USAGE = [343, 329, 335, 317, 326];

const state = {
  kwh: Number(localStorage.getItem("carbonpulse-kwh")) || 300,
  completed: JSON.parse(localStorage.getItem("carbonpulse-actions") || '["temperature"]')
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const formatNumber = value => new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(value);

function navigate(view) {
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  $$(".view").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.title = `CarbonPulse · ${view.charAt(0).toUpperCase() + view.slice(1)}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("#sidebar").classList.remove("open");
  $("#menuButton").setAttribute("aria-expanded", "false");
}

function renderBarChart() {
  const values = [...BASE_USAGE, state.kwh];
  const max = Math.max(...values) * 1.08;
  $("#barChart").innerHTML = values.map((value, index) => `
    <div class="bar-column">
      <span class="bar-value">${value}</span>
      <span class="bar" style="height:${Math.max(12, (value / max) * 115)}px"></span>
      <span class="bar-label">${MONTHS[index]}</span>
    </div>`).join("");
}

function renderEnergy() {
  const emissions = state.kwh * FACTOR;
  $$('[data-kwh]').forEach(el => el.textContent = formatNumber(state.kwh));
  $$('[data-emissions]').forEach(el => el.textContent = emissions.toFixed(1));
  $$('[data-kwh-unit]').forEach(el => el.textContent = `${formatNumber(state.kwh)} kWh`);
  $$('[data-emissions-unit]').forEach(el => el.textContent = `${emissions.toFixed(1)} kg CO₂e`);
  $("#kwhInput").value = state.kwh;
  $("#emissionsBar").style.width = `${Math.min(100, emissions / 3)}%`;
  $("#goalBar").style.width = `${Math.min(100, 270 / state.kwh * 100)}%`;
  const gap = Math.max(0, state.kwh - 270);
  $("#goalGap").textContent = gap ? `${formatNumber(gap)} kWh` : "Goal reached";
  renderBarChart();
}

function renderActions() {
  $$(".plan-card").forEach(card => {
    const isDone = state.completed.includes(card.dataset.actionId);
    card.classList.toggle("completed", isDone);
    $(".action-check", card).textContent = isDone ? "✓" : "";
    $(".action-check", card).setAttribute("aria-label", `Mark ${card.dataset.actionId} action ${isDone ? "incomplete" : "complete"}`);
  });
  const done = state.completed.length;
  $("#actionDone").textContent = done;
  $("#actionCount").textContent = 3 - done;
  $("#planPercent").textContent = `${Math.round(done / 3 * 100)}%`;
  $$(".action-dots i").forEach((dot, index) => dot.classList.toggle("done", index < done));
  localStorage.setItem("carbonpulse-actions", JSON.stringify(state.completed));
}

function renderScenario() {
  const households = Number($("#householdSlider").value);
  const percent = Number($("#savingSlider").value);
  const perHome = 300 * (percent / 100);
  const savedKwh = households * perHome;
  const tonnes = savedKwh * FACTOR / 1000;
  $("#householdOutput").textContent = households;
  $("#savingOutput").textContent = `${percent}%`;
  $("#savedKwh").textContent = formatNumber(savedKwh);
  $("#savedCarbon").textContent = `${tonnes.toFixed(2)} t CO₂e`;
  $("#annualCarbon").textContent = `${(tonnes * 12).toFixed(2)} t CO₂e`;
  $("#scenarioHouseholds").textContent = `${households} households`;
  $("#scenarioPerHome").textContent = `${formatNumber(perHome)} kWh each`;
  const active = Math.round(percent / 25 * 50);
  $("#householdDots").innerHTML = Array.from({length:50}, (_, index) => `<i class="${index < active ? "active" : ""}"></i>`).join("");
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("input,button", modal)?.focus(), 50);
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showToast() {
  const toast = $("#toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3800);
}

$$(".nav-item").forEach(item => item.addEventListener("click", () => navigate(item.dataset.view)));
$$('[data-nav-to]').forEach(item => item.addEventListener("click", () => navigate(item.dataset.navTo)));

$("#menuButton").addEventListener("click", () => {
  const open = $("#sidebar").classList.toggle("open");
  $("#menuButton").setAttribute("aria-expanded", String(open));
});

$$('[data-open-bill]').forEach(button => button.addEventListener("click", () => openModal($("#billModal"))));
$$('[data-close-modal]').forEach(button => button.addEventListener("click", () => closeModal($("#billModal"))));
$("#privacyButton").addEventListener("click", () => openModal($("#privacyModal")));
$$('[data-close-privacy]').forEach(button => button.addEventListener("click", () => closeModal($("#privacyModal"))));

$("#billFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  $("#uploadTitle").textContent = file.name;
  $("#uploadHint").textContent = "Demo scan complete · suggested value ready for your confirmation";
});

$("#confirmBill").addEventListener("click", () => {
  const value = Number($("#kwhInput").value);
  if (!Number.isFinite(value) || value < 1 || value > 3000) {
    $("#formError").textContent = "Enter a valid value between 1 and 3,000 kWh.";
    return;
  }
  state.kwh = Math.round(value);
  localStorage.setItem("carbonpulse-kwh", state.kwh);
  $("#formError").textContent = "";
  renderEnergy();
  closeModal($("#billModal"));
  showToast();
});

$$(".action-check").forEach(button => button.addEventListener("click", () => {
  const id = button.closest(".plan-card").dataset.actionId;
  state.completed = state.completed.includes(id) ? state.completed.filter(item => item !== id) : [...state.completed, id];
  renderActions();
}));

$$(".tip-toggle").forEach(button => button.addEventListener("click", () => button.closest(".plan-card").classList.toggle("tip-open")));
["#householdSlider", "#savingSlider"].forEach(selector => $(selector).addEventListener("input", renderScenario));

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  $$(".modal.open").forEach(closeModal);
  $("#sidebar").classList.remove("open");
});

renderEnergy();
renderActions();
renderScenario();
