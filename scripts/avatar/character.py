# ---------------------------------------------------------------------------
# هوية شخصية المترجم: الشكل (أهداف MakeHuman) والألوان. عدّل هنا ثم أعد البناء.
# ---------------------------------------------------------------------------
CHARACTER = {
    # ماكرو MakeHuman: رجل في الثلاثين تقريبًا، بنية متوسّطة، ملامح عربية خليجية
    'macro': {
        'gender': 1.0,
        'age': 0.56,
        'muscle': 0.47,
        'weight': 0.5,
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
        ('chin/chin-width-incr', 0.15),
        ('cheek/l-cheek-bones-incr', 0.3),
        ('cheek/r-cheek-bones-incr', 0.3),
        ('eyebrows/eyebrows-trans-down', 0.15),
        ('head/head-oval', 0.15),
        ('head/head-scale-horiz-incr', 0.15),
        ('mouth/mouth-scale-horiz-incr', 0.1),
    ],
    # ألوان sRGB 0..255
    'skin': (190, 138, 104),
    'lips': (154, 92, 84),
    'hair': (34, 24, 18),
    'iris': (92, 58, 30),
    'beard': 0.85,  # كثافة اللحية القصيرة 0..1
    'thobe': (246, 245, 240),
    'ghutra': (250, 250, 250),
    'egal': (18, 18, 20),
}
