# Comment Pages and URL Design

**Status:** Working design note for comment pages linked from existing content. The expansion plan contains the high-level policy; this note records route examples, lifecycle, and open decisions.

## Goals

- Let a user create a link and its destination page in one streamlined workflow from an existing page or selected word.
- Keep the existing page fast and publicly cacheable where appropriate; load private links for the signed-in viewer after the page loads.
- Keep private working pages private until their owner explicitly shares them or submits them for public review.
- Keep page identity stable if its URL changes during publication, rename, or migration.
- Serve approved comment pages directly from a dedicated R2 custom domain without invoking the site Worker on public page reads.

## URL Namespaces

The first path segment below `/my/` is application-controlled, not user-selected:

- `/my/` is the authenticated index of personal areas and pages visible to the current user. `/my` redirects to `/my/`. It must not reveal private page names or metadata to signed-out visitors or other users.
- `/my/contacts/` is the Contacts application and its subroutes.
- `/my/private/<slug>` is an owner-only personal page.
- `/my/proposed/<slug>` is a page submitted for possible publication. While pending, it is visible only to its author and authorized moderators.

The user may select or edit a page slug only within the namespace the application assigns. Namespace names and reserved application paths cannot be claimed as user page names. Use canonical lowercase paths and normalize trailing slashes consistently.

On approval, publish the page at `https://comments.servewell.net/<slug>`, served directly from a public R2 custom domain. The hostname/path pair is an alias for a stable internal page ID, not the page's primary identity. Keep references, permissions, and comment/link relationships attached to the ID so changing a route does not break them. The previous `/my/proposed/<slug>` URL remains a private management route; it must not become an alternate public route accidentally.

## Create-and-Link Flow

From an existing page or selected word/fragment, the popover offers “Create linked page.” The author chooses a page pattern, enters an initial title/body, and sees the generated destination before saving. The system creates the page, then creates the relationship from the source target to the new page.

The form includes an unchecked option labeled **“Offer this page for public review.”** Helper text says: "If approved, this contribution will be published for everyone to read and use. Until then, it remains private to you and authorized moderators." Public-domain dedication is a separate consent step described in [Contribution Consent](#contribution-consent); selecting this review option alone is not copyright consent.

- Unchecked: save to `/my/private/<slug>`; only the owner can read or edit unless they explicitly share it.
- Checked: save to `/my/proposed/<slug>`; allow the author to edit and moderators to review; do not expose it as a public page before approval.
- Approved: generate/materialize the approved page into the comments R2 bucket at `comments.servewell.net/<slug>` and make it available under the page's approved public-commenter/moderation policy.
- Changes after approval: follow the normal edit/review policy for public content; publication status does not bypass moderation.

The created link can be public or private independently of the destination page. A private link is returned only to its author/authorized viewers after the existing source page loads. A public link may be included in public page data or public JSON. The UI must not leak a private destination URL through shared HTML, public link indexes, or cacheable responses.

A public link therefore cannot expose a private or pending destination; making its relationship public requires a publishable destination and review of the source context. Do not publish a private contact name, quote, or source URL simply because the author proposes a linked page. Review link visibility separately from destination-page approval. Creation/publication must be retry-safe: failed page/link or R2 writes must not leave a broken public link or mark an unpublished object as live.

## Contribution Consent

The intended policy is that original public contributions are donated for unrestricted reuse. Proposed mechanism: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), which includes a public-domain dedication and fallback license. This is a product-policy draft, not final legal text; have qualified counsel review wording, effective timing, jurisdictional issues, and existing contributions before enabling public submissions.

Keep the interaction short and humane. Do not require a long custom legal agreement or use a summary to hide additional obligations. Show the important consequences directly, with optional links to the standard CC0 explanation and legal instrument.

Proposed unchecked consent statement:

> I agree to dedicate my original contribution under CC0 1.0, and I have the rights needed to do so.

Visible explanation beside it:

> Others may copy, change, and share it, including commercially and without crediting you. Once the dedication takes effect, removing the page does not undo it or recall copies. This does not dedicate your private contacts, notes, or drafts.

Keep the moderation action separate: `Submit for public review`. Do not precheck consent or require dedication merely to sign in, save a private draft, or share privately. Allow the user to keep the page private instead. Before consent is finalized, tell the contributor exactly when dedication takes effect; do not hide that trigger in a linked document.

Record affirmative consent server-side against the specific submitted contribution/revision, authenticated user ID, timestamp, consent wording version, and instrument/version. Content changed after consent needs coverage by an explicit submission/edit policy; never silently apply dedication to unrelated future content or old submissions. Submission and moderation approval are separate from rights status.

Contributors can dedicate only rights they hold. Identify third-party quotations, imported texts, images, and their licenses separately; do not label an entire mixed-rights page CC0 or imply that a contributor can waive another person's rights. Dedication does not authorize disclosure of personal information. Preserve provenance and rights metadata in generated public output without exposing private consent/account records. This process reduces ambiguity but does not guarantee protection from complaints or lawsuits.

### Review and Test Gates

- Decide whether dedication takes effect at explicit submission or publication, and specify withdrawal/rejection behavior consistently with legal review. State the chosen trigger in the visible explanation before launch.
- Define repeat-submission/public-edit consent without long agreements; changes to terms must never be accepted silently.
- Test that saving private data or selecting proposal status does not itself dedicate or publish it; affirmative consent is required for public contributions.
- Test that consent covers the approved content revision and that rights/provenance metadata survives publication without leaking private records.
- Apply the reviewed policy explicitly to public comments, corrections, and shared templates; do not assume historical contributions or existing third-party material are covered.

## Routing and Authorization

The exact `/my` path and `/my/*` should be routed to the Worker before static asset matching. Public routes outside that namespace retain the current asset-first path, so ordinary public page hits do not invoke Worker code. Avoid a blanket `run_worker_first: true`; verify that no private page is present in `public/`.

For a signed-out browser visit, canonicalize `/my` to `/my/`, then show a generic sign-in-required view at `/my/` or any nested private page: "This is a private area. Sign in to access your pages and anything shared with you." Offer Sign in and Home actions without revealing whether a requested private resource exists. Preserve a validated same-origin return destination through sign-in, then recheck authorization; authentication alone never grants access to another user's content. Signed-out API requests return `401` JSON instead. Keep these responses private/no-store. See the Contacts brief for the routing and sign-in regression criteria.

For every `/my/*` read or write, the Worker validates the existing session and checks ownership or an explicit grant. A URL prefix is routing metadata, not proof of authorization. Database lookups use stable page IDs and authenticated user IDs, not client-supplied email addresses or guessed slugs.

## Public Page Serving Decision

Approved comment pages are generated/materialized into a dedicated public R2 bucket connected to the custom domain `comments.servewell.net`. Requests go directly to R2/Cloudflare's public delivery path and do not invoke the site Worker. The Worker handles proposal submission and moderation; approval triggers publication to the comments bucket. Rejection or withdrawal leaves the proposal private and releases its reserved public slug.

This avoids the Workers Static Assets file-count limit and per-request Worker execution, but it requires a separate generation and deployment pipeline for comments. The public bucket is intentionally public; never upload pending proposals, private destinations, or private link data to it. Unpublishing or deleting a page requires removing/replacing the R2 object and handling cached copies according to the tentative-deletion and recovery policy.

The word-study pages already demonstrate the separate-host pattern. Dark/light theme state does not automatically carry between hostnames because browser storage is origin-scoped. Theme handoff from Bible pages or the main site to `comments.servewell.net` is unresolved and must be designed; this architecture does not solve it automatically.

Direct R2 delivery covers public HTML/data reads, not authenticated interactions. The existing host-only session cookie is not sent to `comments.servewell.net`; signed-in actions and private-link loading need an explicit integration with `servewell.net` APIs. Specify narrowly allowed origins, credentialed requests and CSRF protection, and private/no-store responses before enabling those interactions. Do not broaden the session cookie to all subdomains or put tokens in links as an incidental workaround. Cross-origin API calls can invoke the Worker even though the public page request does not.

Before this later slice ships, specify publication states and retries (approved versus successfully published), slug reservation ownership/expiry, and cache handling for edits, tentative deletion, and permanent removal. R2 object metadata alone is not an HTTP redirect: renamed public slugs need an explicit redirect mechanism or a generated redirect page. These are comment-publication gates, not Contacts MVP prerequisites.

## Slug Allocation and Collisions

The `comments.servewell.net` hostname has its own slug namespace, separate from `servewell.net` application routes. Slug selection must check existing comment-page slugs and reserved endpoints on that hostname. The app should show a conflict and ask for another slug rather than overwrite an existing R2 object.

Recommended initial policy: reserve the public slug when a proposal is submitted, not only when approved. This makes the eventual publication route predictable and avoids approval failing later due to a collision. If the proposal is rejected or withdrawn, release the reservation. Keep the reserved slug and proposal status in D1, keyed to the stable page ID.

For private pages, slugs need only be unique within the owner's `/my/private/` namespace. Do not use the slug as a secret; enforce owner access on every request.

## Open Decisions

- On rejection, does the page remain at `/my/proposed/<slug>` for private editing, move to `/my/private/<slug>`, or let the author choose? Suggested default: retain the private page and allow the author to revise or move it.
- Does approving a proposal make the page public and commentable by default, subject to moderation, or should the author choose a narrower public policy during submission? Suggested default: make it public-commentable subject to the site's existing moderation policy, with the moderator able to require a different setting.
- Who may submit a page for public review: any registrant, only Ambassadors, or a permission on the source page? Suggested default: require an explicit page-level capability; role may grant eligibility but must not grant access to private source or destination data.
- May users later rename a public slug? Suggested default: yes, by retaining a redirect/object at the previous comments-host path while preserving the stable page ID.
- For `/my/private/`, is this intended as a general personal-page area with explicit optional sharing, or strictly owner-only storage? Suggested default: owner-only unless the owner explicitly shares it.
- Can the app generate a slug from the title and let users edit it, or should it ask for a slug separately? Suggested default: generate an editable slug from the title, then validate and reserve it on save.
