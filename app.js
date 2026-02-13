(function () {
  "use strict";

  const CATALOG_URL = "https://fonts.google.com/metadata/fonts";
  const LARGE_CATALOGUE_MIRRORS = [
    "https://cdn.jsdelivr.net/npm/google-fonts-complete@2.2.3/api-response.json",
    "https://unpkg.com/google-fonts-complete@2.2.3/api-response.json",
  ];

  const CACHE_KEY = "typepair.catalogue.v2";
  const STATE_KEY = "typepair.state.v1";
  const FAV_KEY = "typepair.favourites.v1";
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  const DEFAULT_STATE = {
    heading: "Inter",
    body: "Source Serif 4",
    headingWeight: 700,
    bodyWeight: 400,
    baseSize: 16,
    lineHeight: 1.55,
    paragraphWidth: 66,
    headingSpacing: 0,
    paragraphSpacing: 0,
    dark: false,
    allowSame: false,
  };

  const EMBEDDED_FALLBACK_FONTS = [
    { family: "Inter", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Roboto", category: "sans-serif", weights: [100, 300, 400, 500, 700, 900] },
    { family: "Open Sans", category: "sans-serif", weights: [300, 400, 500, 600, 700, 800] },
    { family: "Lato", category: "sans-serif", weights: [100, 300, 400, 700, 900] },
    { family: "Montserrat", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Poppins", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Source Sans 3", category: "sans-serif", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Nunito Sans", category: "sans-serif", weights: [200, 300, 400, 600, 700, 800, 900] },
    { family: "Work Sans", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Manrope", category: "sans-serif", weights: [200, 300, 400, 500, 600, 700, 800] },
    { family: "Merriweather", category: "serif", weights: [300, 400, 700, 900] },
    { family: "Lora", category: "serif", weights: [400, 500, 600, 700] },
    { family: "Source Serif 4", category: "serif", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800, 900] },
    { family: "Bitter", category: "serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Cormorant Garamond", category: "serif", weights: [300, 400, 500, 600, 700] },
    { family: "EB Garamond", category: "serif", weights: [400, 500, 600, 700, 800] },
    { family: "Libre Baskerville", category: "serif", weights: [400, 700] },
    { family: "PT Serif", category: "serif", weights: [400, 700] },
    { family: "Noto Serif", category: "serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "Fira Code", category: "monospace", weights: [300, 400, 500, 600, 700] },
    { family: "Source Code Pro", category: "monospace", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "JetBrains Mono", category: "monospace", weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { family: "IBM Plex Mono", category: "monospace", weights: [100, 200, 300, 400, 500, 600, 700] },
    { family: "Inconsolata", category: "monospace", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
    { family: "DM Serif Display", category: "display", weights: [400] },
    { family: "Oswald", category: "display", weights: [200, 300, 400, 500, 600, 700] },
    { family: "Bebas Neue", category: "display", weights: [400] },
    { family: "Pacifico", category: "handwriting", weights: [400] },
    { family: "Caveat", category: "handwriting", weights: [400, 500, 600, 700] },
  ];

  const QUALITY = {
    EMBEDDED: 1,
    LOCAL_FILE: 1,
    MIRROR: 2,
    GOOGLE: 3,
  };

  const App = {
    els: {},
    state: { ...DEFAULT_STATE },
    fonts: [],
    fontsByFamily: new Map(),
    favourites: [],
    headingPicker: null,
    bodyPicker: null,
    catalogueQuality: 0,
    persistDebounced: null,
    toastTimer: 0,

    init() {
      this.cacheElements();
      this.bindControls();
      this.setReadyState(false);
      this.persistDebounced = debounce(() => {
        this.saveStateToStorage();
        this.pushStateToUrl();
      }, 150);

      this.favourites = this.loadFavourites();
      this.renderFavourites();

      this.state = this.resolveInitialState();
      this.applyStateToControls();
      this.applyDarkMode();
      this.setupPickers();
      this.applyPreviewStyles();
      this.loadCatalogue();
    },

    cacheElements() {
      this.els.statusText = document.getElementById("statusText");
      this.els.catalogueMeta = document.getElementById("catalogueMeta");
      this.els.pairHeadingName = document.getElementById("pairHeadingName");
      this.els.pairBodyName = document.getElementById("pairBodyName");
      this.els.previewArea = document.getElementById("previewArea");
      this.els.previewTop = document.querySelector(".preview-top");
      this.els.previewSurface = document.getElementById("previewSurface");

      this.els.headingPickerRoot = document.getElementById("headingPicker");
      this.els.bodyPickerRoot = document.getElementById("bodyPicker");
      this.els.headingWeight = document.getElementById("headingWeight");
      this.els.bodyWeight = document.getElementById("bodyWeight");
      this.els.baseSize = document.getElementById("baseSize");
      this.els.baseSizeInput = document.getElementById("baseSizeInput");
      this.els.baseSizeValue = document.getElementById("baseSizeValue");
      this.els.lineHeight = document.getElementById("lineHeight");
      this.els.lineHeightInput = document.getElementById("lineHeightInput");
      this.els.lineHeightValue = document.getElementById("lineHeightValue");
      this.els.paragraphWidth = document.getElementById("paragraphWidth");
      this.els.paragraphWidthInput = document.getElementById("paragraphWidthInput");
      this.els.paragraphWidthValue = document.getElementById("paragraphWidthValue");
      this.els.headingSpacing = document.getElementById("headingSpacing");
      this.els.headingSpacingInput = document.getElementById("headingSpacingInput");
      this.els.headingSpacingValue = document.getElementById("headingSpacingValue");
      this.els.paragraphSpacing = document.getElementById("paragraphSpacing");
      this.els.paragraphSpacingInput = document.getElementById("paragraphSpacingInput");
      this.els.paragraphSpacingValue = document.getElementById("paragraphSpacingValue");
      this.els.darkMode = document.getElementById("darkMode");
      this.els.allowSame = document.getElementById("allowSame");

      this.els.randomPairBtn = document.getElementById("randomPairBtn");
      this.els.saveFavouriteBtn = document.getElementById("saveFavouriteBtn");
      this.els.copyCssBtn = document.getElementById("copyCssBtn");
      this.els.exportImageBtn = document.getElementById("exportImageBtn");
      this.els.favouritesList = document.getElementById("favouritesList");
      this.els.toast = document.getElementById("toast");
    },

    bindControls() {
      this.els.headingWeight.addEventListener("change", () => {
        this.state.headingWeight = toInt(this.els.headingWeight.value, this.state.headingWeight);
        this.applyPreviewStyles();
        this.updateFontLink();
        this.persistDebounced();
      });

      this.els.bodyWeight.addEventListener("change", () => {
        this.state.bodyWeight = toInt(this.els.bodyWeight.value, this.state.bodyWeight);
        this.applyPreviewStyles();
        this.updateFontLink();
        this.persistDebounced();
      });

      this.bindRangeControl({
        stateKey: "baseSize",
        min: 1,
        max: 400,
        parse: toInt,
        rangeEl: this.els.baseSize,
        inputEl: this.els.baseSizeInput,
      });

      this.bindRangeControl({
        stateKey: "lineHeight",
        min: -20,
        max: 20,
        parse: toFloat,
        rangeEl: this.els.lineHeight,
        inputEl: this.els.lineHeightInput,
      });

      this.bindRangeControl({
        stateKey: "paragraphWidth",
        min: 45,
        max: 85,
        parse: toInt,
        rangeEl: this.els.paragraphWidth,
        inputEl: this.els.paragraphWidthInput,
      });

      this.bindRangeControl({
        stateKey: "headingSpacing",
        min: -4,
        max: 4,
        parse: toFloat,
        rangeEl: this.els.headingSpacing,
        inputEl: this.els.headingSpacingInput,
      });

      this.bindRangeControl({
        stateKey: "paragraphSpacing",
        min: -4,
        max: 4,
        parse: toFloat,
        rangeEl: this.els.paragraphSpacing,
        inputEl: this.els.paragraphSpacingInput,
      });

      this.els.darkMode.addEventListener("change", () => {
        this.state.dark = this.els.darkMode.checked;
        this.applyDarkMode();
        this.persistDebounced();
      });

      this.els.allowSame.addEventListener("change", () => {
        this.state.allowSame = this.els.allowSame.checked;
        if (!this.state.allowSame && this.state.heading === this.state.body) {
          this.state.body = this.findAlternativeFamily(this.state.heading);
          this.syncPickers();
          this.syncWeightSelectors();
          this.applyPreviewStyles();
          this.updateFontLink();
        }
        this.persistDebounced();
      });

      this.els.randomPairBtn.addEventListener("click", () => this.randomPair());
      this.els.saveFavouriteBtn.addEventListener("click", () => this.saveCurrentFavourite());
      this.els.copyCssBtn.addEventListener("click", () => this.copyCssExport());
      this.els.exportImageBtn.addEventListener("click", () => this.exportPreviewImage());
    },

    bindRangeControl(config) {
      const commit = (rawValue) => {
        const parsed = config.parse(rawValue, NaN);
        if (!Number.isFinite(parsed)) {
          return false;
        }
        this.state[config.stateKey] = clamp(parsed, config.min, config.max);
        this.syncOutputs();
        this.applyPreviewStyles();
        this.persistDebounced();
        return true;
      };

      config.rangeEl.addEventListener("input", () => {
        commit(config.rangeEl.value);
      });

      config.inputEl.addEventListener("input", () => {
        commit(config.inputEl.value);
      });

      config.inputEl.addEventListener("blur", () => {
        this.syncOutputs();
      });
    },

    setReadyState(ready) {
      this.els.headingWeight.disabled = !ready;
      this.els.bodyWeight.disabled = !ready;
      this.els.randomPairBtn.disabled = !ready;
      this.els.saveFavouriteBtn.disabled = !ready;
      this.els.copyCssBtn.disabled = !ready;
      this.els.exportImageBtn.disabled = !ready;
    },

    setupPickers() {
      this.headingPicker = createFontPicker({
        mount: this.els.headingPickerRoot,
        inputId: "headingFontInput",
        placeholder: "Search fonts",
        onSelect: (font) => {
          this.state.heading = font.family;
          if (!this.state.allowSame && this.state.heading === this.state.body) {
            this.state.body = this.findAlternativeFamily(this.state.heading);
            this.syncPickers();
          }
          this.syncWeightSelectors();
          this.applyPreviewStyles();
          this.updateFontLink();
          this.persistDebounced();
        },
      });

      this.bodyPicker = createFontPicker({
        mount: this.els.bodyPickerRoot,
        inputId: "bodyFontInput",
        placeholder: "Search fonts",
        onSelect: (font) => {
          this.state.body = font.family;
          if (!this.state.allowSame && this.state.heading === this.state.body) {
            this.state.heading = this.findAlternativeFamily(this.state.body);
            this.syncPickers();
          }
          this.syncWeightSelectors();
          this.applyPreviewStyles();
          this.updateFontLink();
          this.persistDebounced();
        },
      });
    },

    resolveInitialState() {
      const urlState = readStateFromUrl();
      if (urlState.hasAny) {
        return sanitizeState({ ...DEFAULT_STATE, ...urlState.values });
      }
      const saved = readJson(STATE_KEY, null);
      if (saved && typeof saved === "object") {
        return sanitizeState({ ...DEFAULT_STATE, ...saved });
      }
      return { ...DEFAULT_STATE };
    },

    applyStateToControls() {
      this.els.darkMode.checked = this.state.dark;
      this.els.allowSame.checked = this.state.allowSame;
      this.syncOutputs();
    },

    syncOutputs() {
      const lineHeight = stripTrailingZeros(this.state.lineHeight, 2);
      const headingSpacing = stripTrailingZeros(this.state.headingSpacing, 3);
      const paragraphSpacing = stripTrailingZeros(this.state.paragraphSpacing, 3);

      this.els.baseSize.value = String(this.state.baseSize);
      this.els.baseSizeInput.value = String(this.state.baseSize);
      this.els.baseSizeValue.value = `${this.state.baseSize}px`;

      this.els.lineHeight.value = lineHeight;
      this.els.lineHeightInput.value = lineHeight;
      this.els.lineHeightValue.value = lineHeight;

      this.els.paragraphWidth.value = String(this.state.paragraphWidth);
      this.els.paragraphWidthInput.value = String(this.state.paragraphWidth);
      this.els.paragraphWidthValue.value = `${this.state.paragraphWidth}ch`;

      this.els.headingSpacing.value = headingSpacing;
      this.els.headingSpacingInput.value = headingSpacing;
      this.els.headingSpacingValue.value = `${headingSpacing}em`;

      this.els.paragraphSpacing.value = paragraphSpacing;
      this.els.paragraphSpacingInput.value = paragraphSpacing;
      this.els.paragraphSpacingValue.value = `${paragraphSpacing}em`;
    },

    applyDarkMode() {
      document.body.classList.toggle("dark", Boolean(this.state.dark));
    },

    async loadCatalogue() {
      const cached = this.readCatalogCache();

      if (cached && cached.fonts.length) {
        this.setCatalogue(cached.fonts, {
          sourceLabel: cached.sourceLabel || "cache",
          quality: cached.quality || QUALITY.LOCAL_FILE,
        });
        this.setStatus(cached.fresh ? "Loaded cached catalogue." : "Loaded cached catalogue. Checking updates…");
      }

      const remote = await this.fetchPreferredCatalogue(false);
      if (!remote || !remote.fonts.length) {
        if (!this.fonts.length) {
          this.setStatus("Failed to load font catalogue.");
        }
        return;
      }

      const isDowngrade = cached && cached.fonts.length && remote.quality < (cached.quality || 0);
      const changed = !cached || remote.signature !== cached.signature;

      if (isDowngrade) {
        this.setStatus("Using cached catalogue.");
        return;
      }

      if (!cached || changed) {
        this.writeCatalogCache(remote.fonts, remote.signature, remote.sourceStamp, remote.sourceLabel, remote.quality);
        this.setCatalogue(remote.fonts, {
          sourceLabel: remote.sourceLabel,
          quality: remote.quality,
        });
      }

      this.setStatus(remote.statusLabel);
    },

    async fetchPreferredCatalogue(forceNoCache) {
      const errors = [];

      try {
        const result = await fetchGoogleCatalogue(forceNoCache);
        return {
          ...result,
          quality: QUALITY.GOOGLE,
          sourceLabel: "Google metadata",
          statusLabel: "Loaded catalogue from Google metadata.",
        };
      } catch (err) {
        errors.push(err);
      }

      try {
        const result = await fetchLargeMirrorCatalogue();
        return {
          ...result,
          quality: QUALITY.MIRROR,
          sourceLabel: "mirror catalogue",
          statusLabel: "Loaded catalogue from mirror source.",
        };
      } catch (err) {
        errors.push(err);
      }

      try {
        const result = await fetchFallbackCatalogueFile();
        return {
          ...result,
          quality: QUALITY.LOCAL_FILE,
          sourceLabel: "local fallback",
          statusLabel: "Loaded local fallback catalogue.",
        };
      } catch (err) {
        errors.push(err);
      }

      const embedded = fetchEmbeddedFallbackCatalogue();
      return {
        ...embedded,
        quality: QUALITY.EMBEDDED,
        sourceLabel: "embedded fallback",
        statusLabel: "Loaded embedded fallback catalogue.",
      };
    },

    readCatalogCache() {
      const data = readJson(CACHE_KEY, null);
      if (!data || !Array.isArray(data.fonts) || !data.fonts.length) {
        return null;
      }
      return {
        fonts: data.fonts,
        signature: data.signature || "",
        sourceStamp: data.sourceStamp || "",
        sourceLabel: data.sourceLabel || "cache",
        quality: toInt(data.quality, QUALITY.LOCAL_FILE),
        fresh: Date.now() - (data.timestamp || 0) < CACHE_TTL_MS,
      };
    },

    writeCatalogCache(fonts, signature, sourceStamp, sourceLabel, quality) {
      writeJson(CACHE_KEY, {
        timestamp: Date.now(),
        signature,
        sourceStamp,
        sourceLabel,
        quality,
        fonts,
      });
    },

    setCatalogue(fonts, info) {
      this.fonts = fonts.slice();
      this.fontsByFamily = new Map(this.fonts.map((font) => [font.family, font]));
      this.catalogueQuality = toInt(info?.quality, this.catalogueQuality);

      this.setReadyState(this.fonts.length > 0);
      this.updateCatalogueIndicators(info?.sourceLabel || "catalogue");

      this.headingPicker.setFonts(this.fonts);
      this.bodyPicker.setFonts(this.fonts);

      this.reconcileStateWithCatalogue();
      this.syncPickers();
      this.syncWeightSelectors();
      this.applyPreviewStyles();
      this.updateFontLink();
      this.pushStateToUrl();
    },

    updateCatalogueIndicators(sourceLabel) {
      this.els.catalogueMeta.textContent = `Source: ${sourceLabel}`;
    },

    setStatus(text) {
      this.els.statusText.textContent = text;
    },

    reconcileStateWithCatalogue() {
      if (!this.fonts.length) return;

      if (!this.fontsByFamily.has(this.state.heading)) {
        this.state.heading = this.pickInitialFamily(["Inter", "Roboto", "Open Sans"], 0);
      }
      if (!this.fontsByFamily.has(this.state.body)) {
        this.state.body = this.pickInitialFamily(["Source Serif 4", "Merriweather", "Lora"], 1);
      }

      if (!this.state.allowSame && this.state.heading === this.state.body) {
        this.state.body = this.findAlternativeFamily(this.state.heading);
      }

      this.state.headingWeight = snapWeight(this.state.headingWeight, this.getWeightsForFamily(this.state.heading));
      this.state.bodyWeight = snapWeight(this.state.bodyWeight, this.getWeightsForFamily(this.state.body));
    },

    pickInitialFamily(candidates, fallbackIndex) {
      for (const family of candidates) {
        if (this.fontsByFamily.has(family)) {
          return family;
        }
      }
      return this.fonts[Math.min(fallbackIndex, this.fonts.length - 1)].family;
    },

    findAlternativeFamily(excludedFamily) {
      for (let i = 0; i < this.fonts.length; i += 1) {
        if (this.fonts[i].family !== excludedFamily) {
          return this.fonts[i].family;
        }
      }
      return excludedFamily;
    },

    syncPickers() {
      this.headingPicker.setSelectedFamily(this.state.heading);
      this.bodyPicker.setSelectedFamily(this.state.body);
    },

    syncWeightSelectors() {
      this.populateWeightSelect("heading");
      this.populateWeightSelect("body");
    },

    populateWeightSelect(target) {
      const isHeading = target === "heading";
      const select = isHeading ? this.els.headingWeight : this.els.bodyWeight;
      const family = isHeading ? this.state.heading : this.state.body;
      const stateKeyWeight = isHeading ? "headingWeight" : "bodyWeight";
      const weights = this.getWeightsForFamily(family);
      this.state[stateKeyWeight] = snapWeight(this.state[stateKeyWeight], weights);

      select.innerHTML = "";
      const frag = document.createDocumentFragment();
      for (const weight of weights) {
        const option = document.createElement("option");
        option.value = String(weight);
        option.textContent = String(weight);
        frag.appendChild(option);
      }
      select.appendChild(frag);
      select.value = String(this.state[stateKeyWeight]);
    },

    getWeightsForFamily(family) {
      const font = this.fontsByFamily.get(family);
      if (!font || !font.weights || !font.weights.length) {
        return [400, 700];
      }
      return font.weights;
    },

    applyPreviewStyles() {
      const headingFont = this.fontsByFamily.get(this.state.heading);
      const bodyFont = this.fontsByFamily.get(this.state.body);
      const root = document.documentElement.style;

      root.setProperty("--font-heading", cssFontStack(this.state.heading, headingFont?.category));
      root.setProperty("--font-body", cssFontStack(this.state.body, bodyFont?.category));
      root.setProperty("--base-size", `${this.state.baseSize}px`);
      root.setProperty("--line-height", stripTrailingZeros(getRenderableLineHeight(this.state.lineHeight), 2));
      root.setProperty("--measure", `${this.state.paragraphWidth}ch`);
      root.setProperty("--heading-spacing", `${stripTrailingZeros(this.state.headingSpacing, 3)}em`);
      root.setProperty("--paragraph-spacing", `${stripTrailingZeros(this.state.paragraphSpacing, 3)}em`);
      root.setProperty("--heading-weight", String(this.state.headingWeight));
      root.setProperty("--body-weight", String(this.state.bodyWeight));

      this.els.pairHeadingName.textContent = this.state.heading;
      this.els.pairBodyName.textContent = this.state.body;
    },

    buildGoogleCssHref() {
      const familyWeights = new Map();

      const addFamily = (family, selectedWeight) => {
        const available = this.getWeightsForFamily(family);
        const set = familyWeights.get(family) || new Set();
        set.add(snapWeight(selectedWeight, available));
        if (available.includes(400)) set.add(400);
        if (available.includes(700)) set.add(700);
        familyWeights.set(family, set);
      };

      addFamily(this.state.heading, this.state.headingWeight);
      addFamily(this.state.body, this.state.bodyWeight);

      // Build a single CSS2 link from selected families and only needed weights.
      const parts = [];
      for (const [family, weightSet] of familyWeights) {
        const encodedFamily = encodeURIComponent(family).replace(/%20/g, "+");
        const sortedWeights = Array.from(weightSet).sort((a, b) => a - b);
        parts.push(`family=${encodedFamily}:wght@${sortedWeights.join(";")}`);
      }

      return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
    },

    updateFontLink() {
      if (!this.state.heading || !this.state.body) {
        return;
      }

      const href = this.buildGoogleCssHref();
      let link = document.getElementById("google-fonts-link");
      if (!link) {
        link = document.createElement("link");
        link.id = "google-fonts-link";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (link.getAttribute("href") !== href) {
        link.setAttribute("href", href);
      }
    },

    randomPair() {
      if (!this.fonts.length) return;

      const heading = this.fonts[randomInt(0, this.fonts.length - 1)].family;
      let body = this.fonts[randomInt(0, this.fonts.length - 1)].family;

      if (!this.state.allowSame && this.fonts.length > 1) {
        let guard = 0;
        while (body === heading && guard < 24) {
          body = this.fonts[randomInt(0, this.fonts.length - 1)].family;
          guard += 1;
        }
      }

      this.state.heading = heading;
      this.state.body = body;
      this.syncPickers();
      this.syncWeightSelectors();
      this.applyPreviewStyles();
      this.updateFontLink();
      this.persistDebounced();
    },

    saveCurrentFavourite() {
      if (!this.state.heading || !this.state.body) return;

      const item = {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        createdAt: new Date().toISOString(),
        state: sanitizeState({ ...this.state }),
      };

      this.favourites.unshift(item);
      if (this.favourites.length > 50) {
        this.favourites = this.favourites.slice(0, 50);
      }

      this.persistFavourites();
      this.renderFavourites();
      this.showToast("Saved");
    },

    loadFavourites() {
      const stored = readJson(FAV_KEY, []);
      if (!Array.isArray(stored)) return [];
      return stored.filter((item) => item && item.id && item.state);
    },

    persistFavourites() {
      writeJson(FAV_KEY, this.favourites);
    },

    applyFavourite(id) {
      const match = this.favourites.find((fav) => fav.id === id);
      if (!match) return;

      this.state = sanitizeState({ ...DEFAULT_STATE, ...match.state });
      this.applyStateToControls();
      this.applyDarkMode();
      this.reconcileStateWithCatalogue();
      this.syncPickers();
      this.syncWeightSelectors();
      this.applyPreviewStyles();
      this.updateFontLink();
      this.persistDebounced();
      this.showToast("Applied");
    },

    deleteFavourite(id) {
      this.favourites = this.favourites.filter((fav) => fav.id !== id);
      this.persistFavourites();
      this.renderFavourites();
    },

    renderFavourites() {
      const list = this.els.favouritesList;
      list.innerHTML = "";

      if (!this.favourites.length) {
        const empty = document.createElement("li");
        empty.className = "fav-meta";
        empty.textContent = "No favourites yet.";
        list.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();

      for (const fav of this.favourites) {
        const favState = sanitizeState({ ...DEFAULT_STATE, ...fav.state });
        const headingStack = cssFontStack(favState.heading, this.fontsByFamily.get(favState.heading)?.category);
        const bodyStack = cssFontStack(favState.body, this.fontsByFamily.get(favState.body)?.category);

        const item = document.createElement("li");
        item.className = "fav-item";

        const top = document.createElement("div");
        top.className = "fav-top";

        const name = document.createElement("div");
        name.className = "fav-name";
        name.textContent = `${favState.heading} / ${favState.body}`;

        const meta = document.createElement("div");
        meta.className = "fav-meta";
        meta.textContent = `${favState.headingWeight}/${favState.bodyWeight} • ${favState.baseSize}px`;

        top.appendChild(name);
        top.appendChild(meta);

        const preview = document.createElement("div");
        preview.className = "fav-preview";

        const headingSample = document.createElement("p");
        headingSample.className = "fav-preview-heading";
        headingSample.textContent = "Heading sample";
        headingSample.style.fontFamily = headingStack;
        headingSample.style.fontWeight = String(favState.headingWeight);
        headingSample.style.letterSpacing = `${favState.headingSpacing}em`;

        const bodySample = document.createElement("p");
        bodySample.className = "fav-preview-body";
        bodySample.textContent = "Body sample text for readability.";
        bodySample.style.fontFamily = bodyStack;
        bodySample.style.fontWeight = String(favState.bodyWeight);
        bodySample.style.letterSpacing = `${favState.paragraphSpacing}em`;

        preview.appendChild(headingSample);
        preview.appendChild(bodySample);

        const actions = document.createElement("div");
        actions.className = "fav-actions";

        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.textContent = "Apply";
        applyBtn.addEventListener("click", () => this.applyFavourite(fav.id));

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => this.deleteFavourite(fav.id));

        actions.appendChild(applyBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(top);
        item.appendChild(preview);
        item.appendChild(actions);
        fragment.appendChild(item);
      }

      list.appendChild(fragment);
    },

    async copyCssExport() {
      const linkTag = `<link rel="stylesheet" href="${this.buildGoogleCssHref()}">`;
      const css = [
        linkTag,
        "",
        ":root {",
        `  --font-heading: "${this.state.heading}";`,
        `  --font-body: "${this.state.body}";`,
        `  --base-size: ${this.state.baseSize}px;`,
        `  --line-height: ${stripTrailingZeros(getRenderableLineHeight(this.state.lineHeight), 2)};`,
        `  --paragraph-width: ${this.state.paragraphWidth}ch;`,
        `  --heading-weight: ${this.state.headingWeight};`,
        `  --body-weight: ${this.state.bodyWeight};`,
        `  --heading-spacing: ${stripTrailingZeros(this.state.headingSpacing, 3)}em;`,
        `  --paragraph-spacing: ${stripTrailingZeros(this.state.paragraphSpacing, 3)}em;`,
        "}",
        "",
        "body {",
        "  font-family: var(--font-body), serif;",
        "  font-size: var(--base-size);",
        "  line-height: var(--line-height);",
        "  letter-spacing: var(--paragraph-spacing);",
        "  max-width: var(--paragraph-width);",
        "  font-weight: var(--body-weight);",
        "}",
        "",
        "h1, h2, h3 {",
        "  font-family: var(--font-heading), sans-serif;",
        "  font-weight: var(--heading-weight);",
        "  letter-spacing: var(--heading-spacing);",
        "}",
      ].join("\n");

      try {
        await copyText(css);
        this.showToast("Copied");
      } catch (err) {
        this.showToast("Copy failed");
      }
    },

    async exportPreviewImage() {
      if (typeof window.html2canvas !== "function") {
        this.showToast("Export unavailable");
        return;
      }

      const snapshotNode = this.buildExportSnapshotNode();
      if (!snapshotNode) {
        this.showToast("Export failed");
        return;
      }

      const originalLabel = this.els.exportImageBtn.textContent;
      this.els.exportImageBtn.disabled = true;
      this.els.exportImageBtn.textContent = "Exporting...";

      try {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }

        const bodyStyles = getComputedStyle(document.body);
        const backgroundColor = bodyStyles.getPropertyValue("--bg").trim() || null;
        const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

        const canvas = await window.html2canvas(snapshotNode, {
          backgroundColor,
          scale,
          useCORS: true,
          logging: false,
          onclone: disableMotionInClonedDocument,
        });

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-").replace("T", "-");
        const fileName = `typepair-${slugifyFileToken(this.state.heading)}-${slugifyFileToken(
          this.state.body,
        )}-${timestamp}.png`;

        await downloadCanvasImage(canvas, fileName);
        this.showToast("Image exported");
      } catch (err) {
        this.showToast("Export failed");
      } finally {
        if (snapshotNode.parentNode) {
          snapshotNode.parentNode.removeChild(snapshotNode);
        }
        this.els.exportImageBtn.textContent = originalLabel;
        this.setReadyState(this.fonts.length > 0);
      }
    },

    buildExportSnapshotNode() {
      if (!this.els.previewTop || !this.els.previewSurface) {
        return null;
      }

      const previewWidth = Math.round(this.els.previewSurface.getBoundingClientRect().width);
      const width = clamp(previewWidth + 48, 560, 1200);
      const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#f5f5f2";

      const stage = document.createElement("div");
      stage.setAttribute("aria-hidden", "true");
      stage.style.position = "fixed";
      stage.style.left = "-20000px";
      stage.style.top = "0";
      stage.style.width = `${width}px`;
      stage.style.padding = "22px";
      stage.style.boxSizing = "border-box";
      stage.style.borderRadius = "16px";
      stage.style.background = bg;

      const headerClone = this.els.previewTop.cloneNode(true);
      const surfaceClone = this.els.previewSurface.cloneNode(true);
      stripIdsInTree(headerClone);
      stripIdsInTree(surfaceClone);

      headerClone.style.marginBottom = "12px";
      headerClone.style.padding = "0 2px";
      surfaceClone.style.width = "100%";
      surfaceClone.style.maxWidth = "none";

      stage.appendChild(headerClone);
      stage.appendChild(surfaceClone);
      document.body.appendChild(stage);
      return stage;
    },

    showToast(message) {
      clearTimeout(this.toastTimer);
      this.els.toast.textContent = message;
      this.els.toast.classList.add("show");
      this.toastTimer = window.setTimeout(() => {
        this.els.toast.classList.remove("show");
      }, 1300);
    },

    saveStateToStorage() {
      writeJson(STATE_KEY, sanitizeState(this.state));
    },

    pushStateToUrl() {
      const params = new URLSearchParams();
      params.set("heading", this.state.heading);
      params.set("body", this.state.body);
      params.set("weights", `${this.state.headingWeight},${this.state.bodyWeight}`);
      params.set("headingWeight", String(this.state.headingWeight));
      params.set("bodyWeight", String(this.state.bodyWeight));
      params.set("size", String(this.state.baseSize));
      params.set("lh", stripTrailingZeros(this.state.lineHeight, 2));
      params.set("width", String(this.state.paragraphWidth));
      params.set("spacing", stripTrailingZeros(this.state.headingSpacing, 3));
      params.set("pspacing", stripTrailingZeros(this.state.paragraphSpacing, 3));
      params.set("dark", this.state.dark ? "1" : "0");
      params.set("allowSame", this.state.allowSame ? "1" : "0");

      const query = params.toString();
      const nextUrl = `${window.location.pathname}?${query}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl !== currentUrl) {
        window.history.replaceState({}, "", nextUrl);
      }
    },
  };

  async function fetchGoogleCatalogue(forceNoCache) {
    const url = forceNoCache ? `${CATALOG_URL}?ts=${Date.now()}` : CATALOG_URL;
    const response = await fetch(url, {
      cache: "no-store",
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(`Google metadata fetch failed (${response.status})`);
    }

    const text = await response.text();
    const payload = parseGoogleMetadataResponse(text);
    const entries = Array.isArray(payload.familyMetadataList)
      ? payload.familyMetadataList
      : Array.isArray(payload.fonts)
      ? payload.fonts
      : [];

    const fonts = normalizeCatalogue(entries);
    if (!fonts.length) {
      throw new Error("Google metadata returned no font families");
    }

    return {
      fonts,
      sourceStamp: String(payload.lastModified || payload.generated || payload.updated || "google"),
      signature: buildCatalogueSignature(fonts),
    };
  }

  async function fetchLargeMirrorCatalogue() {
    let lastError = null;

    for (const url of LARGE_CATALOGUE_MIRRORS) {
      try {
        const response = await fetch(url, { cache: "no-store", mode: "cors" });
        if (!response.ok) {
          throw new Error(`Mirror fetch failed (${response.status})`);
        }

        const payload = await response.json();
        const entries = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.items)
          ? payload.items
          : [];

        const fonts = normalizeCatalogue(entries);
        if (fonts.length < 500) {
          throw new Error("Mirror response too small");
        }

        return {
          fonts,
          sourceStamp: "mirror",
          signature: buildCatalogueSignature(fonts),
        };
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("No mirror source available");
  }

  async function fetchFallbackCatalogueFile() {
    const response = await fetch("fonts_fallback.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Local fallback fetch failed (${response.status})`);
    }

    const payload = await response.json();
    const entries = Array.isArray(payload) ? payload : Array.isArray(payload.fonts) ? payload.fonts : [];
    const fonts = normalizeCatalogue(entries);
    if (!fonts.length) {
      throw new Error("Local fallback is empty");
    }

    return {
      fonts,
      sourceStamp: "local-fallback",
      signature: buildCatalogueSignature(fonts),
    };
  }

  function fetchEmbeddedFallbackCatalogue() {
    const fonts = normalizeCatalogue(EMBEDDED_FALLBACK_FONTS);
    return {
      fonts,
      sourceStamp: "embedded-fallback",
      signature: buildCatalogueSignature(fonts),
    };
  }

  function normalizeCatalogue(entries) {
    const output = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const family = String(entry.family || "").trim();
      if (!family) {
        continue;
      }

      const category = normalizeCategory(entry.category || entry.classification || entry.kind);
      const weights = extractWeights(entry);
      output.push({
        family,
        familyLower: family.toLowerCase(),
        category,
        weights,
      });
    }

    output.sort((a, b) => a.family.localeCompare(b.family));
    return output;
  }

  function extractWeights(entry) {
    const weights = new Set();

    if (Array.isArray(entry.weights)) {
      for (const value of entry.weights) {
        const n = toInt(value, NaN);
        if (Number.isFinite(n)) {
          weights.add(normalizeWeight(n));
        }
      }
    }

    if (Array.isArray(entry.variants)) {
      for (const variant of entry.variants) {
        const m = String(variant).match(/\d{3}/);
        if (m) {
          weights.add(normalizeWeight(toInt(m[0], 400)));
        }
      }
    }

    if (entry.fonts && typeof entry.fonts === "object") {
      for (const key of Object.keys(entry.fonts)) {
        const m = String(key).match(/\d{3}/);
        if (m) {
          weights.add(normalizeWeight(toInt(m[0], 400)));
        }
      }
    }

    if (Array.isArray(entry.axes)) {
      const weightAxis = entry.axes.find((axis) => axis && axis.tag === "wght");
      if (weightAxis) {
        const min = toFloat(weightAxis.min ?? weightAxis.start ?? weightAxis.minValue, NaN);
        const max = toFloat(weightAxis.max ?? weightAxis.end ?? weightAxis.maxValue, NaN);
        if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
          const start = Math.max(100, Math.round(min / 100) * 100);
          const end = Math.min(900, Math.round(max / 100) * 100);
          for (let w = start; w <= end; w += 100) {
            weights.add(w);
          }
        }
      }
    }

    if (!weights.size) {
      weights.add(400);
      weights.add(700);
    }

    return Array.from(weights).sort((a, b) => a - b);
  }

  function normalizeCategory(input) {
    const value = String(input || "")
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    if (!value) return "sans";
    if (value.includes("serif") && !value.includes("sans")) return "serif";
    if (value.includes("mono")) return "mono";
    if (value.includes("display")) return "display";
    if (value.includes("hand") || value.includes("script")) return "handwriting";
    return "sans";
  }

  function normalizeWeight(value) {
    return clamp(Math.round(value / 100) * 100, 100, 900);
  }

  function sanitizeState(candidate) {
    const next = { ...candidate };
    next.heading = String(candidate.heading || DEFAULT_STATE.heading);
    next.body = String(candidate.body || DEFAULT_STATE.body);
    next.headingWeight = clamp(toInt(candidate.headingWeight, DEFAULT_STATE.headingWeight), 100, 900);
    next.bodyWeight = clamp(toInt(candidate.bodyWeight, DEFAULT_STATE.bodyWeight), 100, 900);
    next.baseSize = clamp(toInt(candidate.baseSize, DEFAULT_STATE.baseSize), 1, 400);
    next.lineHeight = clamp(toFloat(candidate.lineHeight, DEFAULT_STATE.lineHeight), -20, 20);
    next.paragraphWidth = clamp(toInt(candidate.paragraphWidth, DEFAULT_STATE.paragraphWidth), 45, 85);
    next.headingSpacing = clamp(toFloat(candidate.headingSpacing, DEFAULT_STATE.headingSpacing), -4, 4);
    next.paragraphSpacing = clamp(toFloat(candidate.paragraphSpacing, DEFAULT_STATE.paragraphSpacing), -4, 4);
    next.dark = toBool(candidate.dark);
    next.allowSame = toBool(candidate.allowSame);
    return next;
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    const trackedKeys = [
      "heading",
      "body",
      "weights",
      "headingWeight",
      "bodyWeight",
      "size",
      "lh",
      "width",
      "spacing",
      "pspacing",
      "dark",
      "allowSame",
    ];
    const hasAny = trackedKeys.some((key) => params.has(key));
    if (!hasAny) {
      return { hasAny: false, values: {} };
    }

    let headingWeight = toInt(params.get("headingWeight"), DEFAULT_STATE.headingWeight);
    let bodyWeight = toInt(params.get("bodyWeight"), DEFAULT_STATE.bodyWeight);

    const pair = (params.get("weights") || "").split(",");
    if (pair.length === 2) {
      headingWeight = toInt(pair[0], headingWeight);
      bodyWeight = toInt(pair[1], bodyWeight);
    }

    return {
      hasAny: true,
      values: {
        heading: params.get("heading") || DEFAULT_STATE.heading,
        body: params.get("body") || DEFAULT_STATE.body,
        headingWeight,
        bodyWeight,
        baseSize: toInt(params.get("size"), DEFAULT_STATE.baseSize),
        lineHeight: toFloat(params.get("lh"), DEFAULT_STATE.lineHeight),
        paragraphWidth: toInt(params.get("width"), DEFAULT_STATE.paragraphWidth),
        headingSpacing: toFloat(params.get("spacing"), DEFAULT_STATE.headingSpacing),
        paragraphSpacing: toFloat(params.get("pspacing"), DEFAULT_STATE.paragraphSpacing),
        dark: params.get("dark") === "1",
        allowSame: params.get("allowSame") === "1",
      },
    };
  }

  function buildCatalogueSignature(fonts) {
    let hash = 2166136261;
    for (const font of fonts) {
      const source = `${font.family}|${font.category}|${font.weights.join(",")}`;
      for (let i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
    }
    return `${fonts.length}-${hash >>> 0}`;
  }

  function cssFontStack(family, category) {
    const safeFamily = String(family || "").replace(/"/g, '\\"');
    const generic =
      category === "serif"
        ? "serif"
        : category === "mono"
        ? "monospace"
        : category === "handwriting"
        ? "cursive"
        : "sans-serif";
    return `"${safeFamily}", ${generic}`;
  }

  function snapWeight(target, availableWeights) {
    if (!Array.isArray(availableWeights) || !availableWeights.length) {
      return 400;
    }

    const value = toInt(target, availableWeights[0]);
    let best = availableWeights[0];
    let bestDiff = Math.abs(best - value);

    for (let i = 1; i < availableWeights.length; i += 1) {
      const diff = Math.abs(availableWeights[i] - value);
      if (diff < bestDiff) {
        best = availableWeights[i];
        bestDiff = diff;
      }
    }
    return best;
  }

  function createFontPicker(config) {
    const rowHeight = 40;
    const overscan = 5;

    let allFonts = [];
    let filteredFonts = [];
    let selectedFamily = "";
    let activeIndex = -1;
    let query = "";
    let open = false;
    let rafId = 0;
    const rowPool = [];

    const wrapper = document.createElement("div");
    wrapper.className = "font-picker";

    const input = document.createElement("input");
    input.id = config.inputId;
    input.type = "search";
    input.placeholder = config.placeholder || "Search";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.role = "combobox";
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-autocomplete", "list");

    const chevron = document.createElement("button");
    chevron.type = "button";
    chevron.className = "picker-chevron";
    chevron.setAttribute("aria-label", "Toggle font list");
    chevron.textContent = "▾";

    const dropdown = document.createElement("div");
    dropdown.className = "picker-dropdown";
    dropdown.hidden = true;

    const viewport = document.createElement("div");
    viewport.className = "picker-viewport";

    const spacer = document.createElement("div");
    spacer.className = "picker-spacer";

    const items = document.createElement("div");
    items.className = "picker-items";

    const empty = document.createElement("div");
    empty.className = "picker-empty";
    empty.textContent = "No matching fonts.";
    empty.hidden = true;

    viewport.appendChild(spacer);
    viewport.appendChild(items);
    dropdown.appendChild(viewport);
    dropdown.appendChild(empty);

    wrapper.appendChild(input);
    wrapper.appendChild(chevron);
    wrapper.appendChild(dropdown);
    config.mount.appendChild(wrapper);

    const runFilterDebounced = debounce(() => applyFilter(true), 100);

    input.addEventListener("focus", () => {
      openDropdown();
      applyFilter(false);
    });

    input.addEventListener("input", () => {
      query = input.value;
      openDropdown();
      runFilterDebounced();
    });

    input.addEventListener("keydown", (event) => {
      if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        openDropdown();
        applyFilter(false);
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!filteredFonts.length) return;
        activeIndex = clamp(activeIndex + 1, 0, filteredFonts.length - 1);
        ensureActiveVisible();
        scheduleRender();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!filteredFonts.length) return;
        activeIndex = clamp(activeIndex - 1, 0, filteredFonts.length - 1);
        ensureActiveVisible();
        scheduleRender();
      } else if (event.key === "Enter") {
        if (open && activeIndex >= 0 && activeIndex < filteredFonts.length) {
          event.preventDefault();
          selectIndex(activeIndex);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown(true);
      } else if (event.key === "Tab") {
        closeDropdown(true);
      }
    });

    chevron.addEventListener("click", () => {
      if (open) {
        closeDropdown(true);
      } else {
        openDropdown();
        applyFilter(false);
        input.focus();
      }
    });

    viewport.addEventListener("scroll", scheduleRender);

    document.addEventListener("mousedown", (event) => {
      if (!wrapper.contains(event.target)) {
        closeDropdown(true);
      }
    });

    function openDropdown() {
      open = true;
      dropdown.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function closeDropdown(resetInputValue) {
      if (!open) return;
      open = false;
      dropdown.hidden = true;
      input.setAttribute("aria-expanded", "false");

      if (resetInputValue) {
        query = "";
        input.value = selectedFamily;
      }
    }

    function applyFilter(resetScroll) {
      const needle = query.trim().toLowerCase();
      filteredFonts = needle
        ? allFonts.filter((font) => font.familyLower.includes(needle))
        : allFonts.slice();

      activeIndex = filteredFonts.findIndex((font) => font.family === selectedFamily);
      if (activeIndex < 0 && filteredFonts.length) {
        activeIndex = 0;
      }

      if (resetScroll) {
        viewport.scrollTop = 0;
      }
      scheduleRender();
    }

    function selectIndex(index) {
      const font = filteredFonts[index];
      if (!font) return;
      selectedFamily = font.family;
      query = "";
      input.value = selectedFamily;
      closeDropdown(false);
      config.onSelect(font);
    }

    function ensureActiveVisible() {
      const top = activeIndex * rowHeight;
      const bottom = top + rowHeight;
      if (top < viewport.scrollTop) {
        viewport.scrollTop = top;
      } else if (bottom > viewport.scrollTop + viewport.clientHeight) {
        viewport.scrollTop = bottom - viewport.clientHeight;
      }
    }

    function ensurePoolSize() {
      const neededRows = Math.ceil(viewport.clientHeight / rowHeight) + overscan * 2 + 2;
      while (rowPool.length < neededRows) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "picker-item";

        const familySpan = document.createElement("span");
        familySpan.className = "picker-family";

        const categorySpan = document.createElement("span");
        categorySpan.className = "picker-category";

        row.appendChild(familySpan);
        row.appendChild(categorySpan);

        row.addEventListener("mousedown", (event) => event.preventDefault());
        row.addEventListener("click", () => {
          const index = toInt(row.dataset.index, -1);
          if (index >= 0) {
            selectIndex(index);
          }
        });

        rowPool.push(row);
        items.appendChild(row);
      }
    }

    function scheduleRender() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        renderVisibleRows();
      });
    }

    function renderVisibleRows() {
      const total = filteredFonts.length;
      spacer.style.height = `${total * rowHeight}px`;
      empty.hidden = total > 0;
      viewport.hidden = total === 0;

      if (!total) {
        for (const row of rowPool) {
          row.hidden = true;
        }
        return;
      }

      ensurePoolSize();

      // Virtual list: keep a small recycled row pool and only update visible indexes.
      const visibleStart = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan);
      const visibleCount = Math.ceil(viewport.clientHeight / rowHeight) + overscan * 2;
      const visibleEnd = Math.min(total, visibleStart + visibleCount);

      for (let i = 0; i < rowPool.length; i += 1) {
        const row = rowPool[i];
        const index = visibleStart + i;
        if (index >= visibleEnd) {
          row.hidden = true;
          continue;
        }

        const font = filteredFonts[index];
        row.hidden = false;
        row.dataset.index = String(index);
        row.style.transform = `translateY(${index * rowHeight}px)`;
        row.classList.toggle("active", index === activeIndex);
        row.classList.toggle("selected", font.family === selectedFamily);

        row.children[0].textContent = font.family;
        row.children[1].textContent = font.category;
      }
    }

    return {
      setFonts(fonts) {
        allFonts = Array.isArray(fonts) ? fonts : [];
        applyFilter(true);
      },
      setSelectedFamily(family) {
        selectedFamily = String(family || "");
        query = "";
        input.value = selectedFamily;
        applyFilter(false);
      },
    };
  }

  function parseGoogleMetadataResponse(rawText) {
    // Google includes XSSI protection (e.g. ")]}'") before JSON payload.
    const text = String(rawText || "").trim();
    const cleaned = text.replace(/^\)\]\}'\n?/, "");

    try {
      return JSON.parse(cleaned);
    } catch (primaryError) {
      const start = cleaned.search(/[\[{]/);
      const endObject = cleaned.lastIndexOf("}");
      const endArray = cleaned.lastIndexOf("]");
      const end = Math.max(endObject, endArray);
      if (start < 0 || end <= start) {
        throw primaryError;
      }
      return JSON.parse(cleaned.slice(start, end + 1));
    }
  }

  function disableMotionInClonedDocument(doc) {
    const style = doc.createElement("style");
    style.textContent = `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `;
    doc.head.appendChild(style);
  }

  function stripIdsInTree(root) {
    if (!root || !(root instanceof Element)) return;
    if (root.id) {
      root.removeAttribute("id");
    }
    const nodes = root.querySelectorAll("[id]");
    for (const node of nodes) {
      node.removeAttribute("id");
    }
  }

  async function downloadCanvasImage(canvas, fileName) {
    if (canvas.toBlob) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        triggerDownload(blobUrl, fileName);
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        return;
      }
    }

    const dataUrl = canvas.toDataURL("image/png");
    triggerDownload(dataUrl, fileName);
  }

  function triggerDownload(url, fileName) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function slugifyFileToken(value) {
    return String(value || "sample")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "sample";
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  function toInt(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function toFloat(value, fallback) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const str = String(value).toLowerCase();
    return str === "1" || str === "true";
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getRenderableLineHeight(value) {
    // CSS line-height cannot be zero/negative. Accept signed input but render safely.
    return Math.max(0.01, Math.abs(toFloat(value, 1.55)));
  }

  function stripTrailingZeros(value, digits) {
    return Number(value).toFixed(digits).replace(/\.?0+$/, "");
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function debounce(fn, delayMs) {
    let timer = 0;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(this, args), delayMs);
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Ignore quota/private browsing errors.
    }
  }

  window.App = App;
  window.addEventListener("DOMContentLoaded", () => App.init());
})();
