# Private Annotations Design

**Status:** Working design for a reusable private-note capability. Prototype against more than one target type before choosing implementation order; this does not make a private note a comment page or public link.

## Purpose and Reuse

A private annotation is authored and owned by one signed-in user, and attached to a stable target they can access. It is not a field on the target, is not visible to the target/page owner by default, and does not create a page or link.

The reusable foundation is:

- Stable target identity (`target_type` plus `target_id`).
- Author identity derived from the validated session.
- Create/read/update/delete and owner-scoped search.
- Access checks for the target and the annotation on every request.
- A batched, authenticated load of the current user's annotations for targets on a page.
- A shared popover section for displaying, editing, and deleting those annotations.

Candidate target types include `contact` and Bible/content targets such as `page`, `fragment`, or `word`. A small prototype should compare at least one target owned by the note author (a contact) with one target they may only be allowed to read (a Bible word or another user's public page). Implement target support only after each target type has a stable ID and an access-checking resolver.

## How This Relates to Linked Comment Pages

Private annotations and linked comment pages should share target IDs, popover integration, session-derived identity, access-check utilities, and some client-side loading/rendering code. Their data and workflows remain distinct:

- A private annotation is private text owned by its author and attached to a target. It is editable/deletable by that author and is not shared by default.
- A linked comment page is a separate page with its own stable page ID, URL, visibility/grants, page pattern, and possible public moderation/publication lifecycle.
- Creating or deleting a private annotation must not create, publish, or delete a linked page. Creating a linked page must use its own grant/moderation workflow.

Implementing private notes for one target can exercise reusable popover, target-resolution, private-fetch, authorization, search, and CRUD primitives. Comparing contact and Bible/content targets is important before committing to the model: the target owner and note author may differ, and target access can change. Private annotations do not by themselves implement linked-page creation, public links, proposals, or R2 publication.

## Candidate Data Model

If the prototype confirms a reusable model, use a separate annotations table; do not add note columns to `contacts` or other target tables.

Proposed fields:

- `id`: stable annotation ID.
- `author_user_id`: owner from the authenticated session.
- `target_type`: constrained identifier for the target class; initially `contact` only.
- `target_id`: stable ID within that target class.
- `body`: private note text.
- `created_at`, `updated_at`.

For the initial implementation, consider one editable note per author/target, uniquely keyed by `(author_user_id, target_type, target_id)`. This keeps create/update/delete and the popover simple. Confirm this in the prototype; if users need multiple separately dated notes, choose that contract before schema implementation rather than adding a history log speculatively.

Store no caller-supplied owner email as authority. Index by `(author_user_id, target_type, target_id)` for popover loads and by `(author_user_id, updated_at)` for the author's notes/search. Do not index private note text globally in a way that returns matches across users.

## Prototype Behaviors to Compare

- On a contact target, the note author is also the contact-list owner.
- On a Bible word or another public content target, the note author may differ from the page/content owner.
- The relevant popover displays a collapsed `Private Notes` section when a note exists and an appropriate empty/add state when none exists.
- Expanding the section reveals the author's note and controls to edit or delete it.
- A batch request loads the current user's notes for visible target IDs on the page. It is authenticated, private/no-store, bounded to the current page's target IDs, and never embedded in shared static HTML.
- A target/page owner who is not the note author cannot read the note unless a later explicit note-sharing feature is designed.
- Search results, snippets/excerpts, counts, and autocomplete expose only the current author's notes and must not reveal note existence to other users.
- A note does not change target content, contact fields, group membership, or the target's share grants.

The prototype should answer whether one storage/API/popover abstraction cleanly supports both target cases. If target authorization or retention semantics diverge too much, keep target-specific implementations behind a shared UI contract rather than forcing premature schema generalization.

## Access Rules for Future Targets

When notes are extended beyond contacts:

1. Resolve the stable target and verify that the requester can read it.
2. Read or mutate only annotations where `author_user_id` equals the authenticated user ID.
3. For a batch popover request, authorize the page/targets first, then return only the caller's annotations for authorized targets.
4. Do not let a target owner, group member, moderator, or public viewer see a note solely because they can see its target.
5. Apply the same checks to search and result metadata; never rely on hiding a note in the UI.

If the author later loses access to a target, do not show the annotation in that target's popover to other viewers. Whether the author can still find/edit/export their note from a personal notes area, or whether the note is hidden from search until target access returns, remains a policy decision.

## TDD Plan

Use focused red-green-refactor slices after the target model is validated:

1. **Ownership:** tests prove that an author can CRUD their note, a different signed-in user cannot read or mutate it, and a client-supplied `author_user_id` is ignored.
2. **Target access:** tests prove a note can only be created for an existing target the author may read; test both a contact and a non-owned readable content target.
3. **Popover loading:** a batch request returns the current user's notes only for authorized requested target IDs, with private/no-store caching; no note content appears in static HTML.
4. **Search:** tests prove notes are searchable by their author while another user cannot learn matches, counts, or note existence.
5. **UI:** tests cover collapsed/expanded, empty, loading, edit, delete, failure, keyboard, and narrow/wide viewport states.
6. **Target resolvers:** add target-specific authorization tests for each supported target type before enabling it.

## Follow-on Decisions

- If target access is later revoked, may the note's author access the note from a private notes index, or is it hidden until target access returns?
- What retention/export behavior applies to annotations when the target is deleted, the author account is deleted, or a legal/privacy deletion is requested?
- Which future target type should be added first after contacts: pages, fragments/words, or comment pages?
- Should multi-target selection create one annotation per target, or a single annotation associated with the selection as a set? Suggested initial behavior for a future multi-word note: one annotation per target, created atomically, unless users need a shared note spanning the selection.
