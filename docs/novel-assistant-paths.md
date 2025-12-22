# Paths to Evolve novelCode into a Writer's Assistant

This document consolidates a broad set of ideas into five cohesive paths for transforming this VS Code fork into a novel or story-writing assistant. Ratings use a 1–5 scale (higher is stronger) across impact, delivery effort, technical risk, and UX risk, plus a compatibility note for layering with other paths.

## Rating Key
- **Impact:** How much this path improves the writer experience.
- **Delivery Effort:** Amount of work across engineering, UX, and content.
- **Technical Risk:** Uncertainty from platform constraints, performance, or integrations.
- **UX Risk:** Likelihood that writers find the experience confusing or burdensome.

## Path 1: Writer-Focused Extension Pack & Templates
- **Concept:** Curate and ship a first-party extension pack with genrespecific snippets, narrative arcs, beat sheets, and manuscript templates; add command palette entries to scaffold projects.
- **Representative capabilities:** Genre-specific outline generators, character sheets, beat/scene card templates, manuscript word-count goals, and distraction-free theme bundle.
- **Matrix:**
  | Criterion | Rating | Notes |
  | --- | --- | --- |
  | Impact | 3 | Immediate comfort features without AI dependencies. |
  | Delivery Effort | 2 | Mostly configuration, curation, and UI polish. |
  | Technical Risk | 1 | Low—leverages existing extension model. |
  | UX Risk | 1 | Familiar VS Code constructs with minimal novelty. |
- **Pros:** Fast to ship; foundation for other paths; works offline.
- **Cons:** Limited “assistant” feel without deeper guidance or AI.
- **Compatibility:** Baseline layer that complements all other paths; no blocking conflicts.

## Path 2: Narrative Planner Workspace
- **Concept:** A dedicated view/container for story planning (timeline, acts, arcs, characters, locations) with synchronized markdown/JSON sources and visual boards.
- **Representative capabilities:** Drag-and-drop scene board, arc/character timeline, consistency checks (e.g., POV, tense), and per-chapter goal trackers.
- **Matrix:**
  | Criterion | Rating | Notes |
  | --- | --- | --- |
  | Impact | 4 | Centralizes story structure and reduces context-switching. |
  | Delivery Effort | 3 | Requires custom webviews, data model, and persistence. |
  | Technical Risk | 2 | Moderate—performance and data integrity across files. |
  | UX Risk | 2 | Must balance power with simplicity to avoid overwhelm. |
- **Pros:** Visual, tangible planning aids; can export to shared formats (JSON/Markdown).
- **Cons:** Heavier UI work; needs tight sync between visual board and files.
- **Compatibility:** Plays well with Paths 1 and 3; can feed research notes from Path 4 and export to Path 5.

## Path 3: AI Co-Writer & Coach Panel
- **Concept:** Embedded LLM-driven side panel for outlining, drafting, rewriting, sensitivity/style checks, and voice maintenance, tuned for fiction workflows.
- **Representative capabilities:** Scene expansion from beats, dialogue polish, tone/voice style locks, cliffhanger suggestions, “explain change” diff rationale, and contextual Q&A on manuscript.
- **Matrix:**
  | Criterion | Rating | Notes |
  | --- | --- | --- |
  | Impact | 5 | Delivers the strongest assistant-like experience. |
  | Delivery Effort | 4 | Requires prompt/guardrail design, model routing, and usage controls. |
  | Technical Risk | 3 | Model cost, latency, offline fallbacks, and privacy constraints. |
  | UX Risk | 3 | Must avoid over-automation, hallucinations, or tone drift. |
- **Pros:** High leverage for writers; enables iterative coaching and experimentation.
- **Cons:** Operational costs and compliance work; risk of stylistic mismatches.
- **Compatibility:** Consumes structure from Path 2, templates from Path 1, notes from Path 4, and can publish drafts via Path 5.

## Path 4: Research & Knowledge Hub
- **Concept:** Integrated note-taking and citation system with local/remote sources, quick fact checks, and inline citations; supports reading mode and web clipper extension.
- **Representative capabilities:** Source inbox, quote/highlight extraction, backlinking between notes and scenes, glossary enforcement, and “evidence view” for verifying passages.
- **Matrix:**
  | Criterion | Rating | Notes |
  | --- | --- | --- |
  | Impact | 4 | Reduces research friction and continuity errors. |
  | Delivery Effort | 3 | Needs storage, search, and clipping integrations. |
  | Technical Risk | 2 | Manageable if scoped to local storage first. |
  | UX Risk | 2 | Must avoid clutter and maintain trust in citations. |
- **Pros:** Strengthens worldbuilding and accuracy; good standalone value.
- **Cons:** Data ingestion could sprawl; sync/privacy decisions needed.
- **Compatibility:** Feeds references into Paths 2 and 3; can annotate outputs destined for Path 5.

## Path 5: Publishing, Metrics & Habit Loop
- **Concept:** Streamlined export, formatting, and distribution pipeline (Markdown → manuscript → EPUB/PDF) with progress analytics and writing-habit nudges.
- **Representative capabilities:** Style presets (Chicago/UK), compile-to-EPUB/PDF/Docx, word-count streaks, sprint timers, and submission checklists.
- **Matrix:**
  | Criterion | Rating | Notes |
  | --- | --- | --- |
  | Impact | 3 | Helps finish and ship work; reinforces habits. |
  | Delivery Effort | 3 | Requires converters, theming, and telemetry plumbing. |
  | Technical Risk | 2 | Mostly format edge cases; manageable. |
  | UX Risk | 2 | Ensure metrics motivate rather than nag. |
- **Pros:** Clear “done” path; tangibly useful for publication-ready drafts.
- **Cons:** Conversion fidelity and template maintenance can be ongoing chores.
- **Compatibility:** Consumes content from all other paths; non-blocking and modular.

## Cross-Path Notes
- Paths 1 and 2 establish structural and UI foundations that boost success of Paths 3–5.
- Path 3 adds intelligence and benefits most from data produced by Paths 2 and 4.
- Path 4 enhances accuracy and context for Paths 2 and 3 and annotates outputs for Path 5.
- Path 5 is a downstream consumer and can ship incrementally once upstream assets exist.
- All paths can be layered; start with 1 → 2, add 3/4 selectively, then expand into 5.
