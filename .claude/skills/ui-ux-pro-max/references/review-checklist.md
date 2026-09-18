# Pre-ship UI review checklist

Walk this against the diff before calling a UI change done. Each line is pass/fail — if you cannot tell, you have not looked.

## Tokens & theme
- [ ] Zero hardcoded colors: no `#hex`, `rgb()`, `bg-white`, `text-black`, `bg-[...]`, `text-[...]` in the diff
- [ ] Every surface pairs background with its foreground token (`bg-card` + `text-card-foreground`)
- [ ] Rendered in **dark mode**: text readable, borders visible, no black-on-black, no glowing white panel
- [ ] Any new token added to `globals.css` under both `:root` and `.dark`, and mapped in `tailwind.config.ts`
- [ ] Spacing and radius from the scale; no `p-[13px]`, no mixed radii on one surface

## Direction (RTL)
- [ ] No `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` in the diff — logical equivalents only
- [ ] Rendered with `dir="rtl"`: nothing overlaps, no reversed reading order, no clipped text
- [ ] Chevrons/arrows flip (`rtl:rotate-180`); QR codes, logos, numerals, code do **not**
- [ ] LTR content inside Arabic (URLs, emails, IDs) wrapped in `<bdi>` or given `dir="ltr"`

## Responsive
- [ ] 360px wide: no horizontal scroll, no overflow, no truncated CTA
- [ ] Touch targets ≥44px, with enough spacing that adjacent targets aren't mis-tapped
- [ ] Long strings (a pasted URL, a long Arabic name) truncate or wrap instead of blowing out the layout
- [ ] Images sized/`next/image`d — no layout shift on load

## States
- [ ] Loading: skeleton matching real layout shape and height
- [ ] Empty: explains what's missing **and** offers the action
- [ ] Error: what failed + a retry path
- [ ] Disabled: the reason is discoverable
- [ ] Nothing jumps as data arrives

## Accessibility
- [ ] Every interactive element reachable by Tab, with a visible `focus-visible` ring
- [ ] Icon-only controls have `aria-label`; decorative icons `aria-hidden`
- [ ] Inputs have real `<label>`s (placeholder is not a label)
- [ ] Dialogs: focus moves in, Escape closes, focus returns to the trigger
- [ ] Contrast ≥4.5:1 body / ≥3:1 large text and UI borders — check `text-muted-foreground` on tinted backgrounds in **both** themes
- [ ] Status never conveyed by color alone (add icon or text)
- [ ] Headings nest properly; one `<h1>` per page

## Behavior & correctness
- [ ] No `div`/`span` with `onClick` standing in for a button or link
- [ ] Destructive actions confirm, and say what will be destroyed
- [ ] Async actions disable their trigger and show progress — double-submit impossible
- [ ] Success and failure both produce visible feedback (toast or inline)
- [ ] Motion 150–250ms with `motion-reduce` handled

## Consistency & cost
- [ ] Reuses `@/components/ui` rather than a near-duplicate
- [ ] `'use client'` sits at the smallest leaf that needs it
- [ ] `cn()` used for conditional classes
- [ ] No new global CSS that a token or variant could have handled

## Verify
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Actually rendered, not just compiled — or explicitly stated as not rendered
