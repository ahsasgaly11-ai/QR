/**
 * أيقونة تطبيق Documents (Readdle): حرف D أسود بزاوية مطويّة صفراء وخضراء
 * على خلفية بيضاء مستديرة — مرسومة بـSVG لتبقى حادّة بأي حجم وفي الوضع الليلي.
 */
export function DocumentsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="أيقونة تطبيق Documents"
    >
      <defs>
        <linearGradient id="qa-docs-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1f1f3" />
        </linearGradient>
        <linearGradient id="qa-docs-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4fc26a" />
          <stop offset="1" stopColor="#1f8f45" />
        </linearGradient>
        <linearGradient id="qa-docs-yellow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd34d" />
          <stop offset="1" stopColor="#f5a614" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="97" rx="22" fill="url(#qa-docs-bg)" stroke="#d9d9de" strokeWidth="1.5" />
      {/* حرف D (الزاوية العليا اليسرى مطويّة كورقة) */}
      <path
        d="M27 56c13-8 21-20 23-36h-1c17.1 0 30 13.4 30 30S66.1 80 49 80H27Zm15-22v32h2c9.4 0 16-7.2 16-16s-6.6-16-16-16Z"
        fill="#17171a"
        fillRule="evenodd"
        strokeLinejoin="round"
      />
      {/* طيّة الورقة: الوجه الأصفر وظهرها الأخضر */}
      <path d="M27 20h23L27 56Z" fill="url(#qa-docs-yellow)" />
      <path d="M50 20c-2 16-10 28-23 36v-8c10-7 16-16 17-28Z" fill="url(#qa-docs-green)" />
    </svg>
  );
}
