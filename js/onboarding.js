/**
 * NaviCampus UAE - Intelligent Student Onboarding Wizard
 * Captures:
 * 1. Student Identity & Campus Selection (UoS, AUS, RIT Dubai)
 * 2. Academic Level & College (Engineering, Computing, Business, etc.)
 * 3. Spatial Priorities (Commuter/Driver, Quiet Study, Prayer, Food, Step-Free Access)
 * 
 * Persists to localStorage ('navicampus_profile') and customizes the map experience.
 */

class OnboardingWizard {
  constructor(options = {}) {
    this.options = Object.assign({
      onComplete: null
    }, options);

    this.profile = this.loadProfile() || {
      name: "",
      campus: "uos",
      year: "Freshman",
      college: "engineering",
      priorities: ["commuter", "study"],
      completed: false
    };

    this.currentStep = 1;
    this.totalSteps = 3;
    this.modalEl = null;

    this.init();
  }

  loadProfile() {
    try {
      const data = localStorage.getItem("navicampus_profile");
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveProfile() {
    try {
      this.profile.completed = true;
      localStorage.setItem("navicampus_profile", JSON.stringify(this.profile));
    } catch (e) {
      console.warn("Failed to save profile to localStorage", e);
    }
  }

  init() {
    // Check if modal container exists
    let modal = document.getElementById("onboarding-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "onboarding-modal";
      modal.className = "onboarding-backdrop";
      document.body.appendChild(modal);
    }
    this.modalEl = modal;

    // Render modal
    this.render();

    // Auto-open if first time
    if (!this.profile.completed) {
      this.open();
    } else {
      this.close();
    }
  }

  open(step = 1) {
    this.currentStep = step;
    this.render();
    this.modalEl.classList.add("active");
    this.modalEl.style.display = "flex";
  }

  close() {
    this.modalEl.classList.remove("active");
    this.modalEl.style.display = "none";
  }

  render() {
    const p = this.profile;
    const s = this.currentStep;

    this.modalEl.innerHTML = `
      <div class="onboarding-dialog" role="dialog" aria-labelledby="wizard-title" aria-modal="true">
        <!-- Swiss Header Bar -->
        <div class="onboarding-top-bar">
          <div class="onboarding-brand">
            <span class="swiss-cross">+</span>
            <span class="brand-text">NAVICAMPUS UAE</span>
            <span class="brand-tag">ONBOARDING // STEP 0${s}_0${this.totalSteps}</span>
          </div>
          <button class="onboarding-close-btn" id="wizard-close-btn" title="Skip to Map" aria-label="Skip to Map">
            ✕
          </button>
        </div>

        <!-- Progress Tracker Line -->
        <div class="wizard-progress-track">
          <div class="wizard-progress-bar" style="width: ${(s / this.totalSteps) * 100}%"></div>
        </div>

        <!-- Wizard Body Content -->
        <div class="onboarding-content">
          ${this.renderStepContent(s, p)}
        </div>

        <!-- Wizard Action Bar -->
        <div class="onboarding-action-bar">
          ${s > 1 ? `
            <button class="swiss-btn swiss-btn-secondary" id="wizard-prev-btn">
              ← PREVIOUS
            </button>
          ` : `<div></div>`}
          
          <div class="wizard-action-right">
            ${s < this.totalSteps ? `
              <button class="swiss-btn swiss-btn-primary" id="wizard-next-btn">
                CONTINUE →
              </button>
            ` : `
              <button class="swiss-btn swiss-btn-accent" id="wizard-finish-btn">
                INITIALIZE COMMAND CENTER ⚡
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderStepContent(step, p) {
    if (step === 1) {
      return `
        <div class="step-pane">
          <div class="step-meta">01 / IDENTITY & CAMPUS</div>
          <h2 id="wizard-title" class="step-title">Welcome to NaviCampus UAE.</h2>
          <p class="step-description">Personalize your high-precision campus wayfinding and spatial navigation experience.</p>

          <div class="form-group">
            <label class="form-label" for="student-name-input">STUDENT NAME / CALLSIGN</label>
            <input type="text" id="student-name-input" class="form-input" 
                   placeholder="e.g. Yassin Ragab" value="${p.name || ''}" aria-label="Student name or callsign" autofocus />
          </div>

          <div class="form-group">
            <div class="form-label">SELECT YOUR UAE CAMPUS</div>
            <div class="campus-selector-grid">
              <label class="campus-card ${p.campus === 'uos' ? 'selected' : ''}">
                <input type="radio" name="campus-select" aria-label="University of Sharjah (UoS)" value="uos" ${p.campus === 'uos' ? 'checked' : ''} />
                <div class="campus-card-content">
                  <div class="campus-card-name">University of Sharjah (UoS)</div>
                  <div class="campus-card-desc">Main Campus (Zone A, B, C) & Medical City (Zone E)</div>
                  <div class="campus-card-location">📍 University City, Sharjah</div>
                </div>
              </label>

              <label class="campus-card ${p.campus === 'aus' ? 'selected' : ''}">
                <input type="radio" name="campus-select" aria-label="American University of Sharjah (AUS)" value="aus" ${p.campus === 'aus' ? 'checked' : ''} />
                <div class="campus-card-content">
                  <div class="campus-card-name">American University of Sharjah (AUS)</div>
                  <div class="campus-card-desc">Main Rotunda Plaza, Engineering Wing, CAAD & Student Center</div>
                  <div class="campus-card-location">📍 University City, Sharjah</div>
                </div>
              </label>

              <label class="campus-card ${p.campus === 'rit' ? 'selected' : ''}">
                <input type="radio" name="campus-select" aria-label="RIT Dubai" value="rit" ${p.campus === 'rit' ? 'checked' : ''} />
                <div class="campus-card-content">
                  <div class="campus-card-name">RIT Dubai</div>
                  <div class="campus-card-desc">Innovation & Robotics Hub, Solar Atrium, Silicon Eatery</div>
                  <div class="campus-card-location">📍 Dubai Silicon Oasis (DSO)</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      `;
    } else if (step === 2) {
      return `
        <div class="step-pane">
          <div class="step-meta">02 / ACADEMIC PROFILE</div>
          <h2 id="wizard-title" class="step-title">What is your academic focus?</h2>
          <p class="step-description">We will automatically highlight your college buildings, lecture halls, and department facilities on the map.</p>

          <div class="form-group">
            <div class="form-label">ACADEMIC LEVEL</div>
            <div class="pills-selector" id="year-selector">
              ${["Freshman", "Sophomore", "Junior", "Senior", "Graduate / Faculty"].map(y => `
                <button type="button" class="select-pill ${p.year === y ? 'active' : ''}" data-value="${y}">
                  ${y}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="form-group">
            <div class="form-label">COLLEGE / FACULTY</div>
            <div class="college-grid">
              ${[
                { id: "engineering", label: "College of Engineering", icon: "⚡", code: "ENG (M8/M9/EB1)" },
                { id: "computing", label: "Computing & Informatics", icon: "💻", code: "CCI / AI Lab" },
                { id: "business", label: "Business Administration", icon: "📈", code: "CBA / SBA" },
                { id: "sciences", label: "College of Sciences", icon: "🔬", code: "PHYS / CHEM / BIO" },
                { id: "medical", label: "Medicine & Health Sciences", icon: "🩺", code: "MED / PHARM / DENT" },
                { id: "art", label: "Architecture & Design", icon: "📐", code: "CAAD / Interior" }
              ].map(c => `
                <label class="college-card ${p.college === c.id ? 'selected' : ''}">
                  <input type="radio" name="college-select" aria-label="${c.label}" value="${c.id}" ${p.college === c.id ? 'checked' : ''} />
                  <div class="college-card-inner">
                    <span class="college-icon">${c.icon}</span>
                    <div class="college-info">
                      <div class="college-name">${c.label}</div>
                      <div class="college-code">${c.code}</div>
                    </div>
                  </div>
                </label>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    } else if (step === 3) {
      return `
        <div class="step-pane">
          <div class="step-meta">03 / SPATIAL & LIFESTYLE PRIORITIES</div>
          <h2 id="wizard-title" class="step-title">Customize your navigation map.</h2>
          <p class="step-description">Select the spatial layers and accessibility options most relevant to your daily routine.</p>

          <div class="priorities-grid">
            ${[
              {
                id: "commuter",
                title: "Commuter / Driver Quick Access",
                desc: "Emphasize parking gates (A-P1, C-P1, P16), shade-covered walks, and shortest building entrance portals.",
                icon: "🚗"
              },
              {
                id: "study",
                title: "Quiet Study & Library Pods",
                desc: "Surface silent study floors, private carrels, and digital workstations in library sectors.",
                icon: "📚"
              },
              {
                id: "prayer",
                title: "Prayer Quick Access (Musalla / Mosque)",
                desc: "Provide 1-click compass routes to nearest men's & women's prayer halls with ablution details.",
                icon: "🕌"
              },
              {
                id: "dining",
                title: "Cafes & Dining Spots",
                desc: "Highlight cafeterias, Starbucks/Costa kiosks, and student center food courts.",
                icon: "☕"
              },
              {
                id: "accessible",
                title: "Step-Free / Accessible Routing (Ramps & Elevators)",
                desc: "Dijkstra routing strictly avoids stairs and calculates level-grade wheelchair paths.",
                icon: "♿"
              }
            ].map(item => {
              const isChecked = p.priorities.includes(item.id);
              return `
                <label class="priority-card ${isChecked ? 'selected' : ''}">
                  <input type="checkbox" name="priority-check" aria-label="${item.title}" value="${item.id}" ${isChecked ? 'checked' : ''} />
                  <div class="priority-card-inner">
                    <div class="priority-icon">${item.icon}</div>
                    <div class="priority-details">
                      <div class="priority-title">${item.title}</div>
                      <div class="priority-desc">${item.desc}</div>
                    </div>
                    <div class="priority-check-box">
                      <span class="check-mark">${isChecked ? '✓' : ''}</span>
                    </div>
                  </div>
                </label>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }
  }

  bindEvents() {
    const s = this.currentStep;

    // Close / Skip
    document.getElementById("wizard-close-btn")?.addEventListener("click", () => {
      this.close();
      this.notifyComplete();
    });

    // Inputs Step 1
    if (s === 1) {
      const nameInput = document.getElementById("student-name-input");
      if (nameInput) {
        nameInput.addEventListener("input", (e) => {
          this.profile.name = e.target.value.trim();
        });
      }

      this.modalEl.querySelectorAll('input[name="campus-select"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
          this.profile.campus = e.target.value;
          this.render();
        });
      });
    }

    // Inputs Step 2
    if (s === 2) {
      this.modalEl.querySelectorAll("#year-selector .select-pill").forEach(btn => {
        btn.addEventListener("click", (e) => {
          this.profile.year = e.target.getAttribute("data-value");
          this.render();
        });
      });

      this.modalEl.querySelectorAll('input[name="college-select"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
          this.profile.college = e.target.value;
          this.render();
        });
      });
    }

    // Inputs Step 3
    if (s === 3) {
      this.modalEl.querySelectorAll('input[name="priority-check"]').forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
          const val = e.target.value;
          if (e.target.checked) {
            if (!this.profile.priorities.includes(val)) this.profile.priorities.push(val);
          } else {
            this.profile.priorities = this.profile.priorities.filter(x => x !== val);
          }
          this.render();
        });
      });
    }

    // Navigation buttons
    document.getElementById("wizard-prev-btn")?.addEventListener("click", () => {
      if (this.currentStep > 1) {
        this.currentStep--;
        this.render();
      }
    });

    document.getElementById("wizard-next-btn")?.addEventListener("click", () => {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
        this.render();
      }
    });

    document.getElementById("wizard-finish-btn")?.addEventListener("click", () => {
      this.saveProfile();
      this.close();
      this.notifyComplete();
    });
  }

  notifyComplete() {
    if (typeof this.options.onComplete === "function") {
      this.options.onComplete(this.profile);
    }
    const event = new CustomEvent("navicampus:profile_ready", { detail: this.profile });
    window.dispatchEvent(event);
  }
}

if (typeof window !== "undefined") {
  window.OnboardingWizard = OnboardingWizard;
}
