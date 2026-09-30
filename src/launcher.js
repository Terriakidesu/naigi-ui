const form = document.querySelector("#connect-form");
const input = document.querySelector("#server");
const button = document.querySelector("#connect");
const status = document.querySelector("#status");

window.naigi.savedServer().then((server) => { input.value = server; }).catch(() => {
  status.textContent = "Could not read your saved server address.";
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = "Connecting…";
  try {
    const result = await window.naigi.connect(input.value);
    status.textContent = result.ok ? "Connected." : result.error;
  } catch {
    status.textContent = "Could not connect. Please try again.";
  } finally { button.disabled = false; }
});
