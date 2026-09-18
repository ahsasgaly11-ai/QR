# Pre-ship UI review checklist

Walk this against the diff before calling a UI change done. Each line is pass/fail — if you cannot tell, you have not looked.

## Tokens & theme
- [ ] Zero hardcoded colors in the diff: no `#hex`, `rgb()`, `bg-white`, `text-black`, arbitrary color values, inline color styles
- [ ] Every surface pairs its background with the matching foreground token
- [ ] Rendered in **each theme the project ships**: text readable, borders visible, no black-on-black, no glowing white panel
- [ ] Any new token defined for every theme and registered in the theme config
- [ ] Spacing, radius, and shadows from the scale; no one-off values; no mixed radii on one surface

## Direction
- [ ] No physical `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` — logical equivalents only
- [ ] If the project ships an RTL locale: rendered with `dir="rtl"` — nothing overlaps, no reversed reading order, no clipped text
- [ ] Navigational icons mirror; logos, codes, numerals, and media glyphs do **not**
- [ ] Opposite-direction runs (URLs, emails, IDs) isolated with `<bdi>` or an explicit `dir`

## Responsive
- [ ] 360px wide: no horizontal scroll, no overflow, no truncated primary action
- [ ] Touch targets ≥44px, spaced so adjacent targets aren't mis-tapped
- [ ] Long strings (a pasted URL, a long name) truncate or wrap instead of blowing out the layout
- [ ] Images have dimensions — no layout shift on load

## States
- [ ] Loading: skeleton matching real layout shape and height
- [ ] Empty: explains what's missing **and** offers the action
- [ ] Error: what failed + a retry path
- [ ] Disabled: the reason is discoverable
- [ ] Nothing jumps as data arrives

## Accessibility
- [ ] Every interactive element reachable by Tab, with a visible focus ring
- [ ] Icon-only controls have an accessible name; decorative icons are `aria-hidden`
- [ ] Inputs have real labels bound to them (a placeholder is not a label)
- [ ] Dialogs: focus moves in, Escape closes, focus returns to the trigger
- [ ] Contrast ≥4.5:1 body / ≥3:1 large text and UI borders — check muted text on tinted backgrounds in **every** theme
- [ ] Status never conveyed by color alone
- [ ] Headings nest properly; one `h1` per page

## Behavior & correctness
- [ ] No `div`/`span` with a click handler standing in for a button or link
- [ ] Destructive actions confirm, and name what will be destroyed
- [ ] Async actions disable their trigger and show progress — double-submit impossible
- [ ] Success and failure both produce visible feedback
- [ ] Motion 150–250ms with `prefers-reduced-motion` handled
- [ ] User-visible strings go through the project's i18n layer if it has one — no new hardcoded strings

## Consistency & cost
- [ ] Reuses existing primitives rather than a near-duplicate
- [ ] Interactive boundary at the smallest leaf that needs it
- [ ] Conditional classes via the project's helper, not string concatenation
- [ ] No new global CSS that a token or variant could have handled

## Verify
- [ ] The project's typecheck passes
- [ ] The project's lint passes
- [ ] The project's tests pass (if the change touches tested behavior)
- [ ] Actually rendered, not just compiled — or explicitly stated as not rendered
