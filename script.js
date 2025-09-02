document.addEventListener("DOMContentLoaded", () => {
  const quoteEl = document.getElementById("quote");
  const btn = document.getElementById("new-quote");
  const copyBtn = document.getElementById("copy-quote");
  const tweetLink = document.getElementById("tweet-quote");
  const saveFavBtn = document.getElementById("save-fav");
  const openFavBtn = document.getElementById("open-fav");
  const favModal = document.getElementById("favorites-modal");
  const closeFavBtn = document.getElementById("close-fav");
  const clearFavBtn = document.getElementById("clear-fav");
  const favsList = document.getElementById("favorites-list");
  const themeToggle = document.getElementById("theme-toggle");
  const authorFilter = document.getElementById("author-filter");

  quoteEl.classList.add("fade", "show");

  let loading = false;
  let lastQuote = ""; // prevent immediate repeats
  let currentQuoteText = ""; // exposed quote text for copy/tweet
  let favs = []; // favorites array
  let modalOpenerElement = null; // track which element opened modal for focus return
  // === Author filter state ===
  let preferredAuthor = "";
  const authorInput = document.getElementById('author-filter');
  if (authorInput) {
    authorInput.addEventListener('input', () => {
      preferredAuthor = authorInput.value.trim();
      // console.debug('[filter] preferredAuthor =', preferredAuthor);
    });
  }

  // small helpers
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const ciIncludes = (a = "", b = "") => a.toLowerCase().includes(b.toLowerCase());

  // Load favorites from localStorage
  function loadFavs() {
    try {
      const stored = localStorage.getItem("quoteFavs");
      favs = stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.warn("Failed to load favorites:", err);
      favs = [];
    }
  }

  // Save favorites to localStorage
  function saveFavs() {
    try {
      localStorage.setItem("quoteFavs", JSON.stringify(favs));
    } catch (err) {
      console.warn("Failed to save favorites:", err);
    }
  }

  // === Robust fetch with optional author filter ===
  // Tries up to N times when a filter is set. Each attempt has its own 5s timeout.
  async function fetchQuote(authorFilter = "") {
    // console.log(`[fetchQuote] called with authorFilter: "${authorFilter}"`);
    const wantsFilter = !!authorFilter.trim();
    const attempts = wantsFilter ? 12 : 1;
    let last = null;
    // console.log(`[fetchQuote] wantsFilter: ${wantsFilter}, will try ${attempts} attempts`);

    for (let i = 0; i < attempts; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch("https://dummyjson.com/quotes/random", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json(); // { id, quote, author }
        if (!data || !data.quote) throw new Error("Bad response shape");

        const text = `${data.quote} – ${data.author || "Unknown"}`;
        if (!wantsFilter) return text;

        const gotAuthor = (data.author || "").trim();
        const searchTerm = authorFilter.trim().toLowerCase();
        const authorLower = gotAuthor.toLowerCase();
        
        // console.log(`[attempt ${i + 1}] got author: "${gotAuthor}", looking for: "${authorFilter}"`);
        
        if (gotAuthor && (authorLower.includes(searchTerm) || authorLower === searchTerm)) {
          // console.log(`[MATCH FOUND] "${gotAuthor}" matches "${authorFilter}"`);
          return text;
        }

        // console.debug(`[no match] attempt ${i + 1}: ${gotAuthor}`);
        last = text;                // remember something useful to show if we never match
        await sleep(120);           // brief pause before next try
      } catch (err) {
        // console.warn(`[attempt ${i + 1}]`, err);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // no match found — return the last fetched quote so user still gets something
    return last || "Could not load quote. Try again.";
  }

  async function showRandomQuote() {
    if (loading) return;
    loading = true;

    // disable button and input during fetch to prevent spamming/changes
    const originalBtnText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Loading…";
    authorFilter.disabled = true;

    // indicate loading state for screen readers
    quoteEl.setAttribute('aria-busy', 'true');

    // start fade-out
    quoteEl.classList.remove("show");

    const onFadeOut = async (e) => {
      if (e.propertyName !== "opacity") return;
      quoteEl.removeEventListener("transitionend", onFadeOut);

      // loading message while we fetch
      quoteEl.textContent = "Fetching quote...";

      let next = await fetchQuote(preferredAuthor);

      // simple no-immediate-repeat protection
      if (next === lastQuote) {
        // try once more; if it still matches, just use it
        const retry = await fetchQuote();
        if (retry !== lastQuote) next = retry;
      }
      lastQuote = next;
      currentQuoteText = next.trim();

      quoteEl.textContent = next;
      
      // Enable copy, tweet, and save buttons now that we have a quote
      copyBtn.disabled = false;
      tweetLink.style.pointerEvents = "auto";
      tweetLink.style.opacity = "1";
      saveFavBtn.disabled = false;
      openFavBtn.disabled = false;
      
      // Update tweet link href
      tweetLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(currentQuoteText)}`;

      // fade back in
      requestAnimationFrame(() => quoteEl.classList.add("show"));

      // re-enable button after fade-in completes
      const onFadeIn = (ev) => {
        if (ev.propertyName !== "opacity") return;
        quoteEl.removeEventListener("transitionend", onFadeIn);
        btn.disabled = false;
        btn.textContent = originalBtnText;
        authorFilter.disabled = false;
        loading = false;
        
        // remove loading state for screen readers
        quoteEl.removeAttribute('aria-busy');
      };
      quoteEl.addEventListener("transitionend", onFadeIn);
    };

    quoteEl.addEventListener("transitionend", onFadeOut);
  }

  // Initially disable actions until first quote loads
  copyBtn.disabled = true;
  tweetLink.style.pointerEvents = "none";
  tweetLink.style.opacity = "0.5";
  saveFavBtn.disabled = true;
  openFavBtn.disabled = true;

  // Theme management
  function loadTheme() {
    try {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", savedTheme);
        return savedTheme;
      }
    } catch (err) {
      console.warn("Failed to load theme:", err);
    }
    
    // Detect system preference if no saved theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemTheme = prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", systemTheme);
    return systemTheme;
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch (err) {
      console.warn("Failed to save theme:", err);
    }
  }

  function updateThemeToggle(currentTheme) {
    if (currentTheme === "dark") {
      themeToggle.textContent = "☀️ Light";
      themeToggle.setAttribute("aria-pressed", "true");
    } else {
      themeToggle.textContent = "🌙 Dark";
      themeToggle.setAttribute("aria-pressed", "false");
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    saveTheme(newTheme);
    updateThemeToggle(newTheme);
  }

  // Initialize theme on startup
  const initialTheme = loadTheme();
  updateThemeToggle(initialTheme);

  // Theme toggle click handler
  themeToggle.addEventListener("click", toggleTheme);

  // Load favorites on startup
  loadFavs();

  // Copy quote functionality
  copyBtn.addEventListener("click", async () => {
    if (!currentQuoteText) return;
    
    try {
      await navigator.clipboard.writeText(currentQuoteText);
      console.log("Quote copied to clipboard");
    } catch (err) {
      console.warn("Failed to copy quote to clipboard:", err);
    }
  });

  // Save favorite functionality
  saveFavBtn.addEventListener("click", () => {
    if (!currentQuoteText) return;
    if (favs.includes(currentQuoteText)) return; // already saved
    
    favs.push(currentQuoteText);
    saveFavs();
    
    // Visual confirmation
    const originalText = saveFavBtn.textContent;
    saveFavBtn.textContent = "Saved!";
    saveFavBtn.disabled = true;
    
    setTimeout(() => {
      saveFavBtn.textContent = originalText;
      saveFavBtn.disabled = false;
    }, 1500);
  });

  // Render favorites list
  function renderFavorites() {
    favsList.innerHTML = "";
    
    if (favs.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No favorites yet.";
      li.style.fontStyle = "italic";
      favsList.appendChild(li);
      return;
    }
    
    favs.forEach((quote, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${quote}</span>
        <button class="remove-fav" data-index="${index}" aria-label="Remove favorite">✕</button>
      `;
      favsList.appendChild(li);
    });
    
    // Add event listeners for remove buttons
    favsList.querySelectorAll(".remove-fav").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        favs.splice(index, 1);
        saveFavs();
        renderFavorites();
      });
    });
  }

  // Modal functionality
  openFavBtn.addEventListener("click", () => {
    modalOpenerElement = openFavBtn;
    favModal.classList.remove("hidden");
    favModal.classList.add("is-open");
    document.body.classList.add("modal-open");
    document.querySelector(".container").setAttribute("aria-hidden", "true");
    renderFavorites();
    closeFavBtn.focus();
  });

  closeFavBtn.addEventListener("click", () => {
    favModal.classList.add("hidden");
    favModal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    document.querySelector(".container").removeAttribute("aria-hidden");
    if (modalOpenerElement) {
      modalOpenerElement.focus();
      modalOpenerElement = null;
    }
  });

  clearFavBtn.addEventListener("click", () => {
    if (favs.length === 0) return;
    if (window.confirm("Are you sure you want to clear all favorites?")) {
      favs = [];
      saveFavs();
      renderFavorites();
    }
  });

  btn.addEventListener("click", showRandomQuote);

  // keyboard: Space or Enter triggers a new quote, ESC closes modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !favModal.classList.contains("hidden")) {
      e.preventDefault();
      favModal.classList.add("hidden");
      favModal.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      document.querySelector(".container").removeAttribute("aria-hidden");
      if (modalOpenerElement) {
        modalOpenerElement.focus();
        modalOpenerElement = null;
      }
      return;
    }
    
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      showRandomQuote();
    }
  });

  // initial load
  showRandomQuote();
});
