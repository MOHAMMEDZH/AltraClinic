# Healthcare Design System Blueprint

**Version:** 2026-06-15.v1  
**Status:** Authoritative UI/UX specification — **no application pages yet**  
**Audience:** Product, design, frontend engineering  
**Token file:** [`design-tokens.json`](./design-tokens.json)

---

## 0) Document Purpose

This blueprint defines the **complete healthcare design system** for the Booking System platform before any screen implementation. It consolidates and supersedes fragmented guidance in [`UI_SYSTEM.md`](./UI_SYSTEM.md), [`UX_STRATEGY.md`](./UX_STRATEGY.md), and [`INFORMATION_ARCHITECTURE.md`](./INFORMATION_ARCHITECTURE.md) where conflicts exist.

**In scope:** tokens, typography, spacing, components, forms, tables, dashboards, charts, navigation, role UX, RTL/LTR, dark/light, accessibility.  
**Out of scope:** page mockups, route implementations, React components (Phase 2: `packages/ui`).

**Platform alignment:**

| Backend capability | UI implication |
|---|---|
| Permission matrix (`api.*` resources) | Navigation visibility + action buttons |
| Global search (`GET /search`) | Cmd+K palette, header search |
| Realtime (`/realtime` WebSocket) | Live queue, notifications, dashboard counters |
| Subscription tiers (Lite/Pro/Enterprise) | Feature gates in nav + upsell patterns |
| Arabic-first product vision | Default `dir=rtl`, `lang=ar-SY` |

---

## 1) Design Principles

### 1.1 Healthcare-first

1. **Safety over speed** — destructive clinical actions require confirmation; undo where possible.
2. **Context preservation** — patient context bar persists across modules (name, ID, allergies badge).
3. **Scanability** — dense data (labs, schedules) uses tables; narrative data uses structured forms.
4. **Low-bandwidth resilience** — skeleton states, optimistic UI, offline indicators (PWA Phase 2).
5. **Role-appropriate density** — clinicians: compact; reception: balanced; owners: summary-first.

### 1.2 Arabic-first, English-capable

- Default locale: `ar-SY`, direction `rtl`.
- English (`en-US`) is a **peer locale**, not a fallback afterthought.
- All strings externalized; zero hardcoded UI copy.
- See [`INTERNATIONALIZATION.md`](./INTERNATIONALIZATION.md) for formatting rules.

### 1.3 Competing Architect Review — Principles

| Decision | Weakness | Better alternative |
|---|---|---|
| Arabic default for all tenants | International staff clinics struggle | Tenant-level default locale setting; user override persists |
| Single design system for clinic + patient portal | Patient UX needs simpler, warmer tone | Shared tokens; separate `ui-clinical` vs `ui-portal` component variants |
| "Safety over speed" everywhere | Reception check-in becomes slow | Tier confirmations: soft for admin, hard for clinical |

---

## 2) Color System

### 2.1 Brand palette

Primary **Healthcare Green** (`#26AD89`) — trust, life, calm.  
Secondary **Clinical Blue** (`#265FB2`) — authority, information.

Full ramp: see [`design-tokens.json`](./design-tokens.json) → `color.brand`.

### 2.2 Semantic colors

| Token | Light | Use |
|---|---|---|
| `success` | `#16A34A` | Completed, paid, active |
| `warning` | `#D97706` | Pending, expiring, low stock |
| `error` | `#DC2626` | Validation, critical failure |
| `info` | `#2563EB` | Neutral information |

### 2.3 Clinical status colors (healthcare-specific)

| Token | Meaning | Example |
|---|---|---|
| `clinical.critical` | Life-threatening / stat | Allergy alert, STAT order |
| `clinical.urgent` | Needs action today | Abnormal lab, overdue follow-up |
| `clinical.stable` | Normal / cleared | Vitals in range |
| `clinical.pending` | Awaiting result/approval | Pending Rx signature |
| `clinical.inactive` | Archived / cancelled | Discharged, void invoice |

**Rule:** Never use color alone — pair with icon + text label (WCAG + colorblind).

### 2.4 Light mode surfaces

```
background     #FAFAFA   (page)
surface        #FFFFFF   (cards, panels)
surfaceRaised  #FFFFFF   (modals — use border + shadow)
border         #E5E5E5
textPrimary    #262626
textSecondary  #525252
focusRing      #26AD89   (2px, offset 2px)
```

### 2.5 Dark mode surfaces

```
background     #121212   (not pure black — reduces OLED smear)
surface        #1E1E1E
surfaceRaised  #2A2A2A   (elevated cards — higher contrast than v1 UI_SYSTEM)
border         #404040
textPrimary    #FAFAFA
textSecondary  #D4D4D4
focusRing      #51BDA1
```

**Dark mode clinical colors:** use `*.dark` variants in tokens — brighter hues for contrast on `#1E1E1E`.

### 2.6 Competing Architect Review — Color

| Decision | Weakness | Alternative |
|---|---|---|
| Green primary for healthcare | Common; low brand differentiation | Keep green for clinical success; use blue for brand chrome (header) |
| 10-step color ramp | Maintenance burden | **Adopted:** 7 operational steps (50, 100, 300, 500, 700, 900) in implementation |
| Semantic red separate from clinical critical | Two reds confuse | Merge `error` and `clinical.critical` in UI; use icon shape to distinguish validation vs clinical |

---

## 3) Typography

### 3.1 Font stack (revised from UI_SYSTEM)

| Role | Font | Rationale |
|---|---|---|
| Arabic UI | **IBM Plex Sans Arabic** | Designed for Arabic; consistent weights; self-hostable |
| Latin UI | **IBM Plex Sans** | Pairs with Arabic cut; clinical readability |
| Monospace | **IBM Plex Mono** | IDs, invoice numbers, timestamps |

Fallback: `Noto Sans Arabic`, `system-ui`, `sans-serif`.

**Rejected:** Segoe UI-only stack (inconsistent cross-platform, weak Arabic rhythm).

### 3.2 Type roles (semantic, not pixel-named)

| Role | Desktop | Weight | Usage |
|---|---|---|---|
| `display` | 36px / 44px | 700 | Marketing, empty states |
| `pageTitle` | 32px / 40px | 700 | Screen title (one per view) |
| `sectionTitle` | 24px / 32px | 600 | Dashboard sections |
| `cardTitle` | 20px / 28px | 600 | Card headers |
| `bodyLg` | 16px / 24px | 400 | Clinical narrative, consent text |
| `body` | 14px / 20px | 400 | Default UI, forms, tables |
| `bodySm` | 12px / 16px | 400 | Helper text, metadata |
| `label` | 14px / 20px | 500 | Form labels, table headers |
| `caption` | 11px / 16px | 500 | Timestamps, badges |

### 3.3 Arabic typography rules

- **No italic** for Arabic text.
- **Line-height:** 1.6 for body Arabic (1.5 for Latin).
- **Numbers:** locale-aware — Arabic-Indic digits optional (`ar-SY-u-nu-arab` vs `latn`).
- **Mixed script:** patient names may be bilingual — allow `dir=auto` on name fields.
- **Truncation:** ellipsis on end (left in RTL for single-line).

### 3.4 Competing Architect Review — Typography

| Decision | Weakness | Alternative |
|---|---|---|
| Web fonts (IBM Plex) | ~80KB per cut; slow networks | Self-host WOFF2; subset Arabic glyphs; system font fallback until loaded |
| 9 type roles | Proliferation in code | Map to 6 in code: title, heading, body, label, caption, mono |
| Same scale mobile/desktop | Headings too large on phone | Responsive scale: pageTitle 24px on `<md` |

---

## 4) Spacing & Layout

### 4.1 Spacing scale (4px base)

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80` — see tokens.

| Context | Token |
|---|---|
| Input padding | `12px` (space-3) |
| Card padding | `16px` mobile / `24px` desktop |
| Section gap | `24px` |
| Page gutter | `16px` mobile / `24px` tablet / `32px` desktop |
| Inline icon gap | `8px` |

### 4.2 Layout grid

- **12-column** grid, `24px` gutter (desktop).
- **Content max-width:** `1440px` (dashboards); **forms max-width:** `720px`.
- **Sidebar:** expanded `260px`, collapsed `72px` (icon-only).
- **Header height:** `56px` fixed.

### 4.3 Density modes (role-aware)

| Mode | Row height | Use |
|---|---|---|
| `comfortable` | 48px | Reception, owners |
| `compact` | 40px | Doctors, nurses (default clinical) |
| `dense` | 36px | Power users; optional in settings |

### 4.4 Competing Architect Review — Spacing

| Decision | Weakness | Alternative |
|---|---|---|
| Fixed sidebar 260px | Wastes space on Arabic long labels | Collapsible groups; truncate with tooltip |
| 12-column everywhere | Overkill for forms | Forms: single column `<lg`; two-column only for short fields |

---

## 5) Elevation, Motion & Icons

### 5.1 Elevation

Prefer **border + subtle shadow** in light mode; **border only** in dark mode (shadows invisible on dark surfaces).

| Level | Use |
|---|---|
| 0 | Flat lists, table rows |
| 1 | Cards, hover states |
| 2 | Dropdowns, popovers |
| 3 | Modals |
| 4 | Command palette (Cmd+K) |

### 5.2 Motion

- **Duration:** 120ms (micro), 200ms (default), 320ms (panel slide).
- **Respect** `prefers-reduced-motion` — disable transforms.
- **Clinical rule:** no animation on allergy/critical banners.

### 5.3 Icons

- Library: **Lucide** (consistent stroke, RTL-friendly).
- Sizes: 16 / 20 / 24 / 32px.
- **Flip in RTL:** chevrons, arrows, external-link.
- **Do not flip:** check, alert, medical symbols.
- **Always label** primary nav icons; tooltips required when collapsed.

---

## 6) Component Library

### 6.1 Taxonomy

```
Foundation    → tokens, reset, dir, theme
Primitives    → Box, Text, Icon, Spinner
Inputs        → TextField, Select, DatePicker, PhoneInput, SearchInput
Actions       → Button, IconButton, ButtonGroup, SplitButton
Feedback      → Alert, Toast, Banner, Skeleton, Progress
Navigation    → Sidebar, Header, Breadcrumb, Tabs, CommandPalette
Data Display  → Table, Card, Badge, Tag, Avatar, Timeline, Stat
Overlay       → Modal, Drawer, Popover, Tooltip
Clinical      → PatientContextBar, AllergyBanner, StatusChip, OdontogramShell*
Domain        → AppointmentChip, InvoiceStatusBadge, QueueTicketCard

* Shell only in design system — full odontogram is domain package
```

### 6.2 Button variants

| Variant | Use | Clinical note |
|---|---|---|
| `primary` | Main action (Save encounter) | One per view |
| `secondary` | Cancel, back | — |
| `ghost` | Tertiary, toolbar | — |
| `destructive` | Delete, void invoice | Requires modal |
| `clinical` | Sign & lock note | Distinct styling; audit logged |

**Sizes:** `sm` 32px, `md` 40px (default), `lg` 48px (touch/kiosk).

**Loading:** spinner replaces label; min-width preserved.

### 6.3 Badge & status chip

```
[● نشط]  [● قيد الانتظار]  [● حرج]
```

- Dot + label; color from clinical/semantic tokens.
- Invoice: Draft | Sent | Paid | Overdue | Cancelled
- Appointment: Pending | Confirmed | Completed | No-show | Cancelled
- Queue: Waiting | Called | In-room | Done

### 6.4 Alert banner (persistent)

For allergies, subscription expiry, offline mode — **full-width below header**, dismissible only if non-critical.

### 6.5 Skeleton & empty states

- Skeleton: shimmer disabled on `prefers-reduced-motion`.
- Empty state: illustration + Arabic primary message + secondary action button.
- **Never** empty table without guidance ("لا يوجد مرضى — أضف مريضاً").

### 6.6 Competing Architect Review — Components

| Decision | Weakness | Alternative |
|---|---|---|
| Single component library | Dental odontogram doesn't fit generic Table | Domain packages extend primitives via composition |
| Lucide icons | Generic medical feel | Custom 12-icon medical set for nav; Lucide elsewhere |
| Clinical button variant | Proliferates button types | Use `primary` + lock icon + confirmation modal |

---

## 7) Forms

### 7.1 Anatomy

```
[Label *]                    ← label (required text + asterisk)
[Helper text]                ← optional
┌─────────────────────────┐
│ Input                   │
└─────────────────────────┘
[Validation error]         ← error role=alert
```

- Labels **above** fields (not placeholder-only).
- Required: Arabic "مطلوب" + asterisk for colorblind users.
- Tab order follows visual order in RTL (right-to-left, top-to-bottom).

### 7.2 Field types

| Component | Notes |
|---|---|
| `TextField` | `dir=auto` for names |
| `PhoneInput` | Syria +963 default; LTR number in RTL layout |
| `NationalIdInput` | Syrian ID validation pattern |
| `DatePicker` | Gregorian default; Hijri optional Phase 2 |
| `CurrencyInput` | SYP default; LTR numerals in input |
| `SearchInput` | Debounce 300ms; links to global search API |
| `ClinicalTextarea` | Chief complaint; min 3 rows; auto-grow |
| `DiagnosisPicker` | ICD/SNOMED search Phase 2; free text MVP |
| `SignaturePad` | Consent + Rx; canvas LTR neutral |

### 7.3 Validation patterns

- **Inline on blur** for format errors.
- **On submit** for cross-field rules.
- Error summary at form top for >3 errors (linked anchors).
- **Clinical forms:** warn on navigate-away with unsaved changes.

### 7.4 Form layouts

| Pattern | Use |
|---|---|
| Single column | Clinical notes, patient registration |
| Two column | Demographics (name | DOB) |
| Stepped wizard | New patient + appointment (reception) |
| Inline edit | Table row quick-edit (inventory qty) |

### 7.5 Competing Architect Review — Forms

| Decision | Weakness | Alternative |
|---|---|---|
| Labels above fields | Long Arabic labels wrap awkwardly | Inline labels for compact clinical sidebar forms |
| Validate on blur | Slow feedback for typos | Validate on blur + debounced inline for ID/phone |
| Wizard for registration | Extra clicks | Single scroll form with sections; wizard for mobile only |

---

## 8) Tables

### 8.1 Standard data table

| Feature | Spec |
|---|---|
| Header | `label` typography, sticky top, sortable columns |
| Row height | 40px compact / 48px comfortable |
| Selection | Checkbox column; bulk bar appears on select |
| Pagination | Server-side; default 20 rows; options 10/20/50 |
| Empty | Empty state component |
| Loading | Skeleton rows ×5 |

### 8.2 Healthcare table patterns

| Pattern | Example | Notes |
|---|---|---|
| Patient roster | Name, phone, last visit, provider | Avatar + name cell |
| Appointment list | Time, patient, provider, status chip | Today highlighted |
| Invoice ledger | Number, patient, amount, status | LTR numbers |
| Inventory | SKU, name, qty, expiry | Row turns `warning` if low stock |
| Audit log | Actor, action, resource, time | Read-only; no row click |

### 8.3 Mobile adaptation

`<md`: **card list** — each row becomes a card; primary field as title; 3 metadata lines max; swipe actions (call, open).

### 8.4 RTL table rules

- Text columns: `text-align: start` (logical).
- Numeric/currency: `text-align: end` (always).
- Checkbox column: `inline-start` (right in RTL).
- Sticky column: inline-start edge.

### 8.5 Competing Architect Review — Tables

| Decision | Weakness | Alternative |
|---|---|---|
| Server pagination | Can't sort full dataset client-side | Virtual scroll for <500 rows; server for larger |
| Card view on mobile | Loses scan comparison | Horizontal scroll table with sticky first column as option |
| Striped rows | Visual noise | Zebra only on `comfortable` density |

---

## 9) Dashboards

### 9.1 Dashboard shell

```
┌──────────────────────────────────────────────────────┐
│ Page title + date range filter + branch selector      │
├──────────┬──────────┬──────────┬──────────┤
│ Stat KPI │ Stat KPI │ Stat KPI │ Stat KPI │  ← row 1
├────────────────────────┴──────────┤
│ Primary chart (2/3)    │ Side list│  ← row 2
├────────────────────────┴──────────┤
│ Secondary table / feed             │  ← row 3
└──────────────────────────────────────┘
```

- **Real-time KPIs** subscribe to `/realtime` dashboard channel.
- **Stale indicator** if WebSocket disconnected >30s.

### 9.2 Role dashboards (widget matrix)

| Widget | Doctor | Dentist | Nurse | Reception | Manager | Owner |
|---|---|---|---|---|---|---|
| Today's schedule | ● | ● | ● | ● | ● | ○ |
| Patient queue (live) | ○ | ○ | ● | ● | ● | ○ |
| My patients panel | ● | ● | ● | ○ | ○ | ○ |
| Pending encounters | ● | ● | ● | ○ | ● | ○ |
| Odontogram backlog | ○ | ● | ○ | ○ | ● | ○ |
| Check-in / arrivals | ○ | ○ | ○ | ● | ● | ○ |
| Revenue today | ○ | ○ | ○ | ● | ● | ● |
| Branch comparison | ○ | ○ | ○ | ○ | ● | ● |
| Subscription / plan usage | ○ | ○ | ○ | ○ | ○ | ● |
| Compliance / audit summary | ○ | ○ | ○ | ○ | ● | ● |
| Low inventory alerts | ○ | ○ | ○ | ○ | ● | ● |

● = default pin, ○ = hidden or secondary

### 9.3 KPI stat card

```
┌─────────────────┐
│ المواعيد اليوم  │  label (caption)
│      24         │  value (pageTitle size)
│  ↑ 12% عن أمس   │  delta (success/error color)
└─────────────────┘
```

### 9.4 Competing Architect Review — Dashboards

| Decision | Weakness | Alternative |
|---|---|---|
| Role-specific dashboards | 6 layouts to maintain | Configurable widget grid; role provides defaults |
| Real-time everything | Battery + bandwidth cost | Real-time for queue only; 5min poll for KPIs |
| Owner sees financial KPIs on same app | Information leakage on shared PCs | Owner dashboard behind re-auth PIN |

---

## 10) Charts

### 10.1 Chart palette (colorblind-safe)

Primary series: `#26AD89`, `#265FB2`, `#D97706`, `#9333EA`, `#0891B2`, `#64748B`

Use pattern fills (hatch) when >4 series in print/export.

### 10.2 Chart types by use case

| Chart | Clinical / operational | Default period |
|---|---|---|
| Line | Appointments over time, revenue trend | 30 days |
| Bar | Revenue by branch, procedures by type | This month |
| Donut | Appointment status mix, payment methods | Today |
| Heatmap | Chair utilization by hour | This week |
| Sparkline | Inline table trend | 7 days |

### 10.3 Chart container spec

- Min height: `240px`; max `400px` in dashboard grid.
- Title + optional subtitle + export (CSV/PNG) for managers/owners.
- Tooltip: surface raised, `bodySm`, locale-formatted numbers.
- **RTL:** y-axis left; legend bottom; numbers LTR inside tooltips.

### 10.4 Library recommendation

**Recharts** (React) — adequate RTL; lightweight.  
**Rejected for MVP:** D3 direct (too low-level), Chart.js (weak RTL).

Static PNG fallback for `<768px` on slow devices (Phase 2).

### 10.5 Competing Architect Review — Charts

| Decision | Weakness | Alternative |
|---|---|---|
| Recharts | Limited accessibility | Wrap with aria labels + data table fallback |
| 30-day default range | Misses seasonal patterns | Remember user range per widget in localStorage |
| Donut for status mix | Hard to compare slices | Horizontal bar for <5 categories |

---

## 11) Navigation

### 11.1 Application shell

```
┌────────────────────────────────────────────────────────────┐
│ Header: [≡] Logo  [🔍 Search]  [Branch▾] [🔔] [User▾] [🌙] │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │  Patient context bar (when patient selected)     │
│ (primary)│─────────────────────────────────────────────────│
│          │  Main content                                    │
│          │                                                  │
└──────────┴─────────────────────────────────────────────────┘
```

### 11.2 Header elements

| Element | Behavior |
|---|---|
| Search | Opens command palette; `GET /search`; keyboard `/` or `Ctrl+K` |
| Branch selector | Visible if user has multi-branch access |
| Notifications | Badge count; panel with realtime feed |
| User menu | Profile, language, theme, logout |
| Theme toggle | Light / Dark / System |

### 11.3 Sidebar — role navigation map

Aligned with permission matrix `view` actions:

| Nav item | Resource | Roles (summary) |
|---|---|---|
| Dashboard | — | All staff |
| Appointments | `api.scheduling` | Clinical + reception |
| Queue | `api.queue` | Reception, clinical |
| Patients | `api.patients` | Clinical + reception |
| Encounters | `api.emr` | Clinical (not reception) |
| Dental | `api.dental` | Dentist, doctor |
| Beauty | `api.beauty` | Specialist |
| Billing | `api.billing` | Accountant, owner, GM |
| Inventory | `api.inventory` | Inventory mgr, GM |
| Reports | `api.reporting` | GM, owner, accountant |
| Analytics | `api.analytics` | GM, owner |
| Settings | `api.identity` | Owner, GM |

**Hide**, don't disable, unauthorized items (security + clarity).

### 11.4 Command palette (global search UI)

```
┌──────────────────────────────────────────┐
│ 🔍  ابحث عن مريض، موعد، فاتورة...       │
├──────────────────────────────────────────┤
│ ○ أحمد حسن — مريض                        │
│ ○ موعد — أحمد — 15 يونيو                 │
│ ○ INV-2024-0042 — فاتورة                 │
├──────────────────────────────────────────┤
│ ↵ فتح   ↑↓ تنقل   esc إغلاق              │
└──────────────────────────────────────────┘
```

- Group results by `type`; show permission-filtered types only.
- Recent searches stored locally (max 10).

### 11.5 Breadcrumbs

- Max 3 levels visible; truncate middle on mobile.
- Format: `المرضى / أحمد حسن / الزيارات` (RTL logical order).

### 11.6 Competing Architect Review — Navigation

| Decision | Weakness | Alternative |
|---|---|---|
| Hide unauthorized nav | Users don't discover features | Show locked items with upgrade tooltip for tier-gated features |
| Cmd+K search | Discoverability low | Persistent search bar in header + Cmd+K |
| Collapsible sidebar | Loses context on small laptops | Auto-collapse `<lg`; remember preference |

---

## 12) Role UX Summaries

Detailed personas: [`PERSONAS.md`](./PERSONAS.md). Blueprint highlights:

### Doctor
- **Home:** today's schedule + pending encounters + my patients.
- **Density:** compact tables, keyboard shortcuts for common actions.
- **Critical path:** patient → encounter → diagnosis → orders (<3 clicks per UX strategy).

### Dentist
- **Extends doctor** with odontogram + imaging quick access.
- **Touch-friendly** tooth chart targets (min 44px).

### Receptionist
- **Home:** queue + arrivals + quick registration.
- **Density:** comfortable; large touch targets.
- **No EMR nav** items visible.

### Nurse
- **Home:** triage queue + vitals alerts + assigned tasks.
- **Read-mostly** encounters; vitals entry forms optimized.

### General Manager
- **Home:** multi-branch KPIs + staff utilization + alerts feed.
- **Export** actions on tables and charts.

### Owner
- **Home:** financial summary + subscription status + compliance.
- **Read-heavy**; approvals via notification action cards.

---

## 13) Theme, RTL & i18n Implementation

### 13.1 Theme switching

```html
<html lang="ar-SY" dir="rtl" data-theme="light">
```

- CSS variables from [`design-tokens.json`](./design-tokens.json).
- `data-theme: light | dark`; respect `prefers-color-scheme` for `system`.
- Persist in `localStorage` + user profile API (Phase 2).

### 13.2 RTL/LTR rules

| Concern | Rule |
|---|---|
| Layout | CSS logical properties (`margin-inline-start`, `padding-inline`) |
| Icons | Flip directional only |
| Charts | Axis labels follow locale; numbers LTR |
| Modals | Close button `inline-end` |
| Scroll | native direction |

**English switch:** set `dir=ltr` on `<html>`; mirror sidebar to left.

### 13.3 String externalization

```
packages/i18n/
  ar-SY/
  en-US/
```

- ICU messages for plurals ("{count} مواعيد").
- No concatenation ("Hello " + name) — use templates.

---

## 14) Accessibility (WCAG 2.1 AA)

- Contrast: 4.5:1 body text; 3:1 large text and UI components.
- Focus visible on all interactive elements.
- Skip link: "تخطي إلى المحتوى".
- Live regions for toasts (`aria-live=polite`; critical `assertive`).
- Table: `<th scope="col">`; sort state announced.
- Form errors: `aria-describedby` + `role=alert`.

---

## 15) Implementation Roadmap (no pages yet)

| Phase | Deliverable |
|---|---|
| **1 (complete)** | This blueprint + `design-tokens.json` |
| **2 (complete)** | `packages/design-tokens` (CSS variables) |
| **3** | `packages/ui` — primitives through overlays |
| **4** | `packages/ui-clinical` — PatientContextBar, StatusChip, etc. |
| **5 (complete)** | `apps/clinic-dashboard` shell — see [FRONTEND-ARCHITECTURE.md](./FRONTEND-ARCHITECTURE.md) |
| **6** | Domain pages per module |

**Monorepo target:** see [`MONOREPO.md`](./MONOREPO.md).

---

## 16) Master Competing Architect Review

| # | Our decision | Weakness | Recommended evolution |
|---|---|---|---|
| 1 | Federated docs → one blueprint | Still long; hard to onboard | Split into `DESIGN_SYSTEM_BLUEPRINT.md` + role-specific `IA` supplements |
| 2 | IBM Plex web fonts | Latency in Syria | Self-host + preload only Arabic cut; Latin async |
| 3 | Recharts | a11y gaps | Add hidden data table export under every chart |
| 4 | Permission-hiding nav | Users unaware of capabilities | Tier-gated preview with lock icon |
| 5 | 60s search cache (API) | Stale Cmd+K results | Client-side stale-while-revalidate |
| 6 | Single theme for portal + clinic | Wrong tone for patients | Split token themes at Phase 4 |
| 7 | Compact default for clinicians | Older doctors prefer larger | User setting: density preference |
| 8 | No pages in this phase | Drift between spec and reality | Storybook in Phase 3 validates components before pages |

---

## 17) Related Documents

| Document | Relationship |
|---|---|
| [`UI_SYSTEM.md`](./UI_SYSTEM.md) | Component detail reference; defer to this blueprint on conflict |
| [`INFORMATION_ARCHITECTURE.md`](./INFORMATION_ARCHITECTURE.md) | Nav structure per role; aligned in §11 |
| [`INTERNATIONALIZATION.md`](./INTERNATIONALIZATION.md) | Formatting, locale rules |
| [`UX_STRATEGY.md`](./UX_STRATEGY.md) | Journey principles, 3-click rule |
| [`PERSONAS.md`](./PERSONAS.md) | Role goals and screens |
| [`PERMISSIONS.md`](./PERMISSIONS.md) | RBAC → nav visibility |
| [`SEARCH-ARCHITECTURE.md`](./SEARCH-ARCHITECTURE.md) | Cmd+K backend contract |
| [`REALTIME-ARCHITECTURE.md`](./REALTIME-ARCHITECTURE.md) | Live widgets |

---

*Last updated: 2026-06-15 — Principal Healthcare UX / Product Design / Design System Architecture*
