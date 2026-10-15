# ---------------------------------------------------------------------------
# هوية شخصية المترجم: الشكل (أهداف MakeHuman) والألوان. عدّل هنا ثم أعد البناء.
# ---------------------------------------------------------------------------
CHARACTER = {
    # ماكرو MakeHuman: رجل في الثلاثين تقريبًا، بنية متوسّطة، ملامح عربية خليجية
    'macro': {
        'gender': 1.0,
        'age': 0.56,
        'muscle': 0.47,
        'weight': 0.58,
        'height': 0.55,
        'proportions': 0.6,
        'ethnic': {'caucasian': 0.72, 'african': 0.14, 'asian': 0.14},
    },
    # أهداف تفصيلية (مسار داخل targets/ بلا امتداد، وزن)
    'details': [
        ('nose/nose-scale-vert-incr', 0.25),
        ('nose/nose-scale-depth-incr', 0.2),
        ('nose/nose-hump-incr', 0.15),
        ('chin/chin-prominent-incr', 0.2),
        ('chin/chin-width-incr', 0.4),
        ('cheek/l-cheek-bones-incr', 0.2),
        ('cheek/r-cheek-bones-incr', 0.2),
        ('cheek/l-cheek-volume-incr', 0.35),
        ('cheek/r-cheek-volume-incr', 0.35),
        ('eyebrows/eyebrows-trans-down', 0.15),
        ('head/head-oval', 0.15),
        ('head/head-scale-horiz-incr', 0.45),
        ('head/head-scale-vert-incr', 0.25),
        ('head/head-scale-depth-incr', 0.2),
        ('head/head-fat-incr', 0.2),
        ('neck/neck-scale-horiz-incr', 0.45),
        ('neck/neck-scale-depth-incr', 0.3),
        ('torso/torso-scale-horiz-incr', 0.15),
        ('chin/chin-height-incr', 0.15),
        ('mouth/mouth-scale-horiz-incr', 0.1),
    ],
    # ألوان sRGB 0..255
    'skin': (194, 134, 110),  # من الصورة المرجعية (الوجنتان)
    'lips': (150, 80, 78),
    'hair': (40, 28, 20),
    'iris': (70, 44, 24),
    'beard': 0.55,  # ذقن خفيفة كما في الصورة  # كثافة اللحية القصيرة 0..1
    'thobe': (246, 245, 240),
    'ghutra': (250, 250, 250),
    'egal': (18, 18, 20),
}
