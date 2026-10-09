# Expansion Plan: October 2026

## Purpose and Product Direction

Plan a coherent expansion of servewell.net rather than a set of disconnected features. The aim is a consistent experience for reading, linking, discussing, creating, and managing content, supported by a consistent developer architecture.

Potential feature areas:
- Personal reminders
- Personal contacts and contact groups
- Public and private comments on content, including comments on comments and comments attached to specific words
- Personal tracking of group tasks, including recurring tasks
- Assignments that combine contacts with tasks
- Personal message templates and messaging management that combines templates with contacts
- Better moderation, trust, sharing, and page-level permissions

These ideas overlap around shared foundations: pages, stable references within pages, identity, permissions, links, comments, and structured data. Build these foundations first so reminders, messaging, and assignments can be composed from them rather than implemented as separate systems.

Start with personal contacts as the first end-to-end workflow. Task assignment depends on contacts, so it should follow rather than precede the contacts foundation.

## Content Model

### Pages and patterns

Pages should be creatable from a small set of patterns. A pattern defines both how content is displayed and which actions are available from its terms or entries.

Initial patterns to consider:
- Plain text
- Markdown text
- Structured pages with optional validation or constraints, including:
  - Unordered lists
  - Sorted lists
  - Ordered lists with numbers or letters
  - Description lists
  - Dated entries
- Template pages that define schemas and allowed values for other pages
- Composite pages that present or coordinate information from multiple pages

### Structured values and templates

A structured page can supply allowed values or schemas to another page. A template for contacts could define:
- Unique name: String
- Casual name: String
- Friend of: Contact.UniqueName
- Born: Date
- Groups: ContactGroup

When creating a personal contacts page as a sorted list, the user could start from a copy of the Contact template. Each entry would suggest the defined fields and their types. If the user adds fields, offer the option to update that page's copy of the template. If a field name matches a recently created structured page, suggest that page as its type.

Templates could also support message text such as `Hi ${Contact.CasualName}`. While editing, typing `${` or `:` could offer standard types and recently used structured pages.

Treat templates as versioned schemas. Pages can keep using their current template version, and the owner chooses when to adopt a newer version. This allows templates to improve without silently changing existing pages.

### References, links, and search

Wherever content is being created, users should be able to reference existing structured values, probably by typing `@`. For example, autocomplete could find `Contact.UniqueName` or `Content.CasualName`, then create a link to that stable entry in its source page. It should also support selecting a structured page and then one of its entries.

Users can keep private, searchable notes about content they can access, including content owned by someone else. These notes are personal annotations, not fields stored on or shared as part of the page. After the page loads, authorized private annotations can be populated into the relevant popover alongside that user's unshared links. A popover can show them in a collapsed `Private Notes` section; expanding it reveals the notes and controls to edit or delete them. The precise presentation and workflow remain to be worked out.

Search for private notes must be scoped to the note's owner and content they are allowed to access. Results and excerpts must not reveal a private note to the page owner or other viewers unless the note is explicitly shared.
### Composite pages and subscriptions

Some pages should combine information from other pages:
- A messaging view could combine message templates with contacts, or with contacts tagged `message-recipient`, and sort recipients by most recently contacted.
- An assignment view could combine recurring tasks with a filtered contact group. People who have done a task recently go toward the back of the queue; people who have not done it recently are easier to assign.
- An assignment page could have a separate contact queue for each recurring task. A dated task entry could use a schema where task descriptions are keys and contact groups are typed values. Selecting a group could open a popover with its members and sorting options.

These composite pages are subscribers to their source pages. If Contacts changes, a subscriber should remove contacts that were deleted or no longer match its filter, and add newly eligible contacts to the end of the queue so that people not recently selected remain easiest to assign.

Persist user decisions and activity, such as queue position and last assignment, but derive current membership from the source page and its filters. This avoids stale copies while preserving meaningful ordering. Removing someone from a group or filter should affect future selection only; retain historical assignments.

Refresh composite pages on demand by default. Revisit automatic updates if a workflow requires immediate consistency.

## Interaction Model

### Word and entry actions

The main interaction surfaces today include ordinary links and pages, word popovers in Bible chapter pages, and expandable details in word-study pages and the quiz. The next iteration should focus on links and popovers and bring word-study and quiz interactions into alignment where useful.

Any term in structured or unstructured content is either:
- A link, styled so it is recognizable as a link; or
- A popover trigger, which can look like ordinary text when it is not a link.

For structured values, a solid value should link to its line or entry in its source page. An instance of a field name, such as `UniqueName`, should link to its definition. The destination can in turn expose its own popover and related actions.

The default word or entry popover should show:
- Existing links associated with that target
- A way to link to existing content
- A way to create a linked page and link to it in one action
- A way to offer a correction to the page editors
- Other context-specific actions, such as voting, when appropriate

Some standard page patterns could create conventional links automatically. For example, trusted users could create a word-choice discussion page that starts with the word's context and offers pros, cons, alternatives, and reasons. Other standard links could be “more of this” or “more about this” for research and related material.

Use a consistent popover structure across page patterns, while allowing each pattern to contribute its relevant actions. This gives users one interaction model without forcing Bible words, contacts, and task entries to expose identical options.

### Text selection and multi-target actions

A single tap on a word can open its popover. A long press currently begins native text selection and exposes the browser's usual actions such as Copy and Cut. In addition, when text is selected, the top bar should mostly be replaced by `Options` and `Cancel` actions.

The selection Options view should show links common to all selected words and offer actions that apply to all of them, such as adding a link or offering a correction. The resulting relationship should be attached to each selected word.

For a selection, show links that apply to every selected word first. Follow these with links that apply to any selected word. If the list is too long, place the remaining items in a collapsed `more` disclosure. This lets shared links and comments rise to the top as the selection grows, while still helping users discover more links when few are shared.

### Bible chapter pattern

Treat Bible chapter pages as a page pattern with a specialized popover. Adapt it to the shared interaction model:
- Move the root sound value near the top and include it as part of the “all instances” link.
- Provide ways to add links and offer corrections.
- Put less frequently useful reference information later in the popover.

## Identity, Trust, Sharing, and Permissions

### Trust and moderation

Add an `Ambassador` role for a small, selected group of people who want to help and reach out to others. The role name fits the site's context; its definition can evolve. Initially it grants access to feature areas such as contact management and reminders, but does not by itself grant access to personal data or pages; those still require ownership or an explicit share grant.

The site currently has two explicit roles: Moderator and Developer. These appear as menu checkboxes for users with those privileges, allowing them to simulate the experience of users without those roles. The implied `Registrant` state is shown by the “Signed in” message; signing out returns the user to the `Visitor` state.

### Sharing and roles

Allow authorized users to share pages with:
- Named email addresses, with or without sending a notification
- Contact groups
- The public

Candidate page permissions:
- Viewer
- Commenter
- Contributor, with non-destructive edits
- Editor
- Owner, if ownership transfer and recovery rules are defined

Represent permissions as grants attached to stable page IDs. A grant identifies its recipient (a user, contact group, or role), permission level, and optional expiry; an explicit public grant makes the page available to everyone. Access is denied by default, and there are no per-user or per-group deny rules that override a grant. Resolve group membership and signed-in identity on the server, never from an email address supplied by the browser, and enforce permissions on every read and write.

For the first Contacts workflow, each contact list has one owner and is private by default. The owner can explicitly share the page; defer co-owned household or team lists until after the basic workflow works. Contact groups are named memberships on contacts, and composite pages derive their current members from those groups. Sharing a Contacts page shares its contacts and fields according to the page grant; keep personal `Private Notes` separate and visible only to the note's author.

### Permission-aware links and popovers

Most links will appear inside popovers. After a page loads, client code could request the current user's visible links for that page and populate multiple word or entry popovers from one response. If a user opens a popover before its private links have loaded, show a loading state rather than briefly implying that no links exist.

Public links can be part of the page's public static data and do not need that authenticated round trip. Private links must be returned only after the backend authorizes the requesting user. The response can group multiple links by target ID.

Fetch a page's authorized private links in one response and group them by target ID. Keep that response private to the authenticated user; do not place it in shared CDN-cached HTML or cache it across users. Assume the link set is usually small and defer lazy loading or other optimizations until measured usage shows a need.


## Architecture, Storage, and Delivery

### Frontend and data loading

Revisit the split among HTML, JavaScript, embedded JSON, and data fetched after initial page load. Decide what belongs in the initial response versus what is loaded on demand, considering initial rendering speed, cacheability, privacy, and payload size.

Keep public, broadly reusable content in CDN-cacheable HTML and static data. Where it helps initial rendering, serve public popover data separately as public JSON for the page to fetch and render after its visible HTML loads. Fetch identity-specific permissions and private content only after authentication, keeping private responses separate from shared cacheable data.

### Storage and routing

Clarify the source of truth for each content class:
- Application source code and curated source data belong in the repository.
- Generated public content is an output, not an authoring surface; it can be deployed as static assets or to public R2.
- Private user pages and private attachments must not be placed in a public asset directory or a publicly readable R2 bucket.
- D1 can hold users, page metadata, permissions, links, and searchable indexes; larger page bodies and attachments can live in private R2.

The current public word pages are deployed to R2 at `words.servewell.net`; they are not all committed as generated HTML files in the GitHub repository. The main site's Worker already serves static assets from `public/` and handles authenticated APIs. Private content could be served behind that Worker from private R2 without exposing an R2 hostname in browser URLs.

Workers static assets are limited to 20,000 files per Worker version on the Free plan and 100,000 on Paid. Requests that match static assets are served without invoking Worker code and are free/unlimited under current Workers pricing. R2 has unlimited objects/storage per bucket, with its own storage and operation pricing. Public R2 custom domains are not private storage.

Use `servewell.net/my/...` for personal pages rather than a separate subdomain. This keeps them on the authenticated application host, where the current host-only session cookie is available. Treat the browser-facing URL as independent of the physical R2 bucket so storage can move later without changing page links.

### Search and indexing

Search must respect the same visibility rules as direct page reads. For private contacts, a hidden-but-searchable field should only influence results visible to the searcher. Search results, snippets, autocomplete, and counts can all leak information even when the page itself is protected.

Private data should be searchable across pages the current user owns or has permission to access. Search results, snippets, autocomplete, and counts must observe those same permissions.

## Editing, Review, and Retention

### Stable references and scoped edits

Pages need stable URLs, and content within a page should have stable fragment identifiers such as `<URL>#<fragment-id>`. A paragraph or newline-delimited block can be the default fragment for unstructured content. Individual words or targets within a fragment also need stable IDs, which can use dot notation beneath the fragment ID.

When a user selects one or more words, the top-bar Options action can offer Edit if the user's permissions allow it. Editing one word can also be offered from its individual popover. The edit form should scope the change to the selected words and evaluate only public outlinks attached to those targets, not every outlink on the page.

Before an edit is finalized, show the editor and moderator a temporary before/after comparison where useful. This comparison supports review and is not intended as a general version-history feature for every fragment edit.

### Outlink review and moderation handoff

When an edit affects public outlinks, show a review form with one row per affected outlink. For each link, the decision should indicate whether to keep it, remove only the link, or remove both the link and its target document. Provide bulk actions such as select all or select none.

Editors can complete the outlink review as part of their edit. If they cannot, they can refer the review to moderators, leaving the form and decisions for a moderator to complete. Removing an outlink and its target document requires moderator approval; the editor's choice schedules the proposal rather than deleting the target immediately. The process should make it possible to open target documents in other tabs while reviewing.

### Edit reservations and notifications

To reduce conflicting edits, maintain temporary edit/review queues keyed by fragment ID. A user at the front of a fragment's queue may edit it; other users see that the fragment is currently being edited or moderated and can join the queue to be notified when it becomes available. Reservations are expiring leases that an active editor can renew; when a lease expires, the next person in the queue may proceed. A selection spanning multiple fragments joins the relevant queue for each fragment and may be eligible to edit only some of them at first.

The exact reservation and edit-form workflow remains to be designed. The notification experience also needs work: distinguish shared work such as items in `List to moderate` from personal notifications, and make both easier to notice with badges near the menu and visible nonzero counts in menu items.

### Tentative deletion and recovery

Deletion should be recoverable before it becomes permanent. A page scheduled for deletion displays a banner explaining its status and a way to contact moderators if a visitor disagrees. Add a `View items being deleted` list to the moderation workflow, alongside `View processed items`; show each item's scheduled deletion date and let moderators rescue items from deletion.

Keep tentatively deleted pages for approximately one year, then remove eligible items in a monthly cleanup job. During that period, people who previously had access retain read-only access to the pending-deletion page so they can decide whether to make a copy, unless access is revoked for a separate safety or moderation reason. Notify them when a shared page is scheduled for deletion and give them the option to make their own copy during the recovery period. Do not notify them about every fragment edit by default, but allow interested users to opt into email notifications containing before/after content for edited fragments.

Use `fragment` as the general term for an addressable part of a page, with a paragraph or newline-delimited block as the default fragment for unstructured text. Bible content can use the same general term for its addressable units; avoid introducing `snippet` as a separate product term.

## Candidate Feature Workflows

These are candidate applications of the shared foundations, not a required build order:
- Contacts and contact groups
- Reminders
- Recurring group tasks and assignment queues
- Message templates and contact-aware messaging management
- Public/private comments and word-level discussion
- Trust-aware moderation and page sharing

Build one end-to-end workflow at a time, starting with personal contacts and contact groups. This exercises structured page patterns, permissions, search, links, and popovers; task assignment and messaging can follow once those foundations are proven.

## Developing the Plan

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

