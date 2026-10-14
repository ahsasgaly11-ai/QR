/**
 * يوحّد مسار الصفحة بين الخادم والمتصفّح.
 *
 * أثناء التوليد المسبق للصفحة الرئيسية يُعيد usePathname في Next.js مسارًا
 * داخليًا ("/index") بينما يراه المتصفّح "/"، فيختلف ما يرسمه الخادم عمّا
 * يرسمه المتصفّح (زرّ التواصل، الرابط النشط في الترويسة) ويُعاد بناء الصفحة
 * كلّها من جديد (خطأ React #418). هنا نُعيد المسار إلى صورته العامة.
 */
export function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  let p = pathname;
  if (p === '/index' || p === '/index.html') return '/';
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}
