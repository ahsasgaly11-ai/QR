'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Subject } from '@/lib/types';
import {
  DEFAULT_FOOTER_LINKS,
  DOOR_EMBLEMS,
  DOOR_SWATCHES,
  HOME_SECTIONS,
  SITE_TEXT_LIMITS,
  SPECIAL_DOORS,
  isSafeHref,
  type FooterLink,
} from '@/lib/site-texts';
import { DOOR_PAINT, emblemFor, type DoorEmblem } from '@/components/home/door-emblem';
import { cn } from '@/lib/utils';
import { iconBtn, inp, type Draft } from './studio-draft';

type Update = (fn: (d: Draft) => Draft) => void;

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

/** قائمة قابلة للسحب والإفلات، مع أزرار تقديم/تأخير للجوال ولوحة المفاتيح. */
function SortableList<T>({
  items,
  onMove,
  render,
  itemKey,
}: {
  items: T[];
  onMove: (from: number, to: number) => void;
  render: (item: T, i: number) => React.ReactNode;
  itemKey: (item: T, i: number) => string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li
          key={itemKey(item, i)}
          draggable
          onDragStart={(e) => {
            setDrag(i);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(i);
          }}
          onDragLeave={() => setOver((o) => (o === i ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            if (drag !== null) onMove(drag, i);
            setDrag(null);
            setOver(null);
          }}
          onDragEnd={() => {
            setDrag(null);
            setOver(null);
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl border bg-[color:var(--surface)] p-2.5 transition',
            over === i && drag !== i
              ? 'border-[color:var(--maroon)] shadow-[var(--shadow-sm)]'
              : 'border-[color:var(--hairline)]',
            drag === i && 'opacity-50'
          )}
        >
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[color:var(--surface-2)] text-xs font-bold tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">{render(item, i)}</div>
          <button
            className={iconBtn + ' bg-[color:var(--surface-2)]'}
            onClick={() => onMove(i, i - 1)}
            disabled={i === 0}
            aria-label="تقديم"
            title="تقديم"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            className={iconBtn + ' bg-[color:var(--surface-2)]'}
            onClick={() => onMove(i, i + 1)}
            disabled={i === items.length - 1}
            aria-label="تأخير"
            title="تأخير"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** ترتيب أقسام الصفحة الرئيسية وإظهارها — الواجهة الأولى تبقى في الأعلى دائمًا. */
export function OrderPanel({ draft, update }: { draft: Draft; update: Update }) {
  const label = (id: string) => HOME_SECTIONS.find((h) => h.id === id)?.label ?? id;
  const isDefault = draft.order.join('|') === HOME_SECTIONS.map((h) => h.id).join('|');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          اسحب الأقسام لترتيبها كما تظهر في الصفحة الرئيسية من الأعلى إلى الأسفل (أو استخدم
          الأسهم). الواجهة الأولى تبقى في أعلى الصفحة دائمًا.
        </p>
        {!isDefault && (
          <button
            className="btn-ghost btn-sm px-3 py-2 text-sm"
            onClick={() => update((d) => ({ ...d, order: HOME_SECTIONS.map((h) => h.id) }))}
          >
            <RotateCcw className="h-4 w-4" /> الترتيب الأصلي
          </button>
        )}
      </div>
      <SortableList
        items={draft.order}
        itemKey={(id) => id}
        onMove={(from, to) => update((d) => ({ ...d, order: move(d.order, from, to) }))}
        render={(id) => {
          const hidden = draft.hidden.includes(id);
          return (
            <div className="flex items-center gap-2">
              <span className={cn('min-w-0 flex-1 truncate text-sm font-bold', hidden && 'text-muted-foreground line-through')}>
                {label(id)}
                <span className="mr-2 font-normal text-muted-foreground">— {draft.values[`${id}.title`]}</span>
              </span>
              <button
                className={cn('btn-sm px-2.5 py-1 text-xs', hidden ? 'btn-primary' : 'btn-ghost')}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    hidden: hidden ? d.hidden.filter((h) => h !== id) : [...d.hidden, id],
                  }))
                }
              >
                {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {hidden ? 'إظهار' : 'إخفاء'}
              </button>
            </div>
          );
        }}
      />
    </div>
  );
}

/** باب مصغّر للمعاينة بلون النمط المختار */
function DoorSwatch({ color, emblem, title }: { color: string; emblem: DoorEmblem; title: string }) {
  return (
    <span
      className="grid h-14 w-11 shrink-0 place-items-center rounded-t-full border-2 border-black/10 text-[10px] font-bold text-white shadow-inner"
      style={{ background: color }}
      title={`${title} — ${DOOR_EMBLEMS[emblem]}`}
    >
      {emblem === 'letter' ? title.replace(/^ال/, '').charAt(0) : '◆'}
    </span>
  );
}

/** لون باب كل مادة ونقشه، والبابين الخاصّين (الألعاب والعروض). */
export function DoorsPanel({ draft, update, subjects }: { draft: Draft; update: Update; subjects: Subject[] }) {
  const doors = [
    ...subjects.map((s, i) => ({
      id: s.id,
      title: s.title,
      fallback: { color: DOOR_PAINT[i % DOOR_PAINT.length], emblem: emblemFor(s.id) },
    })),
    ...Object.entries(SPECIAL_DOORS).map(([id, d]) => ({
      id,
      title: d.label,
      fallback: { color: d.color, emblem: d.emblem },
    })),
  ];

  const setDoor = (id: string, patch: { color?: string; emblem?: DoorEmblem } | null) =>
    update((d) => {
      const next = { ...d.doors };
      if (patch === null) delete next[id];
      else next[id] = { ...next[id], ...patch };
      return { ...d, doors: next };
    });

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        اختر لون كل باب في «افتح باب المادة» ونقشه. يظهر اللون نفسه في بطاقة المادة بصفحة
        تصفّح المناهج.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {doors.map((door) => {
          const style = draft.doors[door.id];
          const color = style?.color ?? door.fallback.color;
          const emblem = style?.emblem ?? door.fallback.emblem;
          return (
            <li
              key={door.id}
              className="flex gap-3 rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/50 p-3"
            >
              <DoorSwatch color={color} emblem={emblem} title={door.title} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{door.title}</span>
                  {style && (
                    <button
                      className={iconBtn + ' h-7 w-7 bg-[color:var(--surface)]'}
                      onClick={() => setDoor(door.id, null)}
                      title="استعادة اللون والنقش الأصليين"
                      aria-label={`استعادة الأصل: ${door.title}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DOOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition hover:scale-110',
                        c === color ? 'border-foreground' : 'border-transparent'
                      )}
                      style={{ background: c }}
                      onClick={() => setDoor(door.id, { color: c })}
                      aria-label={`اللون ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setDoor(door.id, { color: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="لون مخصّص"
                    title="لون مخصّص"
                  />
                </div>
                <select
                  className={inp + ' py-1.5'}
                  value={emblem}
                  onChange={(e) => setDoor(door.id, { emblem: e.target.value as DoorEmblem })}
                  aria-label="النقش"
                >
                  {(Object.keys(DOOR_EMBLEMS) as DoorEmblem[]).map((k) => (
                    <option key={k} value={k}>
                      {DOOR_EMBLEMS[k]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** روابط «روابط سريعة» في التذييل: نصّها ووجهتها وترتيبها. */
export function FooterPanel({ draft, update }: { draft: Draft; update: Update }) {
  const setLink = (i: number, patch: Partial<FooterLink>) =>
    update((d) => ({ ...d, links: d.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const isDefault = JSON.stringify(draft.links) === JSON.stringify(DEFAULT_FOOTER_LINKS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          الروابط تحت «روابط سريعة» في أسفل كل صفحة. الوجهة رابط داخلي يبدأ بـ «/» مثل{' '}
          <code dir="ltr">/browse</code>، أو رابط خارجي يبدأ بـ <code dir="ltr">https://</code>.
        </p>
        {!isDefault && (
          <button
            className="btn-ghost btn-sm px-3 py-2 text-sm"
            onClick={() => update((d) => ({ ...d, links: DEFAULT_FOOTER_LINKS.map((l) => ({ ...l })) }))}
          >
            <RotateCcw className="h-4 w-4" /> الروابط الأصلية
          </button>
        )}
      </div>
      <SortableList
        items={draft.links}
        itemKey={(_, i) => String(i)}
        onMove={(from, to) => update((d) => ({ ...d, links: move(d.links, from, to) }))}
        render={(l, i) => {
          const bad = l.href.trim() !== '' && !isSafeHref(l.href);
          return (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inp}
                value={l.label}
                maxLength={60}
                placeholder="نص الرابط"
                onChange={(e) => setLink(i, { label: e.target.value })}
              />
              <input
                className={cn(inp, bad && 'border-[color:var(--coral)]')}
                value={l.href}
                maxLength={300}
                placeholder="/browse"
                dir="ltr"
                onChange={(e) => setLink(i, { href: e.target.value })}
                title={bad ? 'رابط غير صالح — سيُتجاهل عند النشر' : undefined}
              />
              <button
                className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                onClick={() => update((d) => ({ ...d, links: d.links.filter((_, j) => j !== i) }))}
                aria-label="حذف الرابط"
                title="حذف الرابط"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        }}
      />
      <button
        className="btn-ghost btn-sm px-4 py-2.5 text-sm"
        disabled={draft.links.length >= SITE_TEXT_LIMITS.footerLinks}
        onClick={() => update((d) => ({ ...d, links: [...d.links, { label: '', href: '/' }] }))}
      >
        <Plus className="h-4 w-4" /> إضافة رابط
      </button>
    </div>
  );
}
