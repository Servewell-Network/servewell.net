# Comment Pages and URL Design

**Status:** Working design note for comment pages linked from existing content. The expansion plan contains the high-level policy; this note records route examples, lifecycle, and open decisions.

## Goals

- Let a user create a link and its destination page in one streamlined workflow from an existing page or selected word.
- Keep the existing page fast and publicly cacheable where appropriate; load private links for the signed-in viewer after the page loads.
- Keep private working pages private until their owner explicitly shares them or submits them for public publication and moderation.
- Keep page identity stable if its URL changes during publication, rename, or migration.
- Serve approved comment pages directly from a dedicated R2 custom domain without invoking the site Worker on public page reads.

## URL Namespaces

The first path segment below `/my/` is application-controlled, not user-selected:

- `/my/` is the authenticated index of personal areas and pages visible to the current user. `/my` redirects to `/my/`. It must not reveal private page names or metadata to signed-out visitors or other users.
- `/my/contacts/` is the Contacts application and its subroutes.
- `/my/private/<slug>` is an owner-only personal page.
- `/my/proposed/<slug>` is a page submitted for possible public publication. While pending, it is visible only to its author and authorized moderators.

The user may select or edit a page slug only within the namespace the application assigns. Namespace names and reserved application paths cannot be claimed as user page names. Use canonical lowercase paths and normalize trailing slashes consistently.

On approval, publish the page at `https://comments.servewell.net/<slug>`, served directly from a public R2 custom domain. The hostname/path pair is an alias for a stable internal page ID, not the page's primary identity. Keep references, permissions, and comment/link relationships attached to the ID so changing a route does not break them. The previous `/my/proposed/<slug>` URL remains a private management route; it must not become an alternate public route accidentally.

## Create-and-Link Flow

From an existing page or selected word/fragment, the popover offers “Create linked page.” The author chooses a page pattern, enters an initial title/body, and sees the generated destination before saving. The system creates the page, then creates the relationship from the source target to the new page.

The form includes an unchecked option labeled **“Propose for public publication and moderation.”** Helper text should say that the page remains private to the author and moderators until approved. Do not say “offer to the public domain”: “public domain” can mean a copyright status rather than public visibility.

- Unchecked: save to `/my/private/<slug>`; only the owner can read or edit unless they explicitly share it.
- Checked: save to `/my/proposed/<slug>`; allow the author to edit and moderators to review; do not expose it as a public page before approval.
- Approved: generate/materialize the approved page into the comments R2 bucket at `comments.servewell.net/<slug>` and make it available under the page's approved public-commenter/moderation policy.
- Changes after approval: follow the normal edit/review policy for public content; publication status does not bypass moderation.

The created link can be public or private independently of the destination page. A private link is returned only to its author/authorized viewers after the existing source page loads. A public link may be included in public page data or public JSON. The UI must not leak a private destination URL through shared HTML, public link indexes, or cacheable responses.

## Routing and Authorization

The exact `/my` path and `/my/*` should be routed to the Worker before static asset matching. Public routes outside that namespace retain the current asset-first path, so ordinary public page hits do not invoke Worker code. Avoid a blanket `run_worker_first: true`; verify that no private page is present in `public/`.

For a signed-out browser visit, canonicalize `/my` to `/my/`, then show a generic sign-in-required view at `/my/` or any nested private page: "This is a private area. Sign in to access your pages and anything shared with you." Offer Sign in and Home actions without revealing whether a requested private resource exists. Preserve a validated same-origin return destination through sign-in, then recheck authorization; authentication alone never grants access to another user's content. Signed-out API requests return `401` JSON instead. Keep these responses private/no-store. See the Contacts brief for the routing and sign-in regression criteria.

For every `/my/*` read or write, the Worker validates the existing session and checks ownership or an explicit grant. A URL prefix is routing metadata, not proof of authorization. Database lookups use stable page IDs and authenticated user IDs, not client-supplied email addresses or guessed slugs.

## Public Page Serving Decision

Approved comment pages are generated/materialized into a dedicated public R2 bucket connected to the custom domain `comments.servewell.net`. Requests go directly to R2/Cloudflare's public delivery path and do not invoke the site Worker. The Worker handles proposal submission and moderation; approval triggers publication to the comments bucket. Rejection or withdrawal leaves the proposal private and releases its reserved public slug.

This avoids the Workers Static Assets file-count limit and per-request Worker execution, but it requires a separate generation and deployment pipeline for comments. The public bucket is intentionally public; never upload pending proposals, private destinations, or private link data to it. Unpublishing or deleting a page requires removing/replacing the R2 object and handling cached copies according to the tentative-deletion and recovery policy.

The word-study pages already demonstrate the separate-host pattern. Dark/light theme state does not automatically carry between hostnames because browser storage is origin-scoped. Theme handoff from Bible pages or the main site to `comments.servewell.net` is unresolved and must be designed; this architecture does not solve it automatically.

## Slug Allocation and Collisions

The `comments.servewell.net` hostname has its own slug namespace, separate from `servewell.net` application routes. Slug selection must check existing comment-page slugs and reserved endpoints on that hostname. The app should show a conflict and ask for another slug rather than overwrite an existing R2 object.

Recommended initial policy: reserve the public slug when a proposal is submitted, not only when approved. This makes the eventual publication route predictable and avoids approval failing later due to a collision. If the proposal is rejected or withdrawn, release the reservation. Keep the reserved slug and proposal status in D1, keyed to the stable page ID.

For private pages, slugs need only be unique within the owner's `/my/private/` namespace. Do not use the slug as a secret; enforce owner access on every request.

## Open Decisions

- On rejection, does the page remain at `/my/proposed/<slug>` for private editing, move to `/my/private/<slug>`, or let the author choose? Suggested default: retain the private page and allow the author to revise or move it.
- Does approving a proposal make the page public and commentable by default, subject to moderation, or should the author choose a narrower public policy during submission? Suggested default: make it public-commentable subject to the site's existing moderation policy, with the moderator able to require a different setting.
- Who may propose a page for public publication: any registrant, only Ambassadors, or a permission on the source page? Suggested default: require an explicit page-level capability; role may grant eligibility but must not grant access to private source or destination data.
- May users later rename a public slug? Suggested default: yes, by retaining a redirect/object at the previous comments-host path while preserving the stable page ID.
- For `/my/private/`, is this intended as a general personal-page area with explicit optional sharing, or strictly owner-only storage? Suggested default: owner-only unless the owner explicitly shares it.
- Can the app generate a slug from the title and let users edit it, or should it ask for a slug separately? Suggested default: generate an editable slug from the title, then validate and reserve it on save.
