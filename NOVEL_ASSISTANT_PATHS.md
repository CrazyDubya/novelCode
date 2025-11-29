# Paths to Evolve Code - OSS into a Novel Writing Assistant

The table below consolidates a dozen possible approaches into five primary paths for adapting the editor into a focused writing assistant. Ratings are 1–5 (higher is better) for Ease, Impact (on writer productivity/creativity), and Alignment (with existing VS Code architecture). Each path notes whether it can coexist with the others.

| Path | Description | Ease | Impact | Alignment | Pros | Cons | Can Complement Others? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1. **Storycraft Extension Pack** | Curated extension bundle for plotting, character sheets, timelines, grammar/style linting, and export templates. | 5 | 3 | 5 | Fast to ship via extension marketplace; minimal core changes; leverages ecosystem. | Dependent on third-party quality; fragmented UX without opinionated defaults. | Yes—acts as a baseline layer beneath deeper changes. |
| 2. **Narrative Workspace Mode** | New workspace layout preset with distraction-free editor, scene/beat sidebar, inline word count/pace, and notebook-style tabs. | 3 | 4 | 4 | Improves focus; organizes long-form projects; reuses existing layout/Panel APIs. | Requires UI design and settings plumbing; risk of clutter if toggled poorly. | Yes—complements packs, AI, and templates. |
| 3. **AI Co-Author & Critique** | Integrated LLM-driven suggestions for brainstorming, outlining, voice/style checks, and rewrites, with persona presets. | 2 | 5 | 3 | High creative lift; can personalize tone; tightly integrated chat/history. | Expensive inference; privacy/compliance concerns; latency; prompt/guardrail work. | Yes—feeds on structure from other paths; should be toggleable. |
| 4. **Narrative Data Model & Graph** | First-class data model for characters, locations, timelines, and arcs stored as JSON/YAML with visual graph and consistency checks. | 2 | 5 | 2 | Enables advanced validation, queries, and AI grounding; unlocks timeline views. | Requires schema design, migration, and graph UI; adds complexity to storage. | Partially—pairs well with AI and workspace; heavier to retrofit into extension packs. |
| 5. **Publishing & Formatting Pipeline** | Built-in export to EPUB/Print-ready PDF, screenplay/novel templates, style guides, and versioned drafts. | 4 | 4 | 4 | Clear value for end-to-end workflow; uses existing task/build pipeline and markdown/LaTeX converters. | Maintenance for converters/templates; needs QA for typographic fidelity across formats. | Yes—sits at the end of other paths and can run independently. |

## Deep-Dive: UI/UX, Workflows, and Backends

### 1) Storycraft Extension Pack (Baseline)
- **Target outcome:** Ship a cohesive bundle that installs opinionated defaults (linting rules, snippets, templates) while enabling deeper paths (3, 4) to add superpowers.
- **UI/UX:**
  - Welcome screen card “Turn on Storycraft” to install the pack; badge shows installed components.
  - Command palette actions to “Create Character Sheet,” “Insert Scene Template,” and “Open Plot Timeline.”
  - Status bar indicator for project mode (Novel / Screenplay / Short Story) that tunes snippets and linting.
- **Workflow:**
  - Starter project wizard: selects format → scaffolds folders (`manuscript/`, `research/`, `exports/`).
  - Template insertion via snippets and quick-picks; linting surface in Problems panel.
  - Bundles extensions that can be swapped for native features later without breaking UX.
- **Backend:**
  - Extension dependencies declared via `extensionPack` in `package.json` with a minimal coordinator extension to surface commands and defaults.
  - Settings sync profiles to let writers toggle between “general coding” and “storycraft” configs.

### 2) Narrative Workspace Mode (Mode)
- **Target outcome:** A toggleable layout preset that reduces friction when drafting narrative prose.
- **UI/UX & Layout:**
  - Ribbon toggle (or command) “Enter Narrative Mode” switches to a layout with: left sidebar = Project/Scenes tree; right sidebar = Notes/References; bottom panel collapsed by default.
  - Editor tabs support “Notebook” view: alternating prose + inline research blocks; optional typewriter scrolling and focus mode.
  - Inline metrics (word count, pace, reading time) appear as ghost text; typing goals visible in status bar.
  - Theme variant with softer contrast, distraction-free margins, and typography tuned for long-form.
- **Workflow:**
  - Scene/beat navigator: drag to reorder scenes; contextual commands to “Split Scene,” “Add Beat,” or “Jump to Timeline.”
  - Quick-research peek: hover references to show cards (characters/locations) pulled from the data model (path 4).
  - Auto-snapshots before major edits; “Compare to last milestone” diff optimized for prose.
- **Backend:**
  - Uses `workbench.layout` presets, `Zen Mode` hooks, and custom view containers.
  - Persisted per-workspace setting (`storycraft.narrativeMode.enabled`) so standard coding layouts remain intact.

### 3) AI Co-Author & Critique (Priority Engine)
- **Target outcome:** Provide grounded, low-latency creative assistance that leverages narrative data (path 4) and feeds curated outputs into the pack (path 1).
- **UI/UX:**
  - Dockable chat panel with persona presets (Editor, Critic, Continuity, Brainstorm). Threaded with inline citations to scenes/characters.
  - Inline actions on selections: “Tighten,” “Rephrase in voice,” “Raise tension,” “Foreshadow X.”
  - Outline composer: user sketches beats; AI fills draft; diffs are shown side-by-side with acceptance controls.
- **Workflow:**
  - Ground prompts with structured context (characters, arcs, recent scenes) to reduce hallucination.
  - Critique pass: runs style/consistency checks; produces actionable checklist cards. Cards link to code actions that apply edits.
  - Safe-ops: offline/local models option; rate-limited background suggestions; redaction of sensitive metadata.
- **Backend:**
  - Request router supporting pluggable providers; caching of embeddings/vectors per workspace; lightweight RAG over scene and data-model files.
  - Guardrails: profanity filters, PII stripping, and prompt templates scoped to narrative tasks.

### 4) Narrative Data Model & Graph (Structure)
- **Target outcome:** Canonical data layer to anchor AI grounding and UI surfaces (timelines, reference cards), enabling consistency and cross-document validation.
- **UI/UX:**
  - Graph view (characters ↔ locations ↔ arcs ↔ scenes) with filters by chapter/POV.
  - Sidebar reference cards with key facts, relationships, and recent appearances; inline tooltips in the editor.
  - Timeline lane that aligns beats with character arcs; conflict alerts when continuity is broken.
- **Workflow:**
  - Schemas stored in `/story/meta/*.yaml` (characters, locations, arcs, objects); scenes reference IDs.
  - Validation tasks flag contradictions (age drift, timeline overlaps, missing POV tags) and offer quick-fixes.
  - Import/export to/from common formats (Fountain, JSON Story, Scrivener metadata) to bootstrap data.
- **Backend:**
  - JSON Schema definitions + validation service; watcher to keep references in sync.
  - Optional lightweight SQLite/IndexedDB cache for graph queries; extension host provides graph APIs to other extensions.

### 5) Publishing & Formatting Pipeline (Workflow Terminus)
- **Target outcome:** Turn drafts into polished outputs and keep iterations versioned without disrupting drafting flow.
- **UI/UX:**
  - Export drawer with presets (EPUB, PDF print-ready, Screenplay, Submission Manuscript) and preview thumbnails.
  - Style guide picker with diff preview (before/after typography and spacing); per-chapter overrides allowed.
  - “Draft shelf” sidebar for frozen versions; quick-restore and comparison.
- **Workflow:**
  - One-click export tasks; pipeline stages shown as chips (Compile → Layout → Proof → Deliver).
  - Automated checks: widow/orphan scanning, dialogue punctuation lint, scene-break consistency.
  - Collaboration hook: shareable read-only preview links generated locally or via publish service.
- **Backend:**
  - Uses existing task runner; Pandoc/LaTeX/PrinceXML adapters; templates stored under `resources/storycraft/templates`.
  - Git-tagged draft snapshots with semantic labels (Draft 0.9, Submission v1); optional cloud storage connector.

## Interplay and Dependency Highlights
- **3/4 to achieve 1:** AI (3) consumes the structured data (4) to generate higher-quality templates/snippets and to critique pack-installed content. The pack (1) remains the delivery shell that surfaces these enhanced assets.
- **2 as a mode:** Narrative Workspace Mode (2) is the ergonomic switch that activates the right views for 3/4/5 without changing core files; it’s a reversible UX skin over the same project.
- **5 as a workflow terminus:** Publishing (5) slots after drafting/AI/structure work; it reads schemas from 4 and adopts styles/snippets from 1.
- **Compatibility:**
  - Paths 1+2: instant, low-risk uplift for writers.
  - Paths 3+4: reinforce each other (grounded AI + structured data) and can be progressively rolled out.
  - Paths 5 + any: largely append-only; minimal conflicts beyond template/schema versioning.

## Prototype Blueprint (Fast Validation)
- **Goal:** Let stakeholders see how toggling modes affects workspace layout and how AI + data model flows feed outputs.
- **Approach:**
  - Build a minimal extension with: (a) layout toggle (path 2), (b) mocked data model store with sample characters/scenes (path 4), (c) fake AI responses (path 3), and (d) stub export panel (path 5).
  - Use Webview-based dashboard to animate layout transitions and show live bindings (e.g., selecting a scene highlights related nodes, triggers AI suggestion, and updates export preview).
  - Instrument with telemetry to measure toggle usage, time-in-mode, and interaction paths between chat, graph, and exports.
- **Artifacts:** storyboards (enter mode → outline → AI draft → graph validation → export), quick Figma frames for layout, and a scripted demo using mocked data to iterate rapidly before full implementation.
