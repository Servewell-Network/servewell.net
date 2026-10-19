# Contact Group Sharing Design

**Status:** Draft exploration linked from the October 2026 expansion plan. This records a possible first model; it is not yet an implementation contract.

## Goal

Let a Contacts owner share one selected contact group without exposing the rest of `/my/contacts`. A recipient can accept the shared group into their own Contacts experience, where it remains distinguishable from contacts and groups they own. The shared membership stays connected to the source group until either side changes that relationship.

## Example

Marcus owns `/my/contacts` and a group named `churchMembers`. He shares that group with selected people. After accepting, a recipient sees the shared contacts as a distinct imported group, displayed with provenance such as `churchMembers:fromMarcusReese`. If Marcus later adds another contact to `churchMembers`, it appears in the accepted shared group. If he removes or deletes a member, the recipient gets a deprecation notice and can accept the removal or make an independent copy before the source entry disappears.

## Proposed Flow

1. The owner selects a group and chooses recipients. Sharing the group exposes only the contacts and fields included in that share, not the owner's full Contacts page.
2. Each recipient receives an invitation and explicitly accepts before the shared group appears in their Contacts view.
3. The recipient sees shared membership separately from their own groups. A readable label can use `groupName:fromOwnerName`, such as `churchMembers:fromMarcusReese`.
4. Internally, identify the share and source group with stable IDs, not the displayed owner name or encoded tag. Owner names can change; display labels can be regenerated without breaking the relationship.
5. Reserve `:` so users cannot create ordinary group names that imitate the shared-group display form. This is a presentation/validation safeguard, not an authorization mechanism.
6. New contacts added to the source group propagate to recipients who accepted that share.
7. When a source contact leaves the group or is deleted, notify recipients that the shared entry is deprecated. They can accept the removal or make an independent copy into their own Contacts data.

## Routing and Authorization

`/my/` is a URL namespace, not proof of identity or permission. A request for a private Contacts page or group must pass through Worker code that validates the session and checks the owner/share grant before returning data. The Worker can then read metadata from D1 and contact content from the selected storage layer. Do not rely on a hard-to-guess URL, group-name suffix, client-provided email, or hidden UI as authorization.

The current Wrangler configuration is asset-first and does not declare `run_worker_first`. Any `/my/*` route that could match a public static asset must be explicitly routed through the Worker before serving. Keep private user data out of the public asset directory and public R2 domains.

## Ownership and Change Boundaries

- The source owner controls the source contact and source group membership.
- The recipient's accepted group is a live, read-only view of source-owned data until the recipient makes an independent copy.
- Private Notes remain owned by their author and do not travel with a shared contact unless separately and explicitly shared.
- Ordinary contact Notes (Text Multiline) is included whenever present on a shared contact. It is not Private Notes; make this distinction clear before the owner confirms a share.
- A source removal/deletion does not silently erase the recipient's local data. The deprecation decision determines whether the imported entry is removed or copied into recipient-owned data.
- A recipient's independent copy stops receiving source changes and has its own subsequent edits and sharing permissions.

## Decisions Still Needed

- Which other contact fields are included when a group is shared? Ordinary Notes is already included when present, and Private Notes is excluded. Use a deliberate field allowlist for the remaining fields and future additions.
- Can recipients add private notes to imported contacts? The likely answer is yes, since notes belong to their author, not the source contact owner.
- Can recipients edit shared contact fields, or must they make a copy first? A conservative first version would keep source fields read-only and provide an explicit copy action.
- What happens when the owner revokes the entire group share? A reasonable default is a deprecation notice with a time-limited option to copy entries, consistent with individual removals.
- If an owner renames a group, should the recipient-facing label update automatically while preserving the stable share ID? Recommended: yes.
- Can a recipient accept some removal notices and copy other entries? Per-entry choices are more flexible, but a bulk accept/copy action may be needed for usability.
- What notification channel and grace period apply to group changes and share revocation?

## Initial Scope Suggestion

Start with explicit invitation and acceptance, a selected group subset, read-only live membership, propagation of additions, and deprecation notices for removals. Support copying an entry into recipient-owned Contacts data. Defer collaborative editing of shared contact fields, fine-grained field-level permissions, and automatic propagation into other composite workflows until the basic sharing lifecycle is validated.
