# Internationalization (i18n) Strategy — Enterprise Healthcare SaaS Platform

> **Typography, RTL/LTR, theme:** [`DESIGN_SYSTEM_BLUEPRINT.md`](./DESIGN_SYSTEM_BLUEPRINT.md) §3, §13. Token defaults: [`design-tokens.json`](./design-tokens.json).

Last updated: 2026-06-13

Purpose
- Define comprehensive internationalization standards for Arabic-first and English support.
- Establish RTL/LTR layout and behavior specifications.
- Standardize translation workflows, date/currency/number formatting, and localization practices.
- Enforce zero hardcoded strings policy; all user-facing text externalized.
- Include competing-team critique and alternative approaches.

---

## 1) Language Support Overview

### 1.1) Supported Languages & Regions

**Primary Market**: Arabic (Syrian Arabic dialect, `ar-SY`)
- Default language on launch
- RTL layout
- Hijri calendar support (optional; many clinics use Gregorian)
- Syrian Lira (SYP) currency, with US Dollar (USD) fallback

**Secondary Market**: English (US, `en-US`) & English (GB, `en-GB`)
- LTR layout
- Gregorian calendar
- Multiple currencies (USD, GBP, EUR)

**Future Expansion**: 
- French (Levantine, `fr-LB` for Lebanon market)
- Turkish (Medical Turkish, `tr-TR` for Turkish-speaking regions)
- Persian (Farsi, `fa-IR` for Iran expansion)

### 1.2) Language Detection & Selection

**Detection Priority**:
1. User explicit choice (saved in user settings)
2. Browser/OS language preference (Accept-Language header)
3. Geographic location (IP geolocation)
4. Default: Arabic (Syria primary market)

**User Override**:
- Language selector in header (flag icon or dropdown)
- Preference stored in user profile (database + local storage)
- Remembered across sessions

**Multi-language Session**:
- Users can switch language mid-session without re-login
- State preserved on language change
- Page re-renders with new translations

### 1.3) Competing-team Critique
- Weakness: Defaulting to Arabic may alienate English-speaking international teams.
- Alternative: Detect OS language first; only default to Arabic for Syrian IP addresses.
- Weakness: Multi-language support adds complexity; each language = testing overhead.
- Alternative: Phase 1: Arabic only. Phase 2 (Month 6): Add English. Phase 3+: French, Turkish.
- Weakness: Hijri calendar support niche; most clinics use Gregorian anyway.
- Alternative: Support Gregorian only; offer Hijri as optional calendar view.

---

## 2) RTL (Right-to-Left) vs LTR (Left-to-Right) Layout

### 2.1) CSS Implementation

**HTML Declaration**:
```html
<html dir="rtl" lang="ar-SY">  <!-- Arabic -->
<html dir="ltr" lang="en-US">  <!-- English -->
```

**CSS Strategy**: Use logical properties (CSS Logical Properties Level 1)

**Logical Properties**:
- `margin-inline-start` / `margin-inline-end` (replaces left/right)
- `padding-block-start` / `padding-block-end` (replaces top/bottom)
- `text-align: start` / `text-align: end` (replaces left/right)
- `inset-inline-start` / `inset-inline-end` (replaces left/right for positioning)

**Example**:
```css
/* Instead of: margin-left: 16px; margin-right: 24px; */
.component {
  margin-inline-start: 16px;
  margin-inline-end: 24px;
}

/* Browsers auto-flip based on dir="rtl" or dir="ltr" */
```

**Flexbox Direction**:
```css
/* Start items naturally flow right-to-left in RTL */
.flex-container {
  display: flex;
  flex-direction: row; /* auto-reverses in RTL */
}
```

**Grid Direction**:
```css
/* Grid auto-placement respects dir attribute */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
```

### 2.2) Component-Level RTL Adaptation

**Sidebar Navigation**:
- LTR: Left side, items left-aligned
- RTL: Right side, items right-aligned
- Icons: Directional icons flip (← → become → ←)

**Buttons & Icon Buttons**:
- Icon position flips:
  - LTR: [Icon Text]
  - RTL: [Text Icon]
- Margin between icon and text flips

**Forms & Inputs**:
- Label: LTR above/left, RTL above/right
- Input direction: `text-align: end` (right-aligned in RTL)
- Helper text: LTR below-left, RTL below-right
- Validation icons: LTR right side, RTL left side

**Modals & Dropdowns**:
- LTR: Appear below/right
- RTL: Appear below/left
- Positioning: Use `inset-inline-start` / `inset-inline-end`

**Tables**:
- Header: LTR left-to-right, RTL right-to-left
- Checkboxes: LTR left column, RTL right column
- Sort icons: Directional arrows flip

**Pagination**:
- LTR: [< Prev] [1] [2] [3] [Next >]
- RTL: [< التالي] [3] [2] [1] [السابق >]

### 2.3) Competing-team Critique
- Weakness: Logical properties not supported in older browsers (IE11).
- Alternative: Use CSS Flexbox/Grid (better RTL support); fallback to standard properties with JS direction detection.
- Weakness: Images and videos may need different orientation (e.g., flag icons).
- Alternative: Provide separate image assets for RTL or use CSS `transform: scaleX(-1)` where appropriate.
- Weakness: RTL testing requires separate QA; doubles test coverage effort.
- Alternative: Use automated visual regression testing (Percy, Chromatic) with RTL variant.

---

## 3) Translation Management System

### 3.1) Translation Workflow

**No Hardcoded Strings Policy**:
- Every user-facing string (UI text, messages, errors) must be externalized.
- All strings stored in translation files (JSON, YAML, or translation management system).
- Code references strings by key: `i18n.t('button.save')` or `$t('button.save')`

**Translation Keys Structure**:
```
common.button.save
common.button.cancel
common.button.delete
common.label.email
common.placeholder.enterName
form.validation.required
form.validation.invalidEmail
page.patient.title
page.patient.searchPlaceholder
page.patient.emptyState
appointment.status.confirmed
appointment.status.pending
appointment.status.cancelled
error.networkError
error.notFound
```

**Key Naming Convention**:
- `namespace.section.item` (e.g., `appointment.status.confirmed`)
- Use camelCase for multi-word keys: `enterPatientName` not `enter_patient_name`
- Descriptive names: `button.submitForm` not `button1`, `error.invalidEmail` not `err502`

### 3.2) Translation File Structure (JSON)

**File Organization**:
```
src/
  locales/
    ar-SY/
      common.json         (shared UI strings)
      appointments.json   (appointment-related)
      patients.json       (patient-related)
      forms.json          (form validation, placeholders)
      errors.json         (error messages)
      reports.json        (report labels, headers)
      notifications.json  (toast messages)
    en-US/
      common.json
      appointments.json
      ... (same structure)
    en-GB/
      common.json
      ... (same structure)
```

**JSON Format** (with pluralization & interpolation):
```json
{
  "button": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "deleteConfirm": "حذف نهائياً"
  },
  "form": {
    "required": "هذا الحقل مطلوب",
    "invalidEmail": "البريد الإلكتروني غير صالح",
    "passwordMismatch": "كلمات المرور غير متطابقة"
  },
  "appointment": {
    "count": "لديك {{count}} موعد",
    "count_one": "لديك موعد واحد",
    "count_other": "لديك {{count}} مواعيد",
    "createdAt": "تم الإنشاء في {{date}}"
  }
}
```

**Placeholders & Interpolation**:
- Use double curly braces: `{{variableName}}`
- Example: `"Welcome, {{firstName}}"` → `"Welcome, Ahmed"`
- Example: `"{{count}} new messages"` → `"3 new messages"`

**Pluralization Rules**:
- JSON: Use `_one`, `_other` suffixes (English, Arabic)
- Some languages (Russian, Polish): Use `_zero`, `_one`, `_two`, `_few`, `_many`, `_other`
- Library (i18n-js, messageformat.js) handles plural forms per language

**Context/Gender Support** (if needed):
```json
{
  "doctor": "طبيب",
  "doctor_m": "طبيب",
  "doctor_f": "طبيبة",
  "message": {
    "checked_by": "تم الفحص بواسطة {{doctor}}",
    "checked_by_m": "تم الفحص بواسطة الطبيب {{doctor}}",
    "checked_by_f": "تم الفحص بواسطة الطبيبة {{doctor}}"
  }
}
```

### 3.3) Translation Workflow (Development to Production)

**Step 1: Development**
- Developer adds strings to code using `i18n.t('key')`
- Missing translations marked in console warnings
- English (en-US) used as source language

**Step 2: Extract & Export**
- Tool (e.g., i18next-scanner) scans codebase
- Extracts all keys from source code
- Outputs to translation files (JSON)
- New keys highlighted for translation

**Step 3: Translation Management**
- Translations managed in external system (Crowdin, Lokalise, or spreadsheet)
- Professional translators or native speakers provide Arabic, French translations
- Translations reviewed by in-country clinicians for medical terminology

**Step 4: QA & Testing**
- Translations imported into staging environment
- QA tests for:
  - Missing translations (key shows instead of text)
  - Text truncation (Arabic longer than English; must fit UI)
  - Character encoding issues
  - RTL rendering
- Linguistic QA: Medical terminology correctness, tone, clarity

**Step 5: Deployment**
- Translations committed to repository or loaded from external CDN
- Application loads correct language bundle based on user preference
- Old language bundles cached (for users who haven't updated)

### 3.4) Competing-team Critique
- Weakness: Manual translation workflow slow; delays feature releases.
- Alternative: Use AI translation (Google Translate API, GPT-4) for auto-translation; professional review only for critical strings.
- Weakness: JSON translation files fragile; easy to miss keys.
- Alternative: Use translation management platform (Crowdin, Lokalise) with automated sync to repo.
- Weakness: Pluralization rules complex; different per language.
- Alternative: Use messageformat.js or i18n library with built-in plural support.

---

## 4) Date Formatting

### 4.1) Gregorian Calendar (Primary)

**Format Specification**:

**Long Format** (appointment confirmations, reports):
- Arabic: `الأربعاء، ١٣ يونيو ٢٠٢٦`
- English: `Wednesday, June 13, 2026`

**Medium Format** (tables, lists):
- Arabic: `١٣ يونيو ٢٠٢٦`
- English: `June 13, 2026`

**Short Format** (compact views, mobile):
- Arabic: `١٣/٠٦/٢٠٢٦` (day/month/year)
- English: `06/13/2026` (month/day/year)

**Time Format**:
- Arabic (24-hour): `١٣:٣٠` (no AM/PM)
- English (24-hour, optional 12-hour): `13:30` or `1:30 PM`
- Seconds omitted unless clinical (e.g., lab results timestamp)

**DateTime Combined**:
- Arabic: `الأربعاء، ١٣ يونيو ٢٠٢٦، الساعة ١٣:٣٠`
- English: `Wednesday, June 13, 2026, 1:30 PM`

### 4.2) Relative Dates

For recent/upcoming dates, use relative format instead of absolute:

**Examples**:
- `اليوم` (Today), `غداً` (Tomorrow), `أمس` (Yesterday)
- `في ساعة` (In 1 hour), `قبل ساعتين` (2 hours ago)
- `الأسبوع القادم` (Next week), `الشهر الماضي` (Last month)

**Rules**:
- Use relative for dates within 7 days
- Switch to absolute format for dates > 7 days
- Combine with time for appointments: `غداً في الساعة ١٣:٣٠`

### 4.3) Hijri Calendar Support (Optional, Secondary)

**Use Case**: Display Hijri dates for Islamic holidays, fasting schedules (Ramadan clinic hours)

**Format**:
- Arabic: `١٢ ذو الحجة ١٤٤٧ هـ`
- English: `12 Dhul-Hijjah 1447 AH`

**Conversion**:
- Use library (moment.js with Hijri plugin, or hijri-converter)
- Always display Gregorian as primary; Hijri as secondary (smaller text)
- Don't use Hijri for regular appointments (may confuse international staff)

**Holiday Highlighting**:
- Ramadan: Highlight clinic hours adjustment (e.g., "Clinic hours: 7 AM – 3 PM during Ramadan")
- Eids: Highlight clinic closures (red banner: "Clinic closed on Eid Al-Fitr, June 30 – July 2")

### 4.4) Timezone Handling

**Timezone Strategy**:
- Store all dates in UTC in database
- Display in user's local timezone (based on system settings or user preference)
- Avoid confusion: Show timezone abbreviation (GMT+3) next to time

**Example**:
- Database: `2026-06-13T10:30:00Z`
- Display (Syria): `الأحد، ١٣ يونيو ٢٠٢٦، ١٣:٣٠ (GMT+3)`
- Display (London): `Sunday, June 13, 2026, 11:30 (GMT+1)`

**Competing-team Critique**:
- Weakness: UTC storage correct but displays confusing if clinic in multiple timezones.
- Alternative: Store timezone with appointment; display relative to clinic timezone (not user timezone).
- Weakness: Hijri support adds complexity; few clinics use it.
- Alternative: Hijri display optional (toggle in settings); not in core product.

---

## 5) Currency Formatting

### 5.1) Supported Currencies

**Primary**: Syrian Lira (SYP)
- Symbol: ` ل.س` or `₪` (SY pound sign)
- Format: `1,234.56 ل.س` (amount followed by symbol)
- Display: Right-to-left placement in RTL: `١٬٢٣٤٫٥٦ ل.س`

**Secondary**: US Dollar (USD)
- Symbol: `$`
- Format: `$1,234.56` (symbol followed by amount)

**Additional** (for future expansion):
- Lebanese Pound (LBP): `₾`
- Turkish Lira (TRY): `₺`

### 5.2) Formatting Rules

**Thousand Separator**:
- Arabic: `١٬٢٣٤` (Arabic comma ، is thousands separator in Arabic numerals)
- English: `1,234` (standard comma)

**Decimal Separator**:
- Arabic: `٫` (Arabic decimal separator)
- English: `.` (period)

**Examples**:
- Arabic SYP: `١٬٢٣٤٫٥٦ ل.س` → "One thousand two hundred thirty-four lira, 56"
- English SYP: `SYP 1,234.56` → display as "1,234.56 SYP" (currency code preferred for international)
- English USD: `$1,234.56`

### 5.3) Payment & Invoice Display

**Consultation Fee**:
- Arabic: `رسوم الاستشارة: ١٥٬٠٠٠ ل.س`
- English: `Consultation Fee: SYP 15,000`

**Invoice Total**:
- Arabic: `الإجمالي: ٢٥٬٠٠٠ ل.س`
- English: `Total: SYP 25,000`

**Currency Conversion** (if applicable):
- Show conversion rate: `١ USD = ١٠٬٠٠٠ ل.س (Updated: 2 hours ago)`
- Refresh rate: Update every hour (due to Syrian currency volatility)

### 5.4) Competing-team Critique
- Weakness: SYP volatile; prices may change daily.
- Alternative: Show prices in USD; convert to SYP at transaction time.
- Weakness: Arabic numeral formatting complex; easy to bug.
- Alternative: Use Intl.NumberFormat API (built-in browser support); handle fallback for older browsers.
- Weakness: Clinic may want multiple currencies; hard to maintain.
- Alternative: Define primary currency per tenant (clinic); allow USD fallback only.

---

## 6) Number Formatting

### 6.1) General Numbers

**Integer Numbers**:
- Arabic: Use Arabic numerals (٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩) with Arabic thousand separator
- English: Use Latin numerals (0 1 2 3 4 5 6 7 8 9) with comma separator

**Examples**:
- Arabic: `١٬٢٣٤` (1,234)
- English: `1,234`

**Decimal Numbers** (3+ significant figures):
- Arabic: `١٬٢٣٤٫٥٦`
- English: `1,234.56`

### 6.2) Clinical & Lab Numbers

**Lab Results** (no thousand separator; single units):
- Hemoglobin: `14.5 g/dL` (not `14,500`)
- Blood glucose: `120 mg/dL`
- Potassium: `4.2 mmol/L`

**Vital Signs**:
- Blood pressure: `120/80 mmHg`
- Heart rate: `72 bpm`
- Temperature: `37.2 °C` (or `98.6 °F` if US)
- Oxygen saturation: `98%`

### 6.3) Percentages

- Format: `25%` (English), `٢٥٪` (Arabic)
- No space between number and `%`

**Examples**:
- Discount: `-15%`
- Tax: `+16% VAT`
- Commission: `5% per appointment`

### 6.4) Phone Numbers

**Syrian Phone Numbers**:
- Format: `+963 11 1234567` (country code + city + number)
- Alternative: `0961 234567` (domestic format)
- Display: Format automatically based on input; allow +963 or 0 prefix

**Input Validation**:
- Remove spaces and dashes
- Accept +963 or 0 prefix
- Validate length (10–12 digits after country code)

**Arabic Display**:
- Numbers in Arabic script: `+٩٦٣ ١١ ١٢٣٤٥٦٧`

### 6.5) Competing-team Critique
- Weakness: Arabic numerals in UI strange for international users (when English language selected).
- Alternative: Always use Latin numerals (0–9) regardless of language; only format separators based on locale.
- Weakness: Clinical numbers complex to format; easy to introduce bugs.
- Alternative: Use Intl.NumberFormat with `maximumFractionDigits` for precision.

---

## 7) Text Expansion & RTL Space Management

### 7.1) Text Expansion Rules

**Translation Length Variance**:
- Arabic typically 20–30% longer than English
- German 15–20% longer than English
- French similar to English

**Example**:
- English: `Save` (4 chars)
- Arabic: `حفظ` (3 chars, but takes more visual space due to letter width)

**Button Sizing**:
- Design buttons with 30% extra width for Arabic
- Use flexible/adaptive button widths (not fixed pixel widths)

**Truncation**:
- Never truncate middle names, surnames (medical context requires full names)
- Truncate in this order (priority):
  1. Descriptions, notes (end with `…`)
  2. Company names, street addresses
  3. Titles, roles (only if > 20 chars)
- Never truncate: patient names, appointment time, medication names, diagnosis

### 7.2) RTL Space Considerations

**Sidebar Width**:
- LTR: 260px (common width for sidebar)
- RTL: 260px (same width, just positioned right)
- Content area: Fill remaining space

**Form Width**:
- Max-width: 500px for desktop (same for both RTL/LTR)
- Labels + input on same row
- Stack on mobile regardless of direction

**Padding & Margins**:
- Use logical properties to auto-adjust: `padding-inline-start`, `margin-inline-end`
- Visual consistency: Same visual balance for both RTL/LTR

### 7.3) Competing-team Critique
- Weakness: 30% extra width for Arabic wastes space; hard to forecast.
- Alternative: Use flexible/dynamic sizing; test in both languages before release.
- Weakness: Truncation removes information; users frustrated.
- Alternative: Show full text in tooltip on hover; truncate only for space constraints.

---

## 8) Localization Standards

### 8.1) No Hardcoded Strings Policy

**Enforced Rules**:
1. **ALL user-facing strings** must be in translation files (JSON)
2. No string literals in code: ❌ `<p>Click here</p>` → ✅ `<p>{{ $t('button.click') }}</p>`
3. Error messages, validation messages, labels, buttons, placeholders: All externalized
4. Code review process checks for hardcoded strings (linting rule)

**Linting Rule** (ESLint):
```javascript
// .eslintrc.json
{
  "rules": {
    "no-hardcoded-strings": "error"
  }
}
```

**Allowed Exceptions**:
- HTML attributes: `<input type="email">` (not user-visible)
- HTML meta tags: `<meta name="viewport">` (system, not user-visible)
- Code comments: `// This is a code comment`
- Variable names, class names (internal, not user-visible)
- Debug/console logs (development only)

### 8.2) Common Localization Issues & Prevention

**Issue 1: Missing Translations**
- Problem: Developer adds new string, forgets to translate
- Prevention:
  - Code review process: Check for new translation keys
  - Linting: Missing keys flagged as warnings during build
  - QA testing: Test both languages; report untranslated keys

**Issue 2: Text Truncation**
- Problem: Arabic text longer, gets cut off in UI
- Prevention:
  - Design for 150% of English text width
  - QA testing: Check all text with longest Arabic translations
  - Responsive design: Allow text wrapping on mobile

**Issue 3: Context/Gender Mismatch**
- Problem: Translation doesn't match context (e.g., greeting man vs woman)
- Prevention:
  - Use context keys: `message.approved_by_m`, `message.approved_by_f`
  - QA testing: Verify correct gender/context used in different scenarios

**Issue 4: Date/Time Format Mistakes**
- Problem: Date displays wrong order (DD/MM vs MM/DD)
- Prevention:
  - Use Intl.DateTimeFormat API (handles locale automatically)
  - QA testing: Verify dates render correctly in both languages
  - Document format per locale in translation file comments

**Issue 5: Number Format Bugs**
- Problem: Arabic numerals not used in Arabic UI, or vice versa
- Prevention:
  - Use Intl.NumberFormat API
  - QA testing: Check all numbers (prices, counts, lab values) in both languages

### 8.3) Competing-team Critique
- Weakness: Hardcoded strings enforcement strict; slows development.
- Alternative: Enforce on "user-facing" strings only; allow technical strings hardcoded.
- Weakness: Translation process centralized; not scalable as languages grow.
- Alternative: Use crowdsourcing (volunteers) for translation; professional review for medical terms only.

---

## 9) Technical Implementation

### 9.1) i18n Library Selection

**Recommended: i18next** (most popular, flexible)
- Supports multiple languages, pluralization, namespacing
- Works with React, Vue, Angular, vanilla JS
- Ecosystem: i18next-scanner (auto-extraction), i18next-http-backend (load from server)

**Alternative: Format.js** (for React)
- Built specifically for React
- Good performance; smaller bundle size
- Compiler-optimized messages

**Alternative: VueI18n** (for Vue.js)
- Native Vue integration
- Reactive translations; switching languages updates UI instantly

### 9.2) i18next Configuration

**Installation**:
```bash
npm install i18next i18next-browser-languagedetector i18next-http-backend
```

**Initialization**:
```javascript
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18next
  .use(HttpBackend)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'ar-SY',
    ns: ['common', 'appointments', 'patients', 'errors'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    },
    interpolation: {
      escapeValue: false
    }
  });
```

**Usage in Code**:
```javascript
// Simple translation
i18next.t('button.save') // Returns: "حفظ" (Arabic) or "Save" (English)

// With interpolation
i18next.t('appointment.createdAt', { date: '2026-06-13' })
// Returns: "تم الإنشاء في 2026-06-13"

// With pluralization
i18next.t('patient.count', { count: 3 })
// Returns: "لديك 3 مرضى" (plural form based on count)
```

**React Hook**:
```javascript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div>
      <button>{t('button.save')}</button>
      <select onChange={(e) => handleLanguageChange(e.target.value)}>
        <option value="ar-SY">العربية</option>
        <option value="en-US">English</option>
      </select>
    </div>
  );
}
```

### 9.3) Localization File Structure

**Directory**:
```
src/
  locales/
    ar-SY/
      common.json
      appointments.json
      patients.json
      forms.json
      errors.json
      notifications.json
    en-US/
      common.json
      appointments.json
      (same files)
```

**JSON Example** (src/locales/ar-SY/common.json):
```json
{
  "button": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف"
  },
  "label": {
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "fullName": "الاسم الكامل"
  },
  "placeholder": {
    "enterEmail": "أدخل بريدك الإلكتروني",
    "enterPassword": "أدخل كلمتك السرية",
    "searchPatient": "ابحث عن المريض..."
  }
}
```

### 9.4) Competing-team Critique
- Weakness: i18next verbose; adds bundle size (~40KB).
- Alternative: Use lightweight library (i18n-js, or Intl API directly for basic cases).
- Weakness: Loading translation files from server adds latency.
- Alternative: Bundle translations with code; trade bundle size for faster load time.

---

## 10) RTL Implementation Checklist

- [ ] HTML `dir="rtl"` set correctly for Arabic
- [ ] CSS Logical Properties used: `margin-inline-start`, `inset-inline-end`, etc.
- [ ] Flexbox/Grid auto-reverses with `dir` attribute
- [ ] Sidebar positioned right in RTL (not left)
- [ ] Form labels aligned right in RTL
- [ ] Checkboxes/icons positioned right in RTL
- [ ] Table columns reversed in RTL (checkbox on right)
- [ ] Pagination controls reversed: [Next] [3] [2] [1] [Prev] in RTL
- [ ] Directional icons flipped: ← → ↑ ↓ arrows, back/forward chevrons
- [ ] Focus ring visible on RTL components
- [ ] Modal positioned correctly (center for both RTL/LTR)
- [ ] Dropdowns open below, respect RTL positioning
- [ ] Text-align: end/start used (not left/right)
- [ ] Tooltips positioned correctly (RTL aware)
- [ ] QA testing: Both RTL and LTR reviewed before release

---

## 11) Localization Testing & QA

### 11.1) Manual Testing Checklist

**Layout & Spacing**:
- [ ] All text fits within containers (no truncation unless intentional)
- [ ] Buttons/inputs properly sized for both languages
- [ ] RTL layout mirrors LTR (sidebar right, content adjusts)
- [ ] No hardcoded text visible (all keys translated)

**Date & Time**:
- [ ] Dates display in correct format (DD/MM/YYYY for Arabic, MM/DD/YYYY for English)
- [ ] Time displays 24-hour format (13:30, not 1:30 PM)
- [ ] Timezones correct (GMT+3 for Syria)
- [ ] Relative dates work ("Today", "Tomorrow", etc.)

**Currency & Numbers**:
- [ ] Currency symbols correct (ل.س for Arabic, $ for USD)
- [ ] Thousand separators correct (، for Arabic, , for English)
- [ ] Decimal separators correct (٫ for Arabic, . for English)
- [ ] Lab numbers not over-formatted (no thousand separator on lab values)
- [ ] Percentages display correctly (25%, ٢٥٪)

**Forms & Inputs**:
- [ ] Labels in correct language
- [ ] Placeholders translated
- [ ] Validation messages translated
- [ ] Error states display correct message
- [ ] Helper text translated

**Navigation & Menus**:
- [ ] All menu items translated
- [ ] Sidebar items right-aligned in RTL
- [ ] Breadcrumbs navigate correctly
- [ ] Search placeholders translated

**Icons & Imagery**:
- [ ] Directional icons flipped (RTL)
- [ ] Status icons not flipped (checkmarks, X, etc.)
- [ ] Images display correctly (not mirrored unless intentional)

**Accessibility**:
- [ ] ARIA labels translated (e.g., `aria-label="حفظ المريض"`)
- [ ] Screen reader works in both languages
- [ ] Keyboard navigation works (Tab order correct for RTL)
- [ ] Focus visible on all interactive elements

### 11.2) Automated Testing

**Unit Tests** (i18n library):
```javascript
test('should translate key correctly', () => {
  expect(i18next.t('button.save')).toBe('حفظ');
});

test('should handle pluralization', () => {
  expect(i18next.t('patient.count', { count: 1 })).toBe('مريض واحد');
  expect(i18next.t('patient.count', { count: 5 })).toBe('5 مرضى');
});

test('should interpolate variables', () => {
  expect(i18next.t('greeting', { name: 'Ahmed' })).toBe('مرحبا Ahmed');
});
```

**Linting** (ESLint for missing translations):
```javascript
// Flags missing keys in build
npm run lint:i18n
// Output: Key 'button.newAction' not found in translations
```

**Visual Regression Testing** (Percy, Chromatic):
- Take screenshots in English and Arabic
- Flag visual differences (layout, spacing)
- Prevent RTL regressions on each release

### 11.3) Competing-team Critique
- Weakness: Manual QA testing slow; requires Arabic-speaking QA.
- Alternative: Use QA specialists from Syria; automate visual testing only.
- Weakness: Linting misses some hardcoded strings; humans can slip through.
- Alternative: Code review process: Flag all strings in review; ask "Is this translatable?"

---

## 12) Deployment & Multi-Language Rollout

### 12.1) Phase 1: Arabic Only (Launch)

**Timeline**: Months 1–3
- Primary market: Syria
- Language: Arabic (ar-SY)
- UI: RTL layout
- Calendar: Gregorian (Hijri optional)
- Currency: Syrian Lira (SYP)
- QA: Arabic fluency required
- Deploy: No language selector needed (only language available)

### 12.2) Phase 2: Add English (Month 4)

**Timeline**: Month 4 (after Arabic stabilizes)
- Add English (en-US) support
- Implement language selector (header flag, dropdown)
- Ensure RTL/LTR consistent
- QA: Test both languages side-by-side
- Deploy: A/B testing with small English-speaking user group

**Language Selector UI**:
```
[العربية ▼] or [English ▼]  (top-right corner of header)
```

**Persistence**:
- Save language preference in user profile
- Remember language in local storage (for non-logged-in users)
- Respect browser language on first visit (fallback to Arabic)

### 12.3) Phase 3: Expand to French/Turkish (Months 5–6)

**Timeline**: Month 5–6
- Add French (for Lebanon, North Africa)
- Add Turkish (for Turkish-speaking regions)
- Same QA & deployment process

### 12.4) Competing-team Critique
- Weakness: Phased rollout delays English support; international teams frustrated.
- Alternative: Launch with Arabic & English simultaneously (doubles QA effort, but better market reach).
- Weakness: Language selector adds UI complexity; clutters header.
- Alternative: Put language selector in account settings (less visible, but cleaner header).

---

## 13) Documentation & Training

### 13.1) Developer Guidelines

**File to Create**: `/docs/i18n-DEVELOPER-GUIDE.md`

**Contents**:
- How to add new strings (step-by-step)
- Translation key naming conventions
- Code examples (React, Vue, vanilla JS)
- Common mistakes & how to avoid
- How to test translations locally
- How to handle pluralization, gender context

**Example**:
```markdown
# Adding a New String

1. Create key: `page.patient.newAction`
2. Add to en-US translation file: `"newAction": "New Action"`
3. Submit PR with translation file changes
4. Translator will add Arabic translation
5. Test locally: Change language, verify translation appears
```

### 13.2) Translator Guidelines

**File to Create**: `/docs/i18n-TRANSLATOR-GUIDE.md`

**Contents**:
- Glossary of medical terms (Arabic-English)
- Clinical context for strings (e.g., "prescription" vs "medication")
- Translation conventions (capitalization, punctuation)
- Do's and Don'ts (consistency, tone)
- Testing translations in UI (how to verify text fits)
- Process: Extract → Translate → Review → Commit

**Glossary Example**:
```markdown
# Medical Glossary (Arabic-English)

| English | Arabic | Context |
|---------|--------|---------|
| Appointment | موعد | Clinic appointment |
| Consultation | استشارة | Doctor visit |
| Prescription | وصفة طبية | Medications |
| Lab Result | نتيجة مخبرية | Blood test, etc. |
```

### 13.3) Competing-team Critique
- Weakness: Glossary maintenance burden; may become outdated.
- Alternative: Live glossary in wiki or translation management system; auto-sync.

---

## 14) Performance Optimization

### 14.1) Translation Bundle Size

**Current Bundle**:
- All translations loaded upfront: ~200KB+ (all languages)

**Optimization**:
- Load only current language: ~30KB (single language bundle)
- Lazy-load other languages on demand (if switching)

**Code Splitting**:
```javascript
// Only load Arabic bundle initially
const translations = await import(`/locales/ar-SY.json`);

// Load English only if user switches
i18next.changeLanguage('en-US', () => {
  import(`/locales/en-US.json`);
});
```

### 14.2) Competing-team Critique
- Weakness: Lazy loading delays language switch; UI feels slow.
- Alternative: Preload other languages in background (low priority).
- Weakness: Translation API calls add latency.
- Alternative: Cache translations in browser; sync on background (SyncManager API).

---

## 15) Implementation Checklist

- [ ] i18n library configured (i18next or alternative)
- [ ] Translation files created (JSON structure)
- [ ] Language detection implemented (OS language, user preference)
- [ ] Language selector in UI (header or settings)
- [ ] RTL CSS applied (logical properties, flexbox direction)
- [ ] All user-facing strings externalized (no hardcoded strings)
- [ ] Date/time formatting correct per locale (Intl.DateTimeFormat)
- [ ] Currency formatting correct per locale (Intl.NumberFormat)
- [ ] Number formatting correct per locale
- [ ] Pluralization rules implemented
- [ ] Gender/context support (if needed)
- [ ] Translation workflow defined (extract, translate, review, deploy)
- [ ] QA testing plan for both languages
- [ ] Performance optimized (language bundle splitting)
- [ ] Accessibility tested (ARIA labels, screen reader)
- [ ] Developer & translator documentation created

---

## 16) Common Issues & Solutions

### Issue: Date Format Wrong
**Symptom**: Dates display MM/DD/YYYY in Arabic (English format)
**Solution**: Use `Intl.DateTimeFormat('ar-SY')` for Arabic, `Intl.DateTimeFormat('en-US')` for English

### Issue: Text Truncated
**Symptom**: Arabic text cut off in buttons
**Solution**: 
1. Increase button width (flex: 1 or min-width: 150px)
2. Allow text wrapping (white-space: normal)
3. Test with longest Arabic translations before release

### Issue: Missing Translation
**Symptom**: Key displays instead of text (e.g., "button.save" shows in UI)
**Solution**:
1. Check translation key exists in JSON file
2. Check namespace matches (common.json vs appointments.json)
3. Check i18n initialization includes namespace
4. Check browser console for warnings/errors

### Issue: RTL Layout Broken
**Symptom**: Sidebar on left (should be right)
**Solution**:
1. Check HTML `dir="rtl"` set
2. Check CSS doesn't use `left`/`right` (use `inline-start`/`inline-end`)
3. Test in Firefox RTL extension or browser dev tools (set direction)

### Issue: Currency Format Wrong
**Symptom**: Prices showing "$1,234.56" in Arabic (wrong format)
**Solution**: Use `Intl.NumberFormat` with `style: 'currency'` and locale-specific currency code

---

## 17) Alignment with UI System & Other Docs

**UI_SYSTEM.md**: Color, typography, spacing apply to both languages
- Use logical CSS properties (margin-inline-start) for RTL
- Typography scaling same for both (headings 32px on desktop)
- Accessibility (WCAG AA) applies to both languages

**UX_STRATEGY.md**: 3-click rule applies to both languages
- Persona workflows (Doctor, Receptionist, etc.) tested in both languages
- Error/loading/empty states translated
- Offline support works in both languages

**INFORMATION_ARCHITECTURE.md**: Sidebar & navigation structure
- Menu items translated
- Sidebar positioned right in RTL
- Breadcrumbs updated for RTL

---

## 18) Next Steps

- [ ] Set up i18n library (i18next)
- [ ] Create translation file structure (JSON)
- [ ] Extract all strings from codebase
- [ ] Hire Arabic translator / validate with in-country team
- [ ] Implement language selector UI
- [ ] QA testing in both Arabic and English
- [ ] Prepare deployment & language switching mechanism
- [ ] Create developer & translator documentation
- [ ] Plan Phase 2 (English launch)
- [ ] Plan Phase 3 (French/Turkish expansion)

