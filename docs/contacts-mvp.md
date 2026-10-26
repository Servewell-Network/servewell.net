# Contacts MVP Implementation Brief

**Status:** Draft for implementation planning. This defines the first Contacts vertical slice; it does not settle the full shared-group lifecycle in [Contact Group Sharing Design](contact-group-sharing-design.md).

## Outcome

A signed-in Ambassador can create and manage a private Contacts list at `/my/contacts/`, add contacts to named groups, find contacts by searching content such as name or groups or notes using the existing native find-in-page browser tool, and insert stable contact references into other content. Another registrant cannot read or modify this data by guessing a URL or identifier. Ambassador grants early eligibility for features, not access to another user's data. Former Ambassadors retain read/export/delete access to their existing data but cannot create or edit it.

The list has one owner and is private by default. Keep public/approved pages on their current asset-first delivery path. Requests under `/my/*` are routed through the Worker, which validates the existing session and authorizes each operation.

## First-Slice Scope

### Included

- Change https://servewell.net/list-to-moderate to https://servewell.net/moderator-page and change the page title from List to Moderate to Moderator Page.
- Give moderators on Moderator Page a field to enter an email address with a checkbox for Ambassador status and a Send button, which causes an invitation to be sent to that email address with a magic link causing them to be immediately signed in (with Ambassador status if the checkbox was selected).
- Let the Account item have a badge -- gray with a lighter gray text count of 0 by default, and make the Account button and its badge a link to the /my page where they can see (if they're not Ambassador) a non-deletable message with a button that says ask to become Ambassador if you want access to the Contacts feature. That button can send moderators an email with the request and a link to Moderator Page. When the Account badge is gray/0, there is no badge on the hamburger menu icon.
- Send an in-app notification to all users when they are given Ambassador status, meaning their account item in the menu has an orange badge with a white text count of 1 and a badge on the hamburger menu icon with the same count in the same color, and that early notification should include congratulations on receiving early access to the Contacts feature. They'll see the Contacts link there. They should also see an x on the notification to delete it. It can also go away a day after it's viewed. The checkboxes for roles should also be moved into the /my page, out of the menu.
- Create the Contacts list on first use, initiated by clicking the Contacts link in the /my page or in any other way going to the /my/contacts page.
- Create, read, update, and delete contacts owned by that user.
- Store the initial Contact fields: required Unique Name (Unique Text), optional Casual Name (Text Line), Birthdate, Friends (references to other contacts), Groups, and Notes (Text Multiline). Only Unique Name is required; lists may be empty.
- Initialize the list from the published Contact template, pin its immutable version, and use its structured field/type definitions for form rendering and server validation. Provide an owner-authorized read-only `/my/contacts/_fields` view linked from the per-page menu.
- Create, rename, and delete named groups owned by the user.
- Add/remove contacts to/from groups; show groups and their members.
- Render the full list so the browser's native find-in-page can match names, groups, and notes: the MVP does not paginate the list view, and any collapsed letter sections auto-expand or render their text for matching. In-app server search is deferred; see [Expansion Plan](Expansion-Plan-October-2026.md#search-and-indexing).
- Resolve `@Contacts.<query>` into autocomplete results and insert a reference tied to a stable contact ID, not a display string or mutable slug.
- Show a contact detail view or popover with links to the source entry and permitted actions.
- Import contacts from CSV or TSV via file upload or paste: one required header row whose column names match Contact field names (normalized per the name rules), a required Unique Name column with all other fields optional, a parse-and-preview step showing row-level errors before anything is written, and an all-or-nothing confirmed commit. Delimiter (comma or tab) is auto-detected from the header line. The 128 KB request-body cap applies. Unknown columns, unknown group names, invalid dates, and duplicate normalized unique names — within the file or against the existing list — are reported as row errors; nothing is imported until the batch is clean. Friends is excluded from import columns because name-based resolution is order-dependent at import time; importing Friends is a follow-on.

### Not in the first slice (see also 'Follow-ons')

- Sharing a whole Contacts list or selected groups with other registrants.
- Live imported groups, acceptance invitations, group revocation, and deprecation/copy flows. These are specified separately and should follow the private owner workflow.
- Arbitrary user-defined fields, notes on arbitrary page/word targets, messaging delivery, reminders, assignments, and curriculum tools.
- Public Contacts pages.
- In-app server search over contacts. The MVP relies on the browser's native find-in-page over the fully rendered list; the `@Contacts.<query>` autocomplete gesture for reference insertion is unaffected. Scoped server search across an expanding graph of pages is deferred — see [Expansion Plan](Expansion-Plan-October-2026.md#search-and-indexing).

## User Scenarios

1. As a signed-in registrant, I open `/my/contacts/` and see my list, or an empty-state action to create it.
2. I add a contact with a unique name and optional casual name, birthdate, friends, groups, and multiline Notes for information that does not fit the fixed fields.
3. I use the browser's find-in-page to locate a person by unique name, casual name, group, or note text and navigate to that contact's stable entry.
4. I create a group such as `churchMembers`, add/remove contacts, and filter the Contacts view by that group.
5. While editing a contact's Notes, I type `@Contacts.Mar`, choose a contact/display label, and insert a reference that continues to resolve if the contact's displayed name changes. Notes is the first insertion host; a general page editor is not required.
6. I edit or delete my contact/group and see consistent results in search, group membership, and references.
7. I export a spreadsheet from elsewhere, upload or paste it as CSV/TSV with a header row, review the parsed preview and fix flagged rows, and confirm to add the batch — or get a clear error list with nothing partially imported.
8. A signed-out visitor or a different registrant requests my Contacts URL or API data and receives no private contact data.

## Data Contract Proposal

Use stable opaque IDs and owner IDs in storage. The user-facing unique name is a validated field, not the database key.

Separate contact identity, reference display, and URL aliases. An inserted reference stores the list ID, opaque contact ID, and selected display form (Unique Name or Casual Name); its visible label can be `@MarcusReese` or `@Marcus`. Typing `@Contacts.Mar` is the lookup gesture, not the persisted identity. Readable fragments such as `#MarcusReese` in overview examples are aliases, not database keys; renaming a contact must not retarget an existing reference. Resolve IDs only through an authorized endpoint, and never treat possession of a reference as a share grant.

- `contact_lists`: `id`, `owner_user_id`, timestamps. One list per owner for the initial workflow.
- Each list also stores its pinned template/version ID and local schema ID. Persist stable field IDs, structured type definitions, and field order; initially the local schema has inherited fields only. Public template definitions remain immutable. See [Form Templates and Local Field Schemas](form-templates-design.md).
- `contacts`: `id`, `list_id`, `unique_name`, `casual_name`, `birthdate`, `notes`, timestamps; unique constraint on `(list_id, normalized_unique_name)`.
- `contact_groups`: `id`, `list_id`, `group_name`, timestamps; unique constraint on `(list_id, normalized_group_name)`.
- `contact_group_members`: `(group_id, contact_id)` with uniqueness and foreign keys.
- `contact_friends`: `(contact_id, friend_contact_id)` with uniqueness and foreign keys; both contacts must belong to the same list.

Friends is directional: adding Susan to George's Friends does not add George to Susan's Friends. Reject self-references on the server and in database constraints where possible.

Canonical contact links use `/my/contacts/#contact-<opaque-id>` with a full randomly generated identifier, not the person's name or a short guessable counter. Visible labels may contain names, but new contact URLs must not. This reduces personal information in copied links, browser history, screenshots, and tooling. HTTPS normally encrypts paths/query strings in transit, and fragments are not sent in HTTP requests; the hostname may still be observable, and endpoints/browser tooling can expose full URLs. Opaque IDs reduce exposure, not provide anonymity or authorization.

For unique names and group names, preserve the original spelling for display and compare a key derived by trimming whitespace, normalizing to Unicode NFC, and applying Unicode case folding. Enforce this in one shared validation function and with database constraints where possible. Reject `:` in ordinary group names because it is reserved for the display of imported shared groups in a later sharing slice.

Persist the normalized comparison keys named in the uniqueness constraints. Use one versioned normalization policy on the server and test composed/decomposed characters and case-fold expansions; JavaScript lowercasing and SQLite's built-in NOCASE alone are not full Unicode case folding. Reject empty normalized required names. List initialization and relationship updates must be atomic/idempotent, with list-ownership consistency enforced for both ends of group/friend relationships, not just independent foreign keys.

Every query must scope by the authenticated `owner_user_id` or prove an accepted share grant. Never accept `owner_user_id` as an authority from the request body. Do not return private contact records in cacheable HTML or shared CDN responses.

Notes is an optional ordinary contact field of type Text Multiline, edited with a multiline input. Preserve its text and line breaks and render it as escaped plain text, not HTML or executable markup. It is private with the owner-only Contacts list in this MVP. When contact sharing is implemented, Notes is included whenever present on a shared contact, unlike author-only Private Notes. Notes text is findable via the browser's find-in-page over the fully rendered list; in-app server search is deferred.

Notes also supports explicitly inserted contact-reference tokens. Persist escaped text plus validated structured reference metadata, not executable HTML or names parsed as identity. Preserve line breaks and safe plain-text fallback labels. Index internal reference targets for impact lookup; deleting a contact keeps embedded Notes references attached to its retired ID as unavailable, never rewrites them to a replacement contact. External/copied links cannot reliably be found or rewritten. Define token serialization and edit-range maintenance before implementing autocomplete.

Deleting a contact removes it from active Friends/group membership, releases its Unique Name for reuse, and moves its personal data into owner-accessible Trash for one year. Purge personal fields, including Notes, after that period; preserve only the minimal retired-ID information required to prevent reference retargeting. A new contact with a reused name always receives a new ID. If restoration encounters a reused name, require a new unique name rather than merging identities. Backup expiry, account deletion/export, and any exceptional privacy erasure rules must be documented before release; one-year Trash is not a reason to retain purged data indefinitely elsewhere.

Initial practical limits: Unique Name, Casual Name, and Group Name each allow 200 Unicode code points; Notes allows 20,000. List/search responses contain at most 50 contacts with pagination, not a total-contact quota. Specify companion request-byte and relationship-list bounds in the API contract.

## Route and UI Contract

- `GET /my` redirects to the canonical `/my/` URL.
- `GET /my/` serves an authenticated “My” index listing only personal areas and pages the current user is authorized to access. In the Contacts MVP, include a Contacts link to `/my/contacts/` or an action to initialize the list; do not list unbuilt feature areas as if they are available.
- For signed-out browser visits, `/my` first redirects to `/my/`; `/my/` and every `/my/...` page then show a sign-in-required view rather than silently redirecting away. Show: "This is a private area. Sign in to access your pages and anything shared with you." Provide Sign in and Home actions, revealing no private page names, existence, counts, or other metadata.
- Sign in launches the existing sign-in flow and preserves a validated same-origin return destination. After authentication, retry that destination and check authorization again; signing in does not grant access to someone else's private data. Preserve a target fragment client-side where needed, since URL fragments are not sent to the Worker. Reject external or malformed return destinations.
- Signed-out API requests return a `401` JSON response, not the browser sign-in view or an HTML redirect. Private page and API responses use private/no-store cache headers.
- `GET /my/contacts/` serves the Contacts application shell through the Worker path.
- `/my/contact-groups/` exposes the owner's group data set; `/my/contact-groups/_fields#Group_Name` identifies its required Unique Text field for the Contact template's optional Groups list. Use the same underlying group records as Contacts group management.
- Contacts/group CRUD and search use authenticated `/api/my/contacts/*` endpoints (exact endpoint names may follow existing API conventions).
- Include both the exact `/my` path and `/my/*` in narrow Worker-first asset routing; do not enable Worker-first routing globally. Match this namespace at a path boundary, not unrelated paths such as `/myths`.
- API responses containing private data use private/no-store cache headers.
- Contact references encode the stable ID in the destination (for example, a fragment ID); display names remain presentation only.
- All actions have pending, empty, validation-error, not-found, and denied-access states. Keep the design usable on mobile and keyboard-accessible.

### Before/after static-routing regression

Verify the current behavior before changing Wrangler routing, then repeat the same check after adding the exact `/my` path and narrow `/my/*` Worker-first pattern. Use a local integration harness that adds a test-only response header such as `X-Test-Worker-Invoked: 1` to every response produced by Worker code, including responses returned through `env.ASSETS.fetch()`. Do not ship this marker in production.

1. Start from the current asset-first configuration and request a known public asset outside `/my/*` (for example, `/about.html`). Assert the response is successful, contains the expected asset content, and has no `X-Test-Worker-Invoked` header. Save the response status/body hash as the baseline.
2. Add only `/my` and `/my/*` to `assets.run_worker_first` and repeat the exact public-asset request. Assert its status and body hash are unchanged and the Worker-invocation marker remains absent. Probe a chapter page and a JavaScript asset too. This proves ordinary public static traffic still bypasses the Worker after the routing change.
3. Probe `/my`, `/my/`, and a nested `/my/contacts/` route while signed out, without automatically following redirects. Assert the Worker marker is present: `/my` redirects only to `/my/`, and the canonical/nested pages show the generic sign-in-required view without private metadata. Test an unknown nested private path too: its signed-out response must not reveal whether a private resource exists. This proves the exact root and private namespace reach the Worker.
4. Keep the integration test as a regression test for both routing properties. Fail the test if configuration is broadened to `run_worker_first: true` or another pattern that matches the public-asset probe.

The test must exercise Wrangler's actual asset-routing behavior, not just call the Worker handler directly; a unit test of the handler cannot prove that a matching public asset bypasses Worker execution.

Validate the marker harness with a known dynamic request in both configurations; absence of a marker is meaningful only if instrumentation is working. Use HTTP requests without browser scripts so page-load auth/API calls are not confused with the asset request itself. Add a temporary synthetic asset under `/my/` in the isolated test fixture to prove authentication runs even when a matching asset exists; do not add private data or this test asset to production. Keep the baseline and candidate inputs identical apart from the intended route configuration/handler changes.

## Acceptance Criteria

### Ownership and authorization

- A registrant can create a list and only sees their own contacts and groups.
- A second registrant cannot read, search, mutate, or infer the first registrant's data through IDs, slugs, autocomplete, error messages, or result counts.
- Signed-out requests to private routes/APIs do not return contact data.
- Browser tests cover the private-area message, Sign in and Home actions, safe return after authentication, and authorization rechecking. API tests assert `401` JSON, and neither path exposes resource existence before authentication.
- The server derives identity from the validated session; changing client-supplied email/user IDs does not change ownership.
- Cookie-authenticated mutations enforce a documented CSRF defense and reject untrusted origins; CORS and hidden buttons are not authorization. Test missing/invalid session, expired session, cross-owner IDs, and forged mutation requests. Log diagnostic IDs and outcomes, not contact names, Notes, or request bodies.
- Requests for `/my/*` reach the Worker before any static-asset match; ordinary public static routes remain asset-first.

### Contact/group behavior

- Unique names are required and unique within a list after normalization; collisions return a useful validation error.
- Only Unique Name is required and must be nonempty after trimming. All other Contact fields may be empty; invalid nonempty dates and references are rejected consistently. Text Line and Unique Text reject embedded line breaks.
- Notes can be created, updated, and cleared; multiline and Unicode text round-trip without losing line breaks, and HTML-like text displays literally without executing. Notes follows the same owner-access checks as other contact fields.
- Group membership updates are idempotent and do not create duplicate memberships.
- Deleting a contact removes it from active group membership and friend lists. Existing references retain the stable contact ID and display an unavailable-contact state rather than silently resolving to a different contact.
- Group filtering and the fully rendered list return only authorized records and stable contact IDs, and the rendered list text supports the browser's find-in-page across names, groups, and notes.
- Contact forms and server validators use the same pinned schema definitions. `_fields` shows the origin and field/type definitions without mutation controls; attempted origin/version changes are rejected by the server.

### References

- Autocomplete results are limited to contacts visible to the current user.
- Inserting a contact reference stores its stable contact ID and chosen display form.
- Renaming the casual or unique display value does not change the target identity; deleted contacts produce a clear unavailable-reference state.

### Regression and operation

- Add worker/API tests for unauthenticated denial, owner access, cross-owner denial, and validation failures.
- Add client tests for contact editing, group membership, find-in-page rendering, and reference resolution.
- Add a migration test and a rollback/recovery note before deploying schema changes.
- Run and preserve the before/after static-routing regression above when introducing `/my/*` Worker-first routing.
- Add a Contacts visual-preview fixture to the `pre-deploy.mjs` slideshow so shared CSS or component changes are inspected before deployment.
- Record D1 rows read/written and verify indexes support owner/list lookups, normalized name search, and group membership queries.

### Visual preview and privacy

The pre-deploy slideshow should include the Contacts UI at wide and narrow viewport sizes, covering at least a populated list with groups, the contact editor, a contact popover/reference state, and an empty or validation state. Build the preview from clearly synthetic fixture data and the same production Contacts components/styles so presentation changes are visible in the normal review flow.

The preview must not load or copy data from a registrant's real Contacts list. If the fixture is served as a static page (for example, under `public/test-r2/`), treat it as public and use only invented sample records. Keep the fixture visibly labeled as sample data. It is for visual inspection only: it does not replace authenticated API tests or the `/my/*` routing/authorization integration tests.

When Contacts styles or shared app-shell styles change, the pre-deploy reviewer should inspect both Contacts viewport sizes and at least the empty state and populated state before approving deployment.

## TDD Approach

Use red-green-refactor for behavior with a clear contract: first write the smallest focused test that fails, implement only enough to pass it, then refactor while keeping the test green. Work in vertical slices rather than writing the entire test suite up front.

Good test-first contracts for this MVP:
- Name/group normalization: equivalent trimmed, NFC-normalized, case-folded inputs collide, while stored display spelling is preserved.
- Ownership boundaries: signed-out and cross-owner reads/writes fail; the owner succeeds; client-supplied owner IDs do not grant access.
- Group behavior: membership add/remove is idempotent, contacts may have no groups, and deleting a contact removes active group/friend membership.
- References: autocomplete returns only authorized contacts; the stored reference uses a stable ID and remains unavailable rather than retargeting after deletion.
- API validation and persistence: invalid dates/references and duplicate normalized names fail with defined responses; valid operations persist and can be read back.
- Notes: test empty, multiline, Unicode, clearing, cross-owner denial, and safe display of HTML-like text.
- Template foundation: initialization pins an immutable version; changing `latest` leaves existing lists unchanged; schema reads are owner-authorized; UI and server reject origin changes and unsupported types.

For the static-routing change, run the before/after integration probe against the current Wrangler configuration first and record the public asset response/Worker marker as the baseline. Then add only `/my` and `/my/*` to Worker-first routing and rerun the same probe: the public asset must still bypass the Worker, while private routes must enter it. Keep this as a routing regression test.

For UI work, first prototype uncertain interactions such as the Contacts empty state, contact editor, and popover/autocomplete on desktop and mobile. Once the interaction is agreed, write tests for observable behavior, keyboard access, loading/empty/error states, and stable reference insertion. Avoid brittle tests that assert exact layout markup or colors.

Defer or test later when their contracts are defined: live group sharing, proposal/publication workflows, custom fields, and tombstone retention. Do not invent tests that lock in unresolved follow-on behavior.

## MVP Decisions

- Unique names are unique per list after trimming, Unicode NFC normalization, and case folding. Preserve the original spelling for display.
- Start with the fixed Contact template fields, backed by real versioned schema definitions rather than a separately hard-coded form. Include public Contact v1/latest routes, the implemented type catalog, and the read-only local `_fields` view. Custom fields and Add/Override editing remain deferred.
- The origin is fixed after initialization, including its version. Define types structurally and support Text Line, Text Multiline, Unique Text, Date, List, and Form Field for this slice. Only Unique Name is required in the Contact template, and ordinary Notes accompanies a shared contact when present. See [Form Templates and Local Field Schemas](form-templates-design.md).
- Deleted contacts leave active group membership and friend lists. Existing references retain the stable ID and display an unavailable-contact state.
- Ship owner-only Contacts before group sharing. Group membership is optional; a contact may belong to zero groups.

## Follow-ons

- **Custom fields:** Revisit after fixed Contact fields, template updates, and moderator review are working. Decide field types, per-field visibility/search, and how user fields may be proposed for the shared template. Custom-field columns would then also become importable; the v1 importer only accepts the fixed Contact field names.
- **Import Friends column (deferred):** CSV/TSV import in the first slice covers Unique Name, Casual Name, Birthdate, Groups, and Notes. A Friends column requires resolving contact names that may appear later in the same file or not at all; define two-pass resolution and error reporting before adding it. A possible direction: accept canonical reference tokens as well as names.
- **Google Contacts import (deferred):** No import, Google OAuth, or synchronization work is scheduled. Revisit only when explicitly prioritized; it is not a prerequisite for Contacts MVP or its immediate follow-ons.
- **Shared contact groups:** Implement as a separate slice after owner-only Contacts is stable. Use [Contact Group Sharing Design](contact-group-sharing-design.md) to resolve the field allowlist, recipient edits, revocation, removal notices, and copy behavior before enabling sharing.
- **Private annotations:** Validate the reusable model with a small prototype on both a contact and a Bible/content target before deciding whether it belongs before or after Contacts MVP. Resolve target identity, target-access requirements, author-only search, and popover loading in [Private Annotations Design](private-annotations-design.md).
- **Deleted-contact lifecycle:** One-year Trash and safe name reuse are approved MVP requirements. Before deletion ships, specify minimal retired-ID storage, restore collisions, scheduled purge, backup expiry, and account deletion/export behavior; do not defer these safeguards beyond release.
- **Template evolution:** Origin/version changes remain forbidden until a separate comparison/mapping, data validation, and recovery workflow is designed and tested. Add Field and Override Field editing, additional validators, and accessible reordering follow the read-only MVP foundation in [Form Templates and Local Field Schemas](form-templates-design.md).

## Suggested Build Sequence

1. Write the routing integration probe and run it against the current config to establish the asset-first baseline.
2. Add the exact `/my` and narrow `/my/*` Worker-first route rules and authenticated route handling; rerun the probe and preserve public asset behavior.
3. Write failing tests for normalization and owner-scoped data access, then add the D1 schema/migration and repository functions until they pass.
	Include the Contact v1/type definitions, pinned local schema, read-only `_fields` view, and shared form/server validation in this foundation before implementing CRUD forms.
4. Implement list/contact/group CRUD in small test-backed slices, including validation and deletion/reference behavior.
5. Prototype and implement the responsive Contacts UI; add behavior/accessibility tests for agreed interactions.
6. Implement `@Contacts` autocomplete/reference insertion with tests for stable IDs and privacy. Autocomplete is the only server-side contact lookup in this slice; it is scoped to the owner's list and returns minimal display fields.
7. Run focused and full relevant tests, verify migrations and rollback/recovery, and review D1 usage before enabling it for users.
8. After this slice is stable, implement selected-group sharing from the separate design note.

## Engineering Contracts

These contracts resolve the remaining implementation-readiness gates. Product choices recorded here require doc review before implementation; technical choices are proven with focused tests during implementation.

### Notes reference tokens

- **Storage:** Notes text stores references as constrained CommonMark inline links of exactly one recognized form: `[fallback label](#contact-<opaque-id>)`. Text counts as a reference only when the destination exactly matches the canonical contact-fragment shape; anything else is literal text. This reuses CommonMark's existing bracket and escaping rules instead of inventing a token grammar, and tokens live inline, so text edits cannot corrupt stored offset ranges.
- **Rendering:** Token text never becomes raw HTML or a navigable link without authorization. A token whose ID does not resolve within the owner's list is inert and displays as literal text.
- **WYSIWYG editing:** The Notes editor renders each validated token as an atomic inline chip showing the current resolved display label (for example `@Marcus`), not the raw syntax; the chip is a single unit for caret movement, selection, and deletion. Only the `@Contacts.<query>` autocomplete gesture creates tokens; the server validates that the target contact belongs to the owner's list at insert time. If the rich editor is unavailable, a plain multiline input shows the raw text, which round-trips safely and grants nothing.
- **Resolution:** On read and save, the server resolves token IDs to the current display value under the stored display form (Unique or Casual). Deleted contacts render an unavailable-contact state against the retired ID; tokens are never rewritten to another contact. The stored fallback label is a display cache for contexts where resolution is unavailable (such as export), not an identity.
- **Reference index:** Maintain `contact_note_refs(list_id, from_contact_id, to_contact_id)` atomically with each Notes save (replace the note's rows in the same transaction) for deletion impact lookup. External or copied links cannot be discovered or rewritten, as the data contract already notes.

### Reservations, save/handoff, and reconnect

This applies the settled fragment boundary: one contact record is one fragment, with server-enforced, per-tab reservations.

- **Lease:** Five-minute TTL, renewed by heartbeat roughly every two minutes while an editor is open, so a single missed heartbeat does not end the lease. After four minutes without a heartbeat, display a 60-second countdown explaining that the reservation is about to expire for inactivity, with an explicit keep-editing action; any editing activity renews the lease and dismisses the countdown. Renewal failure or lease loss moves the editor to an expired state that preserves the draft and explains what happened, using the settled same-user wording where it applies.
- **Save:** Explicit save action. Writes carry `baseRevision` and `leaseId`; the server rejects a stale revision or an expired/foreign lease with `409` and never applies a partial update. A rejected save keeps the draft in place; the user can review the current server value and retry. There is no silent overwrite and no auto-merge in this slice.
- **Handoff:** Release the lease on save, cancel, or tab close (best-effort). While no one else is queued for the fragment, an active editor can keep editing indefinitely; the lease simply keeps renewing with activity. When another authorized user joins the queue, server push notifies the current editor that a ten-minute window has begun, and after nine minutes the editor displays a 60-second countdown explaining that editing privilege is about to pass to the next reservation in the queue. At window end, editing and saving freeze, the current editor is moved to the back of the queue with a promised future window (start and end times), and any unsaved draft is preserved and provided separately for the user to save in the place of their choosing, with the understanding that they must merge considerately with changes committed in the meantime. A same-user duplicate tab never joins the queue or starts a countdown, per the settled same-user rule; on ordinary lease expiry with an empty queue, another reservation — including the owner's other tab — may acquire the fragment. The owner-only MVP has no other authorized editors, so queue windows are specified now but only become reachable with the collaborative-editing slice; the inactivity lease mechanics ship now.
- **Reconnect:** On focus, visibility, or network resume, revalidate the revision and lease. If this tab still holds the lease, resume silently. If the same user holds it elsewhere, use the settled same-user messaging. If it expired, offer re-acquisition with the draft preserved. Correctness never depends on the client honoring these rules; the server enforces them on every write.

### Committed-update push

- **Transport:** Authenticated Server-Sent Events at `GET /api/my/contacts/events`, opened only while the user has the Contacts editor open or holds an active reservation/queue interest — not for ordinary page views.
- **Payload:** Events carry minimal notices only, such as `{type, contactId, revision}` for `contact-updated` and `contact-deleted`. Personal field content is never pushed; clients refetch data through normal authorized endpoints.
- **Authorization:** The channel is scoped server-side to the session owner's list; client-supplied list or user IDs are ignored. Auth is checked at connect and revalidated periodically; reconnect after session expiry receives `401`.
- **Draft safety:** Applying an event must skip the fragment being edited when it has unsaved changes and show a non-destructive "updated elsewhere" indicator instead. Pushed updates never overwrite a draft.
- **Degradation:** If SSE is unavailable, fall back to revalidate-on-focus/visibility; nothing in the save path depends on push. WebSockets and Durable Objects are deferred to the collaborative-editing slice; one-directional SSE covers committed-update notices here.

### API shapes, limits, and errors

- **Paths:** Follow the existing flat convention (`/api/auth/me`, `/api/vote/<id>/<direction>`): `GET /api/my/contacts` and `POST /api/my/contacts` (idempotent list initialization), `/api/my/contacts/contact/<id>` for read/update/delete, `/api/my/contacts/groups` for group management, and `/api/my/contacts/autocomplete`. No `/search` endpoint ships in this slice; the MVP list is fully rendered for find-in-page, and server search is deferred. Exact names may be finalized in code review as long as they keep this convention.
- **Envelopes:** Success responses return the JSON resource directly. Errors return `{ "error": { "code": "UPPER_SNAKE_CODE", "message": "user-safe text" } }`, plus a `fieldErrors` map for validation failures. No stack traces, no echoed request bodies, no internal table names. Server logs carry diagnostic IDs and outcomes only, never names or Notes content.
- **Status map:** `401` for unauthenticated requests (JSON, never the browser sign-in view); uniform `404` for nonexistent and cross-owned resources so existence is never disclosed; `400` with `fieldErrors` for validation failures, including duplicate normalized names and invalid dates or references; `409` for a stale `baseRevision` or a lost/expired lease; `413` above the byte cap; `429` above the rate budget. All private responses use private/no-store cache headers.
- **Limits (initial values, tuned with tests):** Request body at most 128 KB, which fits a 20,000-code-point Notes value in UTF-8 with room for other fields and token syntax; Friends per contact at most 100; groups per list at most 200; contact-reference tokens in a single Notes value at most 100 (a token is one inserted `@` reference, not a character or word); mutations at most 60 per minute per user. There is no total-contact quota.
- **Pagination:** Cursor-based with a fixed page size of 50; responses are `{ items, nextCursor }` with `nextCursor: null` at the end. Ordering is stable — normalized unique name with the opaque contact ID as tiebreaker — so inserts or renames between pages never skip or duplicate entries.
- **Write contract:** Mutations include `baseRevision` and, where a reservation applies, `leaseId`; responses return the new revision. Revisions are per-contact integers incremented by the server only on committed writes.

### Migration rollback and release validation

- **Forward-only migrations:** Numbered migration files; use additive-then-contract steps where possible so old and new code tolerate the schema during rollout. Planning and prototyping never apply migrations to production.
- **Rollback means restore:** Before any production migration, run it on an isolated database copy (existing release gate), export a backup, and record the restore path. D1 point-in-time recovery is the rollback mechanism; down-migrations cannot recover destroyed data and are not the safety mechanism.
- **Restore rehearsal:** Before the first Contacts production deploy, rehearse a snapshot restore in a non-production environment and record the steps and elapsed time in a recovery note.
- **Post-deploy validation:** Routing regression green, synthetic slideshow reviewed at both viewport sizes, D1 rows read/written recorded, and the recovery note updated.

## Implementation Readiness Gates

The product defaults above are settled, and the engineering contracts in [Engineering Contracts](#engineering-contracts) are defined pending doc review. Once approved, technical choices are proven with focused tests during implementation; product choices get explicit review here first. None of this blocks writing the routing baseline or read-only schema prototype.

- **Settled product choices:** Notes hosts reference insertion; canonical links use opaque contact-ID fragments; Friends is directional without self-references; deleted names may be reused without retargeting references; Trash retains data for one year; early access requires Ambassador with read/export/delete access retained after eligibility is lost. The practical limits above are approved.
- **Reference/storage contract (defined):** Notes token representation, authorized ID resolution, reference index, and restore-name conflict behavior are specified in [Notes reference tokens](#notes-reference-tokens). Remaining work is tests: token round-trip, inert pasted text, cross-list inertness, unavailable-contact rendering, and index maintenance. Notes reference support is not a new rich-HTML editor or private-annotation feature.
- **Fragment boundary (settled):** One contact record is one editable fragment, including its fields and group memberships. Different contacts can be edited concurrently. Keep server-enforced, tab-specific reservations and per-fragment revisions; reject expired leases and stale saves even if the client ignores the UI. Pushed committed updates must not overwrite the receiving editor's unsaved draft.
- **Same-user tabs:** Do not present a competing editor or automatically start a multi-user turn countdown when the same user opens a reserved contact in another tab. When unsaved edits are confirmed, show "You made unsaved changes on this contact in another tab." Otherwise say the contact is being edited elsewhere without claiming a draft exists. Offer a best-effort action to focus the editing tab when a usable window handle exists; independently opened tabs and browser policies may prevent this. Same-origin messaging can coordinate status but cannot reliably focus an arbitrary tab. Fall back to asking the user to return to that tab. A focus action does not transfer the edit lease. Test same-user conflicts across devices as well, where switching tabs is unavailable.
- **Multi-user windows (later collaborative editing):** When multiple authorized users can edit the same fragment, allocate server-backed ten-minute windows and show current local time plus the user's next reserved start/end times. Example: "It's now 8:43pm. Your next guaranteed window is 8:53-9:03pm, and if it starts early, we'll send you an in-app notification." An early turn is an optional opportunity, not grounds to shorten or forfeit an unacknowledged reserved window. Later queued users receive their own scheduled windows rather than all being promised a turn within ten minutes. Missing a window is not a permanent loss of access; allow requesting another turn. Enforce deadlines on the server, freeze expired editing/saving, and preserve drafts rather than auto-saving or discarding them. Qualify guarantees on service availability and continued authorization, and reconcile the schedule after outages. A solo editor with an empty queue is not on a countdown; the first ten-minute window begins when another authorized user joins the queue, per [Reservations, save/handoff, and reconnect](#reservations-savehandoff-and-reconnect). This workflow is not needed merely to coordinate the owner-only MVP's duplicate tabs.
- **Concurrency contract (defined):** Save/handoff timing, lease renewal, reconnect/abandonment behavior, and the authorized push transport are specified in [Reservations, save/handoff, and reconnect](#reservations-savehandoff-and-reconnect) and [Committed-update push](#committed-update-push). Before collaborative windows ship, still specify atomic scheduling, notification delivery, early-turn acceptance, missed-window requeueing, and consistent deadlines across clients using server time. A browser countdown alone cannot enforce fairness. Prototype the owner-only reservation and two-contact update behavior before CRUD editing ships; implement the multi-user scheduling UI with the later collaborative-editing slice.
- **Writes and errors (defined):** Request/response shapes, request-byte/relationship limits, cursor pagination, uniform non-disclosing errors, and revision/lease ownership in the write contract are specified in [API shapes, limits, and errors](#api-shapes-limits-and-errors). Implement these technical choices with focused tests.
- **Release gate (approved):** Require isolated-database migration tests, signed-out/cross-owner denial, mutation-security tests, unchanged public static routing, synthetic mobile/desktop slideshow review, and documented backup/recovery. Migration rollback and restore rehearsal follow [Migration rollback and release validation](#migration-rollback-and-release-validation): rollback means restoring a pre-migration snapshot, rehearsed before the first production deploy. Verify expiry/handoff, stale-write rejection, disconnect/reconnect, and cross-owner push isolation. Test Trash restoration/purge and former-Ambassador read/export/delete. Keep public routes unchanged and do not apply migrations to production as part of planning/prototyping.
