# /ui-mobile — Mobile & Accessibility Skill (AGENT-002)
# VERSION: v1.1.0
# OWNER: Frontend Lead
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md


## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.


## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

> **Scope**: Qesto frontend — React + TypeScript + Tailwind CSS v4
> **Revoke na**: Einde van UI/mobile taak.
> **Zie ook**: `frontend-dev.md` §VERPLICHT: Mobile & Accessibility — dit skill voegt diepere regels toe.

---

## 1. Touch Targets (WCAG 2.5.5)

**Regel**: Elk klikbaar element ≥ 44×44 CSS pixels.

```tsx
// ✅ Correct
<button className="min-h-[44px] min-w-[44px] px-4">Label</button>

// ✅ Icon-only knop
<button className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Verwijder item">
  <TrashIcon />
</button>

// ❌ Te klein
<button className="h-8 w-8">✕</button>
```

**Checklist**:
- [ ] Vote.tsx — punt-toewijzing ± knoppen
- [ ] Present.tsx — navigatie, emoji-reacties
- [ ] Dashboard.tsx — actiemenu knoppen (verwijder, kopieer, template)
- [ ] AICreator.tsx — sluiten, verwijder-rij

---

## 2. WCAG AA Contrast (4.5:1 tekst, 3:1 UI-elementen)

**Qesto palet — veilige/verboden combinaties op wit**:

| Klasse | Hex | Op wit | Gebruik |
|--------|-----|--------|---------|
| `text-pulse-300` | #7DD3FC | 2.3:1 | ❌ Verboden voor tekst |
| `text-pulse-400` | #38BDF8 | 3.1:1 | ⚠️ Alleen grote tekst (18pt+) |
| `text-pulse-500` | #0EA5E9 | 4.6:1 | ✅ Normale tekst |
| `text-pulse-600` | #0284C7 | 6.1:1 | ✅ Veilig |
| `text-teal-500`  | #14B8A6 | 3.9:1 | ⚠️ Alleen decoratief |
| `text-teal-600`  | #0D9488 | 5.3:1 | ✅ Veilig |
| `text-slate-400` | #94A3B8 | 3.0:1 | ❌ Verboden placeholder tekst |
| `text-slate-500` | #64748B | 4.6:1 | ✅ Placeholder min |
| `text-slate-700` | #334155 | 8.9:1 | ✅ Body tekst |

**Quick audit**:
```bash
grep -rn "text-pulse-[34]00\|text-teal-[45]00\|text-slate-[34]00" src/
```

---

## 3. Aria-Labels (WCAG 4.1.2)

**Regel**: Elk icon-only element heeft `aria-label`.

```tsx
// ✅ Icon-only knoppen
<button aria-label="Sessie verwijderen">🗑️</button>
<button aria-label="Sessie kopiëren">📋</button>
<button aria-label="Terug naar dashboard">←</button>

// ✅ Dynamische labels
<button aria-label={`Toon details voor ${session.title}`}>
  <ChevronDownIcon />
</button>
<button
  aria-label={open ? `Verberg ${theme.label}` : `Toon ${theme.label}`}
  aria-expanded={open}
>
  {open ? '▲' : '▼'}
</button>

// ❌ Geen label
<button>×</button>
```

**Alle icon-only patronen in Qesto**:
- Sluiten/✕ knoppen in modals, lijstrijen
- Expand/collapse pijlen in InsightsPanel
- Navigatie-pijlen in Present.tsx (← →)
- Emoji-reactie knoppen in Vote.tsx

---

## 4. Focus & Keyboard Navigatie

**Globale stijl** (reeds in `src/index.css`):
```css
button:focus-visible,
a:focus-visible,
[role="button"]:focus-visible {
  outline: 2px solid #14B8A6;
  outline-offset: 2px;
}
```

**Test keyboard-flow**:
1. Tab door de pagina — elk element bereikbaar?
2. Enter/Space op knoppen — werkt het?
3. Escape sluit modals — geïmplementeerd?
4. Focus trap in modals — geen focus-escape?

```tsx
// ✅ Modal focus trap (gebruik dialog element of aria-modal)
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  ...
</div>
```

---

## 5. Skeleton Loaders (vervang spinners)

**Patroon** (zie Dashboard.tsx):
```tsx
// ✅ Skeleton loader
{loading ? (
  <div className="flex flex-col gap-3" aria-busy="true" aria-label="Laden">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
    ))}
  </div>
) : <ActualContent />}

// ❌ Losse spinner
{loading && <div className="spinner" />}
```

---

## 6. Fout- en Laadtoestanden (WCAG 4.1.3)

**Regel**: Elke async operatie heeft een zichtbare fout- én laadtoestand in de UI.

```tsx
// ✅ Knop laadtoestand
<button disabled={loading} aria-disabled={loading}>
  {loading ? 'Laden…' : 'Verzenden'}
</button>

// ✅ Foutstaat met role="alert"
{error && (
  <p role="alert" className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
    ⚠️ {error}
  </p>
)}

// ❌ Alleen console.error
catch (e) { console.error(e) }
```

---

## 7. Responsive Layout (375px = iPhone SE)

**Test commando's**:
```bash
# Chromium 375px viewport (Playwright)
npx playwright test --project=mobile-nl

# Of handmatig: Chrome DevTools → iPhone SE
```

**Anti-patronen**:
- `min-w-[500px]` op modale containers → `w-full max-w-[500px]`
- `flex gap-8` zonder wrapping → `flex flex-wrap gap-4`
- Inline `style={{ width: 480 }}` → gebruik max-w en w-full

---

## 8. Auditworkflow

```
1. Grep verboden klassen:
   grep -rn "text-pulse-[34]00\|h-8.*button\|w-8.*button" src/

2. Grep ontbrekende aria-labels:
   grep -n "aria-label" src/pages/*.tsx | grep -v "aria-label="

3. Visuele check op 375px:
   npx playwright test tests/a11y/ --project=mobile-nl

4. axe-core in Vitest:
   npm test -- --reporter=verbose tests/a11y/
```

---

## 9. Premium Feel Checklist

- [ ] Knoppen hebben `active:opacity-75 active:scale-[0.98] transition` (uit `src/index.css`)
- [ ] Hover-states op alle interactieve elementen
- [ ] Laadtoestand animatie smooth (geen layout-shift)
- [ ] Skeleton-loader breedte varieert per rij (niet identiek)
- [ ] Success-feedback na actie (toast of inline bevestiging)
- [ ] Scroll-gedrag soepel (`scroll-smooth`)
- [ ] Geen layout-shifts bij data laden (gebruik skeleton, niet conditioenele height)
- [ ] Font-size ≥ 14px op mobiel (geen `text-xs` voor primaire inhoud)

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
