/**
 * NaviCampus UAE - High-Precision Vector Map Engine
 * Implements:
 * 1. Dijkstra Shortest-Path Algorithm with Step-Free / Wheelchair Accessibility Mode
 * 2. Interactive SVG Map Rendering with Swiss Architectural Styling
 * 3. Pan, Zoom, Pinch, and Sector-Focus Matrix Transforms
 * 4. Animated Vector Polyline Routing & Turn-by-Turn Wayfinding
 */

class MapEngine {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Map container #${containerId} not found`);
    }

    this.options = Object.assign({
      onBuildingSelect: null,
      onRouteCalculated: null,
      onBuildingHover: null,
      accessibleOnly: false
    }, options);

    this.currentCampusId = "uos";
    this.campus = CAMPUS_DATA.uos;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.selectedBuilding = null;
    this.currentRoute = null;
    this.activeFilter = "all";
    this.accessibleOnly = this.options.accessibleOnly || false;

    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="map-viewport" id="map-viewport" role="region" aria-label="Campus Interactive Map">
        <svg id="campus-svg" class="campus-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        <div class="map-controls" aria-label="Map Zoom and Navigation Controls">
          <button class="map-ctrl-btn" id="btn-zoom-in" title="Zoom In (Ctrl + +)" aria-label="Zoom In">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button class="map-ctrl-btn" id="btn-zoom-out" title="Zoom Out (Ctrl + -)" aria-label="Zoom Out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button class="map-ctrl-btn" id="btn-reset-view" title="Reset View" aria-label="Reset View">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
          </button>
          <div class="map-ctrl-divider"></div>
          <button class="map-ctrl-btn" id="btn-toggle-access" title="Toggle Step-Free / Wheelchair Accessible Route" aria-label="Toggle Step-Free Route">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="4" r="2"></circle><path d="m5 11 4-2 3 5 4-2"></path><path d="M12 14v4"></path><path d="M9 19a4 4 0 1 0 8 0"></path></svg>
          </button>
        </div>
        <div class="map-tooltip" id="map-tooltip" style="display: none;" role="tooltip"></div>
      </div>
    `;

    this.viewport = document.getElementById("map-viewport");
    this.svg = document.getElementById("campus-svg");
    this.tooltip = document.getElementById("map-tooltip");

    this.bindEvents();
    this.loadCampus("uos");
  }

  loadCampus(campusId) {
    if (!CAMPUS_DATA[campusId]) return;
    this.currentCampusId = campusId;
    this.campus = CAMPUS_DATA[campusId];
    this.selectedBuilding = null;
    this.currentRoute = null;

    this.resetView();
    this.render();
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  setAccessibleMode(enabled) {
    this.accessibleOnly = !!enabled;
    const btn = document.getElementById("btn-toggle-access");
    if (btn) {
      btn.classList.toggle("active", this.accessibleOnly);
    }
    // Re-calculate route if one exists
    if (this.currentRoute && this.currentRoute.startId && this.currentRoute.endId) {
      this.findRoute(this.currentRoute.startId, this.currentRoute.endId);
    }
  }

  setFilter(category) {
    this.activeFilter = category;
    this.render();
  }

  // --- RENDERING PIPELINE ---
  render() {
    const c = this.campus;
    this.svg.setAttribute("viewBox", c.viewBox);

    let html = `
      <defs>
        <!-- Swiss Architectural CAD Grid -->
        <pattern id="arch-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" stroke-width="0.75"/>
          <circle cx="0" cy="0" r="1.5" fill="#D1D5DB"/>
        </pattern>
        <pattern id="arch-grid-dense" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F3F4F6" stroke-width="0.5"/>
        </pattern>

        <!-- Solar-Shaded Walkway Pergola Pattern (Diagonal Slats) -->
        <pattern id="pergola-slats" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#94A3B8" stroke-width="2.5" />
        </pattern>

        <!-- Glass Atrium Skylight Pattern -->
        <pattern id="glass-atrium" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#F0F9FF" />
          <path d="M 0 12 L 12 0 M 6 12 L 12 6 M 0 6 L 6 0" fill="none" stroke="#BAE6FD" stroke-width="1"/>
        </pattern>

        <!-- 2.5D Architectural Building Shadows -->
        <filter id="building-shadow" x="-8%" y="-8%" width="120%" height="125%">
          <feDropShadow dx="3" dy="6" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.14"/>
        </filter>
        <filter id="building-select-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#DC2626" flood-opacity="0.6"/>
        </filter>
        <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <!-- Marker definitions -->
        <marker id="route-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#DC2626"/>
        </marker>
      </defs>

      <!-- Background Canvas Ground Plane -->
      <rect width="100%" height="100%" fill="#F8FAFC"/>
      <rect width="100%" height="100%" fill="url(#arch-grid)"/>

      <!-- GIS Landscaping, Green Quads & Boulevards Layer -->
      <g id="landscaping-layer" class="landscaping-layer">
        ${this.renderLandscaping()}
      </g>

      <!-- Campus Zones / Sectors -->
      <g id="zones-layer" class="zones-layer">
        ${this.renderZoneLabels()}
      </g>

      <!-- Walkways and Pedestrian Corridors Layer -->
      <g id="pathways-layer" class="pathways-layer">
        ${this.renderWalkways()}
      </g>

      <!-- Architectural Buildings Layer -->
      <g id="buildings-layer" class="buildings-layer">
        ${this.renderBuildings()}
      </g>

      <!-- POI Markers Layer -->
      <g id="pois-layer" class="pois-layer">
        ${this.renderPOIs()}
      </g>

      <!-- Dynamic Active Route Layer -->
      <g id="route-layer" class="route-layer">
        ${this.renderActiveRoute()}
      </g>
    `;

    this.svg.innerHTML = html;
    this.bindSvgInteractions();
  }

  renderLandscaping() {
    const id = this.campus.id;
    let out = "";

    if (id === "rit") {
      out += `
        <!-- RIT Dubai Campus Parkland & Courtyards -->
        <rect x="220" y="160" width="580" height="420" rx="36" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="2"/>
        <!-- Central Innovation Palm Plaza -->
        <circle cx="500" cy="350" r="130" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.5" stroke-dasharray="4 4"/>
        <circle cx="500" cy="350" r="62" fill="#E0F2FE" stroke="#BAE6FD" stroke-width="1" opacity="0.6"/>
        <!-- Access Boulevard North -->
        <path d="M 490 20 L 490 140" stroke="#E2E8F0" stroke-width="24" stroke-linecap="round"/>
        <path d="M 490 20 L 490 140" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="6 6"/>
        <!-- South Promenade & Ring Road -->
        <path d="M 180 630 L 820 630" stroke="#E2E8F0" stroke-width="18" stroke-linecap="round"/>
      `;
    } else if (id === "uos") {
      out += `
        <!-- University of Sharjah Linear Grand Spine -->
        <rect x="460" y="80" width="80" height="1440" rx="20" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="2"/>
        <!-- Zone A Quad Gardens -->
        <rect x="330" y="340" width="160" height="110" rx="16" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.5"/>
        <!-- Zone B Chancellor's Grand Reflecting Basin -->
        <rect x="410" y="660" width="180" height="50" rx="10" fill="#E0F2FE" stroke="#7DD3FC" stroke-width="2"/>
        <circle cx="500" cy="685" r="14" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1.5"/>
        <!-- Zone C Women's Quad Gardens -->
        <rect x="330" y="880" width="160" height="110" rx="16" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.5"/>
        <!-- Zone E Medical Green Plaza -->
        <rect x="340" y="1320" width="160" height="90" rx="16" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.5"/>
      `;
    } else if (id === "aus") {
      out += `
        <!-- AUS Grand Central Quadrangle Lawn -->
        <rect x="430" y="270" width="340" height="230" rx="24" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="2"/>
        <!-- Iconic AUS Central Ornamental Fountain -->
        <circle cx="600" cy="385" r="34" fill="#E0F2FE" stroke="#38BDF8" stroke-width="2.5"/>
        <circle cx="600" cy="385" r="18" fill="#BAE6FD" stroke="#0284C7" stroke-width="1.5"/>
        <circle cx="600" cy="385" r="5" fill="#0284C7"/>
        <!-- Western Engineering Quad Lawn -->
        <rect x="160" y="280" width="180" height="140" rx="16" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.5"/>
        <!-- Eastern CAAD Design Lawn -->
        <rect x="740" y="440" width="180" height="140" rx="16" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.5"/>
      `;
    }

    return out;
  }

  renderWalkways() {
    const nodes = this.campus.graph.nodes;
    const edges = this.campus.graph.edges;
    let paths = "";

    edges.forEach(edge => {
      const [fromId, toId, dist, isAccessible, isShaded] = edge;
      const n1 = nodes[fromId];
      const n2 = nodes[toId];
      if (!n1 || !n2) return;

      if (isShaded) {
        // High-Comfort Climate-Resilient Covered Colonnade / Arcade
        paths += `
          <!-- Shaded Arcade Base Ambient Bed -->
          <line x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}" 
                stroke="#E2E8F0" stroke-width="10" stroke-linecap="round" />
          <!-- Shaded Solar Canopy Slats -->
          <line x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}" 
                stroke="#CBD5E1" stroke-width="8" stroke-linecap="round"
                class="walkway-line walkway-shaded" />
          <!-- Protected Center Walkway -->
          <line x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}" 
                stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" />
        `;
      } else {
        // Direct Outdoor Pedestrian Path
        paths += `
          <line x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}" 
                stroke="#E2E8F0" stroke-width="5" stroke-linecap="round"
                class="walkway-line" />
          <line x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}" 
                stroke="#F1F5F9" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>
        `;
      }
    });

    return paths;
  }

  renderZoneLabels() {
    if (!this.campus.sectors) return "";
    let labels = "";
    this.campus.sectors.forEach(s => {
      if (s.id === "all") return;
      const b = s.bounds;
      const width = b.maxX - b.minX;
      const height = b.maxY - b.minY;
      labels += `
        <rect x="${b.minX}" y="${b.minY}" width="${width}" height="${height}"
              fill="none" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="6 6" opacity="0.45"/>
        <text x="${b.minX + 16}" y="${b.minY + 28}" 
              font-family="'Inter', -apple-system, sans-serif" font-size="11" font-weight="700" 
              fill="#94A3B8" letter-spacing="0.12em" text-transform="uppercase">
          [ ${s.name} ]
        </text>
      `;
    });
    return labels;
  }

  renderBuildings() {
    let out = "";
    const filter = this.activeFilter;

    this.campus.buildings.forEach(b => {
      const isVisible = filter === "all" || b.category === filter;
      const isSelected = this.selectedBuilding && this.selectedBuilding.id === b.id;

      // Color logic based on category
      let badgeBg = "#1E293B";
      let bldgBg = "#FFFFFF";
      let borderCol = "#94A3B8";

      if (b.category === "engineering") {
        borderCol = "#DC2626";
        badgeBg = "#DC2626";
      } else if (b.category === "computing") {
        borderCol = "#2563EB";
        badgeBg = "#2563EB";
      } else if (b.category === "library") {
        borderCol = "#0D9488";
        badgeBg = "#0D9488";
      } else if (b.category === "admin") {
        borderCol = "#475569";
        badgeBg = "#475569";
      } else if (b.category === "dining") {
        borderCol = "#EA580C";
        badgeBg = "#EA580C";
      } else if (b.category === "medical") {
        borderCol = "#0284C7";
        badgeBg = "#0284C7";
      } else if (b.category === "sports") {
        borderCol = "#16A34A";
        badgeBg = "#16A34A";
      }

      if (isSelected) {
        borderCol = "#DC2626";
        bldgBg = "#FEF2F2";
      }

      const opacity = isVisible ? 1 : 0.25;

      // Render custom architectural footprint based on b.shape
      let footprintSvg = "";

      if (b.shape === "dome") {
        // Iconic 3D Circular Innovation Dome with Radial Ribs & Atrium
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const r = Math.min(b.width, b.height) / 2;

        footprintSvg = `
          <!-- Dome Drop Shadow -->
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0F172A" opacity="0.12" transform="translate(3, 5)"/>
          <!-- Outer Terracotta / Bronze Foundation Ring -->
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${isSelected ? '#FEE2E2' : '#FFFFFF'}" stroke="${borderCol}" stroke-width="${isSelected ? 3 : 2}" class="building-box"/>
          <!-- Concentric Stepped Ribs -->
          <circle cx="${cx}" cy="${cy}" r="${r * 0.75}" fill="none" stroke="${borderCol}" stroke-width="1.25" stroke-dasharray="3 3"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="none" stroke="${borderCol}" stroke-width="1"/>
          <!-- 8 Structural Radial Spokes -->
          <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${borderCol}" stroke-width="0.75" opacity="0.6"/>
          <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${borderCol}" stroke-width="0.75" opacity="0.6"/>
          <line x1="${cx - r * 0.7}" y1="${cy - r * 0.7}" x2="${cx + r * 0.7}" y2="${cy + r * 0.7}" stroke="${borderCol}" stroke-width="0.75" opacity="0.6"/>
          <line x1="${cx - r * 0.7}" y1="${cy + r * 0.7}" x2="${cx + r * 0.7}" y2="${cy - r * 0.7}" stroke="${borderCol}" stroke-width="0.75" opacity="0.6"/>
          <!-- Central Glass Lantern Skylight -->
          <circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.5"/>

          <!-- Dome Floating Monospace Badge -->
          <rect x="${cx - 24}" y="${cy - 20}" width="48" height="16" rx="3" fill="${badgeBg}" class="code-badge"/>
          <text x="${cx}" y="${cy - 8}" font-family="'Inter', monospace" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">
            ${b.code}
          </text>
          <text x="${cx}" y="${cy + 8}" font-family="'Inter', sans-serif" font-size="9" font-weight="700" fill="#0F172A" text-anchor="middle">
            ${this.truncateText(b.name, 16)}
          </text>
        `;
      } else if (b.shape === "track") {
        // All-Weather Athletics Running Track & Grass Turf Pitch
        footprintSvg = `
          <!-- Outer Running Track -->
          <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.height / 2}" 
                fill="#FECDD3" stroke="#DC2626" stroke-width="2" filter="url(#building-shadow)" class="building-box"/>
          <rect x="${b.x + 8}" y="${b.y + 8}" width="${b.width - 16}" height="${b.height - 16}" rx="${(b.height - 16) / 2}" 
                fill="#FCA5A5" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="4 4"/>
          <!-- Inner Soccer / Athletic Turf -->
          <rect x="${b.x + 20}" y="${b.y + 16}" width="${b.width - 40}" height="${b.height - 32}" rx="8" 
                fill="#86EFAC" stroke="#16A34A" stroke-width="1"/>
          <!-- Track Monospace Badge -->
          <rect x="${b.x + b.width / 2 - 28}" y="${b.y + b.height / 2 - 16}" width="56" height="16" rx="3" fill="${badgeBg}"/>
          <text x="${b.x + b.width / 2}" y="${b.y + b.height / 2 - 4}" font-family="'Inter', monospace" font-size="9" font-weight="800" fill="#FFFFFF" text-anchor="middle">
            ${b.code}
          </text>
          <text x="${b.x + b.width / 2}" y="${b.y + b.height / 2 + 12}" font-family="'Inter', sans-serif" font-size="9" font-weight="700" fill="#0F172A" text-anchor="middle">
            ${this.truncateText(b.name, 18)}
          </text>
        `;
      } else if (b.shape === "l-shape") {
        // Interlocking L-Shaped Research Complex with Courtyard Terrace
        const w = b.width;
        const h = b.height;
        const cutW = w * 0.45;
        const cutH = h * 0.45;
        const d = `M ${b.x} ${b.y} L ${b.x + w} ${b.y} L ${b.x + w} ${b.y + h - cutH} L ${b.x + w - cutW} ${b.y + h - cutH} L ${b.x + w - cutW} ${b.y + h} L ${b.x} ${b.y + h} Z`;

        footprintSvg = `
          <!-- L-Shape 2.5D Drop Shadow -->
          <path d="${d}" fill="#0F172A" opacity="0.12" transform="translate(3, 5)"/>
          <!-- L-Shape Base Body -->
          <path d="${d}" fill="${bldgBg}" stroke="${borderCol}" stroke-width="${isSelected ? 3 : 1.75}" class="building-box"/>
          <!-- Inner Terrace Garden Cutout -->
          <rect x="${b.x + w - cutW + 4}" y="${b.y + h - cutH + 4}" width="${cutW - 8}" height="${cutH - 8}" rx="4" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1"/>
          <!-- Code Badge -->
          <rect x="${b.x + 6}" y="${b.y + 6}" width="${Math.min(w * 0.35, 48)}" height="17" rx="3" fill="${badgeBg}" class="code-badge"/>
          <text x="${b.x + 10}" y="${b.y + 18}" font-family="'Inter', monospace" font-size="9" font-weight="800" fill="#FFFFFF">
            ${b.code}
          </text>
          <!-- Title -->
          <text x="${b.x + 8}" y="${b.y + 36}" font-family="'Inter', sans-serif" font-size="10" font-weight="600" fill="#0F172A">
            ${this.truncateText(b.name, Math.floor(w / 7.5))}
          </text>
        `;
      } else {
        // High-Precision Architectural Footprint (CAD Parapet + Glass Skylight + Entry Portico)
        const innerW = Math.max(16, b.width - 24);
        const innerH = Math.max(12, b.height - 38);

        footprintSvg = `
          <!-- Architectural footprint shadow & box -->
          <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" 
                rx="5" fill="${bldgBg}" stroke="${borderCol}" stroke-width="${isSelected ? 3 : 1.75}"
                filter="url(#building-shadow)" class="building-box" />

          <!-- Rooftop Glass Atrium / Skylight Inset -->
          ${b.height > 60 && b.width > 90 ? `
            <rect x="${b.x + b.width - innerW - 8}" y="${b.y + 8}" width="${innerW}" height="${innerH}" 
                  rx="3" fill="url(#glass-atrium)" stroke="#BAE6FD" stroke-width="0.75" opacity="0.8" />
          ` : ''}

          <!-- Building Code Pill Badge (Swiss Monospace / Tabular) -->
          <rect x="${b.x + 6}" y="${b.y + 6}" width="${Math.min(b.width - 12, 48)}" height="17" 
                rx="3" fill="${badgeBg}" class="code-badge" />
          <text x="${b.x + 10}" y="${b.y + 18}" 
                font-family="'Inter', monospace" font-size="9.5" font-weight="800" fill="#FFFFFF" letter-spacing="0.04em">
            ${b.code}
          </text>

          <!-- Building Name Label -->
          <text x="${b.x + 8}" y="${b.y + 38}" 
                font-family="'Inter', sans-serif" font-size="11" font-weight="600" fill="#0F172A" 
                class="building-title-text">
            ${this.truncateText(b.name, Math.floor(b.width / 6.5))}
          </text>

          <!-- Arabic subtitle if space permits -->
          ${b.height > 55 ? `
            <text x="${b.x + 8}" y="${b.y + 52}" 
                  font-family="'Inter', -apple-system, sans-serif" font-size="9" font-weight="400" fill="#64748B" 
                  class="building-subtitle-text">
              ${this.truncateText(b.nameAr || '', Math.floor(b.width / 7))}
            </text>
          ` : ''}
        `;
      }

      // Entrance Node Pinpoint and Accessible Portal Notch
      let entranceSvg = "";
      if (b.entranceNode && this.campus.graph.nodes[b.entranceNode]) {
        const en = this.campus.graph.nodes[b.entranceNode];
        entranceSvg = `
          <!-- Entrance Door Portal -->
          <circle cx="${en.x}" cy="${en.y}" r="4.5" fill="${borderCol}" stroke="#FFFFFF" stroke-width="1.5" class="entrance-dot"/>
          ${b.accessible ? `
            <circle cx="${en.x}" cy="${en.y}" r="2" fill="#FFFFFF" />
          ` : ''}
        `;
      }

      // Selected Building Pulse Ring
      let selectionHalo = "";
      if (isSelected) {
        selectionHalo = `
          <rect x="${b.x - 4}" y="${b.y - 4}" width="${b.width + 8}" height="${b.height + 8}" rx="8"
                fill="none" stroke="#DC2626" stroke-width="2" stroke-dasharray="5 3" opacity="0.8">
            <animate attributeName="stroke-dashoffset" values="0;16" dur="1s" repeatCount="indefinite" />
          </rect>
        `;
      }

      out += `
        <g class="building-group ${isSelected ? 'selected' : ''}" 
           data-id="${b.id}" data-name="${b.name}" data-code="${b.code}"
           style="opacity: ${opacity}; cursor: pointer;">
          ${selectionHalo}
          ${footprintSvg}
          ${entranceSvg}
        </g>
      `;
    });

    return out;
  }

  renderPOIs() {
    let out = "";
    this.campus.pois.forEach(p => {
      let icon = "📍";
      let col = "#475569";
      let bg = "#F1F5F9";

      if (p.type === "parking") {
        icon = "P";
        col = "#2563EB";
        bg = "#EFF6FF";
      } else if (p.type === "gate") {
        icon = "⛩️";
        col = "#DC2626";
        bg = "#FEF2F2";
      } else if (p.type === "prayer") {
        icon = "🕌";
        col = "#059669";
        bg = "#ECFDF5";
      } else if (p.type === "bus") {
        icon = "🚌";
        col = "#D97706";
        bg = "#FFFBEB";
      }

      out += `
        <g class="poi-group" data-id="${p.id}" data-name="${p.name}" 
           transform="translate(${p.x}, ${p.y})" style="cursor: pointer;">
          <circle cx="0" cy="0" r="12" fill="${bg}" stroke="${col}" stroke-width="1.75" filter="url(#building-shadow)"/>
          <text x="0" y="4" font-family="'Inter', sans-serif" font-size="10" font-weight="800" fill="${col}" text-anchor="middle">
            ${p.code || icon}
          </text>
          <text x="0" y="24" font-family="'Inter', sans-serif" font-size="9" font-weight="600" fill="#334155" text-anchor="middle">
            ${p.name.split('(')[0].trim()}
          </text>
        </g>
      `;
    });
    return out;
  }

  renderActiveRoute() {
    if (!this.currentRoute || !this.currentRoute.pathNodes || this.currentRoute.pathNodes.length < 2) {
      return "";
    }

    const nodes = this.campus.graph.nodes;
    const pathNodes = this.currentRoute.pathNodes;

    let d = "";
    pathNodes.forEach((nodeId, idx) => {
      const n = nodes[nodeId];
      if (!n) return;
      if (idx === 0) {
        d += `M ${n.x} ${n.y}`;
      } else {
        d += ` L ${n.x} ${n.y}`;
      }
    });

    const startNode = nodes[pathNodes[0]];
    const endNode = nodes[pathNodes[pathNodes.length - 1]];

    return `
      <!-- Underglow stroke -->
      <path d="${d}" fill="none" stroke="#F87171" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" filter="url(#route-glow)"/>
      <!-- Animated Swiss Red trajectory line -->
      <path d="${d}" fill="none" stroke="#DC2626" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="8 6" class="route-trajectory-anim" marker-end="url(#route-arrow)"/>
      
      <!-- Start Pin -->
      <g transform="translate(${startNode.x}, ${startNode.y})">
        <circle cx="0" cy="0" r="8" fill="#16A34A" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="0" cy="0" r="3" fill="#FFFFFF"/>
        <text x="0" y="-12" font-family="'Inter', sans-serif" font-size="10" font-weight="700" fill="#16A34A" text-anchor="middle">START</text>
      </g>

      <!-- Destination Pin with Swiss Target Rings (Native SVG animation - 100% position stable) -->
      <g transform="translate(${endNode.x}, ${endNode.y})">
        <circle cx="0" cy="0" r="14" fill="#DC2626" fill-opacity="0.3">
          <animate attributeName="r" values="11;20;11" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.35;0.05;0.35" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="0" cy="0" r="9" fill="#DC2626" stroke="#FFFFFF" stroke-width="2.5"/>
        <circle cx="0" cy="0" r="3" fill="#FFFFFF"/>
        <text x="0" y="-15" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="11" font-weight="800" fill="#DC2626" text-anchor="middle">DESTINATION</text>
      </g>
    `;
  }

  // --- DIJKSTRA SHORTEST PATHFINDING ALGORITHM ---
  findRoute(startIdentifier, endIdentifier) {
    const nodes = this.campus.graph.nodes;
    const edges = this.campus.graph.edges;

    // Resolve start node
    const startNodeId = this.resolveNodeId(startIdentifier);
    const endNodeId = this.resolveNodeId(endIdentifier);

    if (!startNodeId || !endNodeId) {
      console.warn("Could not resolve routing nodes", { startIdentifier, endIdentifier, startNodeId, endNodeId });
      return null;
    }

    // Build adjacency list
    const adj = {};
    Object.keys(nodes).forEach(n => { adj[n] = []; });

    edges.forEach(e => {
      const [u, v, weight, isAccessible, isShaded, desc] = e;
      if (this.accessibleOnly && !isAccessible) return; // Skip non-wheelchair paths

      if (adj[u]) adj[u].push({ to: v, weight, isShaded, desc });
      if (adj[v]) adj[v].push({ to: u, weight, isShaded, desc });
    });

    // Dijkstra structures
    const distances = {};
    const previous = {};
    const unvisited = new Set(Object.keys(nodes));

    Object.keys(nodes).forEach(n => {
      distances[n] = Infinity;
      previous[n] = null;
    });
    distances[startNodeId] = 0;

    while (unvisited.size > 0) {
      // Find min distance unvisited
      let current = null;
      let minDistance = Infinity;

      unvisited.forEach(node => {
        if (distances[node] < minDistance) {
          minDistance = distances[node];
          current = node;
        }
      });

      if (current === null || distances[current] === Infinity) break;
      if (current === endNodeId) break;

      unvisited.delete(current);

      const neighbors = adj[current] || [];
      neighbors.forEach(edge => {
        if (!unvisited.has(edge.to)) return;
        const alt = distances[current] + edge.weight;
        if (alt < distances[edge.to]) {
          distances[edge.to] = alt;
          previous[edge.to] = { from: current, desc: edge.desc, isShaded: edge.isShaded };
        }
      });
    }

    if (distances[endNodeId] === Infinity) {
      console.warn("No path found between", startNodeId, endNodeId);
      return null;
    }

    // Reconstruct path
    const path = [];
    const instructions = [];
    let curr = endNodeId;

    while (curr) {
      path.unshift(curr);
      const prevStep = previous[curr];
      if (prevStep) {
        instructions.unshift({
          from: nodes[prevStep.from]?.label || prevStep.from,
          to: nodes[curr]?.label || curr,
          desc: prevStep.desc || "Proceed along walkway",
          isShaded: prevStep.isShaded
        });
        curr = prevStep.from;
      } else {
        break;
      }
    }

    const totalDistanceMeters = Math.round(distances[endNodeId]);
    const walkingMinutes = (totalDistanceMeters / 75).toFixed(1); // Standard ~4.5 km/h walking speed

    const result = {
      startId: startIdentifier,
      endId: endIdentifier,
      pathNodes: path,
      distanceMeters: totalDistanceMeters,
      durationMinutes: parseFloat(walkingMinutes),
      instructions,
      isAccessible: this.accessibleOnly,
      startName: nodes[startNodeId]?.label || startIdentifier,
      endName: nodes[endNodeId]?.label || endIdentifier
    };

    this.currentRoute = result;
    this.render();

    // Notify listener
    if (typeof this.options.onRouteCalculated === "function") {
      this.options.onRouteCalculated(result);
    }

    return result;
  }

  resolveNodeId(identifier) {
    if (!identifier) return null;

    // Direct node ID match
    if (this.campus.graph.nodes[identifier]) {
      return identifier;
    }

    // Building ID match
    const bldg = this.campus.buildings.find(b => b.id === identifier || b.code.toLowerCase() === identifier.toLowerCase());
    if (bldg && bldg.entranceNode) {
      return bldg.entranceNode;
    }

    // POI match
    const poi = this.campus.pois.find(p => p.id === identifier || p.nodeId === identifier || (p.code && p.code.toLowerCase() === identifier.toLowerCase()));
    if (poi && poi.nodeId) {
      return poi.nodeId;
    }

    // Room lookup match
    for (const b of this.campus.buildings) {
      if (b.rooms && b.rooms.some(r => r.toLowerCase().includes(identifier.toLowerCase()))) {
        return b.entranceNode;
      }
    }

    return null;
  }

  // --- PAN, ZOOM & VIEWPORT INTERACTIONS ---
  bindEvents() {
    const vp = this.viewport;

    // Drag / Pan (Mouse)
    vp.addEventListener("mousedown", (e) => {
      if (e.target.closest(".map-controls") || e.target.closest(".map-tooltip")) return;
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      vp.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.dragStart.x;
      this.panY = e.clientY - this.dragStart.y;
      this.updateTransform();
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
      vp.style.cursor = "grab";
    });

    // Touch Drag & Multi-Touch Pinch Zoom (Mobile Devices & Tablets)
    let initialPinchDistance = null;
    let initialPinchZoom = 1;

    vp.addEventListener("touchstart", (e) => {
      if (e.target.closest(".map-controls") || e.target.closest(".map-tooltip")) return;
      if (e.touches.length === 1) {
        this.isDragging = true;
        const touch = e.touches[0];
        this.dragStart = { x: touch.clientX - this.panX, y: touch.clientY - this.panY };
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchZoom = this.zoom;
      }
    }, { passive: false });

    vp.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        e.preventDefault();
        const touch = e.touches[0];
        this.panX = touch.clientX - this.dragStart.x;
        this.panY = touch.clientY - this.dragStart.y;
        this.updateTransform();
      } else if (e.touches.length === 2 && initialPinchDistance) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = currentDistance / initialPinchDistance;
        this.zoom = Math.min(Math.max(initialPinchZoom * scaleFactor, 0.4), 4.0);
        this.updateTransform();
      }
    }, { passive: false });

    vp.addEventListener("touchend", (e) => {
      if (e.touches.length === 0) {
        this.isDragging = false;
        initialPinchDistance = null;
      } else if (e.touches.length === 1) {
        this.isDragging = true;
        const touch = e.touches[0];
        this.dragStart = { x: touch.clientX - this.panX, y: touch.clientY - this.panY };
        initialPinchDistance = null;
      }
    });

    vp.addEventListener("touchcancel", () => {
      this.isDragging = false;
      initialPinchDistance = null;
    });

    // Wheel Zoom centered
    vp.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.applyZoom(zoomFactor);
    }, { passive: false });

    // Button controls
    document.getElementById("btn-zoom-in")?.addEventListener("click", () => this.applyZoom(1.25));
    document.getElementById("btn-zoom-out")?.addEventListener("click", () => this.applyZoom(0.8));
    document.getElementById("btn-reset-view")?.addEventListener("click", () => this.resetView());
    document.getElementById("btn-toggle-access")?.addEventListener("click", () => {
      this.setAccessibleMode(!this.accessibleOnly);
    });

    // Keyboard navigation
    window.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "=") this.applyZoom(1.2);
      if (e.key === "-") this.applyZoom(0.8);
      if (e.key === "0") this.resetView();
    });
  }

  applyZoom(factor) {
    const newZoom = Math.min(Math.max(this.zoom * factor, 0.4), 4.0);
    this.zoom = newZoom;
    this.updateTransform();
  }

  updateTransform() {
    this.svg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.svg.style.transformOrigin = "50% 50%";
  }

  bindSvgInteractions() {
    // Building Click & Hover
    this.svg.querySelectorAll(".building-group").forEach(el => {
      const id = el.getAttribute("data-id");
      const bldg = this.campus.buildings.find(b => b.id === id);

      el.addEventListener("mouseenter", (e) => {
        if (!bldg) return;
        this.showTooltip(e, bldg);
      });

      el.addEventListener("mousemove", (e) => {
        this.positionTooltip(e);
      });

      el.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });

      el.addEventListener("click", () => {
        this.selectedBuilding = bldg;
        this.render();
        if (typeof this.options.onBuildingSelect === "function") {
          this.options.onBuildingSelect(bldg);
        }
      });
    });

    // POI Click
    this.svg.querySelectorAll(".poi-group").forEach(el => {
      const id = el.getAttribute("data-id");
      const poi = this.campus.pois.find(p => p.id === id);
      el.addEventListener("click", () => {
        if (poi && typeof this.options.onBuildingSelect === "function") {
          this.options.onBuildingSelect({
            id: poi.id,
            code: poi.code || "POI",
            name: poi.name,
            nameAr: "",
            category: poi.type,
            facilities: [poi.name],
            rooms: [],
            entranceNode: poi.nodeId,
            accessible: poi.accessible
          });
        }
      });
    });
  }

  showTooltip(e, bldg) {
    // Suppress hover tooltip on mobile/touch screens to prevent screen clutter
    if (window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(hover: none)').matches)) {
      return;
    }

    this.tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-badge">${bldg.code}</span>
        <span class="tooltip-category">${bldg.zone || bldg.category}</span>
      </div>
      <div class="tooltip-title">${bldg.name}</div>
      ${bldg.departments ? `<div class="tooltip-sub">${bldg.departments[0]}</div>` : ''}
      <div class="tooltip-footer">
        <span>Click for full info & navigation</span>
      </div>
    `;
    this.tooltip.style.display = "block";
    this.positionTooltip(e);
  }

  positionTooltip(e) {
    const rect = this.viewport.getBoundingClientRect();
    const x = e.clientX - rect.left + 15;
    const y = e.clientY - rect.top + 15;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  hideTooltip() {
    this.tooltip.style.display = "none";
  }

  truncateText(text, maxLen) {
    if (!text) return "";
    return text.length > maxLen ? text.substring(0, maxLen - 1) + "…" : text;
  }
}

// Export for browser and modules
if (typeof window !== "undefined") {
  window.MapEngine = MapEngine;
}
