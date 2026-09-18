# Patterns

Examples are React + Tailwind + a shadcn-style primitive set, because one concrete example beats five vague ones. **The rule above each example is the portable part** — map the syntax to whatever the project uses (CSS modules, styled-components, MUI `sx`, plain CSS). If the project's convention differs, the project wins.

## 1. Tokens, not literals

**Rule:** a color is a token defined for every theme the project ships, registered once in the theme config, then referenced by name. Never a literal in a component.

```css
/* globals.css — define the pair for BOTH themes */
:root { --success: 142 71% 35%; --success-foreground: 0 0% 100%; }
.dark { --success: 142 60% 45%; --success-foreground: 144 60% 8%; }
```

```ts
// tailwind.config.ts → theme.extend.colors
success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
```

```tsx
<span className="bg-success text-success-foreground">Active</span>
```

Never `bg-[#16a34a]`, and never patch it with `dark:bg-[#22c55e]` — the token pair already handles the theme. Background and foreground travel together: a surface token without its paired text token is how you get grey-on-grey.

## 2. Direction-agnostic layout

**Rule:** logical properties everywhere. Costs nothing in LTR, and is the entire RTL migration.

```tsx
// ❌ physical — correct in English, broken in Arabic/Hebrew
<div className="flex items-center ml-4 text-left">
  <Icon className="mr-2" />
  <ChevronRight className="ml-auto" />
</div>

// ✅ logical
<div className="flex items-center ms-4 text-start">
  <Icon className="me-2" />
  <ChevronRight className="ms-auto rtl:rotate-180" />
</div>
```

| Physical | Logical (Tailwind) | Logical (CSS) |
|---|---|---|
| `ml-*` / `mr-*` | `ms-*` / `me-*` | `margin-inline-start/end` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` | `padding-inline-start/end` |
| `left-*` / `right-*` | `start-*` / `end-*` | `inset-inline-start/end` |
| `text-left` / `text-right` | `text-start` / `text-end` | `text-align: start/end` |
| `border-l` / `rounded-l` | `border-s` / `rounded-s` | `border-inline-start` |

- `gap-*` on a flex/grid parent beats per-child margins — direction-agnostic for free.
- Flip only *navigational* icons (chevrons, arrows, back/forward). Never flip: logos, QR/barcodes, numerals, charts with numeric axes, code, media play glyphs.
- `dir` belongs on `<html>` from the locale, not sprinkled per component.
- Mixed content (an RTL sentence containing a Latin URL, ID, or code) → wrap the Latin run in `<bdi>`, or give the element `dir="ltr"` with `text-start`, so the sentence does not scramble.

## 3. The five states

**Rule:** the skeleton mirrors the real layout's shape and height — a wrong-height skeleton causes a layout jump, which is worse than a spinner.

```tsx
if (isLoading) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

if (error) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
      <p className="text-sm text-foreground">{t('items.loadFailed')}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
        {t('common.retry')}
      </Button>
    </div>
  );
}

if (!items.length) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{t('items.emptyTitle')}</p>
      <Button onClick={onCreate}>{t('items.createFirst')}</Button>
    </div>
  );
}
```

An empty state without an action is a dead end. An error state without a retry is a dead end.

## 4. Accessible interactive element

**Rule:** if it has no visible text, it needs an accessible name; if it removes the outline, it replaces the ring.

```tsx
<Button
  size="icon"
  variant="ghost"
  aria-label={t('item.download')}
  onClick={onDownload}
  className="size-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
>
  <Download className="size-4" aria-hidden />
</Button>
```

- ≥44px target on touch. WCAG 2.2 AA floor is 24×24 CSS px; 44px is the usable one on phones.
- Decorative icons get `aria-hidden` so they aren't announced twice.
- Disabled needs a nearby reason (tooltip or helper text) — a dead control with no explanation is a support ticket.

## 5. Form field

**Rule:** label, description, and error are bound to the input by the library's field wrapper, not placed near it visually.

```tsx
<FormField
  control={form.control}
  name="url"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('form.url')}</FormLabel>
      <FormControl>
        <Input {...field} inputMode="url" dir="ltr" className="text-start" placeholder="https://example.com" />
      </FormControl>
      <FormDescription>{t('form.urlHelp')}</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

- Validation lives in the schema (zod/yup/valibot); messages are localized strings, surfaced by the field's error slot.
- A URL/email/number is LTR content even on an RTL page: `dir="ltr"` + `text-start`.
- `inputMode` picks the right mobile keyboard — cheap, high impact.
- Validate on blur/submit, not every keystroke. Never clear what the user typed.

## 6. Interactive boundary placement

**Rule (RSC, islands, lazy hydration):** the interactive boundary sits at the smallest leaf that needs state — hoisting it to the page drags the whole subtree into the bundle.

```tsx
// Server Component: fetches, no 'use client'
export default async function ItemsPage() {
  const items = await getItems();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('items.title')}</h1>
      <ItemList items={items} />        {/* server */}
      <CopyButton value={items[0]?.url} /> {/* the only client leaf */}
    </main>
  );
}
```

## 7. Motion

**Rule:** animate `transform` and `opacity` (compositor-only). Animating `height`/`width`/`top` costs layout on every frame.

```tsx
<div className="transition-all duration-200 ease-out
                motion-reduce:transition-none motion-reduce:animate-none" />
```

150–250ms for local UI, up to 300ms for full-surface transitions. `prefers-reduced-motion` is not optional — some users get motion sick, and the query is one variant away.

## 8. Responsive shell

**Rule:** mobile-first — unprefixed styles are the phone, breakpoints add.

```tsx
<main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

- `max-w-*` + `mx-auto` for measure; body text near 60–75 characters per line.
- `min-w-0` on a flex child is the fix for text that refuses to truncate.
- Images need intrinsic dimensions (or the framework's image component) or the page shifts on load.
