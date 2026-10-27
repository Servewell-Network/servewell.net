# Expansion Plan: October 2026

## Purpose and Product Direction

Plan a coherent expansion of servewell.net rather than a set of disconnected features. The aim is a consistent experience for reading, linking, discussing, creating, and managing content, supported by a consistent developer architecture.

Potential feature areas:
- Personal contacts and contact groups
- Personal reminders
- Public and private comments on specific content words, including comments on specific words within comments (forming a theoretically infinite network of comments)
- Curriculum building, including collaboration of teachers and interactive experiences for learners
- Tracking of group tasks, including recurring tasks
- Assignments that combine contacts with tasks
- Personal message templates and messaging management that combines templates with contacts
- Better moderation, trust, sharing, and page-level permissions

These ideas overlap around shared foundations: pages, stable references within pages, identity, permissions, links, comments, and structured data. Build these foundations first so reminders, messaging, and assignments can be composed from them rather than implemented as separate systems.

Start with personal contacts as the first end-to-end workflow.

The initial Contacts outcome, scenarios, proposed data contract, acceptance criteria, and implementation sequence are captured in [Contacts MVP Implementation Brief](contacts-mvp.md). Treat that brief as a working specification for the first vertical slice, not as a commitment to the later feature areas.

Curriculum building remains a candidate area and should not expand the first Contacts release. Revisit its specific workflows after the shared page, identity, and permission foundations are established.

## Content Model

### Pages and patterns

Pages should be creatable from a small set of page pattern building blocks. A page pattern defines how content is displayed, how its terms or entries are identified as popover targets, and which sections and actions appear in those popovers.

Initial building blocks to consider:
- Plain text
- Markdown text
- Structured pages with optional data validation, including:
  - Unordered lists
  - Sorted lists
  - Ordered lists with numbers or letters
  - Description lists
  - Dated entries
- Template pages that define schemas and allowed values for other pages
- Composite pages that present or coordinate information from multiple pages

### Pattern catalogs

Three parallel versioned catalogs hold the reusable pattern/template definitions; all are public, read-only, and immutable per version with `latest` aliases resolved at initialization:

- `/form-templates/` — per-item data schemas (see [Form Templates and Local Field Schemas](form-templates-design.md)). Directories name the item type: `/form-templates/contact/v1`.
- `/page-patterns/` — page-level behavior. Composite patterns declare their building block and item type together; `/page-patterns/contacts/v1` says "structured page, sorted list, each item validated by `/form-templates/contact/v1`" plus the pattern's popover default. A plural directory names the page concept; it delegates item shape to the singular form template.
- `/popover-patterns/` — popover structure. `/popover-patterns/basic/v1` is the first slice's default: authorized links and short popover notes, no linked-page creation. A field-name popover is a shared instance (all Unique Name name-taps open the same field-definition popover); a field-value popover is per value (tapping Marcus's name versus Susan's name uses the same pattern populated with that entry's data).

Pattern definitions are developer-authored and versioned, like form templates. Users pick patterns for their pages; they do not edit pattern definitions in this phase.

### Popover specification

Every page pattern carries an explicit popover default, so what appears in a popover is declared rather than hard-wired per page. The page pattern's popover declaration specifies:

- **Targets:** which terms or entries on the page are popover-addressable. A sorted-list pattern's targets are its entries (one contact record per target); a Bible chapter pattern's targets are its words.
- **Pattern:** the default popover pattern for those targets (initially `/popover-patterns/basic/v1`). A form template may override the popover pattern per field, separately for field-name targets and field-value targets.
- **Sections and actions:** the popover pattern defines the ordered named sections — such as links, private notes, reference data, or actions — rendered in declared order, individually collapsible, with less frequently useful material later. A page pattern may contribute additional actions within its popover declaration (voting on a discussion page; Edit on the Contacts page, which opens the record editor under the reservation rules in [Contacts MVP Implementation Brief](contacts-mvp.md#reservations-savehandoff-and-reconnect)).
- **Data:** for each section, what its rows contain and where they come from. Public section data ships with cacheable page data or public JSON; private sections (unshared links, private notes) arrive via the authenticated fetch described in [Permission-aware links and popovers](#permission-aware-links-and-popovers). A spec must never place private data in a public section.

For `/popover-patterns/basic/v1`, the Notes section appears at the top of the popover, before Links. It contains independent text entries attached to the target, newest first; entries are not threaded replies. An Add note action opens a text input, and submitting adds a new entry. Authors can edit or delete their own entries; moderators follow the applicable moderation policy. A note is shared with viewers authorized to see the target by default. The input includes an unchecked `Private` checkbox; when selected before saving, the note is visible only to its author and appears in a collapsed `<details>` disclosure labeled `Private Note`. Private notes remain included in authorized search results for their author but are never returned to other viewers. Contacts is owner-only in its MVP, so its non-private notes are also visible only to the owner until the target is shared. When contact sharing is later enabled, non-private notes follow the target's sharing permissions; private notes never do. Notes are plain, naturally wrapped text, at most 1,000 Unicode code points each. Recognized `http` and `https` URLs within the text render as clickable links; other schemes and markup are inert text. Above 100 code points, show the first line with an Expand control; expansion reveals the rest without leaving the popover. The Links section follows Notes and lists only links visible to the current viewer.

Load the page's authorized popover notes after initial page rendering, grouped by target ID, rather than blocking the page response. Keep private notes in authenticated `private, no-store` responses and exclude them from results for anyone except their author. Once loaded, note text is included in the app's authorized search index, including notes inside a collapsed Private Note disclosure; do not promise that native browser find will surface text hidden in a closed popover or automatically open it. A later unified search can index authorized note text and navigate to the corresponding target/popover.

These short popover notes are text entries, not the separate linked comment pages described in [Comment Pages and URL Design](comment-pages-url-design.md). The basic pattern does not create pages or publish contributions. Non-private notes follow the target's sharing permissions; private notes remain visible only to their author.

The popover default is part of the page pattern definition and is versioned with it, so changing a pattern's popover is a reviewable contract change. Page patterns and popover patterns may each inherit and extend a base version. The data template controls entry fields and types; the page pattern controls page behavior and its popover default; the popover pattern controls section structure. None of the three invents a second place to say another's job.

### Structured values and templates

A structured page can supply allowed values or schemas to another page.

The public catalog at `/form-templates/`, versioned origins, local schema view at `/my/contacts/_fields`, inherited-field overrides, and type catalog are detailed in [Form Templates and Local Field Schemas](form-templates-design.md). Contacts MVP includes the minimal template-backed foundation: immutable Contact v1, structured types, a pinned local schema, schema-driven form/validation, and a read-only field view. Add/Override editing and origin migration remain follow-ons.

For example, the ContactGroups page at `/my/contact-groups/` uses a sorted-list page pattern with the required Unique Text Group Name field, and supplies allowed values to the optional Groups field on Contacts. Its field definition is `/my/contact-groups/_fields#Group_Name`.

A form template called Contact (`/form-templates/contact/v1`) defines:
- Unique name (UniqueName): Unique Text (required, single-line)
- Casual name (CasualName): Text Line
- Friends: List<Contact.UniqueName>
- Birthdate: Date
- Groups: List<ContactGroup.GroupName>
- Other Notes: Text Multiline

Only Unique Name is required; all other Contact fields are optional. The type catalog distinguishes Text Line from Text Multiline instead of a generic Text type. Other Notes is ordinary contact data and is included when a contact is shared if present; author-only popover notes marked Private remain separate and excluded from contact sharing.

When creating a personal contacts page as a new sorted list, the user could start from a copy of the Contact template. Each entry would suggest the defined fields and their types. If the user adds fields, offer the option to update that page's copy of the template, with a selected checkox to allow the field name and type to also be sent to moderators for possible inclusion in the shared template copy. If a field name matches a recently created structured page, suggest that page as its type. Templates could also support message text such as `Hi ${Contact.CasualName}`. While editing, typing `${` or `:` could offer standard types and recently used structured pages.

Treat templates as versioned schemas. Resolve `latest` during initialization and pin the resulting immutable version. Changing an existing schema's origin or version is forbidden for now, both in the UI and on the server. Owner-reviewed comparison, mapping, and version adoption are future work; define data preservation, validation, and recovery before enabling them.

### References, links, and search

While creating content, users can type `@` to insert a reference to a value in a structured page. For example, typing `@Contacts.Mar` can offer a contact such as Marcus Reese, with display choices such as the unique name `@MarcusReese` or casual name `@Marcus`. The inserted reference remains linked to the contact's stable entry ID, for example `<ContactsURL>#MarcusReese`, regardless of which display name is shown.

For Contacts MVP, the contact's Other Notes field is the first insertion host. Canonical reference URLs use opaque random identifiers such as `/my/contacts/#contact-<id>`, not readable-name fragments from the illustrative example above. Keep names out of URLs to reduce exposure in copied links, history, and tooling.

Users can keep private, searchable notes about content they can access, including content owned by someone else. These notes are personal annotations, not fields stored on or shared as part of the page. After the page loads, authorized private annotations can be populated into the relevant popover alongside that user's unshared links. A popover can show them in a collapsed `Private Notes` section; expanding it reveals the notes and controls to edit or delete them. Before choosing an implementation order, validate the reusable model against both a contact and a Bible/content target in [Private Annotations Design](private-annotations-design.md).

Search for private notes must be scoped to the note's owner and content they are allowed to access. Results and excerpts must not reveal a private note to the page owner or other viewers unless the note is explicitly shared.

### Composite pages and subscriptions

Composite pages can combine shared sources while supporting distinct workflows:
- A messaging view combines message templates and contacts tagged `message-recipient`, sorted by most recently contacted. The user can select a drafted message for use outside the site, then mark it sent; only marking it sent updates contact recency. The initial workflow does not send the message itself.
- An assignment view combines recurring tasks and filtered contact groups, maintaining a separate queue per task so that people who have done a task recently move toward the back and people who have not done it recently are easiest to select. A dated task entry can use task names as keys and contact groups as value types; selecting a group opens a popover where one member can be chosen as the assignee.

Track contact history with optional `Email`, `Text`, `Call`, `Visit`, and `Other` selections; selecting `Other` reveals a text field. A general `Done` action records the selected interaction. For messages, selecting a draft does not update recency; the user explicitly marks it sent.

These composite pages are subscribers to their source pages. If Contacts changes, a subscriber should remove contacts that were deleted or no longer match its filter, and add newly eligible contacts to the end of the queue so that people not recently selected remain easiest to assign.

Persist user decisions and activity, such as queue position and last assignment, but derive current membership from the source page and its filters. This avoids stale copies while preserving meaningful ordering. Removing someone from a group or filter should affect future selection only; retain historical assignments.

Refresh composite pages on demand by default. Revisit automatic updates if a workflow requires immediate consistency.

Here, “on demand” means recompute derived membership and ordering when the user opens the composite page, and provide a refresh action for updates while the page remains open. Do not push background updates initially (except perhaps for users that are actively editing another part of the page). Preserve user activity such as assignment history and queue decisions while refreshing the derived set of eligible contacts.

## Interaction Model

### Word and entry actions

The main interaction surfaces today include ordinary links and pages, word popovers in Bible chapter pages, and expandable details in word-study pages and the quiz. The next iteration should focus on links and popovers and bring word-study and quiz interactions into alignment where useful.

Any term in structured or unstructured content is probably tappable:
- A link, styled so it is recognizable as a link; or
- A button, styled so it is recognizable as a button; or
- A popover trigger, which can look like ordinary text because it is not a link.
One likely exception is titles, which may not do anything when tapped, although even that is debatable.

For structured values, a solid value should link to its line or entry in its source page. An instance of a field name, such as `UniqueName`, should link to its definition. The destination can in turn expose its own popover and related actions.

If a structured data set becomes too large to display at once, use expandable sections. For Contacts MVP, load the complete authorized list after initial render so browser find-in-page and local autocomplete work across all entries; letter sections may be visually collapsed but their data is already loaded. Later, if measured payload or rendering costs justify it, consider loading collapsed sections on demand, with an explicit search strategy for entries not yet fetched.

The default word or entry popover should show:
- Existing links associated with that target
- A way to link to existing content
- A way to create a linked page and link to it in one action
- A way to offer a correction to the page editors
- Other context-specific actions, such as voting, when those actions are specified by the page pattern
- Less useful reference information later in the popover rather than earlier (and make it clear if scrolling is required to see the bottom of the popover content).

Some standard page patterns could create conventional links automatically. For example, trusted users could create a word-choice discussion page that starts with the word's context and offers pros, cons, alternatives, and reasons. Another standard link could be “More about this” for research and related material.

Use a consistent popover structure across page patterns: each page pattern declares its popover pattern default (with per-field overrides allowed), and each popover pattern defines the sections and contributed actions. This gives users one interaction model without forcing Bible words, contacts, and task entries to expose identical options.

### Text selection and multi-target actions

A single tap on a word opens its popover. A long press currently begins native text selection and exposes the browser's usual actions such as Copy and Cut. When text is selected, the top bar should mostly be replaced by `Popover` and `Cancel` actions.

The selection popover aggregates the popovers of the individual words. It should show links common to all selected words and offer actions that apply to all of them, such as adding a link or offering a correction. The resulting relationship should be attached to each selected word. Use “popover” consistently in code, user-facing documentation, and interaction labels; reserve “options” for the choices inside a popover.

For a selection of words, show links that apply to every selected word first. Follow these with links that apply to any selected word. If the list is too long, place the remaining items in a collapsed `more` disclosure. This lets shared links and comments rise to the top as the selection grows, while still helping users discover more links when few exist.

### Bible chapter pattern

Treat Bible chapter pages as a page pattern to specify what's in the popover. Adapt it to the shared interaction model:
- Move the root sound value near the top and include it as part of the “all instances” link.
- Provide ways to add links and offer corrections.
- Put less frequently useful reference information later in the popover.

## Identity, Trust, Sharing, and Permissions

### Site Roles

Add an `Ambassador` role for an initially small, selected group of people who want to help and reach out to others. The role name fits the site's context; its definition can evolve. Initially it grants access to feature areas such as contact management and reminders, but does not by itself grant access to personal data or pages; those still require ownership or an explicit share grant.

Contacts early access requires Ambassador. If that eligibility is lost, retain read/export/delete access to existing personal data while disabling creation and editing.

Role checkboxes can only reduce the user's effective privileges for simulation; they cannot assign roles or bypass server checks. Distinguish switching off an assigned role from actually losing that role. The server remains authoritative for role membership and allowed actions.

The site currently has two explicit roles: Moderator and Developer. These appear as menu checkboxes for users with those privileges, allowing them to simulate the experience of users without those roles. The Ambassador role should also have a similar checkbox. The implied `Registrant` state is shown by the “Signed in” message; signing out returns the user to the `Visitor` state. These states can be thought of as pseudo-roles.

### Sharing and permissions

Allow authorized users to share pages with:
- Named email addresses, with or without sending a notification
- Contact groups
- The public

Candidate page permissions (i.e., per-page roles):
- Viewer
- Commenter
- Contributor, with non-destructive edits
- Editor
- Owner, if ownership transfer and recovery rules are defined

Separate page-class defaults from per-page grants. Developer-configured public pages can be publicly viewable and commentable subject to moderation; role-restricted page classes can require a specific role. User-authored public pages can use the same public-commenter default, subject to moderation. Personal pages under `/my/` are private to their owner unless explicitly shared. There are no per-user or per-group deny rules that override a grant. Resolve group membership and signed-in identity on the server, never from an email address supplied by the browser, and enforce permissions on every read and write.

For the first Contacts workflow, each contact list has one owner and is private by default; sharing is not enabled in that MVP. The next sharing slice exposes a selected contact group as a live subset rather than the entire Contacts page. Ordinary Notes accompanies a shared contact when present; author-only Private Notes does not. Defer co-owned household or team lists. Contact groups are named memberships on contacts, and composite pages derive their current members from those groups. Details and unresolved field/provenance rules are in [Contact Group Sharing Design](contact-group-sharing-design.md).

Reserve `/my/*` as the URL namespace for private, user-scoped pages and configure only matching requests to invoke the Worker before static assets. The Worker must validate the signed-in user and page/group grants before returning private data, then access D1 or R2 as appropriate. The path selects the private request-handling route; it does not itself prove identity or grant access. Public static pages outside `/my/*` continue to use asset-first delivery and do not need to invoke the Worker.

### Public contribution rights and consent

Public contributions are intended to be donated for unrestricted reuse, not merely made publicly readable. Use a short, plain-language consent step separate from submission for moderation. CC0 1.0 is the proposed dedication mechanism, subject to legal review before public contributions launch. Show the essential consequences at the point of consent: others may copy, change, and redistribute the contribution, including commercially and without attribution; removing a page does not recall copies or undo an effective dedication. Do not require a long site-specific legal agreement or hide additional obligations behind the short explanation.

Use an unchecked affirmative control, with a link to the standard CC0 explanation and instrument for readers who want details. The contributor must have the rights needed to make the dedication. Third-party material keeps its own rights and must be identified and handled separately; dedication does not waive anyone else's privacy rights. Private Contacts, Notes, drafts, and limited sharing are not dedicated merely by using the site. Record the contribution/revision, user, time, and consent-text/instrument version. Final wording, when dedication takes effect, and treatment of existing contributions require review before implementation; consent is not moderation approval or a guarantee against disputes. See [Comment Pages and URL Design](comment-pages-url-design.md#contribution-consent) for the proposed interaction.

### Permission-aware links and popovers

Include public links in public static page data. After the page loads, fetch the current user's private links in one authenticated response grouped by target ID, and populate the relevant popovers. Keep that response private to the user and out of shared CDN caches. If a popover opens before it arrives, show a loading state rather than implying there are no private links. Assume link sets are small initially; optimize further only if observed usage requires it.


## Architecture, Storage, and Delivery

### Frontend and data loading

Revisit the split among HTML, JavaScript, embedded JSON, and data fetched after initial page load. Decide what belongs in the initial response versus what is loaded on demand, considering initial rendering speed, cacheability, privacy, and payload size.

Keep public, broadly reusable content in CDN-cacheable HTML and static data. Where it helps initial rendering, serve public popover data separately as public JSON for the page to fetch and render after its visible HTML loads. Fetch identity-specific permissions and private content only after authentication, keeping private responses separate from shared cacheable data.

### Storage and routing

Clarify the source of truth for each content class:
- Application source code and curated source data belong in the repository.
- Generated public content is an output, not an authoring surface; it can be deployed as static assets or to public R2.
- Private user pages and private attachments must not be placed in a public asset directory or a publicly readable R2 bucket.
- **Default placement rule:** Store page records in D1 when the page's contract requires database-enforced uniqueness, relationships across records, atomic multi-record updates, or indexed owner-scoped lookup. Store large, mostly self-contained page bodies—such as general unstructured Markdown without those relational constraints—in private R2, with D1 holding the owner/page mapping, permissions, revision, and any indexes needed to locate or authorize the object. A page may be hybrid: structured constrained records in D1 and large free-text bodies or attachments in private R2.
- The page pattern and form template define validation and interaction semantics; they do not imply a matching SQL table schema. The storage adapter enforces the declared constraints using the suitable backend (D1 constraints/transactions or application validation plus revision-checked R2 writes). Do not mirror all R2 content into D1 merely to repeat the template; keep only the metadata/indexes needed for authorization and required queries.
- Contacts uses D1 under this rule: unique names, symmetric Friends pairs, group relationships, owner-scoped lookup, and atomic updates are central to its contract. Its bounded `Other Notes` field remains part of the D1 contact record in this MVP. Larger unstructured Markdown pages without comparable relational rules are candidates for private R2. Revisit placement if measured payload size, write contention, or operational costs justify a different representation; R2 object writes still need revision/concurrency control and do not provide multi-object transactions.
- D1 can also hold users, page metadata, permissions, links, reservations, and searchable indexes; larger page bodies and attachments can live in private R2.

The current public word pages are deployed to R2 at `words.servewell.net`; they are not all committed as generated HTML files in the GitHub repository. The main site's Worker already serves static assets from `public/` and handles authenticated APIs. Private content should be served behind that Worker from private R2 without exposing an R2 hostname in browser URLs.

Workers static assets are limited to 20,000 files per Worker version on the Free plan and 100,000 on Paid. Requests that match static assets are served without invoking Worker code and are free/unlimited under current Workers pricing. R2 has unlimited objects/storage per bucket, with its own storage and operation pricing. Public R2 custom domains are not private storage.

Use `servewell.net/my/...` for personal pages rather than a separate subdomain. This keeps them on the authenticated application host, where the current host-only session cookie is available. Treat the browser-facing URL as independent of the physical R2 bucket so storage can move later without changing page links.


Reserve app-controlled namespace roots under `/my/`: `/my/` is the authenticated index of personal areas visible to the user; `/my/contacts/` is the Contacts application; `/my/private/<slug>` holds private pages; and `/my/proposed/<slug>` holds pages awaiting moderation before publication. `/my` redirects to `/my/`, and the index must not reveal private page metadata to other users. Proposed pages remain private to their author and moderators until approval; approval publishes them to the separate direct-R2 hostname `comments.servewell.net/<slug>`. Use stable page IDs internally and treat URLs as routes or aliases. Validate comment slugs against existing comment routes. In the create/link workflow, separate short public-domain dedication consent from submission for public review; neither is implied by saving private content. The separate hostname means theme preference will not automatically carry over from Bible or main-site pages; that handoff still needs a design. See [Comment Pages and URL Design](comment-pages-url-design.md) for the linked-page lifecycle and URL rules.

### Search and indexing

Search must respect the same visibility rules as direct page reads. For private contacts, a hidden-but-searchable field should only influence results visible to the searcher. Search results, snippets, autocomplete, and counts can all leak information even when the page itself is protected.

Private data should be searchable across pages the current user owns or has permission to access. Search results, snippets, autocomplete, and counts must observe those same permissions.

**MVP and deferred scope.** Reuse the existing Search entry point, currently used for Bible-wide word search, and add a `This page` scope for the current Bible chapter plus a `Contacts` scope that searches the authenticated user's fully loaded Contacts snapshot locally. Contacts scope lets users select fields and optionally filter by group; popover-note text joins local search after its authorized post-render fetch, respecting each note's Private setting. Scope defaults preserve context: Bible on chapter pages and Contacts on `/my/contacts/`. Contacts results navigate to and highlight the matching contact without opening its popover. The existing Bible corpus search and its Literal/Traditional result toggles remain intact.

Defer unified server-side search across the growing graph — public/private pages, linked comment pages, annotations, popover notes, and other content types — until indexing, ranking, permissions, and result presentation are designed. The shared Search UI should be able to grow toward explicit `Everything`, `Bible`, and non-Bible scopes, but do not expose scopes that are not implemented. Private scopes must search only content the user owns or can access; results, snippets, counts, and autocomplete must not leak across permission boundaries. Sectioned/remote search becomes necessary only when measured payload or rendering costs make loading a page's complete authorized data set inappropriate.

## Editing, Review, and Retention

### Stable references and scoped edits

Pages need stable URLs, and content within a page should have stable fragment identifiers for the typical pattern `<URL>#<fragment-id>`. A paragraph or newline-delimited block is the default fragment for unstructured content. Individual words or targets within a fragment also need stable IDs, which can use dot notation beneath the fragment ID.

When a user selects one or more words, the top-bar Popover action can offer Edit if the user's permissions allow it. Editing one word can also be offered from its individual popover. The edit form should scope the change to the selected words and evaluate only public outlinks attached to those targets, not every outlink on the page.

Before an edit is finalized, show the editor and moderator a temporary before/after comparison where useful. This comparison supports review and is not intended as a general version-history feature for every fragment edit.

### Outlink review and moderation handoff

When an edit affects public outlinks, show a review form with one row per affected outlink. For each link, the decision should indicate whether to keep it, remove only the link, or remove both the link and its target document. Provide bulk actions such as select all or select none.

Editors can complete the outlink review as part of their edit. If they choose not to complete it, they can refer the review to moderators, leaving the remainder of the form and decisions for a moderator to complete. Removing an outlink and its target document requires moderator approval; the editor's choice schedules the proposal rather than deleting the target immediately. The process should make it possible to open target documents in other tabs while reviewing.

### Edit reservations and notifications

To reduce conflicting edits, maintain temporary edit/review queues keyed by fragment ID. A user at the front of a fragment's queue may edit it; other users see that the fragment is currently being edited or moderated and can join the queue to be notified when it becomes available. Reservations are expiring leases that an active editor can renew; when a lease expires, the next person in the queue may proceed. A selection spanning multiple fragments joins the relevant queue for each fragment and may be eligible to edit only some of them at first.

The exact reservation and edit-form workflow remains to be designed. The notification experience also needs work: distinguish shared work such as items in `List to moderate` from personal notifications, and make both easier to notice with badges near the menu and visible nonzero counts in menu items.

For Contacts, one contact record is one fragment, and reservations are per tab and server-enforced. Same-user duplicate tabs explain that the contact is being edited elsewhere (or has unsaved changes when confirmed) rather than using multi-user queue wording; focusing the editing tab is best-effort, with a manual fallback. Later collaborative editing uses reserved ten-minute windows, showing both start and end times and notifying users of optional earlier opportunities. Missing a window allows another turn rather than permanently losing access. Enforce deadlines without discarding drafts. Different contacts remain editable concurrently and receive authorized pushed updates of committed changes. This editing synchronization is separate from on-demand composite-page refresh. Scheduling, reconnect behavior, service-availability qualifications, and push transport are tracked in the Contacts implementation readiness gates.

### Tentative deletion and recovery

Deletion should be recoverable before it becomes permanent. A page scheduled for deletion displays a banner explaining its status and a way to contact moderators if a visitor disagrees. Add a `View items being deleted` list to the moderation workflow, alongside `View processed items`; show each item's scheduled deletion date and let moderators rescue items from deletion.

Keep tentatively deleted pages for approximately one year, then remove eligible items in a monthly cleanup job. During that period, people who previously had access retain read-only access to the pending-deletion page so they can decide whether to make a copy, unless access is revoked for a separate safety or moderation reason. Notify them when a shared page is scheduled for deletion and give them the option to make their own copy during the recovery period. Do not notify them about every fragment edit by default, but allow interested users to opt into email notifications containing before/after content for edited fragments.

Use `fragment` as the general term for an addressable part of a page, with a paragraph or newline-delimited block as the default fragment for unstructured text. Bible content can use the same general term for its addressable units; avoid introducing `snippet` as a separate product term.

Implementation should proceed one end-to-end workflow at a time, starting with personal Contacts and contact groups. That first slice exercises structured pages, ownership and sharing, search, references, and popovers. Reminders, assignments, messaging, comments, and curriculum can follow as separate workflows once the shared foundations are proven.

## Standards Alignment

This plan does not adopt heavyweight standards runtimes, but it does align the internal model and public surfaces with a small set of existing vocabularies. The goal is to avoid inventing private shapes where a public shape already exists, so that future import/export and federation are serializers rather than translations.

### Internal model: typed tree with reference edges

The canonical internal shape is a **typed tree with reference edges**:
- Every addressable thing is an **item**: a page, a fragment, a field, a contact, a comment, a word target. Items have an opaque ID, a type, and ordered children.
- Items contain items (a Contacts page contains contact fragments; a contact contains fields; a field contains words).
- Items also hold **references** to other items (a Notes token, a popover link, a group membership). References are edges, not containment.
- This is the cycle that makes the graph web-shaped: pages → fragments → fields → words → links → pages. It is not a pure tree because references create loops, but the containment backbone remains a tree.

This shape is deliberately small. It maps to SysML v2 by using `item` as the generic term for any node and `part` only where we need the definition/usage distinction (for example, a page pattern as a definition, a concrete page as its usage). A lease or reservation is modeled as a state. We do not author in SysML v2 syntax now; we name internal concepts after its metamodel terms and keep a JSON sidecar mapping so future import/export is a mapping exercise, not a redesign.

SysML v2 alignment is a foundation, not an ornament. Every planned feature is more referencing structure over the same graph: messaging pages reference contacts, assignments reference contacts and tasks, curriculum references everything. Naming concepts after the metamodel from the start means each new feature inherits diagrammability and self-description for free — a friends-of-friends view, a message-recipient view, and an assignment view become viewpoints over one model rather than one-off reports — and it avoids retrofitting ten ad-hoc page shapes later. The value is consistency between model and views, not the pictures themselves. Design rule: when defining a new feature's data, ask "what is the item, and what is the connection?" rather than only "what are the tables?"

### Standards we support (subsets)

| Standard | Subset we use | Where it appears |
|---|---|---|
| **JSON-LD** | `@context`, `@type`, `@id`, ordered `@list` | The shared JSON floor for all Linked Data standards below. |
| **schema.org** | `Article`, `Person`, `DefinedTerm`, `ItemList`, `CreativeWork` | Public pages render JSON-LD for search engines. Private pages embed the same markup when it can be generated from the same authorized data as the visible page, served with `no-store`, so an owner can preview the public view without a separate channel. |
| **W3C Web Annotation Data Model** | `Annotation`, `TextualBody`, `FragmentSelector`, `TextPositionSelector` | Comments and private annotations are stored as annotation-shaped objects; the fragment ID is the target. |
| **ActivityStreams 2.0** | `Note`, `Article`, `OrderedCollection` | Comments and comment lists are shaped as AS2 objects. This does not enable federation, but keeps ActivityPub as a future serializer rather than a translation. |
| **SysML v2** | `item`, `part`, `state`, `requirement` | Internal concept names in docs and a machine-readable sidecar mapping our types to SysML v2 metaclasses. No SysML tooling is required now. |
| **SKOS** | `Concept`, `broader`, `narrower`, `prefLabel` | Word-study and trad-index taxonomies align to SKOS concepts. |
| **Creative Commons RDF** | `cc:Work`, `cc:license`, `cc:dedicatedTo` | Contribution consent records carry machine-readable CC0 dedication metadata. |

### Standards we defer or watch

- **OWL reasoning**: no inference engine; SKOS is enough for taxonomy.
- **AT Protocol / Nostr**: different identity model; revisit if ActivityPub federation becomes a requirement.
- **SysML v1 tooling**: v2's API and textual notation are the only relevant line.
- **RDFa / Microdata**: superseded by JSON-LD for our purposes.
- **DID / Solid**: heavier identity/privacy machinery than our threat model needs.

### Implementation rule

When adding a new content type, first ask: does it already fit one of the shapes above? If not, extend the internal typed tree and record the mapping in the sidecar; do not invent a second private shape for the same concept. A first validation experiment: once the Contacts data contract exists, hand-write a SysML v2 export of a small multi-contact fixture and check whether pilot tooling renders the friends connection graph as expected. That tests the sidecar mapping cheaply before any feature depends on it.

## Developing the Plan

Implementation-readiness refinements are tracked in [Contacts MVP Implementation Brief](contacts-mvp.md#implementation-readiness-gates). Its product decisions are settled, and its reference/storage, concurrency, write/error, and release contracts are defined in the brief's Engineering Contracts section, pending doc review and focused tests before implementation. These are review gates, not permission to invent defaults silently. Later sharing, annotations, and comment-publication decisions remain in their companion documents and must not block the routing baseline or read-only template prototype.

1. Turn the candidate feature areas into user outcomes and concrete scenarios. Keep this document as the shared product/architecture direction, not a substitute for implementation specs.
2. Choose one vertical slice at a time. For each, write acceptance criteria covering normal use, permissions, failure states, accessibility, and mobile behavior.
3. Define shared contracts before parallel implementation: page IDs, target IDs, page patterns, permission principals, role semantics, and revision behavior.
4. Prototype uncertain interactions early, especially popovers, multi-word selection, structured editing, and responsive navigation.
5. Record decisions here or in linked decision records, including the rationale and any consequences for existing public pages.

## Reviewing the Plan

1. Review each feature for user value, privacy risk, moderation impact, accessibility, and operational cost.
2. Check that permissions are enforced by the server for every read, search, link lookup, and write; UI hiding is not authorization.
3. Check that public data remains safely cacheable and private responses cannot leak through shared caches, logs, search indexes, or generated artifacts.
4. Review data ownership, export, deletion, restoration, and revision behavior before storing user-created content.
5. Prefer the smallest coherent model that supports the selected workflow; defer speculative generality until a second real use case validates it.

## Executing the Plan

1. Establish the identity, stable page/entry IDs, authorization helpers, and public/private storage boundary needed by the selected slice.
2. Implement a complete path from UI through authorization and persistence, including tests for both allowed and denied access.
3. Add migration and recovery steps for schema changes, plus tests for existing public behavior that must remain unchanged.
4. Instrument reads, writes, storage, latency, and authorization failures. Review Cloudflare D1/R2/Workers usage as real usage accumulates.
5. Release incrementally, verify production behavior and privacy boundaries, then use user feedback to select the next slice.

