# أصول «أسبوع الزكام»

لا توجد نماذج GLB ولا ملفات صوت خارجية: كل شيء مصنوع بالكود في هذا المجلد، إلا صورة الإضاءة البيئية HDR (CC0).

| الأصل | المصدر | الرخصة |
|---|---|---|
| المدرسة والأثاث والنخيل | مجسّمات إجرائية بأشكال three.js (`js/world.js`) | ضمن المشروع |
| الشخصيات الست (هيكل عظمي، IK، تعابير) | إجرائية بالكود (`js/dolls.js`). بحثنا عن شخصيات أطفال CC0 جاهزة، ولم تكن مواقعها متاحة من بيئة البناء | ضمن المشروع |
| عالم «داخل قطرة رذاذ» | إجرائي بعقد TSL (`js/micro.js`) | ضمن المشروع |
| `assets/env/blouberg_sunrise_2_256.hdr` (١٣١ ك.ب) | «Blouberg Sunrise 2» من [Poly Haven](https://polyhaven.com/a/blouberg_sunrise_2) عبر أمثلة three.js (`examples/textures/equirectangular/blouberg_sunrise_2_1k.hdr`)، مصغّرة إلى ٢٥٦×١٢٨ بالأداة `tools/hdr_downscale.py` | CC0 |
| المواد (تيرازو، جص، خشب، مينا، ذهب، زجاج، ورق) | عقد TSL بالضجيج الإجرائي (`js/materials.js`) | ضمن المشروع |
| المشربية، وجه الساعة، رسوم الأطفال، الأيقونات | مرسومة على Canvas بالكود (`js/textures.js`) | ضمن المشروع |
| الرذاذ والجراثيم والقصاصات والغبار الضوئي | جسيمات TSL (`js/particles.js`) | ضمن المشروع |
| الأصوات والموسيقى (مقام البيات، إيقاع الوحدة) | مُركّبة بـ Web Audio (`js/fx.js`) | ضمن المشروع |
| مجسّمات البطاقات العشرون، واللهب والجمرات | إجرائية بالكود (`js/models.js`، `js/ui.js`) | ضمن المشروع |
| `assets/cards/*.webp` | صور مجسّمات البطاقات مُصيَّرة من الطبقة A (`tools/prerender.py`) للطبقة C وللعنصر تحت اليد | ضمن المشروع |
| `assets/c-single.webp`، `assets/c-race.webp` | صور الطبقة C مُصيَّرة من الطبقة A بالأداة `tools/prerender.py` | ضمن المشروع |
| three.js r186.1 والإضافات (`RoomEnvironment`، `RoundedBoxGeometry`، `BloomNode`، `DepthOfFieldNode`، `GaussianBlurNode`، `HDRLoader`) | `/board-kit/vendor/three/` من حزمة npm ‏`three@0.186.1` | MIT © three.js authors |
| خط «المسيري» El Messiri | `/fonts/el-messiri-arabic-26956f.woff2` (موجود في الموقع) | SIL OFL 1.1 |
| رموز البطاقات | رموز Unicode التعبيرية (تُرسم بخط الجهاز) | — |

لا تُصوَّر الطلاب ولا يُحفظ شيء من الكاميرا: الشخصيات كرتونية مخترعة، لا تشبه أحدًا.
