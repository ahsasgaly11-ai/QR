import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * تميمة المنصّة — المها العربي (رمز قطر الوطني) بالهيئة التي اعتمدها المصمّم:
 * درع عنّابي، قرنان حلقيّان، وشارة المستوى الثالث.
 *
 * تُستخدم الصورة الأصلية كما هي بدل رسمها تقريبيًا، حفاظًا على الشخصية نفسها
 * التي يعرفها الطلبة من الكتاب.
 */
export function OryxMascot({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/mascot-oryx.png"
      alt="المها العربي — تميمة منصّة مناهج قطر التفاعلية"
      width={407}
      height={520}
      priority={priority}
      className={cn('select-none object-contain', className)}
      draggable={false}
    />
  );
}
