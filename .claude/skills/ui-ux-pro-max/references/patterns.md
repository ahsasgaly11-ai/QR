# Patterns

Copy-adapt these. All examples assume `cn` from `@/lib/utils` and primitives from `@/components/ui`.

## 1. Tokens, not literals

A new color is a token in **both** themes, then a Tailwind mapping.

```css
/* src/app/globals.css */
:root        { --success: 142 71% 35%; --success-foreground: 0 0% 100%; }
.dark        { --success: 142 60% 45%; --success-foreground: 144 60% 8%; }
```

```ts
// tailwind.config.ts → theme.extend.colors
success: {
  DEFAULT: 'hsl(var(--success))',
  foreground: 'hsl(var(--success-foreground))',
},
```

```tsx
<span className="bg-success text-success-foreground">مُفعّل</span>
```

Never `bg-[#16a34a]`, never `dark:bg-[#22c55e]` — the token pair already handles the theme.

## 2. RTL-safe layout

```tsx
// ❌ breaks in Arabic
<div className="flex items-center ml-4 text-left">
  <Icon className="mr-2" />
  <ChevronRight className="ml-auto" />
</div>

// ✅ direction-agnostic
<div className="flex items-center ms-4 text-start">
  <Icon className="me-2" />
  <ChevronRight className="ms-auto rtl:rotate-180" />
</div>
```

Rules:
- `ms/me/ps/pe/start/end/text-start/text-end/border-s/border-e/rounded-s/rounded-e`.
- `gap-*` on a flex/grid parent beats per-child margins — it is direction-agnostic for free.
- Flip only *navigational* icons (chevrons, arrows, back). Never flip: QR codes, logos, numerals, charts with numeric axes, code, play/pause glyphs.
- `dir="rtl"` belongs on `<html>` in the layout, not sprinkled per component.
- Mixed content (an Arabic sentence containing a Latin URL or code) → wrap the Latin run in `<bdi>` so it does not scramble the sentence.

## 3. The five states

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
      <p className="text-sm text-foreground">تعذّر تحميل الأكواد.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
        إعادة المحاولة
      </Button>
    </div>
  );
}

if (!items.length) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <QrCode className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">لا توجد أكواد بعد.</p>
      <Button onClick={onCreate}>إنشاء أول كود</Button>
    </div>
  );
}
```

Skeletons mirror the real layout's shape and height — a skeleton of the wrong height causes a layout jump, which is worse than a spinner.

## 4. Accessible interactive element

```tsx
<Button
  size="icon"
  variant="ghost"
  aria-label="تنزيل الكود"
  onClick={onDownload}
  className="size-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
>
  <Download className="size-4" aria-hidden />
</Button>
```

- Icon-only ⇒ `aria-label` is mandatory; the icon itself is `aria-hidden`.
- ≥44px target (`size-11`). WCAG 2.2 AA floor is 24px; 44px is the usable one on phones.
- Never remove the outline without replacing it with a visible `focus-visible` ring.
- Disabled needs a reason nearby (tooltip or helper text) — a dead control with no explanation is a bug report waiting to happen.

## 5. Form field

```tsx
<FormField
  control={form.control}
  name="url"
  render={({ field }) => (
    <FormItem>
      <FormLabel>الرابط</FormLabel>
      <FormControl>
        <Input
          {...field}
          inputMode="url"
          dir="ltr"
          className="text-start font-code"
          placeholder="https://example.com"
        />
      </FormControl>
      <FormDescription>سيُحوَّل هذا الرابط إلى رمز QR.</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

- Validation lives in the zod schema, messages in Arabic, surfaced by `FormMessage`.
- A URL/email/number input is LTR content inside an RTL page: `dir="ltr"` + `text-start`.
- `inputMode` picks the right mobile keyboard — cheap, high-impact.
- Validate on blur/submit, not on every keystroke; never clear what the user typed.

## 6. Client boundary placement

```tsx
// app/codes/page.tsx — Server Component: fetches, no 'use client'
export default async function CodesPage() {
  const codes = await getCodes();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-headline text-2xl font-bold">أكوادي</h1>
      <CodeList codes={codes} />        {/* server */}
      <CopyButton value={codes[0]?.url} /> {/* the only 'use client' leaf */}
    </main>
  );
}
```

Hoisting `'use client'` to the page drags the whole subtree into the bundle. Push it to the leaf that actually needs state, effects, or handlers.

## 7. Motion

```tsx
<div className="transition-all duration-200 ease-out data-[state=open]:opacity-100
                motion-reduce:transition-none motion-reduce:animate-none" />
```

150–250ms for local UI, up to 300ms for full-surface transitions. Animate `transform` and `opacity` — animating `height`/`top`/`width` costs layout. `tailwindcss-animate` + Radix `data-[state]` attributes cover most cases; the accordion keyframes already in `tailwind.config.ts` are the house pattern.

## 8. Responsive shell

```tsx
<main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

Mobile-first: unprefixed = phone, `sm:`/`lg:` add. `max-w-*` + `mx-auto` for measure; body text stays near 60–75 characters per line. `min-w-0` on a flex child is the fix for text that refuses to truncate.
