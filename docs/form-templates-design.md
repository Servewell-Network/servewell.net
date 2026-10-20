# Form Templates and Local Field Schemas

**Status:** Working design. The Contacts MVP includes the minimal template-backed foundation and a read-only local schema view. Local field editing and origin migration are separate follow-ons.

## Routes and Discovery

- `/form-templates/` is the public template catalog, organized to parallel application areas where useful, not to expose a user's private `/my/` contents.
- `/form-templates/contacts/latest` resolves or redirects to a published immutable version such as `/form-templates/contacts/v1`.
- `/form-templates/translation/latest` identifies a template for Bible translation/chapter content used under `/-/`.
- `/form-templates/_types` lists supported type names, descriptions, argument rules, and examples.
- `/my/contacts/_fields` is the authenticated owner's local Contacts schema editor. Reserve `_fields` as an app-controlled subroute, not a user contact slug.

Show a link to the local field schema in the Contacts per-page menu. Public templates and the type catalog can be generated static assets; the local editor and its data require Worker authorization. Published template changes require a new version. `latest` may change and should be revalidated, but a local schema saves the resolved version URL and stable template/version ID, never a floating dependency on `latest`.

The translation template must account for chapter, fragment, word, and language-specific fields. It does not replace page patterns, popover configuration, or the existing Phase 2 schema contract. Adoption for Bible content must preserve phase boundaries and update affected producers/consumers together.

## Owner's Field Editor

Near the top of `/my/contacts/_fields`, show the origin template, initially `/form-templates/contacts/v1`, as a read-only link. In the MVP, follow it with the read-only inherited fields and their types. The following local editing controls belong to the subsequent schema-editing slice.

Inherited definitions remain read-only. Each will offer an `Override Field` action that opens a small form for the replacement name and type. Saving creates a local override linked to the inherited field; it does not mutate the public template or destroy the original definition. An `Add Field` action at the bottom opens the same form for a new local field. Show the effective definition and enough origin information to explain an override, and allow the owner to cancel before saving.

Give every field a stable internal ID independent of its name. For example, `/my/contacts/_fields#Unique_Name` can be a readable field-definition link, but changing a label must not silently break references. Preserve an alias if a readable fragment changes. Store overrides as explicit relationships to origin field IDs, not as matches on label text.

Maintain an explicit effective field order. An override occupies its original field's position by default; additions receive their own IDs and positions. Drag-and-drop ordering can be deferred, but the model must support moving an effective field together with its origin/override relationship. When reordering is implemented, include keyboard-accessible move controls rather than requiring dragging.

## Changing the Origin

Changing an existing local schema's origin is forbidden for now, both in the UI and on the server. This includes adopting a newer version of the same template family. Resolve `latest` only when initializing a schema, then pin the resolved immutable version. Changes to `latest` do not alter existing schemas.

Origin comparison, field mapping, version adoption, and data conversion are deferred. Before enabling any of them, define validation, preservation of local overrides and stored values, confirmation, and recovery behavior. Do not fetch arbitrary origin URLs supplied by the client.

## Type Catalog

The initial catalog can describe the following candidates. A catalog entry must distinguish implemented validators from planned types; documenting a type does not make it supported.

| Type | Meaning and example |
| --- | --- |
| `Text Line` | Single-line plain text; reject embedded line breaks. |
| `Text Multiline` | Plain text allowing line breaks, preserved on save and display. |
| `Unique Text` | Single-line text unique within the owning data set for that field, using the agreed trim/NFC/case-fold comparison policy. Uniqueness does not itself imply that a field is required. |
| `Date > YYYY-MM-DD` | A calendar date with the indicated representation; validate real dates, not just their text shape. |
| `Decimal Number` | A decimal value; precision and permitted bounds need an explicit contract. |
| `Y/N` | A boolean value; whether an unset value is allowed is a separate field constraint. |
| `Link` | A URL/reference; only permitted schemes may become clickable links. |
| `Email Address` | An email value with format validation, not proof that the address exists or is owned by the contact. |
| `Phone Number` | A phone value; preserve international prefixes and formatting rather than treating it as a number. |
| `List > Text Line` | A collection whose elements satisfy the argument type. |
| `Form Field > /my/contacts/_fields#Unique_Name` | A reference to a field definition that supplies the allowed values from its associated data set. Store the selected entry's stable ID rather than copying its display name as identity. |

Type names may take arguments after `>`, including comma-separated arguments where a type explicitly defines them. The proposed `Friends` declaration is:

```text
Friends: List > Form Field > /my/contacts/_fields#Unique_Name
```

The intended meaning is a list of references to Contacts entries identified/displayed through Unique Name. The same public Contact template must resolve `/my/contacts/_fields` in the consuming user's context, not the template author's account. Validate access to referenced schemas/data sets on the server, including autocomplete and allowed-value queries.

Store types as structured expressions, not strings to be split on `>` or commas. For example, Friends is a `List` node whose element type is a `Form Field` reference containing stable schema/field IDs. Render the readable `>` notation from that structure. The initial UI selects types and arguments through controls; a free-text expression parser is not required for MVP. Define nesting/grouping and a grammar before enabling free-text type expressions.

## Contacts Example

`/form-templates/contacts/v1` defines the following initial fields:

```text
Unique Name: Unique Text
Casual Name: Text Line
Friends: List > Form Field > /my/contacts/_fields#Unique_Name
Birthdate: Date > YYYY-MM-DD
Groups: List > Form Field > /my/contact-groups/_fields#Group_Name
Notes: Text Multiline
```

Only Unique Name is required, including a nonempty value after trimming. Casual Name, Friends, Birthdate, Groups, and Notes are optional; list fields may contain zero entries. Store requiredness explicitly in the published field definition and use it in both the form and server validation. User-configurable requiredness remains deferred.

Notes is ordinary contact data of type Text Multiline. Preserve line breaks and escape text on display. When a contact is shared, its Notes is included if present; it is not an author-only Private Note. Private Notes remains a separate annotation capability and is not included in contact sharing.

For Contacts MVP, Notes is also the first host for explicitly inserted `@Contacts` references. Keep its text safe and multiline, with validated stable-ID reference tokens stored alongside it rather than raw HTML. Reference rendering and serialization extend the field's editing behavior without introducing arbitrary rich markup or changing its sharing policy. See the Contacts brief for privacy, deletion, and concurrency contracts.

Groups is part of Contacts MVP. The owner's group data set is at `/my/contact-groups/`, with its read-only schema at `/my/contact-groups/_fields` and the stable Group Name field link `/my/contact-groups/_fields#Group_Name`. Group Name is required Unique Text within that owner's group data set. Resolve this Form Field reference in the consuming user's context and store selected group IDs, not copied group names. These routes expose the existing group-management model, not a second independent group store.

## Validation and TDD

- Test that published versions remain unchanged when an owner adds or overrides a local field.
- Test stable field identity across label edits, overrides, and later ordering changes.
- Test that origin/version changes are rejected by the server and unavailable in the UI.
- Test uniqueness scope, nested lists, invalid type arguments, unresolved references, and cycles in schema references.
- Test cross-owner denial for schema editing and for referenced private allowed-value data.
- Test that `latest` updates do not automatically change an existing local schema.
- Test that Contacts forms and server validators use the same structured field definitions, and that viewing `_fields` cannot mutate them.
- Test single-line rejection of line breaks, multiline preservation and safe display, required Unique Name, optional remaining Contact fields, and Groups resolution to the owner's group IDs.
- Prototype the inherited/override/add field mini-form on desktop/mobile before implementing the later editing slice.

## MVP Foundation and Follow-ons

Include the published Contact v1 definition, its `latest` discovery route, the implemented type catalog, a per-list pinned schema/version reference, stable field IDs, structured type expressions, and an owner-authorized read-only `/my/contacts/_fields` view in Contacts MVP. Generate the contact form and server-side validation from these definitions rather than maintaining an unrelated hard-coded form. Storage can still use dedicated contact/group tables; a form schema is not a user-editable SQL schema, and changing form definitions must never directly issue arbitrary database DDL.

Before implementing schema-driven CRUD, specify a versioned machine-readable definition: stable template/version and field IDs, labels, requiredness, field order, and structured type arguments. Map those stable field IDs to the supported contact columns and relationship repositories through an explicit server-owned adapter; never turn a field label or client-supplied schema into a SQL identifier. Publish the human-readable template and machine-readable definition from the same source. Initialization must atomically pin an allowed version and create the owner's schema/list; malformed or unsupported definitions fail without leaving partial data.

The Group Name data set also needs a pinned definition and stable field identity, with the same owner-scoped initialization rules. The type reference to an owner's field is contextual metadata, not a server-side fetch of an arbitrary private URL. Test that Friends and Groups resolve to the intended local data sets without exposing another owner's values. Record the concrete serialized definition and adapter contract before implementing their consumers.

Implement the types required for the initial Contact fields: Text Line, Text Multiline, Unique Text, Date, List, and Form Field. Remove the generic Text type from this proposed catalog. The public catalog must distinguish implemented types from unimplemented candidates. Translation templates and Bible pipeline integration remain later work.

Defer Add Field, Override Field, field disabling/removal, configurable required/default constraints, origin/version adoption, generic schema migrations, and accessible reordering. Preserve origin relationships and ordering in the model now, but do not expose nonfunctional editing controls. Before allowing removal or type changes on populated fields, define recovery and validation behavior.

In the Validation and TDD list above, read-only view, type validation, owner isolation, immutable versions, and pinned initialization tests belong to MVP. Tests of local overrides, label editing, and ordering belong to their later editing slices; they are not prerequisites for releasing the read-only foundation.