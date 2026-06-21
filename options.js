// Braintox Extension - Options Page Logic

const DEFAULT_API_URL = "https://braintox-be.onrender.com";

const apiUrlInput = document.getElementById("api-url");
const saveBtn = document.getElementById("save-btn");
const savedMsg = document.getElementById("saved-msg");
const signoutBtn = document.getElementById("signout-btn");
const statusValue = document.getElementById("status-value");

// Load current settings + auth status.
chrome.storage.sync.get(["apiUrl", "apiKey"], (data) => {
  apiUrlInput.value = data.apiUrl || DEFAULT_API_URL;
  statusValue.textContent = data.apiKey ? "Signed in" : "Not signed in";
});

// Save the API URL.
saveBtn.addEventListener("click", () => {
  const apiUrl = (apiUrlInput.value.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
  chrome.storage.sync.set({ apiUrl }, () => {
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 2000);
  });
});

// Sign out — clears the stored key so the popup asks to sign in again.
signoutBtn.addEventListener("click", () => {
  chrome.storage.sync.remove("apiKey", () => {
    statusValue.textContent = "Not signed in";
    savedMsg.textContent = "✓ Signed out";
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 2000);
  });
});
