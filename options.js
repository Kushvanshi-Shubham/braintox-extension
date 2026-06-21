// Braintox Extension - Options Page Logic

const apiUrlInput = document.getElementById("api-url");
const authTokenInput = document.getElementById("auth-token");
const saveBtn = document.getElementById("save-btn");
const savedMsg = document.getElementById("saved-msg");

// Load saved settings
chrome.storage.sync.get(["apiUrl", "authToken"], (data) => {
  if (data.apiUrl) apiUrlInput.value = data.apiUrl;
  if (data.authToken) authTokenInput.value = data.authToken;
});

// Save settings
saveBtn.addEventListener("click", () => {
  const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, ""); // Remove trailing slashes
  const authToken = authTokenInput.value.trim();

  if (!apiUrl) {
    alert("Please enter the API URL.");
    return;
  }

  if (!authToken) {
    alert("Please enter your auth token.");
    return;
  }

  chrome.storage.sync.set({ apiUrl, authToken }, () => {
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 2000);
  });
});
