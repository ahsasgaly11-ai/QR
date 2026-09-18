---
name: ui-ux-pro-max
description: Use when building, restyling, or reviewing any user-facing UI — pages, screens, components, dialogs, forms, or layout/visual/CSS changes — and when the request mentions design, UX, polish, "make it look better", responsive, dark mode, RTL or internationalization, accessibility, contrast, or a styling/component library.
---

# UI UX Pro Max

## Overview

Ship interfaces that survive four axes at once: **theme** (light/dark), **direction** (LTR/RTL), **size** (phone/desktop), **input** (keyboard/pointer/touch). Most UI defects are not "ugly" — they are one of those four axes never being looked at.

Core principle: **the project's existing design system is the source of truth.** Adopt it; do not import your own taste. Tokens over literals, existing primitives over new ones, logical properties over left/right.

## Step 0 — Read the system before writing a line

Never assume the stack. Spend one minute establishing these five facts, then work inside them:

| Fact | Where to find it |
|---|---|
| **Design tokens** | `tailwind.config.*`, `globals.css` / `:root` custom properties, `theme.*`, design-token JSON, styled-components theme |
| **Component library** | `package.json` deps (shadcn/Radix, MUI, Chakra, Mantine, Ant, Bootstrap), plus the project's own `components/ui` or equivalent |
| **Theming strategy** | `darkMode: 'class'` vs `media`, a theme provider, `data-theme`, `prefers-color-scheme` |
| **Direction & locale** | `<html dir>`, i18n config/locale list, the UI font (an Arabic/Hebrew/Persian font means RTL is a primary case) |
| **Verify commands** | `package.json` scripts, Makefile, CI config — the project's own typecheck/lint/test/build |

If a fact contradicts this skill, the project wins. This skill sets the standard; the project sets the vocabulary.

## The Four Axes

Check every one, every time.

1. **Theme** — holds in both themes. Only semantic tokens (`background`/`foreground`/`muted`/`border`, or the project's names) get this for free. A hardcoded `#fff`, `bg-white`, `text-black`, or `color: #1a1a1a` breaks a theme by construction.
2. **Direction** — **if the project ships an RTL locale** (an `ar`/`he`/`fa` locale, `dir="rtl"`, or an RTL UI font), direction is a required axis: logical properties only, directional icons mirrored. **If it does not**, still prefer logical properties (`margin-inline-start`, `ms-*`/`ps-*`, `text-start`) — they cost nothing today and are the whole migration later.
3. **Size** — design at 360px first, then scale up. No horizontal scroll, no fixed-pixel containers, nothing clipped at 320px.
4. **Input** — reachable and visible by keyboard: a visible focus ring on every interactive element, real labels, Escape closes overlays, tap targets ≥44px.

## Five States per component

Every component that touches data ships all five, or it is unfinished: **loading** (skeleton shaped like the real content, not a bare spinner), **empty** (says what is missing *and* offers the action), **error** (what failed + retry), **populated**, **disabled/denied** (with a discoverable reason). Empty and error are the two that get skipped — write them first if you are short on time.

## Quick reference

| Need | Do |
|---|---|
| A color | Semantic token. New color → define it for **every** theme the project has, then register it in the theme config |
| Spacing | The project's scale; no one-off `13px` |
| Radius / shadow / border | From the scale, consistent within a surface |
| A new component | Compose existing primitives first; hand-roll only when none fits |
| Conditional classes | The project's helper (`cn`, `clsx`, `classnames`), never template-string concatenation |
| Text hierarchy | Size **and** weight **and** color — never color alone |
| Icon-only button | Accessible name (`aria-label`) + `aria-hidden` on the icon |
| Motion | 150–250ms, `ease-out` in / `ease-in` out, plus a `prefers-reduced-motion` path |
| Status | Never color alone — pair with icon or text |
| Client/server split (RSC, islands) | Keep the interactive boundary at the smallest leaf that needs state |

Code patterns: `references/patterns.md`. Pre-ship gate: `references/review-checklist.md`.

## Workflow

1. **Step 0 above** — establish the five facts.
2. **Inventory before inventing** — grep the component directory and a neighboring screen for the pattern. Matching what exists beats something nicer in isolation.
3. **Name the states and the axes** for what you're building (one line each) before writing markup.
4. **Build with tokens and existing primitives.**
5. **Walk `references/review-checklist.md`** and fix what it catches.
6. **Verify with the project's own commands** (typecheck, lint, tests). If you claim it renders, you ran it; otherwise say plainly that you did not.

## Common mistakes

- **Arbitrary values as a shortcut** — `bg-[#0ea5e9]`, `w-[327px]`, inline `style={{color:'#333'}}`. Each one is a future dark-mode or responsive bug.
- **Physical margins next to icons** — `margin-left` is correct in English and visibly broken in Arabic.
- **Overriding a component library's internals with `!important`** — use its documented slots, variants, or props.
- **`div` with `onClick`** — not focusable, not announced. Use a button or link.
- **Placeholder as label** — disappears on input; fails accessibility and RTL alignment both.
- **"Checking" dark mode by imagining it inverted** — toggle it.
- **New global CSS** — almost always a token or a variant is the real fix.
- **A second near-identical component** — consistency beats local perfection.

## Red flags — stop and re-check

- "It's a small style tweak, skipping the checklist"
- "Dark mode / RTL can be a follow-up"
- "I'll use the hex now and tokenize later"
- "No time for the empty state"
- "It looked fine in the diff"

All of these mean: run `references/review-checklist.md` now. A UI change is not done because it compiles.

## Rationalizations

| Excuse | Reality |
|---|---|
| "One hardcoded color won't matter" | It is invisible in the theme you built in and unreadable in the other one. 10 seconds to tokenize. |
| "This project is LTR-only" | Verify that from the locale config, not from memory — and logical properties cost nothing either way. |
| "Users won't keyboard-navigate this" | Focus rings are also how you prove nothing is trapped inside a dialog. |
| "The checklist is overkill for a button" | Buttons are exactly where tap-target, label, and focus defects live. |
| "The design system is ugly, mine is better" | Two systems is the worse UX. Improve the system, then use it. |
