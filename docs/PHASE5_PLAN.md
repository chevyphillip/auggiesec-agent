# Phase 5: Web Interface Implementation Plan

**Status**: PROPOSED
**Replaces**: Original Phase 5 (CLI & Testing)

---

## 1. Overview

### 1.1 Objective

Build a modern web interface for GraphGuard using SvelteKit and shadcn-svelte to display security analysis results in a professional, interactive table format.

### 1.2 Key Changes from Original Phase 5

| Original (CLI) | New (Web UI) |
|----------------|--------------|
| `src/cli.ts` with argument parsing | SvelteKit app in `web/` directory |
| `bun run scan` script | Web-based scan trigger |
| JSON/Markdown output formatters | Interactive data tables with filtering/sorting |

---

## 2. Technical Architecture

### 2.1 Project Structure (Monorepo)

```
auggiesec-agent/
├── src/                    # Existing agent code
│   ├── graph/              # LangGraph nodes
│   ├── tools/              # Auggie tools + Langfuse
│   └── instrumentation.ts  # OpenTelemetry
│
├── web/                    # NEW: SvelteKit application
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   └── ui/           # shadcn-svelte components
│   │   │   ├── server/
│   │   │   │   └── agent.ts      # Agent integration layer
│   │   │   └── types.ts          # Shared types
│   │   ├── routes/
│   │   │   ├── +page.svelte      # Dashboard
│   │   │   ├── +layout.svelte    # App shell
│   │   │   ├── scan/
│   │   │   │   ├── +page.svelte        # New scan form
│   │   │   │   └── [id]/
│   │   │   │       └── +page.svelte    # Scan results
│   │   │   └── api/
│   │   │       └── scan/
│   │   │           ├── +server.ts      # POST: start scan
│   │   │           └── [id]/
│   │   │               └── +server.ts  # GET: scan status/results
│   │   └── app.css
│   ├── static/
│   ├── svelte.config.js
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── package.json            # Root package.json (workspace)
└── bun.lock
```

### 2.2 Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SvelteKit App                            │
├─────────────────────────────────────────────────────────────────┤
│  Browser                         │  Server (Node/Bun)           │
│  ────────                        │  ────────────────            │
│  ┌──────────────┐                │  ┌──────────────────┐        │
│  │ Dashboard    │                │  │ API Routes       │        │
│  │ (+page)      │ ──fetch───────>│  │ /api/scan        │        │
│  └──────────────┘                │  └────────┬─────────┘        │
│                                  │           │                  │
│  ┌──────────────┐                │           ▼                  │
│  │ Scan Results │                │  ┌──────────────────┐        │
│  │ DataTable    │ <───SSE────────│  │ Agent Layer      │        │
│  └──────────────┘                │  │ (imports from    │        │
│                                  │  │  ../src/graph)   │        │
│                                  │  └──────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

1. **Start Scan**: `POST /api/scan` with `{ repoPath, query }`
2. **Execute**: SvelteKit server imports `runSecurityAnalysis()` from agent
3. **Stream**: Server-Sent Events (SSE) push progress updates
4. **Display**: Results rendered in shadcn-svelte DataTable

---

## 3. UI Components & Pages

### 3.1 shadcn-svelte Components Required

| Component | Purpose |
|-----------|---------|
| `data-table` | Main findings display with sorting/filtering/pagination |
| `table` | Base table styling |
| `badge` | Severity indicators (Critical/High/Medium/Low) |
| `card` | Summary statistics cards |
| `button` | Actions (Start Scan, Export, etc.) |
| `input` | Filter inputs, repo path entry |
| `select` | Category filter dropdown |
| `alert` | Error/warning messages |
| `dialog` | Code snippet viewer modal |
| `tabs` | Category breakdown tabs |
| `progress` | Scan progress indicator |
| `dropdown-menu` | Row actions, export options |

### 3.2 Page Layouts

#### Dashboard (`/`)
```
┌─────────────────────────────────────────────────────────────────┐
│  GraphGuard Security Scanner                    [Start New Scan]│
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Critical │ │   High   │ │  Medium  │ │   Low    │           │
│  │    17    │ │    12    │ │    12    │ │    0     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  Recent Scans                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Repo               │ Date       │ Findings │ Status        ││
│  │ nodejs-goof        │ 2025-12-09 │ 41       │ ✓ Complete    ││
│  │ ...                │ ...        │ ...      │ ...           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### Scan Results (`/scan/[id]`)
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    nodejs-goof Scan Results            [Export ▾]       │
├─────────────────────────────────────────────────────────────────┤
│  Summary: 41 findings │ 6 categories │ Duration: 1.2s          │
├─────────────────────────────────────────────────────────────────┤
│  [All] [A01] [A02] [A03] [A06] [A07] [A08]    🔍 Filter...     │
├─────────────────────────────────────────────────────────────────┤
│  │ Severity │ Category │ Title           │ File      │ Actions ││
│  ├──────────┼──────────┼─────────────────┼───────────┼─────────┤│
│  │ CRITICAL │ A03      │ Command inject..│ routes/.. │ ⋮       ││
│  │ CRITICAL │ A03      │ NoSQL injection │ routes/.. │ ⋮       ││
│  │ HIGH     │ A02      │ Hard-coded pass │ app.js    │ ⋮       ││
│  │ ...      │ ...      │ ...             │ ...       │ ...     ││
│  └──────────┴──────────┴─────────────────┴───────────┴─────────┘│
│                              [◄] 1 of 5 [►]    10 per page ▾   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Table Columns

| Column | Type | Sortable | Filterable | Description |
|--------|------|----------|------------|-------------|
| Severity | Badge | ✓ | ✓ | Critical/High/Medium/Low with color coding |
| Category | Text | ✓ | ✓ | OWASP category (A01-A10) |
| Title | Text | ✓ | ✓ | Finding title (truncated) |
| File | Link | ✓ | ✓ | File path with line range |
| Actions | Menu | ✗ | ✗ | View details, copy, export |

### 3.4 Severity Badge Colors

```css
.severity-critical { background: #dc2626; } /* red-600 */
.severity-high     { background: #ea580c; } /* orange-600 */
.severity-medium   { background: #ca8a04; } /* yellow-600 */
.severity-low      { background: #16a34a; } /* green-600 */
```

---

## 4. Implementation Tasks

### 4.1 Task Breakdown

```
Phase 5: Web Interface
├── 5.1 Project Setup
│   ├── 5.1.1 Initialize SvelteKit project in web/
│   ├── 5.1.2 Configure shadcn-svelte
│   ├── 5.1.3 Set up Tailwind CSS
│   ├── 5.1.4 Configure monorepo workspace
│   └── 5.1.5 Add path aliases for agent imports
│
├── 5.2 API Layer
│   ├── 5.2.1 Create /api/scan POST endpoint
│   ├── 5.2.2 Create /api/scan/[id] GET endpoint
│   ├── 5.2.3 Implement SSE for progress updates
│   ├── 5.2.4 Create agent integration layer
│   └── 5.2.5 Add in-memory scan storage
│
├── 5.3 UI Components
│   ├── 5.3.1 Install required shadcn-svelte components
│   ├── 5.3.2 Create SeverityBadge component
│   ├── 5.3.3 Create FindingsDataTable component
│   ├── 5.3.4 Create ScanSummaryCard component
│   ├── 5.3.5 Create CodeSnippetDialog component
│   └── 5.3.6 Create CategoryTabs component
│
├── 5.4 Pages & Routes
│   ├── 5.4.1 Create app layout (+layout.svelte)
│   ├── 5.4.2 Create dashboard page (+page.svelte)
│   ├── 5.4.3 Create new scan page (/scan/+page.svelte)
│   └── 5.4.4 Create scan results page (/scan/[id]/+page.svelte)
│
└── 5.5 Integration & Testing
    ├── 5.5.1 Test scan flow end-to-end
    ├── 5.5.2 Validate against nodejs-goof
    └── 5.5.3 Add loading states and error handling
```

### 4.2 Estimated Effort

| Task Group | Subtasks | Est. Time |
|------------|----------|-----------|
| 5.1 Project Setup | 5 | 1-2 hours |
| 5.2 API Layer | 5 | 2-3 hours |
| 5.3 UI Components | 6 | 3-4 hours |
| 5.4 Pages & Routes | 4 | 2-3 hours |
| 5.5 Integration | 3 | 1-2 hours |
| **Total** | **23** | **9-14 hours** |

---

## 5. Dependencies & Prerequisites

### 5.1 New Dependencies (web/)

```json
{
  "dependencies": {
    "@sveltejs/adapter-auto": "^4.0.0",
    "@sveltejs/kit": "^2.21.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "svelte": "^5.0.0",
    "@tanstack/table-core": "^8.21.0",
    "bits-ui": "^1.0.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "tailwind-variants": "^0.3.1"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.16",
    "tailwindcss": "^4.0.0",
    "@lucide/svelte": "^0.468.0",
    "typescript": "^5.7.0"
  }
}
```

### 5.2 Prerequisites

- [x] Phase 4 complete (OWASP analysis working)
- [x] `runSecurityAnalysis()` function exported
- [x] SecurityFinding type defined
- [ ] Node.js 20+ or Bun for SvelteKit

### 5.3 Commands to Initialize

```bash
# From project root
cd web
bunx sv create . --template minimal --types ts
bunx sv add tailwindcss

# Initialize shadcn-svelte
bunx shadcn-svelte@latest init

# Add required components
bunx shadcn-svelte@latest add table data-table badge card button input select alert dialog tabs progress dropdown-menu
```

---

## 6. API Specification

### 6.1 POST /api/scan

**Request:**
```json
{
  "repoPath": "./nodejs-goof",
  "query": "Perform comprehensive OWASP Top 10 security analysis"
}
```

**Response:**
```json
{
  "scanId": "scan_1765309912653_lcnde8",
  "status": "started"
}
```

### 6.2 GET /api/scan/[id]

**Response (in progress):**
```json
{
  "scanId": "scan_...",
  "status": "running",
  "progress": {
    "phase": "analyze",
    "targetsAnalyzed": 5,
    "totalTargets": 12
  }
}
```

**Response (complete):**
```json
{
  "scanId": "scan_...",
  "status": "complete",
  "result": {
    "findings": [...],
    "summary": "...",
    "analyzedCategories": [...],
    "startTime": 1765309912653,
    "endTime": 1765309914200
  }
}
```

### 6.3 GET /api/scan/[id]/stream (SSE)

```
event: progress
data: {"phase": "enumerate", "message": "Found 12 targets"}

event: progress
data: {"phase": "analyze", "targetsAnalyzed": 5, "totalTargets": 12}

event: complete
data: {"scanId": "scan_...", "findingsCount": 41}
```

---

## 7. Open Questions / Decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Separate package.json or workspace? | Monorepo workspace | **Workspace** - shared types |
| Bun or Node for SvelteKit? | Both work | **Bun** - consistency |
| Store scan results where? | Memory / SQLite / File | **Memory** - v1 simplicity |
| SSE or WebSocket for progress? | Both work | **SSE** - simpler |

---

## 8. Acceptance Criteria

- [ ] Dashboard shows summary statistics from most recent scan
- [ ] Can trigger new scan from UI with repo path input
- [ ] Findings displayed in sortable/filterable data table
- [ ] Severity badges with correct color coding
- [ ] Category filter tabs working
- [ ] Can view finding details in modal/dialog
- [ ] Export to JSON/CSV available
- [ ] Loading states during scan execution
- [ ] Error handling for failed scans
- [ ] Successfully scans nodejs-goof and displays 41+ findings

---

## 9. References

- [SvelteKit Documentation](https://svelte.dev/docs/kit)
- [shadcn-svelte](https://shadcn-svelte.com/docs)
- [Tanstack Table](https://tanstack.com/table/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
