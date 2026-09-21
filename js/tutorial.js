/**
 * NaviCampus UAE — Interactive Tutorial Walkthrough Controller
 * Architecture: Swiss Minimalist Guided Spatial Tour
 * Fully responsive across Desktop, Tablet, and Mobile devices.
 */

class NaviCampusTutorial {
  constructor(options = {}) {
    this.options = Object.assign({
      autoPromptDelay: 1800,
      storageKey: "navicampus_tutorial_completed"
    }, options);

    this.currentStepIndex = 0;
    this.isActive = false;

    // Elements
    this.backdropEl = null;
    this.spotlightEl = null;
    this.cardEl = null;
    this.inviteChipEl = null;

    // Bind event handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.steps = [
      {
        id: "campus_selector",
        getTarget: () => document.getElementById("campus-select")?.parentElement || document.querySelector(".header-left"),
        stepNum: "01",
        featureTag: "TRI-CAMPUS // GCC SCALABLE",
        title: "Tri-Campus Unified Masterplan",
        description: "NaviCampus bridges Sharjah and Dubai university ecosystems. Seamlessly switch between University of Sharjah (Main & Medical), American University of Sharjah (AUS), and RIT Dubai Silicon Oasis with zero page reloads.",
        position: "bottom"
      },
      {
        id: "global_search",
        getTarget: () => document.getElementById("global-search")?.parentElement || document.getElementById("global-search"),
        stepNum: "02",
        featureTag: "OMNIBOX SEARCH",
        title: "Global Room & Facility Omnibox",
        description: "Search any classroom (e.g. M8-102, W9-204), engineering lab, academic department, central library, prayer musalla, or student dining hall for instant sub-millisecond coordinates.",
        position: "bottom"
      },
      {
        id: "wayfinding_engine",
        getTarget: () => {
          return document.querySelector(".route-planner-card") || document.getElementById("spatial-sidebar");
        },
        stepNum: "03",
        featureTag: "DIJKSTRA v2.4",
        title: "A-to-B Autonomous Pathfinding",
        description: "Select your start and destination terminals to run real-time Dijkstra graph pathfinding. The engine calculates the shortest outdoor and indoor corridor path with live distance, travel time, and turn-by-turn vectors.",
        position: "right",
        onEnter: () => {
          if (window.innerWidth <= 1024) {
            const sidebar = document.getElementById("spatial-sidebar");
            const backdrop = document.getElementById("sidebar-backdrop");
            if (sidebar) sidebar.classList.add("mobile-open");
            if (backdrop) backdrop.classList.add("active");
          }
        },
        onLeave: (nextIndex) => {
          if (window.innerWidth <= 1024 && nextIndex !== 3) {
            const sidebar = document.getElementById("spatial-sidebar");
            const backdrop = document.getElementById("sidebar-backdrop");
            if (sidebar) sidebar.classList.remove("mobile-open");
            if (backdrop) backdrop.classList.remove("active");
          }
        }
      },
      {
        id: "step_free_access",
        getTarget: () => {
          if (window.innerWidth <= 1024) {
            return document.querySelector('.switch-label[for="step-free-toggle"]') || document.getElementById("step-free-toggle");
          }
          return document.getElementById("map-hud-accessibility") || document.querySelector('.switch-label[for="step-free-toggle"]');
        },
        stepNum: "04",
        featureTag: "WCAG 2.1 AA COMPLIANT",
        title: "Step-Free Accessibility Routing",
        description: "Toggle Step-Free navigation for wheelchair, trolley, or injured-student transit. The pathfinding engine dynamically bypasses staircases, prioritizing ramps, grade-level breezeways, and elevator cores.",
        position: "bottom",
        onEnter: () => {
          if (window.innerWidth <= 1024) {
            const sidebar = document.getElementById("spatial-sidebar");
            const backdrop = document.getElementById("sidebar-backdrop");
            if (sidebar) sidebar.classList.add("mobile-open");
            if (backdrop) backdrop.classList.add("active");
          }
        },
        onLeave: (nextIndex) => {
          if (window.innerWidth <= 1024 && nextIndex !== 2) {
            const sidebar = document.getElementById("spatial-sidebar");
            const backdrop = document.getElementById("sidebar-backdrop");
            if (sidebar) sidebar.classList.remove("mobile-open");
            if (backdrop) backdrop.classList.remove("active");
          }
        }
      },
      {
        id: "cad_masterplan",
        getTarget: () => document.getElementById("map-container"),
        stepNum: "05",
        featureTag: "VECTOR CAD MASTERPLAN",
        title: "Architectural CAD Inspection",
        description: "Pan, zoom, and click any building block on the vector campus grid. Selecting a building reveals multi-floor classroom directories, accessible entrance ramps, and live operating hours.",
        position: "center"
      },
      {
        id: "safety_infrastructure",
        getTarget: () => {
          if (window.innerWidth <= 1024) {
            return document.getElementById("mb-btn-layers") || document.querySelector(".category-pills-row");
          }
          return document.querySelector(".category-pills-row") || document.getElementById("spatial-sidebar");
        },
        stepNum: "06",
        featureTag: "24/7 SAFETY // UAE CLIMATE",
        title: "Emergency Blue-Lights & Shaded Paths",
        description: "Filter campus layers to immediately locate 24/7 emergency blue-light callboxes, automated external defibrillators (AEDs), and shaded thermal walkways engineered for hot UAE mid-day commutes.",
        position: "right"
      }
    ];

    this.init();
  }

  init() {
    this.createDOMElements();
    this.bindGlobalTriggers();

    // Check if tutorial has been completed
    const completed = localStorage.getItem(this.options.storageKey);
    if (!completed) {
      setTimeout(() => {
        this.showInviteChip();
      }, this.options.autoPromptDelay);
    }
  }

  createDOMElements() {
    // 1. Overlay Backdrop
    let backdrop = document.getElementById("tour-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "tour-backdrop";
      backdrop.className = "tour-backdrop";
      backdrop.innerHTML = `
        <div id="tour-spotlight-frame" class="tour-spotlight-frame"></div>
      `;
      document.body.appendChild(backdrop);
    }
    this.backdropEl = backdrop;
    this.spotlightEl = document.getElementById("tour-spotlight-frame");

    // Click backdrop to dismiss or advance
    this.backdropEl.addEventListener("click", (e) => {
      if (e.target === this.backdropEl) {
        this.dismiss();
      }
    });

    // 2. Tutorial Card
    let card = document.getElementById("tour-card");
    if (!card) {
      card = document.createElement("div");
      card.id = "tour-card";
      card.className = "tour-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      card.setAttribute("aria-label", "NaviCampus Tutorial Guide");
      document.body.appendChild(card);
    }
    this.cardEl = card;

    // 3. First Visit Invite Chip
    let chip = document.getElementById("tour-invite-chip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "tour-invite-chip";
      chip.className = "tour-invite-chip";
      chip.innerHTML = `
        <span class="chip-pulse" aria-hidden="true"></span>
        <span class="chip-text">New to NaviCampus?</span>
        <span class="chip-action">Take 60s Tour 🧭</span>
        <button class="chip-dismiss" id="btn-dismiss-tour-chip" aria-label="Dismiss tour prompt">✕</button>
      `;
      document.body.appendChild(chip);

      chip.addEventListener("click", (e) => {
        if (e.target.id === "btn-dismiss-tour-chip" || e.target.classList.contains("chip-dismiss")) {
          e.stopPropagation();
          this.hideInviteChip();
          localStorage.setItem(this.options.storageKey, "dismissed");
          return;
        }
        this.hideInviteChip();
        this.start();
      });
    }
    this.inviteChipEl = chip;
  }

  bindGlobalTriggers() {
    // Header trigger button
    const headerBtn = document.getElementById("btn-start-tutorial");
    if (headerBtn) {
      headerBtn.addEventListener("click", () => {
        this.start();
      });
    }

    // Window listeners
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  showInviteChip() {
    if (this.inviteChipEl && !this.isActive) {
      this.inviteChipEl.classList.add("active");
    }
  }

  hideInviteChip() {
    if (this.inviteChipEl) {
      this.inviteChipEl.classList.remove("active");
    }
  }

  start(stepIndex = 0) {
    this.hideInviteChip();
    this.isActive = true;
    this.currentStepIndex = Math.max(0, Math.min(stepIndex, this.steps.length - 1));
    this.backdropEl.classList.add("active");
    this.renderStep();
  }

  next() {
    const current = this.steps[this.currentStepIndex];
    const targetIdx = this.currentStepIndex + 1;
    if (current && typeof current.onLeave === "function") {
      current.onLeave(targetIdx);
    }

    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.renderStep();
    } else {
      this.finish();
    }
  }

  prev() {
    const current = this.steps[this.currentStepIndex];
    const targetIdx = this.currentStepIndex - 1;
    if (current && typeof current.onLeave === "function") {
      current.onLeave(targetIdx);
    }

    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.renderStep();
    }
  }

  goTo(index) {
    const current = this.steps[this.currentStepIndex];
    if (current && typeof current.onLeave === "function") {
      current.onLeave(index);
    }

    this.currentStepIndex = Math.max(0, Math.min(index, this.steps.length - 1));
    this.renderStep();
  }

  dismiss() {
    const current = this.steps[this.currentStepIndex];
    if (current && typeof current.onLeave === "function") {
      current.onLeave(-1);
    }

    if (window.innerWidth <= 1024) {
      const sidebar = document.getElementById("spatial-sidebar");
      const backdrop = document.getElementById("sidebar-backdrop");
      if (sidebar) sidebar.classList.remove("mobile-open");
      if (backdrop) backdrop.classList.remove("active");
    }

    this.isActive = false;
    this.backdropEl.classList.remove("active");
    this.cardEl.classList.remove("visible");
    localStorage.setItem(this.options.storageKey, "completed");
  }

  finish() {
    this.dismiss();
    if (typeof showSwissToast === "function") {
      showSwissToast("Tour complete! Explore UAE campuses anytime.", "info");
    }
  }

  renderStep() {
    const step = this.steps[this.currentStepIndex];
    if (!step) return;

    if (typeof step.onEnter === "function") {
      step.onEnter();
    }

    // Build Progress Dots HTML
    const dotsHtml = this.steps.map((s, idx) => {
      let stateClass = "";
      if (idx === this.currentStepIndex) stateClass = "active";
      else if (idx < this.currentStepIndex) stateClass = "completed";
      return `<div class="tour-dot ${stateClass}" data-step="${idx}" title="Step ${idx + 1}: ${s.title}"></div>`;
    }).join("");

    const isLast = this.currentStepIndex === this.steps.length - 1;
    const isFirst = this.currentStepIndex === 0;

    // Render Card Content
    this.cardEl.innerHTML = `
      <div class="tour-card-header">
        <div class="tour-badge-cluster">
          <span class="tour-swiss-cross">+</span>
          <span class="tour-step-counter">STEP ${step.stepNum} // 0${this.steps.length}</span>
          <span class="tour-feature-tag">${step.featureTag}</span>
        </div>
        <button class="tour-close-btn" id="btn-tour-close" title="Exit Tour (Esc)" aria-label="Exit Tour">✕</button>
      </div>

      <h3 class="tour-card-title">${step.title}</h3>
      <p class="tour-card-body">${step.description}</p>

      <div class="tour-card-footer">
        <div class="tour-dots">
          ${dotsHtml}
        </div>

        <div class="tour-nav-buttons">
          ${!isFirst ? `<button class="tour-btn tour-btn-prev" id="btn-tour-prev">← Prev</button>` : ''}
          <button class="tour-btn tour-btn-next" id="btn-tour-next">
            ${isLast ? 'Finish ✦' : 'Next →'}
          </button>
        </div>
      </div>

      <div style="margin-top: 0.65rem; display: flex; justify-content: flex-end;">
        <span class="tour-kb-hint">
          <span>Navigate with</span>
          <kbd>←</kbd> <kbd>→</kbd> <kbd>Esc</kbd>
        </span>
      </div>
    `;

    // Bind card internal events
    this.cardEl.querySelector("#btn-tour-close")?.addEventListener("click", () => this.dismiss());
    this.cardEl.querySelector("#btn-tour-next")?.addEventListener("click", () => this.next());
    this.cardEl.querySelector("#btn-tour-prev")?.addEventListener("click", () => this.prev());

    this.cardEl.querySelectorAll(".tour-dot").forEach(dot => {
      dot.addEventListener("click", (e) => {
        const stepIdx = parseInt(e.currentTarget.getAttribute("data-step"), 10);
        if (!isNaN(stepIdx)) this.goTo(stepIdx);
      });
    });

    // Position Spotlight & Card
    this.positionElements(step);
  }

  positionElements(step) {
    const targetEl = step.getTarget();
    const isMobile = window.innerWidth <= 1024;

    if (targetEl && targetEl.nodeType === Node.ELEMENT_NODE) {
      const rect = targetEl.getBoundingClientRect();
      const padding = 6;

      // Scroll element into view smoothly if needed (only if outside viewport)
      const inView = rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
      if (!inView && step.position !== "center") {
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }

      // Re-read rect after potential adjustment
      const updatedRect = targetEl.getBoundingClientRect();

      // Spotlight Box
      this.spotlightEl.style.display = "block";
      this.spotlightEl.style.top = `${Math.max(0, updatedRect.top - padding)}px`;
      this.spotlightEl.style.left = `${Math.max(0, updatedRect.left - padding)}px`;
      this.spotlightEl.style.width = `${Math.min(window.innerWidth, updatedRect.width + padding * 2)}px`;
      this.spotlightEl.style.height = `${Math.min(window.innerHeight, updatedRect.height + padding * 2)}px`;

      // Position Card on Mobile vs Desktop
      if (isMobile) {
        const targetCenterY = updatedRect.top + (updatedRect.height / 2);
        if (targetCenterY > (window.innerHeight * 0.52)) {
          this.cardEl.classList.add("dock-top");
        } else {
          this.cardEl.classList.remove("dock-top");
        }
      } else {
        this.cardEl.classList.remove("dock-top");
        this.positionCardDesktop(updatedRect, step.position);
      }
    } else {
      // Fallback if target not found: center spotlight
      this.spotlightEl.style.display = "none";
      if (!isMobile) {
        this.cardEl.style.top = "50%";
        this.cardEl.style.left = "50%";
        this.cardEl.style.transform = "translate(-50%, -50%)";
      }
    }

    this.cardEl.classList.add("visible");
  }

  positionCardDesktop(targetRect, preferredPosition) {
    const cardWidth = 420;
    const cardHeight = 240;
    const margin = 20;

    let top = 0;
    let left = 0;

    if (preferredPosition === "bottom") {
      top = targetRect.bottom + margin;
      left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
    } else if (preferredPosition === "right") {
      top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
      left = targetRect.right + margin;
    } else if (preferredPosition === "left") {
      top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
      left = targetRect.left - cardWidth - margin;
    } else if (preferredPosition === "center") {
      top = (window.innerHeight - cardHeight) / 2;
      left = (window.innerWidth - cardWidth) / 2;
    } else {
      top = targetRect.bottom + margin;
      left = targetRect.left;
    }

    // Viewport Boundary Clamping
    left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - cardHeight - 16));

    this.cardEl.style.top = `${top}px`;
    this.cardEl.style.left = `${left}px`;
    this.cardEl.style.bottom = "auto";
    this.cardEl.style.right = "auto";
    this.cardEl.style.transform = "translateY(0)";
  }

  handleResize() {
    if (!this.isActive) return;
    const step = this.steps[this.currentStepIndex];
    if (step) {
      this.positionElements(step);
    }
  }

  handleKeyDown(e) {
    if (!this.isActive) return;

    if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
      e.preventDefault();
      this.next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.prev();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.dismiss();
    }
  }
}

// Attach globally
window.NaviCampusTutorial = NaviCampusTutorial;
