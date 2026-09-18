---
name: ui-ux-pro-max
description: Use when building, restyling, or reviewing any user-facing UI in this app — new pages, screens, components, dialogs, forms, or layout/visual/CSS changes — and when the request mentions design, UX, polish, "make it look better", responsive, dark mode, RTL/Arabic, accessibility, or shadcn/Tailwind styling.
---

# UI UX Pro Max

## Overview

Ship interfaces that survive four axes at once: **light and dark**, **RTL and LTR**, **phone and desktop**, **keyboard and mouse**. Most UI bugs in this app are not "ugly" — they are one of those four axes never being looked at.

Core principle: **the design system is the source of truth.** Tokens over literals, shadcn primitives over hand-rolled ones, logical properties over left/right.

## Stack facts (do not re-derive)

| Thing | Value |
|---|---|
| Framework | Next.js 15 App Router, RSC on (`components.json: rsc: true`) |
| Styling | Tailwind 3.4, `darkMode: ['class']`, tokens as `hsl(var(--x))` |
| Components | shadcn/ui in `@/components/ui`, Radix primitives, `cn()` from `@/lib/utils` |
| Icons | lucide-react |
| Theme | next-themes |
| Fonts | `font-body` / `font-headline` = Tajawal (Arabic), `font-code` = Source Code Pro |
| Forms | react-hook-form + zod via `@hookform/resolvers` |
| Charts | recharts — also load the `dataviz` skill before writing chart code |

Tajawal + Arabic means **RTL is a first-class case, not an edge case.**

## The Four Axes (check every one, every time)

1. **Theme** — does it hold in dark mode? Only semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`) get you this for free. A hardcoded `#fff`, `bg-white`, `text-black`, or `bg-[#1a1a1a]` breaks a theme by construction.
2. **Direction** — `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`/`text-start`/`text-end`, never `ml-*`/`mr-*`/`left-*`/`text-left`. Directional icons get `rtl:rotate-180`. QR codes, logos, numbers, and code blocks never mirror.
3. **Size** — design at 360px first, then scale up. No horizontal scroll, no fixed pixel widths on containers, no text clipped at 320px.
4. **Input** — reachable and visible by keyboard: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`, real `<label>`s, Escape closes overlays, tap targets ≥44px.

## Five States per component

Every component that touches data ships all five, or it is unfinished: **loading** (Skeleton, not a spinner-only page), **empty** (says what to do next, with the action), **error** (what failed + retry), **partial/populated**, **disabled/permission-denied**. Empty and error are the two that get skipped — write them first if you are short on time.

## Quick reference

| Need | Do |
|---|---|
| A color | Semantic token. New color → add `--x` in `globals.css` for **both** themes, then map it in `tailwind.config.ts` |
| Spacing | Tailwind scale only (`gap-2/4/6`), no `p-[13px]` |
| Radius | `rounded-md/lg` (driven by `--radius`), consistent within a surface |
| A new component | Compose existing `@/components/ui` first; hand-roll only if no primitive fits |
| Conditional classes | `cn()`, never template-string concatenation |
| Interactivity | Keep `'use client'` at the leaf; parents stay Server Components |
| Motion | 150–250ms, `ease-out` in / `ease-in` out, plus `motion-reduce:transition-none` |
| Text hierarchy | Size **and** weight **and** color — never color alone |
| Icon-only button | `size="icon"` + `aria-label` + `sr-only` text |

Code patterns: `references/patterns.md`. Pre-ship gate: `references/review-checklist.md`.

## Workflow

1. **Inventory before inventing** — grep `@/components/ui` and existing screens for the pattern. Matching what exists beats a nicer-in-isolation component.
2. **Name the states and the axes** for the thing you're building (one line each) before writing JSX.
3. **Build with tokens and primitives.**
4. **Walk `references/review-checklist.md`** and fix what it catches.
5. **Verify** — `npm run typecheck` and `npm run lint` must pass. If you claim it renders, you ran it (see the `run` skill); otherwise say you did not.

## Common mistakes

- **Arbitrary values as a shortcut** — `bg-[#0ea5e9]`, `w-[327px]`, `text-[13px]`. Each one is a future dark-mode or responsive bug.
- **`ml-2` next to an icon** — correct in English, visibly broken in Arabic. This is the single most common defect in this codebase's shape.
- **Styling Radix internals with `!important`** — use the primitive's own slots/props and `cn()`.
- **`div` with `onClick`** — not focusable, not announced. Use `Button`/`Link`.
- **Placeholder as label** — disappears on input, fails a11y and RTL alignment both.
- **Dark mode "checked" by inverting a screenshot mentally** — toggle it.
- **New global CSS** — almost always a token or a variant is the real fix.

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
| "RTL is an edge case" | The body font is Tajawal. Arabic is the primary case here. |
| "Users won't keyboard-navigate this" | Focus rings are also how you prove nothing is trapped inside a dialog. |
| "The checklist is overkill for a button" | Buttons are exactly where tap-target, label, and focus defects live. |
| "It's prettier than the existing component" | Two nearly-identical components is a worse UX than one consistent one. |
