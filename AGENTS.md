# FINAL AGENT PROMPT — Existing E-commerce SaaS (V4)

## Storefront Templates, Visual Builder, Storefront Theme System & Dashboard Color Customizer

IMPLEMENTATION NOTE (read before starting):
This document is long and applies across many phases and sessions. At the start
of every phase — especially in a new session — re-read this file in full before
writing any code or giving any report.

IMPORTANT:

You are working directly on my EXISTING, partially built full-stack e-commerce SaaS application.

This is NOT a new project.

DO NOT rebuild the application from scratch.

Work directly with the existing codebase.

Preserve existing business logic, database architecture, APIs, integrations, authentication, authorization, workflows, and working functionality.

The goal is to safely improve the application's UI/UX and extend the Storefront architecture without breaking the existing product.

REFERENCE SCREENSHOTS:

Two screenshots will be attached in Phase 2.

They are screenshots of ANOTHER product/store/platform that I like visually.

They are NOT screenshots of my current application.

They are NOT the current project's architecture, UI, branding, code, components, database, or functionality.

Use them ONLY as visual references.


==================================================
# 1. NON-NEGOTIABLE RULES
==================================================

1. EXISTING APPLICATION — NO REBUILD

- Inspect and extend/refactor the existing codebase.
- Do not rebuild the SaaS from scratch.
- Do not replace the application with a new implementation.
- Do not create a separate demo application.
- Do not create fake/demo screens instead of integrating with the real application.
- Reuse existing components, services, APIs, state, database models, business logic, and working functionality whenever possible.


2. PRESERVE BUSINESS LOGIC

Do not unnecessarily break, rewrite, replace, or redesign business logic related to:

- Authentication
- Authorization
- Products
- Orders
- Customers
- Analytics
- Payments
- Delivery integrations
- Existing APIs
- Existing integrations
- Existing database business models
- Existing workflows

UI/UX improvements must not become an excuse to rewrite working business logic.


3. DASHBOARD VS STOREFRONT ISOLATION

There are two different UI systems:

A. SaaS Dashboard
- Merchant/admin interface.
- Contains existing business functionality such as Dashboard, Orders, Products, Customers, Analytics, Settings, etc.

B. Merchant Storefront
- Customer-facing online store.

The Dashboard and Storefront must remain architecturally and visually isolated.

Dashboard customization must NOT affect the Storefront.

Storefront Templates, Themes, Builder, and Theme Editor must NOT unintentionally affect the Dashboard.

The Storefront may inherit general brand principles from the Dashboard, but it must have its own Storefront-specific design-token mapping, layout rules, and responsive behavior.

Do NOT force Dashboard UI patterns onto the customer-facing Storefront.


4. REFERENCE SCREENSHOTS

The two screenshots are visual references from another product/store/platform.

Use them to understand:

- Visual hierarchy
- Background
- Cards
- Borders
- Border thickness
- Border color
- Radius
- Shadows
- Spacing
- Margins
- Padding
- Typography
- Heading hierarchy
- Body text
- Icons
- Navigation
- Sidebar
- Topbar
- Buttons
- Information density
- Tables
- Forms
- Responsive behavior
- RTL behavior
- Overall visual polish

Do NOT copy:

- Branding
- Logos
- Names
- Text
- Images
- Assets
- Proprietary content
- Exact layout
- Exact visual identity

Create an original design suitable for this SaaS.


5. GIT SAFETY

Before making implementation changes in each phase:

- Create a phase-specific Git checkpoint/commit.
- Use a clear commit title.

Example:

phase-2: dashboard ui redesign

If pre-existing uncommitted changes that were NOT created by you exist:

STOP.

Report them to me.

Do not overwrite unrelated work.

Phase 0 is audit-only and does not require a commit.


6. NEVER GUESS

If you are uncertain about:

- Framework
- Framework version
- File structure
- Component ownership
- Database schema
- API behavior
- Rendering architecture
- Existing integrations
- State management
- Caching
- Existing feature behavior

STOP and ask me before making a risky architectural decision.

Do not guess.


7. NO UNNECESSARY STACK MIGRATION

Inspect the actual existing stack first.

Do NOT migrate to:

- React 19
- Tailwind v4
- shadcn/ui
- another major framework/version
- another complete UI library

unless compatibility is confirmed and explicit approval is given.

If shadcn/ui already exists or is compatible with the current stack, it may be used as a UI component foundation.

shadcn/ui is a component/building-block layer.

It is NOT the visual identity of the product.

Do not use shadcn defaults as the final design.


8. REUSE BEFORE CREATING

Before creating components, search the existing codebase for reusable:

- Buttons
- Inputs
- Cards
- Tables
- Dialogs
- Drawers
- Tabs
- Dropdowns
- Navigation
- Forms
- Typography
- Layout primitives
- Existing Storefront sections
- Existing Builder components

Reuse existing components when appropriate.

Avoid duplicate components with the same responsibility.

Prefer shared components over duplicated template-specific implementations.


9. DATABASE SAFETY

Do not unnecessarily modify existing business database models.

New customization data must follow the existing tenant/data architecture.

Before any database migration:

- Explain the proposed schema.
- Explain relationships.
- Explain tenant isolation.
- Explain backward compatibility.
- Explain migration and rollback strategy.

Do not perform a database migration before explicit approval.


10. STRUCTURED CONFIGURATION

Store:

- Template configuration
- Theme configuration
- Section configuration
- Builder state

as validated structured data.

Do NOT allow arbitrary executable CSS or JavaScript through merchant configuration.

Configuration must be schema-validated and safe.


11. DRAFT / PREVIEW / PUBLISH

Builder changes modify Draft only.

Preview renders Draft.

Live Storefront must NEVER change before Publish.

Live Storefront uses the latest valid Published Version.

Save Draft must never automatically publish.


12. SAFE FALLBACK

If a custom Template or Theme fails:

- Fall back safely to Modern where appropriate.
- Do not silently delete valid configuration.
- Do not silently overwrite a valid published version.
- Log the failure.
- Keep the Live Storefront functional whenever possible.

If Builder functionality fails, the Live Storefront must remain functional.


13. ACCESSIBILITY AND UX

The system must be:

- Responsive
- Readable
- Touch-friendly
- Keyboard accessible where applicable
- Visually consistent
- RTL-compatible
- Accessible with long Arabic text
- Usable at different screen widths


14. MANDATORY PHASE STOPS

After EVERY phase:

STOP.

Provide an Arabic report containing:

- What was changed
- Files/components changed
- Database changes
- API changes
- Tests performed
- Known issues
- Risks
- Completed work
- Remaining work

Then WAIT for my approval.

Do not automatically continue to the next phase.


15. TESTING

Reuse the existing testing framework.

Do not introduce a new testing framework without approval.

Test where relevant:

- Component behavior
- Template CRUD
- Section CRUD
- Section reorder persistence
- Draft
- Preview
- Publish
- Live rendering
- Rollback
- Fallback
- Tenant isolation
- Dashboard/Storefront isolation
- Responsive behavior
- RTL
- Permissions

Clearly distinguish:

- Automated tests
- Manual tests
- Untested areas

Never claim something works if it was not actually tested.


16. ASSETS

Use the existing asset/storage pipeline whenever possible.

Store merchant images as:

- URL
- Asset ID
- Existing storage reference

Never store binary image data inside JSON configuration.

Validate:

- File type
- File size
- Tenant/store ownership

Support:

- Optimization
- Lazy loading
- Existing CDN/storage pipeline

Do not introduce a new storage provider/CDN without approval.


17. SEO

Audit and preserve:

- Title
- Meta description
- Canonical URL
- Open Graph
- Sitemap
- Structured data

Template/Theme changes must not overwrite SEO configuration.

Support relevant schemas such as:

- Product
- BreadcrumbList


18. PERFORMANCE

Performance is a top priority.

First inspect the existing architecture.

Use the fastest architecture compatible with the existing stack.

The published customer-facing Storefront must NOT depend on a full client-side fetch-and-render cycle on every visit.

Where appropriate, use:

- Server rendering
- Static generation
- Edge caching
- CDN caching
- Warmed server cache
- Existing framework-native caching

Choose the safest and fastest option compatible with the current architecture.

Before implementation, establish a performance baseline in Phase 0.

Measure where possible:

- LCP
- INP
- CLS
- TTFB
- JavaScript transferred
- Total page weight
- Request count
- Image weight

Agree on a realistic performance budget before final implementation.

Additional rules:

- Only the active Storefront Template should contribute customer-facing Template code.
- Do NOT ship all four templates into every Storefront unnecessarily.
- Builder/editor code must NOT be included in the customer-facing Storefront bundle.
- Editor-only dependencies must remain isolated where possible.
- Minimize customer-side JavaScript.
- Lazy-load appropriate below-the-fold content.
- Optimize images.
- Publish should invalidate only the affected Storefront cache.
- Do not perform unsafe global cache flushing.
- Do not duplicate large configuration/data unnecessarily.

At Phase 6, perform actual performance testing using appropriate tools such as Lighthouse/PageSpeed where available.

Report actual measurements.


19. PUBLISHING AND ROLLBACK

Every Publish creates an immutable Published Version snapshot.

A Published Version records at least:

- Version
- Date/time
- Store
- What was published
- Relevant configuration reference

Rollback must NEVER mutate or delete historical versions.

Example:

V1 → V2 → V3 → Rollback V1 → V4

V4 is a new snapshot equivalent to V1.


20. MULTI-TENANT ISOLATION

Follow the existing tenant architecture.

Enforce isolation at appropriate:

- Database/query level
- Server/API level
- Builder level
- Storefront-rendering level
- Asset level

Include explicit cross-tenant tests.


21. STAGING / BACKUP / MIGRATION SAFETY

Before any production-impacting migration:

- Use a staging/development environment when available.
- Verify that a recent production backup exists.
- Confirm the backup is usable where possible.
- Prepare a rollback plan.
- Test migration behavior before production.

Do NOT perform a production database migration or destructive migration without explicit approval.

If staging is unavailable, STOP and report the limitation and safest alternative before making production-impacting changes.


22. LEGACY STOREFRONT MIGRATION

Existing live stores may currently use the old Storefront design.

Do NOT automatically convert existing live stores to the new system.

First audit:

- How current stores identify their design
- How current Storefront configuration is stored
- How many stores may be using the old system
- Whether backward compatibility is possible

Preferred strategy:

Existing stores remain visually and functionally unchanged through a Legacy Storefront/compatibility mode until the merchant explicitly opts in or selects a new Template.

New Templates apply only when intentionally selected.

Do not silently migrate live stores.

Propose alternatives in Phase 0 if a better migration architecture is discovered.


23. VERSION RETENTION POLICY

Published/Draft history must have a defined retention strategy.

Before implementation, propose:

- Maximum number of versions and/or maximum age
- Which versions must be protected
- Rollback requirements
- Audit requirements

Never silently delete versions.

Protect at minimum:

- Current Published Version
- Versions required for rollback
- Versions required for audit/compliance where applicable

Any automatic cleanup must follow the approved retention policy.


24. CONCURRENT EDITING

Audit whether multiple:

- Users
- Browser tabs
- Sessions
- Devices

can edit the same Storefront Draft.

Do NOT assume last-write-wins is safe.

Prefer optimistic concurrency/version checking over heavy locking.

If a Draft becomes stale:

- Warn the user.
- Do not silently overwrite newer changes.
- Require refresh/merge/retry as appropriate.

Do NOT introduce heavy real-time synchronization or polling unless it is actually necessary.


25. DRAFT / PUBLISH / ROLLBACK PERMISSIONS

Audit existing roles and permissions.

Draft, Publish, and Rollback actions must respect the existing authorization architecture.

Permission enforcement must exist server/API-side, not only in the UI.

If the current application is single-user, preserve that simplicity while keeping the architecture extensible.

Do not invent a completely new permission system unless necessary and approved.


26. DRAFT RECOVERY / AUTOSAVE

Draft editing should have safe recovery behavior.

Provide where appropriate:

- Saved/unsaved indicator
- Last saved status
- Recovery status
- Draft recovery after accidental refresh/navigation
- Debounced/throttled autosave

Autosave:

- Must NEVER publish.
- Must not create a database request for every tiny interaction.
- Batch rapid changes into one logical save.
- Prefer a debounce around approximately 800–1500ms where compatible with the existing architecture.
- Avoid high-frequency writes.

Version snapshots should store compact configuration/state references rather than duplicating:

- Product records
- Large images
- Media binaries

Do not store duplicate media in version snapshots.


27. VISUAL PREVIEW BEFORE IMPLEMENTATION

Before writing real implementation code for:

A. Dashboard redesign (Phase 2)

B. Storefront/customer-facing interface (Phase 2/3)

C. Each of the four Templates individually (Phase 3)

you MUST first produce a visual-only preview.

The preview may be:

- Static HTML/CSS
- Rendered visual mockup
- Other non-production visual representation

The preview must NOT be connected to:

- Real database data
- Real business logic
- Routing
- Production APIs
- Real persistence

The preview must use the approved Design Tokens from Phase 1/2.

IMPORTANT:

The visual preview must be representative of the real implementation constraints.

It must use, or faithfully model:

- The same design tokens
- The same component primitives
- The same responsive breakpoints
- The same layout rules
- The same structural constraints

Do NOT create a visually impressive mockup that cannot be reproduced faithfully in the existing stack.

Separate approval gates are required:

1. Dashboard visual preview
2. Core Storefront / Modern visual preview
3. Minimal visual preview
4. Bold visual preview
5. Boutique visual preview

Do NOT proceed to real implementation until I explicitly approve the corresponding preview.

If I request changes:

Modify the preview only.

Do NOT modify production/real implementation code until the preview is approved.


28. REFERENCE BLOCK LIBRARY FOR STOREFRONT STRUCTURE

When building Storefront sections such as:

- Hero
- Product Grid
- Testimonials
- Newsletter
- Promotional sections
- Other Storefront sections

you may use a real, known block/component library compatible with shadcn/ui as a structural reference.

For example:

shadcn/ui Blocks

Reference:

https://ui.shadcn.com/blocks

The library is a structural/design reference.

If you believe another library is more appropriate:

- Name it explicitly.
- State its license.
- Explain why it is more appropriate.
- Request my approval before using it.

Do NOT silently switch to another library.

RULES FOR USING REFERENCE LIBRARIES:

1. STRUCTURE ONLY

Use only structural/layout ideas such as:

- Layout rhythm
- Grid structure
- Section composition
- Component arrangement
- Responsive behavior

Do NOT copy:

- Colors
- Fonts
- Icons
- Images
- Branding
- Visual identity

2. DESIGN TOKENS ARE OUR SOURCE OF TRUTH

All visual values must come exclusively from our approved Design Tokens.

This includes:

- Colors
- Radius
- Typography
- Spacing
- Borders
- Shadows

Do NOT inherit default visual values from the reference library.

3. LICENSE

Verify the license before copying any code.

The source must be:
- Free/open-source where applicable
- Compatible with commercial SaaS use

Do NOT use paid/proprietary libraries such as Tailwind Plus without my explicit approval.

4. OFFLINE FALLBACK

If you do not have live access to the reference library:

Say so explicitly.

Ask me for:

- Reference files
- Exports
- Screenshots
- Relevant source files

Do NOT guess block structures from memory.

5. REPORTING

In the Phase 3 report, explicitly state:

- Library name
- License
- Specific blocks used
- Which template used each block/reference

REFERENCE CODE IS NOT A REQUIREMENT TO COPY CODE.

Prefer recreating the structure using the project's existing components when that produces cleaner, safer, and more maintainable code.


==================================================
# 2. DEFINITIONS
==================================================

Template
= Storefront structural/layout system.

Section
= Reusable Storefront content block.

Theme
= Storefront visual design token configuration.

Builder
= Interface used to edit Storefront sections and configuration.

Draft
= Unpublished working configuration.

Preview
= Rendering of the Draft.

Published Version
= Immutable live configuration snapshot.

Legacy Storefront
= Existing Storefront implementation used by stores that have not opted into the new Template system.

Autosave
= Debounced saving of Draft changes without publishing.

Dashboard Color Customizer
= Lightweight Dashboard-only editor for choosing Dashboard primary/accent color.


==================================================
# PHASE 0 — COMPLETE AUDIT ONLY
==================================================

DO NOT implement UI changes.

DO NOT implement database changes.

Audit the existing application first.

Inspect and report:

1. Frontend framework/version
2. React version if applicable
3. Tailwind/CSS architecture
4. Existing UI/component libraries
5. shadcn/Radix usage
6. State management
7. Dashboard layout
8. Storefront renderer and exact files
9. Current data flow
10. Existing Templates/Themes/Sections
11. Existing Design Tokens/CSS variables
12. Drag-and-drop implementation
13. Existing reusable components
14. Existing Builder/editor
15. Database architecture
16. Asset/upload pipeline
17. SEO implementation
18. Caching/CDN architecture
19. Multi-tenancy
20. Testing setup
21. Existing authentication/authorization and roles
22. Current Draft/Publish behavior if any
23. Existing autosave/recovery behavior
24. Concurrent editing behavior
25. Existing live stores using the old Storefront
26. How old Storefront configuration is stored
27. Safest architecture for Templates, Sections, Themes, Builder, Draft/Preview/Publish, Version History, Rollback, and Dashboard Color Customizer
28. What should be extended
29. What should be refactored
30. What should be reused
31. What should remain untouched
32. Performance baseline where measurable:
   - LCP
   - INP
   - CLS
   - TTFB
   - JS transferred
   - Page weight
   - Request count
   - Image weight
33. Staging environment
34. Backup status/strategy
35. Migration/rollback strategy
36. Version retention strategy
37. Concurrency strategy
38. Permissions strategy

DASHBOARD AUDIT RULE:

Focus on presentation/UI/UX organization.

Do NOT change functional architecture.

Do NOT merge, split, remove, rename, or relocate business features unless explicitly approved.

Example:

If "Profitability" currently contains:

- Facebook profitability
- Overall profitability
- Most profitable products

do NOT create new business modules just to make the UI cleaner.

Instead improve hierarchy through:

- Cards
- Summaries
- Tabs
- Tables
- Filters
- Sections
- Spacing
- Visual grouping

while preserving the underlying functionality.

OUTPUT:

Provide an Arabic audit and architecture proposal.

No implementation.

STOP.

Wait for approval.


==================================================
# PHASE 1 — STOREFRONT DESIGN SYSTEM FOUNDATION
==================================================

Create/extend a reusable Storefront Design System.

Design tokens should cover:

- Colors
- Typography
- Font scale
- Spacing
- Layout
- Borders
- Radius
- Shadows
- Effects
- Density
- Responsive rules where appropriate

Use scoped CSS variables/design tokens per Storefront/store.

IMPORTANT — VALUES VS. STRUCTURE:

In this phase, define only the token STRUCTURE and NAMING (the variable
names, the schema, the categories listed above). Do NOT assign final
visual VALUES yet (actual hex colors, exact radius numbers, exact spacing
scale, exact font stack). Those values are determined in Phase 2, from the
reference-screenshot analysis. Assigning arbitrary placeholder values
now risks locking in a look that doesn't match the approved direction and
having to redo work in Phase 2.

IMPORTANT:

The Storefront should inherit general brand principles from the approved Dashboard direction, but it must NOT become a copy of the Dashboard.

The Storefront has its own token mapping and layout rules.

Before any database migration, present:

- Proposed schema
- Relationships
- Tenant isolation
- Draft/Published model
- Versioning
- Rollback
- Backward compatibility
- Fallback
- Legacy Storefront coexistence
- Version retention policy
- Concurrency strategy
- Autosave storage strategy
- Permission alignment
- Staging/backup/rollback plan

No migration until explicit approval.

Do not redesign the Dashboard in this phase.

STOP and report.


==================================================
# PHASE 2 — REFERENCE ANALYSIS + DASHBOARD UI/UX REDESIGN
==================================================

## Primary Goal: Dashboard Visual Direction

The two attached screenshots show the Dashboard/merchant interface of ANOTHER product.

They are NOT the current project's Dashboard.

They are NOT the Storefront.

They do NOT contain Storefront sections such as Hero, Product Grid, Testimonials, etc.

Therefore, they must NOT be used as direct references for designing Storefront sections.

Use them as the actual visual source for the Dashboard direction.

Analyze:

- Visual hierarchy
- Background
- Cards
- Borders
- Radius
- Shadows
- Spacing
- Margins
- Padding
- Typography
- Icons
- Sidebar
- Navigation
- Topbar
- Tables
- Forms
- Information density
- Mobile behavior
- RTL behavior

Before coding, provide an Arabic design analysis and connect it to Phase 1 Design Tokens:

- Color/token direction
- Typography
- Spacing
- Radius
- Borders
- Shadows
- Layout
- Density
- Desktop
- Tablet
- Mobile
- RTL

STOP.

Wait for approval.

## Visual Preview Gate

Before real Dashboard implementation, produce the Dashboard visual-only preview according to Rule 27.

STOP.

Wait for explicit approval.

## After Preview Approval — Dashboard Redesign

Redesign the presentation/UI/UX of the existing Dashboard.

Do NOT change:

- Business logic
- Functional architecture
- Existing workflows
- Existing permissions
- Existing business functionality

Improve:

- Layout
- Hierarchy
- Spacing
- Typography
- Cards
- Borders
- Navigation
- Sidebar
- Topbar
- Tables
- Forms
- Filters
- Empty states
- Loading states
- Information grouping
- Density
- Responsive behavior
- RTL

Use shadcn/ui/Tailwind only when compatible with the existing stack.

Do not introduce another complete UI library unnecessarily.

Test:

- Desktop
- Tablet
- Mobile
- RTL
- Different screen widths

STOP and report.


==================================================
# PHASE 2.5 — DASHBOARD COLOR CUSTOMIZER
==================================================

Add a LIGHTWEIGHT Dashboard Color Editor ONLY.

This is NOT a full Dashboard Theme Editor.

The merchant can select the Dashboard primary/accent color:

- Blue
- Purple
- Green
- Orange
- Red
- Custom color picker

Apply it appropriately to:

- Primary buttons
- Active sidebar/navigation
- Links
- Accent icons
- Focus states
- Relevant badges
- Relevant charts where appropriate

Requirements:

- Dashboard-scoped CSS variables
- Persist per merchant/store/tenant
- Validate color values
- Sensible default
- Reset to default
- No Storefront impact
- No cross-merchant impact
- No business logic changes

STRICT LIMITATION:

Do NOT add Dashboard customization for:

- Fonts
- Spacing
- Radius
- Sidebar structure
- Card structure
- Layout density
- Arbitrary component configuration

unless explicitly requested later.

The Dashboard Color Customizer is for color/accent only.

STOP and report.


==================================================
# PHASE 3 — STOREFRONT TEMPLATES
==================================================

Build a reusable Storefront Template System with four initial Templates:

1. Modern — Default/Fallback
2. Minimal
3. Bold
4. Boutique

All Templates must use:

- Shared contracts
- Shared reusable components
- Shared Storefront Design Tokens
- Existing business data

Template = structure/layout.

Theme = visual appearance.

Do NOT create four completely independent CSS systems.

Do NOT duplicate components unnecessarily.

Where possible, shared components should be reused.

Only the active Template should contribute customer-facing Template code.


## Shared Storefront Sections

Support sections such as:

- Announcement Bar
- Header
- Hero/Banner
- Categories
- Featured Products
- Product Grid
- Promotional Banner
- Testimonials
- Benefits
- Newsletter
- Footer

Each Section must have:

- Stable ID
- Section type
- Order/index
- Enabled state
- Structured settings
- Content/configuration
- Asset references
- SEO-related fields where relevant


## DIFFERENCES BETWEEN TEMPLATES

The four Templates share the same approved brand tokens.

However, they MUST have genuinely different structural identities.

They must NOT be four nearly identical Storefronts with different colors or small section rearrangements.

Before implementation:

Propose a comparison table and obtain approval.

At minimum compare:

### Spacing rhythm
- Compact
- Comfortable
- Spacious

### Radius philosophy
- Sharp
- Medium
- Fully rounded

### Hero structure
- Full-screen/image-led
- Split text + image
- Text-led/minimal

### Product Grid
- Number of columns
- Card structure
- Border-based
- Shadow-based
- Borderless

### Typography
Examples:

- Large bold editorial headings
- Balanced modern hierarchy
- Lighter editorial typography

### Additional structural differences

Where appropriate, also vary:

- Header composition
- Navigation density
- Promotional section composition
- Product card information density
- Content width
- Section proportions
- CTA placement
- Footer structure

The differences must be structural and recognizable.

Each Template must have a clearly recognizable identity when viewed side-by-side using the same content/data.

If two Templates feel like the same Storefront with only minor rearrangement or styling differences, the design is NOT approved.

Use the approved reference block library from Rule 28 as a structural source where appropriate.

Do NOT rely on changing tokens alone to differentiate Templates.


## Visual Preview Gates

Before implementing each Template:

1. Produce Modern visual preview.
2. Obtain approval.
3. Implement Modern.

Then:

1. Produce Minimal visual preview.
2. Obtain approval.
3. Implement Minimal.

Then:

1. Produce Bold visual preview.
2. Obtain approval.
3. Implement Bold.

Then:

1. Produce Boutique visual preview.
2. Obtain approval.
3. Implement Boutique.

If changes are requested:

Modify only the corresponding preview until approved.

Do not modify production implementation before approval.


## Merchant Actions

Merchant can:

- Select Template
- Preview Template
- Add sections
- Remove sections
- Duplicate sections
- Enable/disable sections
- Reorder sections
- Edit sections
- Save Draft
- Preview Draft
- Publish
- View history
- Rollback

Use dnd-kit or an existing approved DnD solution.

Do not modify unrelated business logic.

Test section persistence and operations.

STOP and report.


==================================================
# PHASE 4 — LIVE VISUAL BUILDER
==================================================

Create a real Storefront Visual Builder.

Three main areas:

## LEFT PANEL

- Section hierarchy
- Drag/reorder
- Add
- Duplicate
- Delete
- Enable/disable
- Select

## CENTER

Render the actual Storefront using the same reusable components as the Live Storefront whenever possible.

Selected sections must show:

- Visual highlight
- Editing controls
- Draft changes immediately

## RIGHT PANEL

Contextual settings editor for the selected section.

Support where appropriate:

- Section-specific settings
- Content
- Images/assets
- Supported layout controls
- Validated values

Also provide:

- Undo
- Redo
- Unsaved changes indicator
- Save Draft
- Preview
- Publish
- Published-state indicator
- Last saved status
- Recovery status

Draft history and Published Version history must remain separate.

## Mobile Builder

On mobile:

- Left panel becomes Drawer
- Right editor becomes Bottom Sheet/Drawer
- Controls are touch-friendly
- RTL-compatible

Builder code and editor-only dependencies MUST NOT be included in the customer-facing Storefront bundle.

Never modify Live Storefront before Publish.

STOP and report.


==================================================
# PHASE 5 — STOREFRONT THEME EDITOR
==================================================

Create a Storefront Theme Editor controlling Storefront Design System tokens.

Allow editing of:

- Colors
- Typography
- Layout
- Spacing
- Shape/radius
- Borders
- Effects/shadows
- Density

Image settings must use the existing asset pipeline.

Theme changes must:

- Update Builder Preview live
- Use validated design tokens/CSS variables
- Avoid unnecessary reloads
- Never affect Dashboard
- Never affect another store

Support:

- Save
- Edit
- Reset
- Duplicate
- Draft
- Preview
- Publish

Keep SEO configuration separate from Theme configuration.

STOP and report.


==================================================
# PHASE 6 — FINAL INTEGRATION + QA
==================================================

Verify all systems.

## STOREFRONT

Verify:

- Template persistence
- Section persistence
- Theme persistence
- Draft survives refresh
- Preview reflects Draft
- Live uses Published only
- Publish creates immutable version
- Rollback creates a new version
- Fallback works
- Legacy stores remain unaffected unless explicitly migrated
- Only active Template code reaches the customer bundle


## DASHBOARD

Verify:

- Redesign preserves functionality
- Color Customizer persists
- Color applies correctly
- Reset works
- Dashboard color never changes Storefront
- No cross-merchant impact


## BUILDER

Verify:

- Drag and drop
- Add/remove
- Duplicate
- Reorder
- Section editor
- Undo/redo
- Draft
- Preview
- Publish
- Recovery
- Autosave
- Mobile drawers
- RTL
- Stale Draft detection


## ASSETS

Verify:

- Existing storage pipeline
- Asset IDs/URLs
- Validation
- Tenant isolation
- Optimization
- Lazy loading


## SEO

Verify:

- Metadata
- Canonical
- Open Graph
- Sitemap
- Product schema
- BreadcrumbList where relevant

No SEO regression.


## PERFORMANCE

Measure actual performance.

Verify:

- Appropriate rendering strategy
- Cache behavior
- Publish invalidation
- No unsafe global cache flush
- Minimal customer JavaScript
- Only active Template code shipped
- Builder code excluded from Storefront
- Optimized images
- Lazy loading

Report actual:

- LCP
- INP
- CLS
- TTFB
- JS transferred
- Total page weight
- Request count
- Image weight

Do not claim performance targets were met without measurement.


## SECURITY / MULTI-TENANCY

Test:

- Cross-tenant API access
- Builder isolation
- Storefront rendering isolation
- Asset isolation
- Permission enforcement
- Draft/Publish/Rollback permissions


## VERSIONING

Verify:

- Immutable Published Versions
- Rollback creates new version
- Retention policy
- Protected current version
- No silent deletion


## CONCURRENCY

Verify:

- Stale Draft detection
- No silent overwrites
- Version checking
- Refresh/merge/retry behavior


## BACKUP / MIGRATION

Verify:

- Staging validation where applicable
- Backup strategy
- Rollback plan
- Legacy compatibility
- No automatic migration of old live stores


## RESPONSIVE / RTL

Test:

- Desktop
- Tablet
- Mobile
- Narrow screens
- Wide screens
- Arabic RTL
- Long Arabic text
- Sidebar
- Navigation
- Builder
- Editor
- Drawers
- Forms
- Buttons
- Tables
- Preview


==================================================
# FINAL ARABIC REPORT
==================================================

Provide a complete Arabic Final Report containing:

1. What was implemented
2. Final architecture
3. Files/components changed
4. Database changes
5. API changes
6. Dashboard redesign
7. Dashboard Color Customizer
8. Storefront Template System
9. Modern Template
10. Minimal Template
11. Bold Template
12. Boutique Template
13. Section System
14. Visual Builder
15. Theme Editor
16. Draft/Preview/Publish
17. Version History
18. Rollback
19. Version Retention
20. Autosave/Recovery
21. Concurrent editing protection
22. Permissions
23. Assets/storage
24. SEO
25. Performance measurements
26. Responsive behavior
27. RTL
28. Multi-tenant isolation
29. Legacy Storefront compatibility
30. Staging/backup/migration safety
31. Automated tests
32. Manual tests
33. Untested areas
34. Known limitations
35. Technical debt
36. Remaining risks

Never claim that something works if it was not actually tested.

Never hide known problems.


==================================================
# FINAL ARCHITECTURE
==================================================

Existing SaaS
│
├── Authorization
│
├── SaaS Dashboard
│   ├── Existing Business Functionality
│   ├── Dashboard UI/UX Design System
│   └── Dashboard Color Customizer
│       └── Scoped Dashboard CSS Variables
│
└── Merchant Storefront
    │
    ├── Legacy Storefront
    │
    ├── Storefront Template Engine
    │   ├── Modern
    │   ├── Minimal
    │   ├── Bold
    │   └── Boutique
    │
    ├── Shared Storefront Design System
    │
    ├── Shared Storefront Components
    │
    ├── Storefront Theme Editor
    │   └── Scoped Storefront CSS Variables
    │
    ├── Visual Builder
    │
    ├── Draft
    │
    ├── Preview
    │
    ├── Publish
    │
    ├── Immutable Published Version History
    │   └── Rollback → creates new version
    │
    ├── Version Retention
    │
    ├── Autosave / Recovery
    │
    ├── Concurrency Protection
    │
    ├── Permission Enforcement
    │
    ├── Store-scoped Asset References
    │
    └── Performance / Caching Layer
        ├── Server rendering/static generation where appropriate
        ├── Edge/CDN caching where appropriate
        ├── Active-template code splitting
        └── Publish-scoped cache invalidation


==================================================
# FUTURE EXTENSIBILITY — DO NOT IMPLEMENT NOW
==================================================

Design the architecture so it can later support:

- AI Theme Generator
- AI Section Generator
- AI Storefront Layout Generator
- Additional Storefront Templates
- Custom Storefront Themes
- Template duplication
- Theme duplication
- Store duplication
- Import/export
- Template marketplace
- AI-generated layouts

DO NOT implement these now.

Build the architecture so they can be added later without rewriting the Core Storefront System.


==================================================
# FINAL PRINCIPLE
==================================================

PRESERVE THE EXISTING APPLICATION.

DO NOT REBUILD IT.

Improve its presentation and extend it safely.

The Dashboard is primarily:

Dashboard UI/UX redesign
+
Lightweight Dashboard Color Customizer for color/accent only.

The Storefront is where the full:

Template
+
Section
+
Visual Builder
+
Theme Editor
+
Draft
+
Preview
+
Publish
+
Versioning
+
Rollback

architecture belongs.

The two screenshots are Dashboard visual references from another product/platform only.

They are NOT Storefront references.

The Storefront should inherit the same general brand principles, but it must not become a copy of the Dashboard.

Never sacrifice:

- Business logic
- Data integrity
- Tenant isolation
- Security
- Production functionality
- Backward compatibility
- Performance

for visual changes.

Never claim untested functionality as working.

STOP after every phase and wait for approval.
