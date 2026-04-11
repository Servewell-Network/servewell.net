# AGENTS.md

This file is the canonical project guidance for architecture, modularity, and safe change patterns.
It is intended for both human contributors and AI coding agents.

## Core Principles

1. Respect phase boundaries.
- Phase 1 scripts ingest and align source data.
- Phase 2 JSON is the canonical intermediate representation.
- Phase 3 scripts render static output from Phase 2.

2. Treat generated artifacts as outputs, not authoring surfaces.
- Do not hand-edit generated files under `src/json-Phase2/` or `public/-/`.
- Make changes in source scripts, then regenerate.

3. Keep data contracts explicit and stable.
- `src/phasingScripts/phase1To2/phase2Types.ts` defines cross-phase schema contracts.
- If a contract changes, update all producers and consumers in the same change.

4. Keep runtime concerns separated.
- Worker routing stays minimal and focused in `src/index.ts`.
- Static content is served from `public/` via Wrangler assets config.
- Data processing and rendering logic stays in `src/phasingScripts/`.

5. Build client features as modules with lifecycle.
- Prefer feature modules with explicit `activate` and `deactivate` behavior.
- Register modules through the module registry; do not hard-wire feature state globally.
- Register UI interactions through delegated listeners with disposers.

6. Preserve deterministic, repeatable generation.
- Generation scripts should be idempotent when rerun.
- Keep chapter/file ordering stable and predictable.
- Avoid hidden side effects in template/base helpers.

7. Keep alignment overrides layered and traceable.
- Manual supplement overrides are authoritative over auto-generated suggestions.
- Supplement keys and normalization logic must match parser lookup behavior.

8. Prefer additive, localized changes.
- Avoid broad refactors unless required by a specific defect or feature.
- Preserve existing public shape and output structure when possible.

9. Defend boundaries and sanitization.
- Treat external/source text as untrusted for direct HTML injection.
- Normalize and sanitize text before rendering.

10. Validate at the right level before commit.
- Run the smallest relevant script/test set for your changes first.
- Regenerate affected outputs and confirm logs are clean enough for merge.

11. Prefer TDD when practical.
- When a bug or behavior change is reported, add or update a focused failing test first.
- Implement the minimal fix, then rerun the same test(s) to confirm they pass.

## Standard Validation Checklist

- Data ingestion/alignment changes: run `npm run p1a-2` and/or `npm run p1b-2` as applicable.
- Alignment review workflow changes: run `npm run p1b-review` and `npm run p1b-apply-review` (or copy variant) as applicable.
- Rendering/output changes: run `npm run p2-3`.
- App shell/browser module changes: run `npm run build:servewell-app-shell`.
- Worker behavior changes: run `npm test`.

## Change Placement Guide

- Input/source parsing logic: `src/phasingScripts/phase1aTo2.ts`, `src/phasingScripts/phase1bTo2.ts`
- Review tooling and supplement management: `src/phasingScripts/generateAlignmentDoubleCheck.ts`, `src/phasingScripts/applyAlignmentReviewSelections.ts`
- Rendering/generation: `src/phasingScripts/phase2To3.ts`, `src/phasingScripts/phase2To3/*`
- Runtime edge worker entry: `src/index.ts`
- Static shell/assets/templates: `public/`, `src/phasingScripts/phase2To3/makeHtmlBase.ts`

## Decision Rule

When in doubt:
- Choose the smallest change that preserves current contracts.
- Keep source-of-truth layers clean.
- Regenerate instead of patching generated output by hand.