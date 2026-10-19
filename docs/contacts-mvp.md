# Contacts MVP Implementation Brief

**Status:** Draft for implementation planning. This defines the first Contacts vertical slice; it does not settle the full shared-group lifecycle in [Contact Group Sharing Design](contact-group-sharing-design.md).

## Outcome

A signed-in registrant can create and manage a private Contacts list at `/my/contacts/`, add contacts to named groups, find contacts by name or group, and insert stable contact references into other content. Another registrant cannot read or modify this data by guessing a URL or identifier.

The list has one owner and is private by default. Keep public/approved pages on their current asset-first delivery path. Requests under `/my/*` are routed through the Worker, which validates the existing session and authorizes each operation.

## First-Slice Scope

### Included

- Create the signed-in user's Contacts list on first use.
- Create, read, update, and delete contacts owned by that user.
- Store the initial Contact fields: required Unique Name (Unique Text), optional Casual Name (Text Line), Birthdate, Friends (references to other contacts), Groups, and Notes (Text Multiline). Only Unique Name is required; lists may be empty.
- Initialize the list from the published Contact template, pin its immutable version, and use its structured field/type definitions for form rendering and server validation. Provide an owner-authorized read-only `/my/contacts/_fields` view linked from the per-page menu.
- Create, rename, and delete named groups owned by the user.
- Add/remove contacts to/from groups; show groups and their members.
- Search the user's contacts by unique name, casual name, and group.
- Resolve `@Contacts.<query>` into autocomplete results and insert a reference tied to a stable contact ID, not a display string or mutable slug.
- Show a contact detail view or popover with links to the source entry and permitted actions.

### Not in the first slice

- Sharing a whole Contacts list or selected groups with other registrants.
- Live imported groups, acceptance invitations, group revocation, and deprecation/copy flows. These are specified separately and should follow the private owner workflow.
- Arbitrary user-defined fields, notes on arbitrary page/word targets, messaging delivery, reminders, assignments, and curriculum tools.
- Public Contacts pages.

## User Scenarios

1. As a signed-in registrant, I open `/my/contacts/` and see my list, or an empty-state action to create it.
2. I add a contact with a unique name and optional casual name, birthdate, friends, groups, and multiline Notes for information that does not fit the fixed fields.
3. I search for a person using either their unique name or casual name and navigate to that contact's stable entry.
4. I create a group such as `churchMembers`, add/remove contacts, and filter the Contacts view by that group.
5. While writing another page, I type `@Contacts.Mar`, choose a contact/display label, and insert a reference that continues to resolve if the contact's displayed name changes.
6. I edit or delete my contact/group and see consistent results in search, group membership, and references.
7. A signed-out visitor or a different registrant requests my Contacts URL or API data and receives no private contact data.

## Data Contract Proposal

Use stable opaque IDs and owner IDs in storage. The user-facing unique name is a validated field, not the database key.

- `contact_lists`: `id`, `owner_user_id`, timestamps. One list per owner for the initial workflow.
- Each list also stores its pinned template/version ID and local schema ID. Persist stable field IDs, structured type definitions, and field order; initially the local schema has inherited fields only. Public template definitions remain immutable. See [Form Templates and Local Field Schemas](form-templates-design.md).
- `contacts`: `id`, `list_id`, `unique_name`, `casual_name`, `birthdate`, `notes`, timestamps; unique constraint on `(list_id, normalized_unique_name)`.
- `contact_groups`: `id`, `list_id`, `group_name`, timestamps; unique constraint on `(list_id, normalized_group_name)`.
- `contact_group_members`: `(group_id, contact_id)` with uniqueness and foreign keys.
- `contact_friends`: `(contact_id, friend_contact_id)` with uniqueness and foreign keys; both contacts must belong to the same list.

For unique names and group names, preserve the original spelling for display and compare a key derived by trimming whitespace, normalizing to Unicode NFC, and applying Unicode case folding. Enforce this in one shared validation function and with database constraints where possible. Reject `:` in ordinary group names because it is reserved for the display of imported shared groups in a later sharing slice.

Every query must scope by the authenticated `owner_user_id` or prove an accepted share grant. Never accept `owner_user_id` as an authority from the request body. Do not return private contact records in cacheable HTML or shared CDN responses.

Notes is an optional ordinary contact field of type Text Multiline, edited with a multiline input. Preserve its text and line breaks and render it as escaped plain text, not HTML or executable markup. It is private with the owner-only Contacts list in this MVP. When contact sharing is implemented, Notes is included whenever present on a shared contact, unlike author-only Private Notes. Note-body search is not added to the MVP search scope by this field alone.

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

Verify the current behavior before changing Wrangler routing, then repeat the same check after adding the narrow `/my/*` Worker-first pattern. Use a local integration harness that adds a test-only response header such as `X-Test-Worker-Invoked: 1` to every response produced by Worker code, including responses returned through `env.ASSETS.fetch()`. Do not ship this marker in production.

1. Start from the current asset-first configuration and request a known public asset outside `/my/*` (for example, `/about.html`). Assert the response is successful, contains the expected asset content, and has no `X-Test-Worker-Invoked` header. Save the response status/body hash as the baseline.
2. Add only `/my/*` to `assets.run_worker_first` and repeat the exact public-asset request. Assert its status and body hash are unchanged and the Worker-invocation marker remains absent. This proves ordinary public static traffic still bypasses the Worker after the routing change.
3. Probe `/my`, `/my/`, and a nested `/my/contacts/` route while signed out, without automatically following redirects. Assert the Worker marker is present: `/my` redirects only to `/my/`, and the canonical/nested pages show the generic sign-in-required view without private metadata. Test an unknown nested private path too: its signed-out response must not reveal whether a private resource exists. This proves the exact root and private namespace reach the Worker.
4. Keep the integration test as a regression test for both routing properties. Fail the test if configuration is broadened to `run_worker_first: true` or another pattern that matches the public-asset probe.

The test must exercise Wrangler's actual asset-routing behavior, not just call the Worker handler directly; a unit test of the handler cannot prove that a matching public asset bypasses Worker execution.

## Acceptance Criteria

### Ownership and authorization

- A registrant can create a list and only sees their own contacts and groups.
- A second registrant cannot read, search, mutate, or infer the first registrant's data through IDs, slugs, autocomplete, error messages, or result counts.
- Signed-out requests to private routes/APIs do not return contact data.
- Browser tests cover the private-area message, Sign in and Home actions, safe return after authentication, and authorization rechecking. API tests assert `401` JSON, and neither path exposes resource existence before authentication.
- The server derives identity from the validated session; changing client-supplied email/user IDs does not change ownership.
- Requests for `/my/*` reach the Worker before any static-asset match; ordinary public static routes remain asset-first.

### Contact/group behavior

- Unique names are required and unique within a list after normalization; collisions return a useful validation error.
- Only Unique Name is required and must be nonempty after trimming. All other Contact fields may be empty; invalid nonempty dates and references are rejected consistently. Text Line and Unique Text reject embedded line breaks.
- Notes can be created, updated, and cleared; multiline and Unicode text round-trip without losing line breaks, and HTML-like text displays literally without executing. Notes follows the same owner-access checks as other contact fields.
- Group membership updates are idempotent and do not create duplicate memberships.
- Deleting a contact removes it from active group membership and friend lists. Existing references retain the stable contact ID and display an unavailable-contact state rather than silently resolving to a different contact.
- Search and group filtering return only authorized records and stable contact IDs.
- Contact forms and server validators use the same pinned schema definitions. `_fields` shows the origin and field/type definitions without mutation controls; attempted origin/version changes are rejected by the server.

### References

- Autocomplete results are limited to contacts visible to the current user.
- Inserting a contact reference stores its stable contact ID and chosen display form.
- Renaming the casual or unique display value does not change the target identity; deleted contacts produce a clear unavailable-reference state.

### Regression and operation

- Add worker/API tests for unauthenticated denial, owner access, cross-owner denial, and validation failures.
- Add client tests for contact editing, group membership, search, and reference resolution.
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

For the static-routing change, run the before/after integration probe against the current Wrangler configuration first and record the public asset response/Worker marker as the baseline. Then add only `/my/*` to Worker-first routing and rerun the same probe: the public asset must still bypass the Worker, while a `/my/` request must enter it. Keep this as a routing regression test.

For UI work, first prototype uncertain interactions such as the Contacts empty state, contact editor, and popover/autocomplete on desktop and mobile. Once the interaction is agreed, write tests for observable behavior, keyboard access, loading/empty/error states, and stable reference insertion. Avoid brittle tests that assert exact layout markup or colors.

Defer or test later when their contracts are defined: live group sharing, proposal/publication workflows, custom fields, and tombstone retention. Do not invent tests that lock in unresolved follow-on behavior.

## MVP Decisions

- Unique names are unique per list after trimming, Unicode NFC normalization, and case folding. Preserve the original spelling for display.
- Start with the fixed Contact template fields, backed by real versioned schema definitions rather than a separately hard-coded form. Include public Contact v1/latest routes, the implemented type catalog, and the read-only local `_fields` view. Custom fields and Add/Override editing remain deferred.
- The origin is fixed after initialization, including its version. Define types structurally and support Text Line, Text Multiline, Unique Text, Date, List, and Form Field for this slice. Only Unique Name is required in the Contact template, and ordinary Notes accompanies a shared contact when present. See [Form Templates and Local Field Schemas](form-templates-design.md).
- Deleted contacts leave active group membership and friend lists. Existing references retain the stable ID and display an unavailable-contact state.
- Ship owner-only Contacts before group sharing. Group membership is optional; a contact may belong to zero groups.

## Follow-ons

- **Custom fields:** Revisit after fixed Contact fields, template updates, and moderator review are working. Decide field types, per-field visibility/search, and how user fields may be proposed for the shared template.
- **Google Contacts import (deferred):** No import, Google OAuth, or synchronization work is scheduled. Revisit only when explicitly prioritized; it is not a prerequisite for Contacts MVP or its immediate follow-ons.
- **Shared contact groups:** Implement as a separate slice after owner-only Contacts is stable. Use [Contact Group Sharing Design](contact-group-sharing-design.md) to resolve the field allowlist, recipient edits, revocation, removal notices, and copy behavior before enabling sharing.
- **Private annotations:** Validate the reusable model with a small prototype on both a contact and a Bible/content target before deciding whether it belongs before or after Contacts MVP. Resolve target identity, target-access requirements, author-only search, and popover loading in [Private Annotations Design](private-annotations-design.md).
- **Deleted-contact references:** Before implementation, decide how to retain an unavailable stable ID without retaining unnecessary personal data. Specify whether this uses a minimal tombstone, how long it persists, and how deletion/export requests affect it.
- **Template evolution:** Origin/version changes remain forbidden until a separate comparison/mapping, data validation, and recovery workflow is designed and tested. Add Field and Override Field editing, additional validators, and accessible reordering follow the read-only MVP foundation in [Form Templates and Local Field Schemas](form-templates-design.md).

## Suggested Build Sequence

1. Write the routing integration probe and run it against the current config to establish the asset-first baseline.
2. Add the narrow `/my/*` Worker-first route rule and authenticated route handling; rerun the probe and preserve public asset behavior.
3. Write failing tests for normalization and owner-scoped data access, then add the D1 schema/migration and repository functions until they pass.
	Include the Contact v1/type definitions, pinned local schema, read-only `_fields` view, and shared form/server validation in this foundation before implementing CRUD forms.
4. Implement list/contact/group CRUD in small test-backed slices, including validation and deletion/reference behavior.
5. Prototype and implement the responsive Contacts UI; add behavior/accessibility tests for agreed interactions.
6. Implement owner-scoped search and `@Contacts` autocomplete/reference insertion with tests for stable IDs and privacy.
7. Run focused and full relevant tests, verify migrations and rollback/recovery, and review D1 usage before enabling it for users.
8. After this slice is stable, implement selected-group sharing from the separate design note.
