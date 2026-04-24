const STORAGE_KEY = "parkwise_state_v1";
const ADMIN_PASSWORD = "admin123";
const RATES = { Bike: 20, Car: 40, Truck: 60 };

const defaultSlots = [
  { id: "C-01", type: "Car", status: "Available" },
  { id: "C-02", type: "Car", status: "Available" },
  { id: "C-03", type: "Car", status: "Reserved" },
  { id: "C-04", type: "Car", status: "Available" },
  { id: "B-01", type: "Bike", status: "Available" },
  { id: "B-02", type: "Bike", status: "Occupied" },
  { id: "B-03", type: "Bike", status: "Available" },
  { id: "T-01", type: "Truck", status: "Available" },
  { id: "T-02", type: "Truck", status: "Reserved" }
];

let state = loadState();

const slotGrid = document.getElementById("slotGrid");
const slotTypeFilter = document.getElementById("slotTypeFilter");
const slotSelect = document.getElementById("slotSelect");
const bookingsBody = document.getElementById("bookingsBody");
const bookingForm = document.getElementById("bookingForm");
const formMessage = document.getElementById("formMessage");
const receiptModal = document.getElementById("receiptModal");
const receiptContent = document.getElementById("receiptContent");
const revenueText = document.getElementById("revenueText");
const adminRevenue = document.getElementById("adminRevenue");
const adminSessions = document.getElementById("adminSessions");
const removeSlotSelect = document.getElementById("removeSlotSelect");
const logList = document.getElementById("logList");

document.getElementById("findParkingBtn").addEventListener("click", handleFindParking);
slotTypeFilter.addEventListener("change", renderAll);
bookingForm.addEventListener("submit", createBooking);
document.getElementById("closeReceiptBtn").addEventListener("click", () => receiptModal.classList.add("hidden"));
document.getElementById("printReceiptBtn").addEventListener("click", () => window.print());
document.getElementById("unlockAdmin").addEventListener("click", unlockAdmin);
document.getElementById("addSlotBtn").addEventListener("click", addSlot);
document.getElementById("removeSlotBtn").addEventListener("click", removeSlot);

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return {
    slots: defaultSlots,
    bookings: [],
    completedSessions: [],
    revenue: 0,
    logs: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderStats();
  renderSlots();
  renderAvailableSlotOptions();
  renderBookings();
  renderBillingSummary();
  renderAdminOptions();
  renderLogs();
  drawOccupancyChart();
  saveState();
}

function renderStats() {
  const total = state.slots.length;
  const available = state.slots.filter((s) => s.status === "Available").length;
  const reserved = state.slots.filter((s) => s.status === "Reserved").length;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statAvailable").textContent = available;
  document.getElementById("statReserved").textContent = reserved;
}

function renderSlots() {
  const filterType = slotTypeFilter.value;
  const filtered = state.slots.filter((slot) => filterType === "All" || slot.type === filterType);
  slotGrid.innerHTML = "";

  filtered.forEach((slot) => {
    const div = document.createElement("div");
    div.className = `slot ${slot.status.toLowerCase()}`;
    div.innerHTML = `${slot.id}<small>${slot.type} - ${slot.status}</small>`;
    div.title = "Admin can click to change slot status";
    div.addEventListener("click", () => slotClickCycle(slot.id));
    slotGrid.appendChild(div);
  });
}

function slotClickCycle(slotId) {
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot) return;
  const cycle = ["Available", "Reserved", "Occupied"];
  const next = cycle[(cycle.indexOf(slot.status) + 1) % cycle.length];

  if (slot.status === "Occupied" && next !== "Occupied") {
    const activeBooking = state.bookings.find((b) => b.slotId === slot.id);
    if (activeBooking) {
      alert("Release booking from Active Bookings before changing this occupied slot.");
      return;
    }
  }
  slot.status = next;
  renderAll();
}

function renderAvailableSlotOptions() {
  const selectedType = document.getElementById("vehicleType").value;
  const availableSlots = state.slots.filter(
    (slot) => slot.status === "Available" && (!selectedType || slot.type === selectedType)
  );
  const current = slotSelect.value;
  slotSelect.innerHTML = `<option value="">Select Available Slot</option>`;
  availableSlots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot.id;
    option.textContent = `${slot.id} (${slot.type})`;
    slotSelect.appendChild(option);
  });
  if ([...slotSelect.options].some((o) => o.value === current)) slotSelect.value = current;
}

document.getElementById("vehicleType").addEventListener("change", renderAvailableSlotOptions);

function createBooking(event) {
  event.preventDefault();
  formMessage.textContent = "";
  formMessage.style.color = "#f25c5c";

  const ownerName = document.getElementById("ownerName").value.trim();
  const vehicleNo = document.getElementById("vehicleNo").value.trim().toUpperCase();
  const vehicleType = document.getElementById("vehicleType").value;
  const entryTime = document.getElementById("entryTime").value;
  const slotId = slotSelect.value;

  if (!ownerName || !vehicleNo || !vehicleType || !entryTime || !slotId) {
    formMessage.textContent = "Please fill all fields.";
    return;
  }
  if (state.bookings.some((b) => b.vehicleNo === vehicleNo)) {
    formMessage.textContent = "Duplicate vehicle number not allowed.";
    return;
  }
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot || slot.status !== "Available") {
    formMessage.textContent = "Selected slot is no longer available.";
    return;
  }
  if (slot.type !== vehicleType) {
    formMessage.textContent = "Vehicle type must match slot type.";
    return;
  }

  const booking = {
    id: crypto.randomUUID(),
    slotId,
    vehicleNo,
    ownerName,
    vehicleType,
    entryTime
  };
  state.bookings.push(booking);
  slot.status = "Occupied";
  state.logs.unshift(`[ENTRY] ${new Date().toLocaleString()} - ${vehicleNo} entered Slot ${slotId}`);
  bookingForm.reset();
  formMessage.style.color = "#35d07f";
  formMessage.textContent = "Booking created successfully.";
  renderAll();
}

function renderBookings() {
  bookingsBody.innerHTML = "";
  if (!state.bookings.length) {
    bookingsBody.innerHTML = `<tr><td colspan="6">No active bookings</td></tr>`;
    return;
  }
  state.bookings.forEach((booking) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${booking.slotId}</td>
      <td>${booking.vehicleNo}</td>
      <td>${booking.ownerName}</td>
      <td>${booking.vehicleType}</td>
      <td>${new Date(booking.entryTime).toLocaleString()}</td>
      <td><button class="btn btn-danger" data-booking-id="${booking.id}">Release Slot</button></td>
    `;
    tr.querySelector("button").addEventListener("click", () => releaseSlot(booking.id));
    bookingsBody.appendChild(tr);
  });
}

function releaseSlot(bookingId) {
  const index = state.bookings.findIndex((b) => b.id === bookingId);
  if (index === -1) return;
  const booking = state.bookings[index];
  const exit = new Date();
  const entry = new Date(booking.entryTime);
  const hours = Math.max(1, Math.ceil((exit - entry) / (1000 * 60 * 60)));
  const amount = hours * (RATES[booking.vehicleType] || 40);

  state.revenue += amount;
  state.completedSessions.push({
    ...booking,
    exitTime: exit.toISOString(),
    hours,
    amount
  });
  state.bookings.splice(index, 1);

  const slot = state.slots.find((s) => s.id === booking.slotId);
  if (slot) slot.status = "Available";

  state.logs.unshift(`[EXIT] ${exit.toLocaleString()} - ${booking.vehicleNo} exited Slot ${booking.slotId} (Rs ${amount})`);
  showReceipt(booking, exit, hours, amount);
  renderAll();
}

function showReceipt(booking, exitTime, hours, amount) {
  receiptContent.innerHTML = `
    <p><strong>Slot:</strong> ${booking.slotId}</p>
    <p><strong>Owner:</strong> ${booking.ownerName}</p>
    <p><strong>Vehicle:</strong> ${booking.vehicleNo} (${booking.vehicleType})</p>
    <p><strong>Entry:</strong> ${new Date(booking.entryTime).toLocaleString()}</p>
    <p><strong>Exit:</strong> ${exitTime.toLocaleString()}</p>
    <p><strong>Duration:</strong> ${hours} hour(s)</p>
    <p><strong>Total Fee:</strong> Rs ${amount.toFixed(2)}</p>
  `;
  receiptModal.classList.remove("hidden");
}

function renderBillingSummary() {
  const revenueStr = `Rs ${state.revenue.toFixed(2)}`;
  revenueText.textContent = revenueStr;
  adminRevenue.textContent = revenueStr;
  adminSessions.textContent = String(state.completedSessions.length);
}

function unlockAdmin() {
  const value = document.getElementById("adminPassword").value;
  if (value !== ADMIN_PASSWORD) {
    alert("Incorrect password.");
    return;
  }
  document.getElementById("adminLocked").classList.add("hidden");
  document.getElementById("adminContent").classList.remove("hidden");
}

function addSlot() {
  const id = document.getElementById("newSlotNo").value.trim().toUpperCase();
  const type = document.getElementById("newSlotType").value;
  if (!id) return alert("Slot number is required.");
  if (state.slots.some((s) => s.id === id)) return alert("Slot already exists.");
  state.slots.push({ id, type, status: "Available" });
  document.getElementById("newSlotNo").value = "";
  renderAll();
}

function removeSlot() {
  const slotId = removeSlotSelect.value;
  if (!slotId) return alert("Select a slot to remove.");
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot || slot.status !== "Available") return alert("Only empty available slots can be removed.");
  state.slots = state.slots.filter((s) => s.id !== slotId);
  renderAll();
}

function renderAdminOptions() {
  removeSlotSelect.innerHTML = `<option value="">Select empty slot to remove</option>`;
  state.slots
    .filter((slot) => slot.status === "Available" && !state.bookings.some((b) => b.slotId === slot.id))
    .forEach((slot) => {
      const option = document.createElement("option");
      option.value = slot.id;
      option.textContent = `${slot.id} (${slot.type})`;
      removeSlotSelect.appendChild(option);
    });
}

function renderLogs() {
  logList.innerHTML = "";
  if (!state.logs.length) {
    logList.innerHTML = `<div class="log-item">No logs yet.</div>`;
    return;
  }
  state.logs.slice(0, 25).forEach((line) => {
    const item = document.createElement("div");
    item.className = "log-item";
    item.textContent = line;
    logList.appendChild(item);
  });
}

function drawOccupancyChart() {
  const canvas = document.getElementById("occupancyChart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const types = ["Bike", "Car", "Truck"];
  const values = types.map((type) => {
    const total = state.slots.filter((s) => s.type === type).length;
    const occupied = state.slots.filter((s) => s.type === type && s.status === "Occupied").length;
    return total ? Math.round((occupied / total) * 100) : 0;
  });

  const chart = { x: 60, y: 20, w: 380, h: 220 };
  const barW = 70;
  const gap = 50;
  const colors = ["#35d07f", "#2b8eff", "#f1c24b"];

  ctx.strokeStyle = "#8ea7bd";
  ctx.beginPath();
  ctx.moveTo(chart.x, chart.y);
  ctx.lineTo(chart.x, chart.y + chart.h);
  ctx.lineTo(chart.x + chart.w, chart.y + chart.h);
  ctx.stroke();

  ctx.font = "13px Inter";
  ctx.fillStyle = "#a6bbcf";
  values.forEach((v, i) => {
    const x = chart.x + 32 + i * (barW + gap);
    const h = (chart.h - 30) * (v / 100);
    const y = chart.y + chart.h - h;
    ctx.fillStyle = colors[i];
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = "#e6eef7";
    ctx.fillText(`${v}%`, x + 16, y - 8);
    ctx.fillStyle = "#a6bbcf";
    ctx.fillText(types[i], x + 12, chart.y + chart.h + 18);
  });
}

function handleFindParking() {
  const value = document.getElementById("findParkingInput").value.trim().toLowerCase();
  if (!value) {
    slotTypeFilter.value = "All";
    renderSlots();
    return;
  }

  const maybeType = value.charAt(0).toUpperCase() + value.slice(1);
  if (["Car", "Bike", "Truck"].includes(maybeType)) {
    slotTypeFilter.value = maybeType;
    renderSlots();
    document.getElementById("dashboard").scrollIntoView({ behavior: "smooth" });
    return;
  }

  const slotCard = [...document.querySelectorAll(".slot")].find((el) => el.textContent.toLowerCase().includes(value));
  if (slotCard) {
    slotCard.scrollIntoView({ behavior: "smooth", block: "center" });
    slotCard.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], {
      duration: 500
    });
    return;
  }
  alert("No matching slot found.");
}

renderAll();
