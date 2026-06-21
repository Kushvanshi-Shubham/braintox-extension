// Braintox Chrome Extension - Popup Logic

(async function () {
  // Default backend; overridable via the Settings (options) page.
  const DEFAULT_API_URL = "https://braintox-be.onrender.com";

  const states = {
    login: document.getElementById("login"),
    main: document.getElementById("main-content"),
    success: document.getElementById("success-state"),
    error: document.getElementById("error-state"),
  };

  const els = {
    title: document.getElementById("title"),
    url: document.getElementById("url"),
    tagsContainer: document.getElementById("tags-container"),
    notes: document.getElementById("notes"),
    saveBtn: document.getElementById("save-btn"),
    settingsBtn: document.getElementById("settings-btn"),
    retryBtn: document.getElementById("retry-btn"),
    errorMessage: document.getElementById("error-message"),
    loginEmail: document.getElementById("login-email"),
    loginPassword: document.getElementById("login-password"),
    loginBtn: document.getElementById("login-btn"),
    loginError: document.getElementById("login-error"),
  };

  let apiUrl = DEFAULT_API_URL;
  let apiKey = null;
  let tab = null;
  let selectedTags = [];
  let allSuggestedTags = [];

  function showState(name) {
    Object.values(states).forEach((s) => s.classList.add("hidden"));
    states[name].classList.remove("hidden");
  }

  els.settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

  // Load stored settings.
  const stored = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
  apiUrl = (stored.apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
  apiKey = stored.apiKey || null;

  if (!apiKey) {
    showLogin();
  } else {
    startSaveFlow();
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  function showLogin() {
    showState("login");
    els.loginBtn.addEventListener("click", handleLogin);
    els.loginPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });
  }

  async function handleLogin() {
    const usernameOrEmail = els.loginEmail.value.trim();
    const password = els.loginPassword.value;
    if (!usernameOrEmail || !password) {
      showLoginError("Enter your email/username and password.");
      return;
    }

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = "Signing in...";
    els.loginError.classList.add("hidden");

    try {
      // 1) Log in to get a short-lived JWT.
      const loginRes = await fetch(`${apiUrl}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok || !loginData.token) {
        throw new Error(loginData.message || "Invalid credentials");
      }

      // 2) Exchange it for a long-lived API key (no daily expiry).
      const keyRes = await fetch(`${apiUrl}/api/v1/settings/api-keys/extension`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginData.token}`,
        },
      });
      const keyData = await keyRes.json().catch(() => ({}));
      if (!keyRes.ok || !keyData.key) {
        throw new Error(keyData.message || "Could not set up the extension key");
      }

      apiKey = keyData.key;
      await chrome.storage.sync.set({ apiUrl, apiKey });
      startSaveFlow();
    } catch (err) {
      showLoginError(err.message || "Sign in failed. Please try again.");
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = "Sign in";
    }
  }

  function showLoginError(msg) {
    els.loginError.textContent = msg;
    els.loginError.classList.remove("hidden");
  }

  // ── Save flow ────────────────────────────────────────────────────────────────
  async function startSaveFlow() {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showState("error");
      els.errorMessage.textContent = "Cannot access this page.";
      return;
    }

    els.title.value = tab.title || "";
    els.url.value = tab.url;
    showState("main");

    fetchSuggestions();
    els.saveBtn.addEventListener("click", saveContent);
    els.retryBtn.addEventListener("click", () => {
      showState("main");
      els.saveBtn.disabled = false;
    });
  }

  async function fetchSuggestions() {
    try {
      const response = await fetch(`${apiUrl}/api/v1/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ url: tab.url, title: tab.title || "", description: "" }),
      });

      if (response.status === 401) return handleAuthExpired();

      if (response.ok) {
        const data = await response.json();
        allSuggestedTags = data.tags || [];
        selectedTags = [...allSuggestedTags];
        if (data.suggestedTitle && data.ai) els.title.value = data.suggestedTitle;
        renderTags();
      } else {
        setTagsMessage("Could not get suggestions");
      }
    } catch {
      setTagsMessage("AI suggestions unavailable");
    }
  }

  // Render a single status message safely (no innerHTML).
  function setTagsMessage(text) {
    const span = document.createElement("span");
    span.className = "tags-loading";
    span.textContent = text;
    els.tagsContainer.replaceChildren(span);
  }

  function renderTags() {
    els.tagsContainer.replaceChildren();
    if (allSuggestedTags.length === 0) {
      setTagsMessage("No tags suggested");
      return;
    }
    allSuggestedTags.forEach((tag) => {
      const el = document.createElement("span");
      el.className = `tag ${selectedTags.includes(tag) ? "selected" : ""}`;
      el.textContent = tag;
      el.addEventListener("click", () => {
        selectedTags = selectedTags.includes(tag)
          ? selectedTags.filter((t) => t !== tag)
          : [...selectedTags, tag];
        renderTags();
      });
      els.tagsContainer.appendChild(el);
    });
  }

  function detectType(url) {
    const map = {
      "youtube.com": "youtube", "youtu.be": "youtube", "twitter.com": "twitter",
      "x.com": "twitter", "instagram.com": "instagram", "tiktok.com": "tiktok",
      "linkedin.com": "linkedin", "reddit.com": "reddit", "medium.com": "medium",
      "github.com": "github", "codepen.io": "codepen", "spotify.com": "spotify",
      "soundcloud.com": "soundcloud", "vimeo.com": "vimeo", "twitch.tv": "twitch",
      "facebook.com": "facebook", "pinterest.com": "pinterest",
    };
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      for (const [domain, type] of Object.entries(map)) {
        if (hostname.includes(domain)) return type;
      }
    } catch {}
    return "article";
  }

  async function saveContent() {
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "Saving...";
    try {
      const response = await fetch(`${apiUrl}/api/v1/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          title: els.title.value.trim() || tab.title || "Saved Link",
          link: tab.url,
          type: detectType(tab.url),
          tags: selectedTags,
          notes: els.notes.value.trim(),
        }),
      });

      if (response.status === 401) return handleAuthExpired();

      if (response.ok) {
        showState("success");
        setTimeout(() => window.close(), 1500);
      } else {
        const data = await response.json().catch(() => ({}));
        // 402 = Free-plan quota reached.
        throw new Error(data.message || "Failed to save");
      }
    } catch (err) {
      showState("error");
      els.errorMessage.textContent = err.message || "Failed to save. Please try again.";
    }
  }

  // If the stored key was revoked, clear it and send the user back to login.
  async function handleAuthExpired() {
    apiKey = null;
    await chrome.storage.sync.remove("apiKey");
    showState("login");
    showLoginError("Your session ended. Please sign in again.");
    if (!els.loginBtn.dataset.bound) {
      els.loginBtn.addEventListener("click", handleLogin);
      els.loginBtn.dataset.bound = "1";
    }
  }
})();
