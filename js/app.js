/**
 * NaviCampus UAE - Application Controller & Command Center
 * Connects MapEngine, OnboardingWizard, Search, and Turn-by-Turn Wayfinding.
 * Follows strict Swiss Graphic Design Standards (Josef Müller-Brockmann).
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Application State
  const state = {
    campusId: "uos",
    startPoint: null,
    endPoint: null,
    currentBuilding: null,
    activeCategory: "all",
    accessibleMode: false,
    profile: null
  };

  // DOM Element References
  const startSelect = document.getElementById("route-start-select");
  const endSelect = document.getElementById("route-end-select");
  const swapBtn = document.getElementById("btn-swap-route");
  const findRouteBtn = document.getElementById("btn-find-route");
  const clearRouteBtn = document.getElementById("btn-clear-route");
  const accessToggle = document.getElementById("step-free-toggle");
  const campusSelect = document.getElementById("campus-select");
  const profileBtn = document.getElementById("btn-open-profile");
  const searchInput = document.getElementById("global-search");
  const searchResults = document.getElementById("search-results");
  const mobileMenuBtn = document.getElementById("btn-mobile-menu");
  const closeSidebarBtn = document.getElementById("btn-close-sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const spatialSidebar = document.getElementById("spatial-sidebar");
  const toastContainer = document.getElementById("toast-container");

  // Swiss HUD Toast System
  function showSwissToast(message, type = "error") {
    if (!toastContainer) {
      console.warn(message);
      return;
    }
    const toast = document.createElement("div");
    toast.className = `swiss-toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close-btn" aria-label="Close notification">✕</button>
    `;

    toast.querySelector(".toast-close-btn")?.addEventListener("click", () => {
      toast.remove();
    });

    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(() => toast.remove(), 200);
      }
    }, 3800);
  }

  function openMobileSidebar() {
    if (spatialSidebar) spatialSidebar.classList.add("mobile-open");
    if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
  }

  function closeMobileSidebar() {
    if (spatialSidebar) spatialSidebar.classList.remove("mobile-open");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
      if (spatialSidebar && spatialSidebar.classList.contains("mobile-open")) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", closeMobileSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", closeMobileSidebar);
  }

  // Mobile Bottom Quick Navigation Bar Controls
  document.getElementById("mb-btn-routes")?.addEventListener("click", () => {
    openMobileSidebar();
  });

  document.getElementById("mb-btn-search")?.addEventListener("click", () => {
    searchInput?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById("mb-btn-layers")?.addEventListener("click", () => {
    openMobileSidebar();
    document.querySelector(".category-pills-row")?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById("mb-btn-rubric")?.addEventListener("click", () => {
    window.location.href = "problem-solution.html";
  });

  document.getElementById("mb-btn-tour")?.addEventListener("click", () => {
    if (window.navicampusTutorial) {
      window.navicampusTutorial.start();
    }
  });

  document.getElementById("mb-btn-profile")?.addEventListener("click", () => {
    onboarding.open(1);
  });

  // Initialize Map Engine
  const mapEngine = new MapEngine("map-container", {
    accessibleOnly: false,
    onBuildingSelect: (bldg) => {
      showBuildingDetails(bldg);
    },
    onRouteCalculated: (route) => {
      displayTurnByTurn(route);
    }
  });
  window.mapEngine = mapEngine;

  // Initialize Onboarding Wizard
  const onboarding = new OnboardingWizard({
    onComplete: (profile) => {
      state.profile = profile;
      applyUserProfile(profile);
    }
  });

  // Initialize Interactive Tutorial Walkthrough
  if (typeof NaviCampusTutorial !== "undefined") {
    window.navicampusTutorial = new NaviCampusTutorial();
  }

  // Load existing profile if any
  state.profile = onboarding.loadProfile();
  if (state.profile) {
    applyUserProfile(state.profile);
  }

  // --- TOP BAR CONTROLS ---

  // Campus Selector Dropdown
  if (campusSelect) {
    campusSelect.value = state.campusId;
    campusSelect.addEventListener("change", (e) => {
      switchCampus(e.target.value);
    });
  }

  // Profile Button
  if (profileBtn) {
    profileBtn.addEventListener("click", () => {
      onboarding.open(1);
    });
  }

  // Search Input & Suggestions
  if (searchInput && searchResults) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (q.length < 1) {
        searchResults.style.display = "none";
        return;
      }
      renderSearchResults(q);
    });

    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim().length >= 1) {
        renderSearchResults(searchInput.value.trim().toLowerCase());
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-container")) {
        searchResults.style.display = "none";
      }
    });

    // Keyboard navigation in search
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        searchResults.style.display = "none";
        searchInput.blur();
      }
    });
  }

  // Category Filter Pills
  document.querySelectorAll(".category-filter-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      document.querySelectorAll(".category-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const cat = pill.getAttribute("data-category");
      state.activeCategory = cat;
      mapEngine.setFilter(cat);
    });
  });

  // Sector Presets (Zone A, Zone B, etc.)
  renderSectorPills();

  // Quick-Jump "Take Me to Class" Destination Pills
  renderQuickJumps();

  // --- ROUTE PANEL CONTROLS ---
  const hudBanner = document.getElementById("map-hud-accessibility");
  const hudToggleBtn = document.getElementById("hud-toggle-access-btn");

  function updateAccessibilityUI(enabled) {
    state.accessibleMode = enabled;
    if (accessToggle) accessToggle.checked = enabled;
    mapEngine.setAccessibleMode(enabled);
    if (hudBanner) {
      hudBanner.classList.toggle("active-mode", enabled);
      const textSpan = hudBanner.querySelector(".hud-pill-text");
      if (textSpan) {
        textSpan.innerHTML = enabled
          ? "<strong>STEP-FREE ROUTING ACTIVE</strong> · Stairs Bypassed · Verified Ramps & Elevators"
          : "<strong>STEP-FREE ROUTING READY</strong> · Verified Ramps & Elevators · WCAG 2.1 AA";
      }
    }
  }

  if (accessToggle) {
    accessToggle.addEventListener("change", (e) => {
      updateAccessibilityUI(e.target.checked);
    });
  }

  if (hudToggleBtn) {
    hudToggleBtn.addEventListener("click", () => {
      updateAccessibilityUI(!state.accessibleMode);
    });
  }

  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const temp = startSelect.value;
      startSelect.value = endSelect.value;
      endSelect.value = temp;
      triggerRouteCalculation();
    });
  }

  if (findRouteBtn) {
    findRouteBtn.addEventListener("click", () => {
      triggerRouteCalculation();
    });
  }

  if (clearRouteBtn) {
    clearRouteBtn.addEventListener("click", () => {
      clearActiveRoute();
    });
  }

  populateRouteSelectors();

  // --- FUNCTIONS ---

  function applyUserProfile(profile) {
    if (!profile) return;

    // Update user callsign badge
    const badge = document.getElementById("user-profile-callsign");
    if (badge) {
      badge.textContent = profile.name ? `${profile.name.toUpperCase()} // ${profile.year.toUpperCase()}` : "STUDENT PILOT";
    }

    // Switch campus if different
    if (profile.campus && profile.campus !== state.campusId) {
      switchCampus(profile.campus);
    }

    // Apply accessible mode if in priorities
    if (profile.priorities && profile.priorities.includes("accessible")) {
      updateAccessibilityUI(true);
    }

    // Commuter priority: auto-fill default start point with nearest parking
    if (profile.priorities && profile.priorities.includes("commuter")) {
      const primaryParking = state.campusId === "uos" ? "p_a1" : (state.campusId === "aus" ? "aus_p16" : "rit_p1");
      if (startSelect) {
        startSelect.value = primaryParking;
      }
    }
  }

  function switchCampus(campusId) {
    if (!CAMPUS_DATA[campusId]) return;
    state.campusId = campusId;
    mapEngine.loadCampus(campusId);

    if (campusSelect) campusSelect.value = campusId;

    // Update campus subtitle
    const sub = document.getElementById("active-campus-title");
    if (sub) {
      sub.textContent = CAMPUS_DATA[campusId].fullName;
    }

    // Re-populate selectors & quick jumps
    populateRouteSelectors();
    renderQuickJumps();
    renderSectorPills();
    clearActiveRoute();
    closeBuildingDetails();
  }

  function renderSectorPills() {
    const container = document.getElementById("sector-presets-bar");
    if (!container) return;

    const sectors = mapEngine.campus.sectors || [];
    container.innerHTML = sectors.map(s => `
      <button class="sector-preset-btn ${s.id === 'all' ? 'active' : ''}" data-sector="${s.id}">
        ${s.name}
      </button>
    `).join("");

    container.querySelectorAll(".sector-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".sector-preset-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const secId = btn.getAttribute("data-sector");
        focusSector(secId);
      });
    });
  }

  function focusSector(sectorId) {
    if (sectorId === "all") {
      mapEngine.resetView();
      return;
    }
    const sec = mapEngine.campus.sectors.find(s => s.id === sectorId);
    if (!sec) return;

    // Center map on sector center
    const cx = (sec.bounds.minX + sec.bounds.maxX) / 2;
    const cy = (sec.bounds.minY + sec.bounds.maxY) / 2;

    mapEngine.zoom = 1.6;
    mapEngine.panX = (500 - cx) * 0.8;
    mapEngine.panY = (400 - cy) * 0.8;
    mapEngine.updateTransform();
  }

  function renderQuickJumps() {
    const container = document.getElementById("quick-jumps-bar");
    if (!container) return;

    const list = mapEngine.campus.quickJumps || [];
    container.innerHTML = list.map(q => `
      <button class="quick-jump-pill" data-target="${q.targetId}" data-room="${q.room || ''}">
        <span class="qj-icon">${getIconSymbol(q.icon)}</span>
        <span class="qj-label">${q.label}</span>
      </button>
    `).join("");

    container.querySelectorAll(".quick-jump-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        quickNavigateTo(targetId);
      });
    });
  }

  function quickNavigateTo(targetId) {
    if (endSelect) endSelect.value = targetId;

    // Auto-select starting point if empty
    if (startSelect && !startSelect.value) {
      const defaultStart = state.campusId === "uos" ? "p_a1" : (state.campusId === "aus" ? "aus_p16" : "rit_p1");
      startSelect.value = defaultStart;
    }

    triggerRouteCalculation();

    // Also show details drawer
    const bldg = mapEngine.campus.buildings.find(b => b.id === targetId);
    if (bldg) showBuildingDetails(bldg);
  }

  function populateRouteSelectors() {
    if (!startSelect || !endSelect) return;

    const c = mapEngine.campus;
    let bldgOptions = `<optgroup label="Academic & Campus Buildings">`;
    c.buildings.forEach(b => {
      bldgOptions += `<option value="${b.id}">${b.code}: ${b.name}</option>`;
    });
    bldgOptions += `</optgroup>`;

    let poiOptions = `<optgroup label="Parking & Campus Entrances">`;
    c.pois.forEach(p => {
      poiOptions += `<option value="${p.id}">${p.name}</option>`;
    });
    poiOptions += `</optgroup>`;

    startSelect.innerHTML = `<option value="">-- Select Departure Point --</option>` + poiOptions + bldgOptions;
    endSelect.innerHTML = `<option value="">-- Select Destination --</option>` + bldgOptions + poiOptions;

    // Set default values for demonstration
    if (state.campusId === "uos") {
      startSelect.value = "p_a1"; // Parking A-P1
      endSelect.value = "uos-a13"; // Engineering M8
    } else if (state.campusId === "aus") {
      startSelect.value = "aus_p16"; // Visitor Parking
      endSelect.value = "aus-2"; // Engineering EB1
    } else {
      startSelect.value = "rit_p1";
      endSelect.value = "rit-main";
    }
  }

  function triggerRouteCalculation() {
    const startVal = startSelect ? startSelect.value : null;
    const endVal = endSelect ? endSelect.value : null;

    if (!startVal || !endVal) {
      showSwissToast("Please select both a departure point and a destination.", "error");
      return;
    }

    if (startVal === endVal) {
      showSwissToast("Departure and destination points cannot be the same.", "error");
      return;
    }

    const route = mapEngine.findRoute(startVal, endVal);
    if (!route) {
      showSwissToast("No valid walking route found between these locations under current accessibility constraints.", "error");
    } else {
      closeMobileSidebar();
    }
  }

  function clearActiveRoute() {
    mapEngine.currentRoute = null;
    mapEngine.render();
    const sheet = document.getElementById("route-directions-sheet");
    if (sheet) sheet.style.display = "none";
  }

  function displayTurnByTurn(route) {
    const sheet = document.getElementById("route-directions-sheet");
    if (!sheet) return;

    sheet.style.display = "block";
    sheet.innerHTML = `
      <div class="sheet-header">
        <div class="sheet-title-row">
          <span class="sheet-badge">ACTIVE ROUTE</span>
          <button class="sheet-close-btn" id="btn-close-sheet" title="Close directions">✕</button>
        </div>
        <div class="route-summary-metrics">
          <div class="metric-box">
            <span class="metric-value">${route.distanceMeters}</span>
            <span class="metric-unit">METERS</span>
          </div>
          <div class="metric-box metric-accent">
            <span class="metric-value">${route.durationMinutes}</span>
            <span class="metric-unit">MINS WALK</span>
          </div>
          <div class="metric-box ${route.isAccessible ? 'metric-accessible' : ''}">
            <span class="metric-value">${route.isAccessible ? '100%' : 'STANDARD'}</span>
            <span class="metric-unit">${route.isAccessible ? 'STEP-FREE' : 'PEDESTRIAN'}</span>
          </div>
        </div>
        <div class="route-terminals">
          <div class="terminal-row">
            <span class="terminal-dot start-dot"></span>
            <span class="terminal-name">FROM: ${route.startName}</span>
          </div>
          <div class="terminal-row">
            <span class="terminal-dot end-dot"></span>
            <span class="terminal-name">TO: ${route.endName}</span>
          </div>
        </div>
      </div>

      <div class="sheet-body">
        <div class="directions-timeline" role="list">
          ${route.instructions.map((step, idx) => `
            <div class="timeline-step" role="listitem">
              <div class="step-indicator">
                <span class="step-num">0${idx + 1}</span>
                <span class="step-line"></span>
              </div>
              <div class="step-instruction-box">
                <div class="step-heading">${step.from} → ${step.to}</div>
                <div class="step-detail">${step.desc}</div>
                ${step.isShaded ? `<span class="shaded-badge">☀️ SOLAR-SHADED WALKWAY</span>` : ''}
              </div>
            </div>
          `).join("")}
          <div class="timeline-step end-step">
            <div class="step-indicator">
              <span class="step-num-end">✓</span>
            </div>
            <div class="step-instruction-box">
              <div class="step-heading">Arrive at Destination: ${route.endName}</div>
              <div class="step-detail">Enter through the verified accessible portal. Welcome!</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-close-sheet")?.addEventListener("click", () => {
      sheet.style.display = "none";
    });
  }

  function showBuildingDetails(bldg) {
    const drawer = document.getElementById("building-details-drawer");
    if (!drawer) return;

    state.currentBuilding = bldg;
    drawer.style.display = "block";
    drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-code-row">
          <span class="drawer-code-badge">${bldg.code}</span>
          <span class="drawer-zone-tag">${bldg.zone || 'CAMPUS HUB'}</span>
          <button class="drawer-close-btn" id="btn-close-drawer" title="Close Details">✕</button>
        </div>
        <h3 class="drawer-title">${bldg.name}</h3>
        ${bldg.nameAr ? `<div class="drawer-title-ar">${bldg.nameAr}</div>` : ''}
      </div>

      <div class="drawer-body">
        <!-- Action Row -->
        <div class="drawer-actions-grid">
          <button class="swiss-btn swiss-btn-accent" id="btn-drawer-nav-here">
            NAVIGATE HERE ⚡
          </button>
          <button class="swiss-btn swiss-btn-secondary" id="btn-drawer-set-start">
            SET AS DEPARTURE 📍
          </button>
        </div>

        <!-- Verified Accessibility Callout -->
        <div class="drawer-accessibility-alert ${bldg.accessible ? 'accessible-verified' : ''}">
          <span class="alert-icon">${bldg.accessible ? '♿' : '⚠️'}</span>
          <div class="alert-text">
            <strong>${bldg.accessible ? 'Verified Wheelchair & Step-Free Accessible' : 'Standard Stair Access Only'}</strong>
            <div>${bldg.accessible ? 'Equipped with ground ramp entrance and internal elevators to all lecture floors.' : 'Caution: multi-step elevation.'}</div>
          </div>
        </div>

        <!-- Departments -->
        ${bldg.departments && bldg.departments.length > 0 ? `
          <div class="drawer-section">
            <div class="section-label">COLLEGES & DEPARTMENTS</div>
            <ul class="drawer-tags-list">
              ${bldg.departments.map(d => `<li>${d}</li>`).join("")}
            </ul>
          </div>
        ` : ''}

        <!-- Rooms & Lecture Halls -->
        ${bldg.rooms && bldg.rooms.length > 0 ? `
          <div class="drawer-section">
            <div class="section-label">SEARCHABLE ROOMS & LABS</div>
            <div class="rooms-grid">
              ${bldg.rooms.map(r => `<span class="room-pill">${r}</span>`).join("")}
            </div>
          </div>
        ` : ''}

        <!-- Key Facilities -->
        ${bldg.facilities && bldg.facilities.length > 0 ? `
          <div class="drawer-section">
            <div class="section-label">FACILITIES & AMENITIES</div>
            <div class="facilities-cloud">
              ${bldg.facilities.map(f => `<span class="facility-badge">${f}</span>`).join("")}
            </div>
          </div>
        ` : ''}

        <!-- Operating Hours -->
        <div class="drawer-section">
          <div class="section-label">OPERATING HOURS</div>
          <div class="hours-text">07:30 AM — 09:00 PM (Monday – Friday)</div>
        </div>
      </div>
    `;

    document.getElementById("btn-close-drawer")?.addEventListener("click", closeBuildingDetails);

    document.getElementById("btn-drawer-nav-here")?.addEventListener("click", () => {
      closeBuildingDetails();
      if (endSelect) endSelect.value = bldg.id;
      if (startSelect && !startSelect.value) {
        const defaultStart = state.campusId === "uos" ? "p_a1" : (state.campusId === "aus" ? "aus_p16" : "rit_p1");
        startSelect.value = defaultStart;
      }
      triggerRouteCalculation();
    });

    document.getElementById("btn-drawer-set-start")?.addEventListener("click", () => {
      if (startSelect) startSelect.value = bldg.id;
      showSwissToast(`Departure set to ${bldg.name}`, "success");
    });
  }

  function closeBuildingDetails() {
    const drawer = document.getElementById("building-details-drawer");
    if (drawer) drawer.style.display = "none";
  }

  function renderSearchResults(query) {
    const c = mapEngine.campus;
    const results = [];

    // Search buildings
    c.buildings.forEach(b => {
      let score = 0;
      if (b.code.toLowerCase().includes(query)) score += 10;
      if (b.name.toLowerCase().includes(query)) score += 8;
      if (b.nameAr && b.nameAr.includes(query)) score += 8;
      if (b.departments && b.departments.some(d => d.toLowerCase().includes(query))) score += 6;
      if (b.rooms && b.rooms.some(r => r.toLowerCase().includes(query))) score += 7;
      if (b.facilities && b.facilities.some(f => f.toLowerCase().includes(query))) score += 5;

      if (score > 0) {
        results.push({ type: "building", item: b, score });
      }
    });

    // Search POIs
    c.pois.forEach(p => {
      let score = 0;
      if (p.name.toLowerCase().includes(query)) score += 8;
      if (p.code && p.code.toLowerCase().includes(query)) score += 10;
      if (score > 0) {
        results.push({ type: "poi", item: p, score });
      }
    });

    results.sort((a, b) => b.score - a.score);

    if (results.length === 0) {
      searchResults.innerHTML = `<div class="search-empty">No matching buildings, rooms, or amenities found.</div>`;
      searchResults.style.display = "block";
      return;
    }

    searchResults.innerHTML = results.slice(0, 8).map(r => {
      if (r.type === "building") {
        const b = r.item;
        return `
          <div class="search-item" data-id="${b.id}" data-type="building">
            <div class="search-item-badge">${b.code}</div>
            <div class="search-item-info">
              <div class="search-item-title">${b.name}</div>
              <div class="search-item-sub">${b.zone} · ${b.category.toUpperCase()}</div>
            </div>
            <button class="search-nav-btn" title="Navigate here">NAVIGATE →</button>
          </div>
        `;
      } else {
        const p = r.item;
        return `
          <div class="search-item" data-id="${p.id}" data-type="poi">
            <div class="search-item-badge search-poi-badge">${p.code || 'POI'}</div>
            <div class="search-item-info">
              <div class="search-item-title">${p.name}</div>
              <div class="search-item-sub">${p.type.toUpperCase()}</div>
            </div>
            <button class="search-nav-btn" title="Navigate here">NAVIGATE →</button>
          </div>
        `;
      }
    }).join("");

    searchResults.style.display = "block";

    searchResults.querySelectorAll(".search-item").forEach(itemEl => {
      itemEl.addEventListener("click", () => {
        const id = itemEl.getAttribute("data-id");
        const type = itemEl.getAttribute("data-type");
        searchResults.style.display = "none";

        if (type === "building") {
          const bldg = c.buildings.find(b => b.id === id);
          if (bldg) {
            showBuildingDetails(bldg);
            quickNavigateTo(bldg.id);
          }
        } else {
          quickNavigateTo(id);
        }
      });
    });
  }

  function getIconSymbol(type) {
    const map = {
      engineering: "⚡",
      computing: "💻",
      library: "📚",
      dining: "☕",
      admin: "🏛️",
      medical: "🩺",
      art: "📐",
      prayer: "🕌",
      business: "📈",
      event: "🎯"
    };
    return map[type] || "📍";
  }

  // Initialize Preloader
  initNaviCampusPreloader();
});

/* ==========================================================================
   Swiss Spatial Wayfinding Preloader Engine
   ========================================================================== */
function initNaviCampusPreloader() {
  const preloader = document.getElementById("navicampus-preloader");
  if (!preloader) return;

  let hidden = false;
  const hidePreloader = () => {
    if (hidden) return;
    hidden = true;
    preloader.classList.add("fade-out");
    setTimeout(() => {
      preloader.style.display = "none";
    }, 500);
  };

  if (document.readyState === "complete") {
    setTimeout(hidePreloader, 400);
  } else {
    window.addEventListener("load", () => setTimeout(hidePreloader, 400));
  }

  // Safety fallback after 1.5s
  setTimeout(hidePreloader, 1500);
}

