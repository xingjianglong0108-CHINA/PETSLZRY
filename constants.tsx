
import { TriageCategory, TriageLevel, TriageResult } from './types';

export const HIGH_RISK_FACTORS = [
  { id: 'repeat_visit', name: '24h内因同一症状再次就诊 (注2)', upgrade: true },
  { id: 'complex_history', name: '合并高危基础病史 (如先心、免疫缺陷、肿瘤等) (注3)', upgrade: true },
  { 
    id: 'p_severe', 
    name: 'P: 剧烈/严重疼痛 7-10分 (2级)', 
    upgrade: false, 
    helperInfo: 'Wong-Baker 面部表情疼痛量表或数字评定量表 (NRS) 评分 7～10 分。' 
  },
  { id: 'p_moderate', name: 'P: 中度疼痛 4-6分 (3级)', upgrade: false },
  { id: 'p_mild', name: 'P: 轻度疼痛 1-3分 (4级)', upgrade: false },
  { id: 'guardian_anxiety', name: '家长极度焦虑 / 医疗纠纷高风险 (注5)', upgrade: false }
];

export const TRIAGE_CATEGORIES: TriageCategory[] = [
  {
    id: 'temp_age',
    name: '体温与年龄',
    symptoms: [
      { id: 't1', name: '高热伴惊厥 (1级)', level: TriageLevel.L1 },
      { id: 't2', name: '体温≥41℃；体温≤35℃ (2级)', level: TriageLevel.L2, confirmMessage: '本共识体温以耳温测定分级。耳温≤35℃为 2 级，肛温确认；新生儿体温采用腋温、肛温确认，腋温≤36℃（肛温 < 36.5℃）酌情列入 2 级。' },
      { id: 't3', name: '≤24h新生儿 (2级)', level: TriageLevel.L2 },
      { id: 't4', name: '体温≥39℃ (3级)', level: TriageLevel.L3, confirmMessage: '本共识体温以耳温测定分级。耳温 39~41℃为 3 级，其中 < 3 个月婴儿、粒细胞缺乏、免疫缺陷患儿酌情列入 2 级。' },
      { id: 't5', name: '≤3月婴儿 (3级)', level: TriageLevel.L3 },
      { id: 't6', name: '体温≥38.5℃ (4级)', level: TriageLevel.L4 },
      { id: 't7', name: '＞3月婴儿 (4级)', level: TriageLevel.L4 },
      { id: 't8', name: '体温≥38℃ (5级)', level: TriageLevel.L5 }
    ]
  },
  {
    id: 'neuro',
    name: '神经系统',
    symptoms: [
      { id: 'n1', name: '深昏迷 (1级)', level: TriageLevel.L1, confirmMessage: 'G的含义：急诊抢救室评估 1级至2 级患儿儿童改良版格拉斯哥昏迷评分法，GCS 评分≤9 分为 1 级，GCS 评分 10分至13 分为 2 级；3级至5 级无需评分（GCS14分至15 分）' },
      { id: 'n2', name: '惊厥发作 (1级)', level: TriageLevel.L1 },
      { id: 'n3', name: '浅昏迷、嗜睡、烦躁不安（谵妄） (2级)', level: TriageLevel.L2, confirmMessage: 'G的含义：急诊抢救室评估 1级至2 级患儿儿童改良版格拉斯哥昏迷评分法，GCS 评分≤9 分为 1 级，GCS 评分 10分至13 分为 2 级；3级至5 级无需评分（GCS14分至15 分）' },
      { id: 'n4', name: '剧烈头痛 (2级)', level: TriageLevel.L2, confirmMessage: 'P的含义：急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分（Wong-Baker 面部表情疼痛量表 / 数字评定量表）' },
      { id: 'n5', name: '急性瘫痪/松软儿 (2级)', level: TriageLevel.L2 },
      { id: 'n6', name: '精神状态改变；短暂意识不清楚 (3级)', level: TriageLevel.L3 },
      { id: 'n7', name: '惊厥发作后24h (3级)', level: TriageLevel.L3 },
      { id: 'n8', name: '明显头痛 (3级)', level: TriageLevel.L3, confirmMessage: 'P的含义：急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分（Wong-Baker 面部表情疼痛量表 / 数字评定量表）' },
      { id: 'n9', name: '神志清楚、对答切题 (4级)', level: TriageLevel.L4 },
      { id: 'n10', name: '神志清楚对答切题 (5级)', level: TriageLevel.L5 }
    ]
  },
  {
    id: 'resp',
    name: '呼吸系统',
    symptoms: [
      { id: 'r1', name: '重度呼吸窘迫 (1级)', level: TriageLevel.L1, confirmMessage: '重度呼吸窘迫为 1 级：呼吸频率 (表 3:1 级)，发绀，脉速，反应差，吸气性三凹征，鼻扇，呻吟，呼吸音消失或减弱，单字或不说话，上气道梗阻，失去气道保护 (咳嗽、吞咽反射几乎消失)，肌张力低下' },
      { id: 'r2', name: '呼吸停止/呼吸节律异常 (1级)', level: TriageLevel.L1 },
      { id: 'r3', name: 'SpO2 < 90% (1级)', level: TriageLevel.L1 },
      { id: 'r4', name: '危重哮喘急性发作 (1级)', level: TriageLevel.L1 },
      { id: 'r5', name: '气道异物（气道不能维持） (1级)', level: TriageLevel.L1 },
      { id: 'r6', name: '急性喉喘鸣伴Ⅲ°喉梗阻 (1级)', level: TriageLevel.L1 },
      { id: 'r7', name: '中度呼吸窘迫 (2级)', level: TriageLevel.L2, confirmMessage: '中度呼吸窘迫为 2 级：明显气促 (表 3:2 级)，烦躁或易激惹，轻度吸气性三凹征，鼻扇，说短词或短句，呼气延长，喘鸣有气道保护' },
      { id: 'r8', name: 'SpO2 ≤ 94% (2级)', level: TriageLevel.L2 },
      { id: 'r9', name: '重度哮喘急性发作 (2级)', level: TriageLevel.L2 },
      { id: 'r10', name: '气道异物（呼吸窘迫） (2级)', level: TriageLevel.L2 },
      { id: 'r11', name: '明显急性喉喘鸣 (2级)', level: TriageLevel.L2 },
      { id: 'r12', name: '轻度呼吸窘迫 (3级)', level: TriageLevel.L3, confirmMessage: '轻度呼吸窘迫为 3 级：气促 (表 3:3 级)，劳累后气短，呼吸做功无明显增强，说话成句，喘鸣无气道梗阻，时常咳嗽' },
      { id: 'r13', name: 'SpO2 > 94% (3级)', level: TriageLevel.L3 },
      { id: 'r14', name: '中度哮喘急性发作 (3级)', level: TriageLevel.L3 },
      { id: 'r15', name: '气道异物（无呼吸窘迫） (3级)', level: TriageLevel.L3 },
      { id: 'r16', name: '急性喉喘鸣 (3级)', level: TriageLevel.L3 },
      { id: 'r17', name: '无呼吸窘迫 (4级)', level: TriageLevel.L4 },
      { id: 'r18', name: '轻度哮喘急性发作 (4级)', level: TriageLevel.L4 }
    ]
  },
  {
    id: 'circ',
    name: '循环系统',
    symptoms: [
      { id: 'c1', name: '心搏骤停 (1级)', level: TriageLevel.L1 },
      { id: 'c2', name: '严重心律失常 (1级)', level: TriageLevel.L1 },
      { id: 'c3', name: '休克（失代偿） (1级)', level: TriageLevel.L1, confirmMessage: 'C的含义：失代偿性休克为 1 级，严重终末器官灌注不足表现：面色苍白、四肢湿冷、脉搏微弱、明显心动过速或心动过缓 (表 4:1 级)、低血压、通气不足或低氧、体位性晕厥、意识水平下降；也可表现为面色潮红、皮肤发干、肢端暖、脉压差大、烦躁，常见于感染性休克。低血压标准：新生儿收缩压 < 60mmHg，1月至12 个月收缩压 < 70mmHg，1岁至10 岁收缩压 < (70 + 年龄 ×2) mmHg，>10 岁收缩压 < 90mmHg。' },
      { id: 'c4', name: '心力衰竭 (2级)', level: TriageLevel.L2 },
      { id: 'c5', name: '心律失常伴循环稳定 (2级)', level: TriageLevel.L2 },
      { id: 'c6', name: '休克（代偿） (2级)', level: TriageLevel.L2, confirmMessage: 'C的含义：代偿性休克为 2 级：存在组织灌注不良表现如毛细血管充盈时间延长、心动过速 (表 4:2 级)、少尿和面色改变；因机体代偿，可表现为血压正常。' },
      { id: 'c7', name: '严重胸痛、胸闷 (2级)', level: TriageLevel.L2, confirmMessage: 'P的含义：急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分（Wong-Baker 面部表情疼痛量表 / 数字评定量表）' },
      { id: 'c8', name: '高血压伴惊厥、昏迷 (2级)', level: TriageLevel.L2 },
      { id: 'c9', name: '急性心动过速/过缓伴血压正常 (3级)', level: TriageLevel.L3, confirmMessage: 'C的含义：心动过速 / 过缓伴血压正常为 3 级：心率与正常值相差 +/-2 标准差（表 4:3 级）。' },
      { id: 'c10', name: '明显胸痛 (3级)', level: TriageLevel.L3, confirmMessage: 'P的含义：急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分（Wong-Baker 面部表情疼痛量表 / 数字评定量表）' },
      { id: 'c11', name: '循环稳定 (4级)', level: TriageLevel.L4 },
      { id: 'c12', name: '胸痛 (4级)', level: TriageLevel.L4, confirmMessage: 'P的含义：急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分（Wong-Baker 面部表情疼痛量表 / 数字评定量表）' },
      { id: 'c13', name: '循环稳定 (5级)', level: TriageLevel.L5 }
    ]
  },
  {
    id: 'gi',
    name: '消化/泌尿系统',
    symptoms: [
      { id: 'gi1', name: '消化道大出血 (1级)', level: TriageLevel.L1, confirmMessage: 'C的含义：失代偿性休克为 1 级，严重终末器官灌注不足表现：面色苍白、四肢湿冷、脉搏微弱、明显心动过速或心动过缓 (表 4:1 级)、低血压、通气不足或低氧、体位性晕厥、意识水平下降；也可表现为面色潮红、皮肤发干、肢端暖、脉压差大、烦躁，常见于感染性休克。低血压标准：新生儿收缩压 < 60mmHg，1月至12 个月收缩压 < 70mmHg，1岁至10 岁收缩压 < (70 + 年龄 ×2) mmHg，>10 岁收缩压 < 90mmHg。' },
      { id: 'gi2', name: '腹泻、呕吐伴重度脱水/重度脱水，并有生命体重异常 (2级)', level: TriageLevel.L2 },
      { id: 'gi3', name: '活动性消化道出血 (2级)', level: TriageLevel.L2, confirmMessage: 'C的含义：代偿性休克为 2 级：存在组织灌注不良表现如毛细血管充盈时间延长、心动过速 (表 4:2 级)、少尿和面色改变；因机体代偿，可表现为血压正常。' },
      { id: 'gi4', name: '明显腹胀/呕吐/急性腹痛伴生命征异常 (2级)', level: TriageLevel.L2, confirmMessage: 'P含义: 急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分。' },
      { id: 'gi5', name: '消化道异物（性质部位不明/食道/有症状） (2级)', level: TriageLevel.L2 },
      { id: 'gi6', name: '急性肾功能衰竭 (2级)', level: TriageLevel.L2 },
      { id: 'gi7', name: '腹泻、呕吐伴中度脱水 (3级)', level: TriageLevel.L3 },
      { id: 'gi8', name: '急性消化道出血 (3级)', level: TriageLevel.L3, confirmMessage: 'C的含义：心动过速 / 过缓伴血压正常为 3 级：心率与正常值相差 +/-2 标准差（表 4:3 级）。' },
      { id: 'gi9', name: '持续或胆汁性呕吐/急性腹痛 (3级)', level: TriageLevel.L3, confirmMessage: 'P含义: 急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分。' },
      { id: 'gi10', name: '少尿 (3级)', level: TriageLevel.L3 },
      { id: 'gi11', name: '腹泻、呕吐伴轻度脱水 (4级)', level: TriageLevel.L4 },
      { id: 'gi12', name: '腹泻、呕吐不伴脱水 (5级)', level: TriageLevel.L5 }
    ]
  },
  {
    id: 'surg',
    name: '外科/骨科',
    symptoms: [
      { id: 's1', name: '严重多发伤 (1级)', level: TriageLevel.L1 },
      { id: 's2', name: '脏器穿透伤或钝伤合并休克 (1级)', level: TriageLevel.L1 },
      { id: 's3', name: '四肢离断伤/指趾端离断伤 (1级)', level: TriageLevel.L1 },
      { id: 's4', name: '重度烧烫伤伴休克（大于25%体表面积或累及气道） (1级)', level: TriageLevel.L1 },
      { id: 's5', name: '血管神经受累的骨筋膜室综合征 (2级)', level: TriageLevel.L2 },
      { id: 's6', name: '眼外伤眼球损伤 (2级)', level: TriageLevel.L2 },
      { id: 's7', name: '血管神经受累的开放性骨折 (2级)', level: TriageLevel.L2 },
      { id: 's8', name: 'Ⅱ°烧烫伤（＞10%体表面积或面、手足受累） (2级)', level: TriageLevel.L2 },
      { id: 's9', name: '严重睾丸疼痛 (2级)', level: TriageLevel.L2, confirmMessage: 'P的含义: 急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分。' },
      { id: 's10', name: '单侧撕裂伤 (3级)', level: TriageLevel.L3 },
      { id: 's11', name: '血管神经未受累的骨折 (3级)', level: TriageLevel.L3 },
      { id: 's12', name: 'Ⅱ°烧烫伤（＜10%体表面积） (3级)', level: TriageLevel.L3 },
      { id: 's13', name: '睾丸疼痛或肿胀/阴囊外伤 (3级)', level: TriageLevel.L3, confirmMessage: 'P的含义: 急性疼痛程度：剧烈 / 严重疼痛 7分至10 分，中度疼痛 4分至6 分，轻度疼痛 1分至3 分。' },
      { id: 's14', name: 'Ⅰ°烧烫伤 (4级)', level: TriageLevel.L4 }
    ]
  },
  {
    id: 'allergy',
    name: '过敏反应',
    symptoms: [
      { id: 'a1', name: '呼吸窘迫 (1级)', level: TriageLevel.L1 },
      { id: 'a2', name: '过敏性休克 (1级)', level: TriageLevel.L1, actionType: 'epinephrine_calc', confirmMessage: '过敏性休克为 1 级。严重过敏反应伴有血压下降或组织灌注不良。' },
      { id: 'a3', name: '皮肤黏膜广泛皮疹（口唇、结膜） (2级)', level: TriageLevel.L2 },
      { id: 'a4', name: '面部广泛肿胀 (2级)', level: TriageLevel.L2 },
      { id: 'a5', name: '剧烈腹痛、持续呕吐 (2级)', level: TriageLevel.L2 },
      { id: 'a6', name: '广泛皮疹 (3级)', level: TriageLevel.L3 },
      { id: 'a7', name: '局部皮疹、肿胀 (4级)', level: TriageLevel.L4 }
    ]
  },
  {
    id: 'blood',
    name: '血液系统',
    symptoms: [
      { id: 'b1', name: '凝血功能障碍伴全身性大出血 (1级)', level: TriageLevel.L1 },
      { id: 'b2', name: '血小板＜20×10^9/L伴活动性出血 (2级)', level: TriageLevel.L2 },
      { id: 'b3', name: '血小板＜20×10^9/L不伴活动性出血 (3级)', level: TriageLevel.L3 }
    ]
  },
  {
    id: 'other',
    name: '其他',
    symptoms: [
      { id: 'o1', name: '溺水、中毒、触电伴生命体征不稳定 (1级)', level: TriageLevel.L1 },
      { id: 'o2', name: '活动性大出血 (1级)', level: TriageLevel.L1 },
      { id: 'o3', name: '重度贫血 (2级)', level: TriageLevel.L2 },
      { id: 'o4', name: '中度或药物超量 (2级)', level: TriageLevel.L2 },
      { id: 'o5', name: '动物咬伤伴全身中毒症状 (2级)', level: TriageLevel.L2 },
      { id: 'o6', name: '糖尿病酮症酸中毒或低血糖 (2级)', level: TriageLevel.L2 },
      { id: 'o7', name: '活动性出血 (2级)', level: TriageLevel.L2 },
      { id: 'o8', name: '糖尿病（高血糖伴呕吐、腹痛） (3级)', level: TriageLevel.L3 }
    ]
  }
];

export const GCS_CONFIG = {
  eye: [
    { score: 4, label: '自发睁眼 (Spontaneous)' },
    { score: 3, label: '语言吩咐睁眼 (To speech)' },
    { score: 2, label: '疼痛刺激睁眼 (To pain)' },
    { score: 1, label: '无睁眼 (None)' },
  ],
  verbal: [
    { score: 5, label: '啼哭、清醒、正常互动 (Appropriate coo/cry)' },
    { score: 4, label: '啼哭、可安抚、互动减少 (Consolable crying)' },
    { score: 3, label: '不适当的啼哭、哭闹 (Inappropriate/irritable cry)' },
    { score: 2, label: '仅能发出呻吟声 (Moaning)' },
    { score: 1, label: '无发音 (None)' },
  ],
  motor: [
    { score: 6, label: '按吩咐动作 (Obeys commands)' },
    { score: 5, label: '对疼痛定位反应 (Localizes pain)' },
    { score: 4, label: '对疼痛刺激屈曲撤退 (Withdraws from pain)' },
    { score: 3, label: '异常屈曲反应 (去皮层状态)' },
    { score: 2, label: '异常伸展反应 (去脑状态)' },
    { score: 1, label: '无反应 (None)' },
  ]
};

export const WONG_BAKER_CONFIG = [
  { score: 0, label: '无痛', desc: '无痛状态', emoji: '😃', color: 'bg-lime-500' },
  { score: 2, label: '微痛', desc: '轻微疼痛', emoji: '🙂', color: 'bg-yellow-400' },
  { score: 4, label: '有些痛', desc: '中度疼痛', emoji: '😐', color: 'bg-amber-400' },
  { score: 6, label: '很痛', desc: '中度疼痛', emoji: '☹️', color: 'bg-orange-500' },
  { score: 8, label: '疼痛剧烈', desc: '重度疼痛', emoji: '😫', color: 'bg-red-500' },
  { score: 10, label: '疼痛难忍', desc: '极度疼痛', emoji: '😭', color: 'bg-rose-700' }
];

export const PTS_CONFIG = {
  size: [
    { score: 2, label: '> 20 kg' },
    { score: 1, label: '10 - 20 kg' },
    { score: -1, label: '< 10 kg' }
  ],
  airway: [
    { score: 2, label: '正常' },
    { score: 1, label: '可维持' },
    { score: -1, label: '不可维持' }
  ],
  sbp: [
    { score: 2, label: '> 90 mmHg (或脉搏正常)' },
    { score: 1, label: '50 - 90 mmHg (或脉搏微弱)' },
    { score: -1, label: '< 50 mmHg (或无脉搏)' }
  ],
  cns: [
    { score: 2, label: '清醒' },
    { score: 1, label: '迟钝/意识丧失' },
    { score: -1, label: '昏迷/去大脑强直' }
  ],
  skeletal: [
    { score: 2, label: '无骨折' },
    { score: 1, label: '闭合性骨折' },
    { score: -1, label: '开放性/多发骨折' }
  ],
  cutaneous: [
    { score: 2, label: '无损伤' },
    { score: 1, label: '轻微伤' },
    { score: -1, label: '严重/穿透伤' }
  ]
};

export const TRIAGE_RESULT_CONFIG: Record<TriageLevel, TriageResult> = {
  [TriageLevel.L1]: {
    level: TriageLevel.L1,
    levelName: '1级: 濒危',
    responseTime: '立即响应',
    zone: '抢救室 (红区)',
    zoneColor: 'bg-rose-600',
    description: '病情濒危，随时可能危及生命，需立即投入抢救。',
    interventions: ['进入红区', '维持气道/循环', '高级生命支持介入']
  },
  [TriageLevel.L2]: {
    level: TriageLevel.L2,
    levelName: '2级: 危重',
    responseTime: '≤15分钟',
    zone: '抢救室 (红区)',
    zoneColor: 'bg-orange-500',
    description: '病情危重，生命体征不稳定，需尽快救治。',
    interventions: ['安排红区', '心电监护', '建立静脉通路']
  },
  [TriageLevel.L3]: {
    level: TriageLevel.L3,
    levelName: '3级: 急症',
    responseTime: '≤1小时',
    zone: '诊室 (黄区)',
    zoneColor: 'bg-amber-500',
    description: '病情急，潜在恶化风险，需优先处理。',
    interventions: ['黄区诊疗', '重点体征监测', '完善实验室检查']
  },
  [TriageLevel.L4]: {
    level: TriageLevel.L4,
    levelName: '4级: 亚急症',
    responseTime: '≤2小时',
    zone: '候诊区 (绿区)',
    zoneColor: 'bg-emerald-500',
    description: '病情稳定，恶化风险低。',
    interventions: ['绿区候诊', '医生接诊']
  },
  [TriageLevel.L5]: {
    level: TriageLevel.L5,
    levelName: '5级: 非急症',
    responseTime: '≤4小时',
    zone: '普通诊室',
    zoneColor: 'bg-indigo-500',
    description: '症状轻微，建议门诊处理。',
    interventions: ['建议门诊随访', '普通健康指导']
  }
};
