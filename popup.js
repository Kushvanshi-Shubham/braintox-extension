// Braintox Chrome Extension - Popup Logic

(async function () {
  const states = {
    notConfigured: document.getElementById("not-configured"),
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
    openSettings: document.getElementById("open-settings"),
    retryBtn: document.getElementById("retry-btn"),
    errorMessage: document.getElementById("error-message"),
  };

  let selectedTags = [];
  let allSuggestedTags = [];

  function showState(stateName) {
    Object.values(states).forEach((s) => s.classList.add("hidden"));
    states[stateName].classList.remove("hidden");
  }

  // Load settings
  const { apiUrl, authToken } = await chrome.storage.sync.get([
    "apiUrl",
    "authToken",
  ]);

  if (!apiUrl || !authToken) {
    showState("notConfigured");
    els.openSettings.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
    els.settingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
    return;
  }

  els.settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    showState("error");
    els.errorMessage.textContent = "Cannot access this page.";
    return;
  }

  els.title.value = tab.title || "";
  els.url.value = tab.url;
  showState("main");

  // Fetch AI suggestions
  try {
    const response = await fetch(`${apiUrl}/api/v1/ai/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title || "",
        description: "",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      allSuggestedTags = data.tags || [];
      selectedTags = [...allSuggestedTags];

      if (data.suggestedTitle && data.ai) {
        els.title.value = data.suggestedTitle;
      }

      renderTags();
    } else {
      els.tagsContainer.innerHTML =
        '<span class="tags-loading">Could not get suggestions</span>';
    }
  } catch (err) {
    els.tagsContainer.innerHTML =
      '<span class="tags-loading">AI suggestions unavailable</span>';
  }

  function renderTags() {
    els.tagsContainer.innerHTML = "";
    if (allSuggestedTags.length === 0) {
      els.tagsContainer.innerHTML =
        '<span class="tags-loading">No tags suggested</span>';
      return;
    }

    allSuggestedTags.forEach((tag) => {
      const el = document.createElement("span");
      el.className = `tag ${selectedTags.includes(tag) ? "selected" : ""}`;
      el.textContent = tag;
      el.addEventListener("click", () => {
        if (selectedTags.includes(tag)) {
          selectedTags = selectedTags.filter((t) => t !== tag);
        } else {
          selectedTags.push(tag);
        }
        renderTags();
      });
      els.tagsContainer.appendChild(el);
    });
  }

  // Detect content type from URL
  function detectType(url) {
    const map = {
      "youtube.com": "youtube",
      "youtu.be": "youtube",
      "twitter.com": "twitter",
      "x.com": "twitter",
      "instagram.com": "instagram",
      "tiktok.com": "tiktok",
      "linkedin.com": "linkedin",
      "reddit.com": "reddit",
      "medium.com": "medium",
      "github.com": "github",
      "codepen.io": "codepen",
      "spotify.com": "spotify",
      "soundcloud.com": "soundcloud",
      "vimeo.com": "vimeo",
      "twitch.tv": "twitch",
      "facebook.com": "facebook",
      "pinterest.com": "pinterest",
    };

    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      for (const [domain, type] of Object.entries(map)) {
        if (hostname.includes(domain)) return type;
      }
    } catch {}
    return "article";
  }

  // Save to Braintox
  els.saveBtn.addEventListener("click", async () => {
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "Saving...";

    try {
      // First, create tags on the server and get their IDs
      const tagIds = [];
      for (const tagName of selectedTags) {
        try {
          // The content route handles tag creation internally
          // We'll pass tag names and let the backend resolve them
        } catch {}
      }

      const response = await fetch(`${apiUrl}/api/v1/content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: els.title.value.trim() || tab.title || "Saved Link",
          link: tab.url,
          type: detectType(tab.url),
          tags: selectedTags,
          notes: els.notes.value.trim(),
        }),
      });

      if (response.ok) {
        showState("success");
        // Auto-close after 1.5s
        setTimeout(() => window.close(), 1500);
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save");
      }
    } catch (err) {
      showState("error");
      els.errorMessage.textContent = err.message || "Failed to save. Please try again.";
    }
  });

  els.retryBtn.addEventListener("click", () => {
    showState("main");
    els.saveBtn.disabled = false;
    els.saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
      Save to Braintox
    `;
  });
})();
