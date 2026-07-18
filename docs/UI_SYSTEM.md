# UI System — Enterprise Healthcare Saaas Platform

> **Authoritative spec:** [`DESIGN_SYSTEM_BLUEPRINT.md`](./DESIGN_SYSTEM_BLUEPRINT.md) (2026-06-15) supersedes this document where conflicts exist.  
> This file remains as **component-level reference detail**. Tokens: [`design-tokens.json`](./design-tokens.json).

Last updated: 2026-06-13

Purpose
- Define design tokens, components, and standards for a consistent, accessible, and Arabic-first UI system.
- Establish reusable component specifications with variants (light mode, dark mode, RTL, mobile/desktop).
- Ensure WCAG AA accessibility compliance across all components.
- Include competing-team critique and alternative design approaches.

---

## 1) Color System

### 1.1) Brand Colors (Primary Palette)

**Primary Green** (Healthcare trust, nature, life):
- Primary-50: `#F0F9F6` (lightest)
- Primary-100: `#D4EFE7`
- Primary-200: `#A8DED0`
- Primary-300: `#7DCEB8`
- Primary-400: `#51BDA1`
- Primary-500: `#26AD89` (brand primary)
- Primary-600: `#1E8A6F`
- Primary-700: `#166755`
- Primary-800: `#0E443B`
- Primary-900: `#062221` (darkest)

**Secondary Blue** (Trust, clinical):
- Secondary-50: `#F0F4F9`
- Secondary-100: `#D4DFF0`
- Secondary-200: `#A8BFE0`
- Secondary-300: `#7D9FD1`
- Secondary-400: `#517FC1`
- Secondary-500: `#265FB2` (secondary)
- Secondary-600: `#1E4A8E`
- Secondary-700: `#16356A`
- Secondary-800: `#0E2046`
- Secondary-900: `#062022`

### 1.2) Semantic Colors

**Success (Green)**: `#16A34A` (action completed, positive)
- Used for: checkmarks, success messages, "approved" status
- Contrast ratio: 4.8:1 on white background (WCAG AA)

**Warning (Amber)**: `#D97706` (caution, requires attention)
- Used for: pending approvals, expiry warnings, high inventory
- Contrast ratio: 4.5:1 on white background (WCAG AA)

**Error (Red)**: `#DC2626` (danger, blocking issue)
- Used for: validation errors, no-shows, critical alerts
- Contrast ratio: 5.1:1 on white background (WCAG AA)

**Info (Blue)**: `#2563EB` (informational, no action required)
- Used for: tips, reminders, neutral messages
- Contrast ratio: 4.5:1 on white background (WCAG AA)

### 1.3) Neutral Colors (Grayscale)

- Neutral-50: `#FAFAFA` (off-white)
- Neutral-100: `#F5F5F5` (light background)
- Neutral-200: `#E5E5E5` (borders, dividers)
- Neutral-300: `#D4D4D4` (subtle backgrounds)
- Neutral-400: `#A3A3A3` (disabled text)
- Neutral-500: `#737373` (secondary text)
- Neutral-600: `#525252` (primary text)
- Neutral-700: `#404040` (strong text)
- Neutral-800: `#262626` (headings)
- Neutral-900: `#171717` (darkest)

### 1.4) Light Mode Color Scheme

```
Background: Neutral-50 (#FAFAFA)
Surface: White (#FFFFFF)
Text (primary): Neutral-800 (#262626)
Text (secondary): Neutral-600 (#525252)
Text (tertiary): Neutral-500 (#737373)
Borders: Neutral-200 (#E5E5E5)
Focus ring: Primary-500 (#26AD89, 2px)
```

### 1.5) Dark Mode Color Scheme

```
Background: Neutral-900 (#171717)
Surface: Neutral-800 (#262626)
Text (primary): Neutral-50 (#FAFAFA)
Text (secondary): Neutral-300 (#D4D4D4)
Text (tertiary): Neutral-500 (#737373)
Borders: Neutral-700 (#404040)
Focus ring: Primary-400 (#51BDA1, 2px)
```

### 1.6) Competing-team Critique
- Weakness: 10-step color ramp may be overkill; hard to maintain.
- Alternative: 7-step ramp (50, 100, 300, 500, 700, 900); reduces variants.
- Weakness: Semantic colors not consistent with brand; feels disconnected.
- Alternative: Use brand green for success, secondary blue for info; only error in red.
- Weakness: Dark mode colors too similar; hard to distinguish surfaces.
- Alternative: Increase contrast: Surface should be Neutral-700 (#404040), not 800.

---

## 2) Typography System

### 2.1) Font Stack

**Primary Font (Arabic & Latin)**: Segoe UI, Noto Sans Arabic, -apple-system, BlinkMacSystemFont
- Reason: System font; supports both Arabic (RTL) and Latin; no HTTP requests
- Fallback: Generic sans-serif

**Monospace Font (Code, timestamps)**: Menlo, Monaco, Courier New, monospace

### 2.2) Type Scale & Hierarchy

**Desktop**:
- `Display`: 48px / 56px line-height / 700 weight (hero, page titles)
- `Heading 1`: 32px / 40px line-height / 700 weight (section titles)
- `Heading 2`: 24px / 32px line-height / 600 weight (subsection titles)
- `Heading 3`: 20px / 28px line-height / 600 weight (component titles)
- `Body Large`: 16px / 24px line-height / 400 weight (primary text)
- `Body`: 14px / 20px line-height / 400 weight (default, forms, lists)
- `Body Small`: 12px / 16px line-height / 400 weight (helper text, labels)
- `Caption`: 11px / 16px line-height / 500 weight (timestamps, metadata)

**Tablet**:
- `Display`: 36px / 44px line-height / 700 weight
- `Heading 1`: 28px / 36px line-height / 700 weight
- `Heading 2`: 22px / 30px line-height / 600 weight
- `Body Large`: 16px / 24px line-height / 400 weight
- `Body`: 14px / 20px line-height / 400 weight
- (Smaller sizes same as desktop)

**Mobile**:
- `Display`: 28px / 36px line-height / 700 weight
- `Heading 1`: 24px / 32px line-height / 700 weight
- `Heading 2`: 20px / 28px line-height / 600 weight
- `Body Large`: 16px / 24px line-height / 400 weight
- `Body`: 14px / 20px line-height / 400 weight

### 2.3) Font Weight & Styles

- `400 (Regular)`: Default, body text
- `500 (Medium)`: Labels, buttons, emphasis
- `600 (Semibold)`: Subheadings, card titles
- `700 (Bold)`: Page titles, strong emphasis

**Italic**: Used sparingly; avoid for Arabic (italic Arabic is hard to read).

### 2.4) Line Height Ratios

- Headings: 1.2–1.25 ratio (tight)
- Body: 1.5 ratio (readable)
- Captions: 1.45 ratio (compact but readable)

### 2.5) Competing-team Critique
- Weakness: System fonts may render differently on different OS; brand consistency lost.
- Alternative: Use web fonts (e.g., Roboto, IBM Plex) for consistent rendering; accept HTTP cost.
- Weakness: No letter-spacing defined; may look cramped in Arabic.
- Alternative: Add 0.5px letter-spacing to Arabic text; reduce for Latin.
- Weakness: Type scale has 8 sizes; hard to remember and use consistently.
- Alternative: Collapse to 5–6 primary sizes; use semantic names (e.g., "PageTitle", "SectionTitle") instead of sizes.

---

## 3) Spacing System

### 3.1) Spacing Scale (Base 4px)

```
4px   = 1 unit
8px   = 2 units
12px  = 3 units
16px  = 4 units
20px  = 5 units
24px  = 6 units
32px  = 8 units
40px  = 10 units
48px  = 12 units
64px  = 16 units
80px  = 20 units
96px  = 24 units
```

### 3.2) Recommended Spacing Usage

- **Padding**: 12px–16px (form inputs), 16px–24px (cards, sections)
- **Margin**: 16px–24px (between sections), 8px–12px (between list items)
- **Gap** (flexbox): 8px–16px (between grid items)

### 3.3) Competing-team Critique
- Weakness: 8px base too fine-grained; most design systems use 8px or 4px.
- Alternative: Use base 8px (easier to scale to desktop/mobile).
- Weakness: No guidance on when to use which spacing; ambiguous.
- Alternative: Define rules: padding inside components (12–16px), margin between (16–24px).

---

## 4) Elevation & Shadows

### 4.1) Shadow Scale (Z-index & Depth)

**Level 0**: No shadow (default, flat)

**Level 1** (Raised, subtle): `0 1px 2px rgba(0,0,0,0.05)`
- Used for: hover states, subtle cards

**Level 2** (Floating): `0 4px 6px rgba(0,0,0,0.1)`
- Used for: cards, small modals, popovers

**Level 3** (Elevated): `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)`
- Used for: larger modals, dropdowns, notifications

**Level 4** (High elevation): `0 20px 25px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.05)`
- Used for: full-screen overlays, top-level modals

### 4.2) Z-Index Scale

```
1:    Dropdowns, popovers
10:   Sticky headers, sidebars
100:  Modal overlays, tooltips
1000: Alerts, critical notifications
```

### 4.3) Competing-team Critique
- Weakness: Shadows may not render well on low-end devices or dark backgrounds.
- Alternative: Use borders (1–2px) for elevation instead of shadows; more performant.
- Weakness: Four shadow levels may be overkill.
- Alternative: Use 2 levels: subtle (cards) and prominent (modals).

---

## 5) Icons

### 5.1) Icon System

**Source**: Material Design Icons (24px base size) or custom SVG
- Reason: Large library, regular maintenance, Arabic-friendly, free

**Sizes**:
- 16px: Inline with text, badges
- 20px: Form inputs, navigation
- 24px: Buttons, list items (default)
- 32px: Large buttons, card headers
- 48px: Empty states, hero sections

**Stroke Weight**: 2px (consistent with body text stroke)

**Padding**: Icons should have visual padding; 8px minimum space around

### 5.2) RTL Icon Handling

**Icons that need flipping (directional)**:
- Arrows: ← → ↑ ↓ (flip horizontal)
- Chevrons: « » (flip horizontal)
- Menu / navigation icons: hamburger (no flip), back arrow (flip), forward arrow (flip)

**Icons that don't flip**:
- Status icons: checkmark, X, warning, info
- Action icons: search, delete, download, upload
- Object icons: patient, appointment, prescription

**Implementation**: CSS `transform: scaleX(-1)` for directional icons in RTL context

### 5.3) Icon Colors

- **Primary**: Primary-500 or brand color for interactive icons
- **Secondary**: Neutral-500 for subtle icons
- **Disabled**: Neutral-300 for disabled state
- **Success**: Success-500 for positive actions
- **Error**: Error-500 for destructive actions
- **White**: On dark backgrounds or primary-color buttons

### 5.4) Competing-team Critique
- Weakness: Material Design icons may not match clinic branding.
- Alternative: Commission custom icon set; use Material as fallback.
- Weakness: Icon flipping breaks symmetry; some clinics prefer consistency.
- Alternative: Provide both RTL and LTR icon sets; use context to select.
- Weakness: Icons without labels ambiguous; users confused.
- Alternative: Always pair icons with text in primary UI; icon-only in mobile navigation only.

---

## 6) Forms & Inputs

### 6.1) Text Input

**States**:
- **Default**: Border 1px Neutral-200, padding 12px, font 14px, height 40px
- **Focus**: Border 2px Primary-500, box-shadow: inset 0 0 0 3px Primary-50
- **Filled**: Background Neutral-50, border Neutral-300
- **Disabled**: Background Neutral-100, text Neutral-400, cursor not-allowed
- **Error**: Border 2px Error-500, helper text Error-500, icon ⚠️

**Label**:
- Position: Above input (not placeholder)
- Font: 14px, weight 500, color Neutral-700
- Required indicator: Red asterisk `*`
- Helper text: Below input, 12px, color Neutral-500

**Placeholder** (secondary hint):
- Font: 14px, color Neutral-400, italic (light gray)
- Example: "e.g., Ahmed Mohammed"

**RTL Variant**:
- Label aligns right
- Text input aligns right (text-align: right)
- Helper text aligns right

### 6.2) Button

**Primary Button**:
- Background: Primary-500
- Text: White, 14px, weight 600
- Padding: 12px 24px (vertical × horizontal)
- Border radius: 6px
- Min height: 40px
- States:
  - **Hover**: Background Primary-600, slight scale (1.02)
  - **Active**: Background Primary-700, scale (0.98)
  - **Focus**: Focus ring (2px Primary-500 outline)
  - **Disabled**: Background Neutral-300, text Neutral-500, cursor not-allowed
  - **Loading**: Icon spinner in button, text hidden (or faded)

**Secondary Button**:
- Background: Neutral-100
- Text: Neutral-800, 14px, weight 600
- Border: 1px Neutral-300
- Padding: 12px 24px
- States: Similar to primary but reverse colors

**Destructive Button**:
- Background: Error-500
- Text: White, 14px, weight 600
- Warning text: "This action cannot be undone" below button
- Require confirmation modal before execution

**Icon Button**:
- Width/height: 40px (square)
- Icon size: 24px (centered)
- Background: Transparent on default, Neutral-100 on hover
- Border radius: 6px
- No text (icon-only)

**Sizes**:
- Small: 32px height, 12px padding, 12px font
- Medium: 40px height, 12px padding, 14px font (default)
- Large: 48px height, 16px padding, 16px font

### 6.3) Checkbox

- **Size**: 20px × 20px
- **Border**: 2px, color Neutral-300
- **Checked**: Background Primary-500, checkmark white
- **Focus**: Focus ring (2px Primary-500)
- **Disabled**: Background Neutral-100, border Neutral-300, cursor not-allowed
- **Label**: 14px, left of checkbox (14px gap between checkbox and label); click label to toggle
- **Label text alignment**: For RTL, label on right of checkbox

### 6.4) Radio Button

- **Size**: 20px diameter
- **Border**: 2px, color Neutral-300
- **Selected**: Border 8px Primary-500 (concentric circles)
- **Focus**: Outer ring 2px Primary-500
- **Label**: Same as checkbox, positioned right/left based on RTL/LTR

### 6.5) Select / Dropdown

- **Height**: 40px (same as text input)
- **Border**: 1px Neutral-200, border-radius 6px
- **Padding**: 12px 12px (left) + 36px (right for arrow)
- **Arrow icon**: Right-aligned (or left-aligned in RTL), 16px
- **Dropdown list**: Max height 240px; scroll if more options
- **Option height**: 36px, padding 12px
- **Selected option**: Background Primary-50, checkmark on left/right (RTL)
- **Hover**: Background Neutral-100
- **Focus**: Focus ring

### 6.6) Textarea

- **Height**: Min 120px; grows with content (auto-expand)
- **Border**: 1px Neutral-200, border-radius 6px
- **Padding**: 12px
- **Font**: 14px, monospace for code, serif for notes
- **Resize**: Allow vertical resize; no horizontal
- **Placeholder**: Same as text input

### 6.7) Competing-team Critique
- Weakness: Required indicators (red asterisks) not inclusive; colorblind users may miss them.
- Alternative: Use "Required" text label, not just asterisk.
- Weakness: Focus ring may look jarring on Mac; may conflict with OS styling.
- Alternative: Use subtle outline (1px) and shadow instead of thick ring.
- Weakness: Disabled state too subtle; users may try to interact.
- Alternative: Add "Disabled" label or tooltip on hover.
- Weakness: Dropdown arrow hardcoded; doesn't adapt to RTL.
- Alternative: Use CSS generated content or programmatic arrow placement.

---

## 7) Tables

### 7.1) Table Structure

**Header Row**:
- Background: Neutral-50
- Font: 12px, weight 600, color Neutral-700
- Padding: 12px 16px
- Borders: Bottom 2px Neutral-200
- Sortable column: Add ▲▼ icon next to header text

**Data Row**:
- Height: 48px (touch-friendly)
- Padding: 12px 16px
- Borders: Bottom 1px Neutral-200
- Font: 14px, weight 400, color Neutral-800
- Hover: Background Neutral-50, subtle shadow

**Striped Rows** (optional):
- Alternate background: Neutral-50 vs White
- Reduces eye strain on long tables

**Responsive**:
- Desktop: Full table visible
- Tablet: Horizontal scroll if needed; sticky first column
- Mobile: Card view (one row = one card; headers inside each card)

### 7.2) Table Interactions

**Selection** (checkboxes in first column):
- Header checkbox: "Select all" (on current page)
- Row checkbox: Select individual row
- Selected row: Background Primary-100
- Batch actions: Bar above table with [Delete] [Export] etc.

**Sorting**:
- Click header to sort ascending; click again for descending
- Clear sorting by clicking a third time (or "Clear Sort" button)
- Visual indicator: ▲ (ascending) or ▼ (descending) next to header text

**Filtering**:
- Filter bar above table with input fields or dropdowns per column
- Auto-filter as user types (debounced 300ms)
- "Clear filters" button to reset

**Pagination**:
- "Rows per page: [10 ▼]" dropdown
- "Showing 1–10 of 245" text
- Pagination controls: [< Prev] [1] [2] [3] ... [Next >]
- Jump to page: Go to page [___] [Go]

### 7.3) RTL Table Adaptation

- Header and data cells align right
- Checkboxes on right side (not left)
- Sort arrows flip direction
- Pagination controls reverse: [Next >] ... [3] [2] [1] [Prev <]
- Scrollable content scrolls left-to-right (normal)

### 7.4) Competing-team Critique
- Weakness: Large tables overwhelming; too much data at once.
- Alternative: Default to "Cards" view on mobile; table view for desktop only.
- Weakness: Striped rows add visual noise; some say improves readability, others say clutters.
- Alternative: Make striped optional (toggle in settings).
- Weakness: Batch actions bar takes space; may obscure important rows.
- Alternative: Float action bar (sticky) or show as inline buttons in rows.

---

## 8) Cards

### 8.1) Card Structure

**Container**:
- Background: White (light mode) or Neutral-800 (dark mode)
- Border radius: 8px
- Padding: 16px–24px (depends on content density)
- Shadow: Level 1 (0 1px 2px rgba(0,0,0,0.05))
- Hover: Slight shadow increase (Level 2), scale slight (1.02), cursor pointer (if clickable)

**Header** (optional):
- Border-bottom: 1px Neutral-200
- Padding-bottom: 12px
- Margin-bottom: 12px
- Font: 16px, weight 600

**Body**:
- Font: 14px, weight 400
- Line-height: 1.5
- Color: Neutral-800 (light) or Neutral-50 (dark)

**Footer** (optional):
- Border-top: 1px Neutral-200
- Padding-top: 12px
- Margin-top: 12px
- Contains action buttons or metadata

### 8.2) Card Variants

**Outlined Card**:
- Background: Transparent
- Border: 1px Neutral-200
- No shadow
- Used for: Secondary information, less emphasis

**Elevated Card**:
- Shadow: Level 3 (larger shadow)
- Used for: Important cards, hero sections

**Interactive Card** (clickable):
- Cursor: pointer
- Hover: Background slight tint (Primary-50), shadow increase
- Used for: Patient cards, appointment cards

**Status Card** (colored header):
- Header background: Success-500 (for positive), Warning-500 (for caution), Error-500 (for critical)
- Header text: White
- Used for: Alerts, status indicators

### 8.3) Competing-team Critique
- Weakness: All cards same visual weight; hard to scan.
- Alternative: Use size and color hierarchy; primary cards larger/bolder.
- Weakness: Card padding 16–24px wastes space on mobile.
- Alternative: Use 12px padding on mobile, 16px on tablet, 24px on desktop.

---

## 9) Charts & Data Visualization

### 9.1) Chart Types & Colors

**Line Chart**:
- Line color: Primary-500
- Area fill: Primary-100 (20% opacity)
- Axis labels: Neutral-600, 12px
- Grid lines: Neutral-200, 1px, dashed
- Data point markers: 4px radius, Primary-500 border + white fill

**Bar Chart**:
- Bar color: Primary-500
- Hover: Bar color Primary-600, shadow Level 1
- X-axis: Category labels, Neutral-600, 12px
- Y-axis: Value labels, Neutral-600, 12px
- Stacked bars: Use Primary-500, Primary-300, Primary-100 (gradient)

**Pie / Donut Chart**:
- Segments: Mix of Primary, Secondary, and complementary colors
- Legend: Compact, aligned below chart
- Hover: Segment slightly scaled (1.05), tooltip shows value + percentage

**Heatmap**:
- Color scale: Low (Primary-50) → High (Primary-900)
- Cell size: Responsive (8–20px)
- Labels: Centered, white text on dark cells, dark text on light cells

### 9.2) Chart Container

- Height: Min 300px (readable), max 600px (not overwhelming)
- Padding: 16px
- Background: White (light) or Neutral-800 (dark)
- Title: 16px, weight 600, above chart
- Legend: Below or right side (responsive)
- Tooltip: Dark background (Neutral-900), white text, rounded, 8px padding

### 9.3) Competing-team Critique
- Weakness: Too many color variations; hard to distinguish.
- Alternative: Use colorblind-friendly palette (Okabe-Ito colors).
- Weakness: Chart library may not support RTL; numbers/dates may display wrong.
- Alternative: Use D3.js or Recharts (good RTL support).
- Weakness: Large charts slow on low-end devices.
- Alternative: Render static images for performance-critical dashboards.

---

## 10) Modals & Overlays

### 10.1) Modal Structure

**Overlay**:
- Background: rgba(0,0,0,0.5) (50% opacity)
- Z-index: 100
- Click outside modal: Close (unless critical/destructive action)

**Modal Container**:
- Width: 480px (desktop), 90vw min 300px (mobile)
- Max width: 680px (large modal)
- Background: White (light) or Neutral-800 (dark)
- Border-radius: 12px
- Box-shadow: Level 4
- Z-index: 101

**Header** (required):
- Padding: 24px
- Border-bottom: 1px Neutral-200
- Title: 20px, weight 600, Neutral-900
- Close button: Icon ✕, 24px, top-right, hover background Neutral-100

**Body** (required):
- Padding: 24px
- Font: 14px, line-height 1.5
- Max-height: 70vh; scroll if needed

**Footer** (optional):
- Padding: 24px
- Border-top: 1px Neutral-200
- Contains action buttons (typically [Cancel] [Action])

### 10.2) Modal Types

**Confirmation Modal** (destructive):
- Title: "Confirm Action"
- Body: "Are you sure? This cannot be undone."
- Buttons: [Cancel] [Delete] (red)
- Require secondary confirmation (e.g., type "DELETE" to enable button)

**Form Modal**:
- Body: Form inputs
- Buttons: [Cancel] [Save]
- Submit on Enter key

**Alert Modal**:
- No form; just message
- Button: [OK] or [Close]
- Auto-close after 5 seconds (optional, for info alerts)

### 10.3) Competing-team Critique
- Weakness: Modal blocks entire page; user can't see context.
- Alternative: Use slide-in panel (from right) or overlay without full opacity.
- Weakness: "Click outside" not discoverable; users expect X button.
- Alternative: Require explicit close (X button or Cancel button); don't close on background click.
- Weakness: Modal takes all space on mobile; hard to interact.
- Alternative: Full-screen modal on mobile; normal modal on desktop (use media query).

---

## 11) Notifications & Toasts

### 11.1) Toast (Temporary Notification)

**Container**:
- Position: Fixed, top-right (or top-left for RTL)
- Width: 320px (desktop), 90vw (mobile)
- Border-radius: 8px
- Padding: 16px
- Shadow: Level 3
- Z-index: 1000

**Types**:

**Success Toast** (action completed):
- Background: Success-50
- Border: 2px Success-500, left side
- Icon: ✓ (Success-500)
- Text: 14px, color Neutral-800
- Auto-dismiss: 4 seconds
- Example: "Patient registered successfully"

**Error Toast** (action failed):
- Background: Error-50
- Border: 2px Error-500, left side
- Icon: ⚠️ (Error-500)
- Text: 14px, color Neutral-800
- Duration: 6 seconds (user needs time to read)
- Button: [Retry] or [Dismiss]

**Info Toast** (neutral message):
- Background: Info-50
- Border: 2px Info-500, left side
- Icon: ℹ️ (Info-500)
- Duration: 5 seconds

**Warning Toast** (caution):
- Background: Warning-50
- Border: 2px Warning-500, left side
- Icon: ⚠️ (Warning-500)
- Duration: 5 seconds

**Stacking**:
- Multiple toasts stack vertically (20px gap between)
- Max 3 toasts visible; oldest dismissed if limit reached

### 11.2) Inline Alert (Persistent)

**Container**:
- Full width or contained
- Border-radius: 6px
- Padding: 16px
- Margin-bottom: 16px
- Icon on left: 24px

**Types**: Same as toasts (success, error, info, warning)

**Dismissible**: [✕] button top-right; onClick removes alert

**Example Usage**:
```
[⚠️] Low inventory alert. Syringes stock < 10 units. [View Inventory] [✕]
```

### 11.3) Competing-team Critique
- Weakness: Toast auto-dismiss may disappear before user reads.
- Alternative: Require user click to dismiss; increase duration for errors.
- Weakness: Stack of toasts obscures content.
- Alternative: Show only 1 toast at a time; queue others; show "X more" count.
- Weakness: Toast color + icon may be redundant.
- Alternative: Use icon only with clear color coding; no text color variation.

---

## 12) Responsive Design & Breakpoints

### 12.1) Breakpoints

```
Mobile (xs):  320px – 639px
Mobile+ (sm): 640px – 767px
Tablet (md):  768px – 1023px
Desktop (lg): 1024px – 1535px
Desktop+ (xl): 1536px+
```

### 12.2) Layout Adaptation

**Mobile (< 768px)**:
- Single column layout
- Full-width content (max-width: 100%, padding: 12px)
- Bottom tab navigation
- Hamburger menu for sidebar
- Large buttons (40px height)
- Simplified tables (card view)

**Tablet (768px – 1023px)**:
- Two-column layout (sidebar + content)
- Sidebar collapses on demand (hamburger)
- Medium buttons (40px height)
- Half-width modals
- Flexible forms

**Desktop (> 1024px)**:
- Three-column layout (optional: sidebar + content + details panel)
- Sidebar always visible
- Full modals
- Compact buttons (36px height)

### 12.3) Font Size Adaptation

- Desktop: Base 16px for body text
- Tablet: Base 15px
- Mobile: Base 14px

Headings scale proportionally down on mobile.

### 12.4) Competing-team Critique
- Weakness: Multiple breakpoints hard to maintain; inconsistent across components.
- Alternative: Use 3 breakpoints only (mobile, tablet, desktop).
- Weakness: Bottom navigation takes space; may hide important UI.
- Alternative: Use sticky footer on mobile; swipe to reveal.

---

## 13) Dark Mode Implementation

### 13.1) Dark Mode Activation

**Methods**:
1. System preference (OS dark mode)
2. Manual toggle in settings
3. Schedule (e.g., auto-dark at sunset)

**Default**: Match system preference; override in user settings

### 13.2) Color Mapping

**Light Mode → Dark Mode**:
- Primary text: Neutral-800 → Neutral-50
- Secondary text: Neutral-600 → Neutral-300
- Backgrounds: White → Neutral-800
- Surfaces: Neutral-50 → Neutral-700
- Borders: Neutral-200 → Neutral-700
- Shadow opacity: Reduce opacity by 20–30% (shadows less visible on dark)

### 13.3) Component Adaptation

**Cards**:
- Light: White background, Neutral-200 borders
- Dark: Neutral-800 background, Neutral-700 borders

**Buttons**:
- Light primary: Primary-500 background
- Dark primary: Primary-400 background (brighter for visibility)

**Inputs**:
- Light: Neutral-50 background
- Dark: Neutral-700 background

**Charts**:
- Light: Neutral-50 background
- Dark: Neutral-800 background
- Axis labels: Light text (Neutral-100)

### 13.4) Competing-team Critique
- Weakness: Dark mode may reduce readability for some users; medical data critical.
- Alternative: Default to light mode; offer dark mode as optional.
- Weakness: Inconsistent dark mode implementation; looks broken.
- Alternative: Test dark mode thoroughly; use CSS variables for consistency.

---

## 14) Accessibility (WCAG AA) Standards

### 14.1) Color Contrast

**Minimum Requirements**:
- Normal text (< 18px): 4.5:1 contrast ratio
- Large text (≥ 18px or ≥ 14px weight 700): 3:1 contrast ratio
- UI components (borders, icons): 3:1 contrast ratio

**Testing**:
- Use tools like Contrast Ratio app or axe DevTools
- Test in light and dark modes

### 14.2) Touch Targets

**Minimum Sizes**:
- Buttons: 40px × 40px (mobile), 36px × 36px (desktop minimum)
- Links: 40px height with padding
- Form inputs: 40px height
- Checkboxes: 20px × 20px with 8px padding around

### 14.3) Focus Indicators

**All interactive elements must have visible focus**:
- Default: 2px outline, Primary-500 color, 2px offset
- Tested with keyboard Tab navigation
- Never use outline: none without replacement

### 14.4) Semantic HTML & ARIA

**Structural Elements**:
- Use `<button>`, `<input>`, `<label>`, `<form>` (not div divs)
- Headings: `<h1>`, `<h2>`, etc. in hierarchical order
- Lists: `<ul>`, `<ol>`, `<li>` for list content
- Tables: `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`

**ARIA Labels**:
- Icon buttons: `aria-label="Close"` (if no text label)
- Form fields: `<label for="field-id">` associated with `<input id="field-id">`
- Status messages: `role="status"` or `role="alert"`
- Modal: `role="dialog"` with `aria-labelledby` for title

**Live Regions**:
- For dynamic content (notifications, toasts): `aria-live="polite"` or `aria-live="assertive"`
- Example: "3 new messages" announced when notifications arrive

### 14.5) Keyboard Navigation

**All features accessible via keyboard**:
- Tab: Move to next interactive element
- Shift+Tab: Move to previous interactive element
- Enter: Activate button or submit form
- Space: Toggle checkbox/radio
- Arrow keys: Navigate lists, menus, sliders
- Escape: Close modals, cancel actions
- Shortcuts documented and discoverable (Cmd+K help)

### 14.6) Screen Reader Compatibility

- Test with NVDA (Windows), JAWS (Windows), VoiceOver (Mac/iOS)
- Use semantic HTML (don't hide headings in CSS)
- Provide alt text for images: `alt="Patient dashboard screenshot"`
- Avoid ambiguous link text: Not "Click here" but "View patient records"
- Use descriptive labels: Not "Search" but "Search patients by name or ID"

### 14.7) Motion & Animation

- Respect `prefers-reduced-motion` CSS media query
- Animations < 3 seconds; no infinite loops
- Avoid flashing or flickering (risk of seizures)

### 14.8) Language & Localization

- Clearly indicate page language: `<html lang="ar">` for Arabic
- Provide translations for all UI text
- Use correct character encoding: UTF-8 for Arabic support

### 14.9) Competing-team Critique
- Weakness: WCAG AA is baseline; some users need more (AAA level).
- Alternative: Aim for AAA (7:1 contrast) where feasible; accept trade-offs.
- Weakness: Accessibility testing manual; slow and error-prone.
- Alternative: Automate with axe, Lighthouse, Pa11y; manual testing for nuanced cases.
- Weakness: Keyboard navigation hard to implement in complex UIs.
- Alternative: Use accessible UI libraries (React Aria, Radix UI) as foundation.

---

## 15) RTL (Right-to-Left) Support

### 15.1) CSS Direction

**HTML element**:
```html
<html dir="rtl" lang="ar">
```

**CSS**:
- Use logical properties: `margin-inline-start`, `padding-block-end` (instead of left/right)
- Or use CSS direction variable: `--ltr: 1; --rtl: -1;` and apply flexibly

### 15.2) Component-Level RTL Adaptation

**Sidebar**:
- Position: Right side in RTL
- Items right-aligned

**Tables & Lists**:
- Checkboxes on right (RTL) vs left (LTR)
- Text aligned right (RTL) vs left (LTR)

**Form Inputs**:
- Label on right (RTL) vs left (LTR)
- Helper text aligned right (RTL)
- Currency/units on right in Arabic (e.g., "500 ل.س" not "ل.س 500")

**Buttons**:
- Icon position flips: [Icon Text] → [Text Icon] in RTL

### 15.3) Testing RTL

- Test in Firefox or Chrome with RTL Language extension
- Verify text, icons, and layout all correctly flipped
- Common bugs: hardcoded `left`/`right` CSS, text-align left/right, flex direction

### 15.4) Competing-team Critique
- Weakness: RTL CSS complex; easy to miss edge cases.
- Alternative: Use Tailwind CSS or other utility framework with built-in RTL support.
- Weakness: Icons designed for LTR; hard to flip meaningfully.
- Alternative: Separate RTL icon set; conditional imports based on language.

---

## 16) Component Library Tooling

### 16.1) Documentation

**Each component includes**:
- Usage guidelines (when to use)
- Security and privacy notes for sensitive inputs, authentication state, and session handling
- Anatomy (parts, labels)
- Variants (sizes, states, themes)
- Accessibility notes (contrast, keyboard support, ARIA)
- Code examples (React, Vue, or HTML)
- Do's and Don'ts (visual examples)

### 16.2) Testing

- Visual regression testing (Percy, Chromatic)
- Accessibility testing (axe, Lighthouse)
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Cross-device testing (iPhone, Android, iPad)

### 16.3) Version Control

- Semantic versioning (major.minor.patch)
- CHANGELOG documenting breaking changes and new features
- Migration guides for breaking changes

---

## 17) Implementation Checklist

- [ ] All colors WCAG AA compliant (4.5:1 contrast minimum)
- [ ] Typography scales responsive across mobile, tablet, desktop
- [ ] Spacing consistent via token system (base 4px or 8px)
- [ ] All interactive elements keyboard accessible (Tab, Enter, Escape)
- [ ] All icons RTL-aware (flip directional, keep status icons stable)
- [ ] Focus indicators visible and clear (2px outline, min 2px offset)
- [ ] Form labels associated with inputs (for/id attributes)
- [ ] Tables semantic (thead, tbody, th, td)
- [ ] Dark mode colors tested and consistent
- [ ] Toasts and notifications ARIA live-region enabled
- [ ] Modals trap focus (Tab cycles within modal)
- [ ] Touch targets ≥ 40px (mobile) or 36px (desktop)
- [ ] Animations respect prefers-reduced-motion
- [ ] Page language declared in HTML (lang attribute)
- [ ] RTL layout tested in Arabic context

---

## 18) Next Steps & Rollout

### Phase 1: Foundation (Weeks 1–2)
- Define and document color, typography, spacing tokens
- Create base component library (Button, Input, Card, Table)

### Phase 2: Components (Weeks 3–4)
- Implement remaining components (Modal, Toast, Form elements)
- Dark mode support
- RTL support

### Phase 3: Polish (Weeks 5–6)
- Accessibility audit (axe, manual testing)
- Performance optimization
- Component documentation and Storybook

### Phase 4: Testing & Validation (Weeks 7–8)
- Usability testing with real users
- Cross-browser and cross-device testing
- Clinical user feedback (doctors, receptionists)

