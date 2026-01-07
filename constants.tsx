
import { TriageCategory, TriageLevel, TriageResult } from './types';

export const HIGH_RISK_FACTORS = [
  { id: 'repeat_visit', name: '24h内因同一症状再次就诊 (注2)', upgrade: true },
  { id: 'complex_history', name: '合并高危基础病史 (如先心、免疫缺陷、肿瘤、移植等) (注3)', upgrade: true },
  { 
    id: 'p_severe', 
    name: 'P: 剧烈/严重疼痛 (7-10分) (注4)', 
    upgrade: true, 
    helperInfo: 'Wong-Baker 面部表情疼痛量表或数字评定量表 (NRS) 评分 7～10 分。' 
  },
  { id: 'p_moderate', name: 'P: 中度疼痛 (4-6分)', upgrade: false },
  { id: 'guardian_anxiety', name: '家长极度焦虑 / 医疗纠纷高风险 (注5)', upgrade: false }
];

export const TRIAGE_CATEGORIES: TriageCategory[] = [
  {
    id: 'neuro',
    name: '神经系统',
    symptoms: [
      { id: 'n1', name: 'G: GCS 评分 3~9 分 (1级)', level: TriageLevel.L1, helperInfo: '儿童改良版格拉斯哥昏迷评分 (GCS) 3～9 分。表现为无反应，气道不能维持。' },
      { id: 'n2', name: 'G: GCS 评分 10~13 分 (2级)', level: TriageLevel.L2, helperInfo: '儿童改良版格拉斯哥昏迷评分 (GCS) 10～13 分。生命体征异常，面临生命危险。' },
      { id: 'n3', name: '持续惊厥发作 (1级)', level: TriageLevel.L1 },
      { id: 'n4', name: '嗜睡 / 烦躁不安 / 浅昏迷 (2级)', level: TriageLevel.L2 },
      { id: 'n5', name: '剧烈头痛伴频繁呕吐 (2级)', level: TriageLevel.L2 },
      { id: 'n6', name: '急性瘫痪 / 松软儿 (2级)', level: TriageLevel.L2 },
      { id: 'n8', name: '神志清楚 (GCS 14-15分)', level: TriageLevel.L4 }
    ]
  },
  {
    id: 'resp',
    name: '呼吸系统',
    symptoms: [
      { 
        id: 'r1', 
        name: 'R: 重度呼吸窘迫 (1级)', 
        level: TriageLevel.L1, 
        helperInfo: '【Paediatric CTAS 呼吸分级 - 1级】\n- 呼吸频率(次/min)：>70(<3月); >60(3-12月); >50(1-3岁); >40(4-11岁); >30(>=12岁)\n- 表现：发绀、脉速、反应差、吸气性三凹征、呻吟、单字或不能说话、上气道梗阻。' 
      },
      { 
        id: 'r2', 
        name: 'R: 中度呼吸窘迫 (2级)', 
        level: TriageLevel.L2, 
        helperInfo: '【Paediatric CTAS 呼吸分级 - 2级】\n- 呼吸频率(次/min)：60-70(<3月); 50-60(3-12月); 40-50(1-3岁); 30-40(4-11岁); 20-30(>=12岁)\n- 表现：轻度吸气性三凹征、鼻扇、说短词或短句、呼气延长、喘鸣。' 
      },
      { 
        id: 'r3', 
        name: 'R: 轻度呼吸窘迫 (3级)', 
        level: TriageLevel.L3, 
        helperInfo: '【Paediatric CTAS 呼吸分级 - 3级】\n- 呼吸频率(次/min)：50-60(<3月); 40-50(3-12月); 30-40(1-3岁); 20-30(4-11岁); 15-20(>=12岁)\n- 表现：说话成句、喘鸣无气道梗阻、时常咳嗽。' 
      },
      { id: 'r4', name: 'SpO2 < 90% (1级)', level: TriageLevel.L1 },
      { id: 'r5', name: 'SpO2 90% ~ 94% (2级)', level: TriageLevel.L2 }
    ]
  },
  {
    id: 'circ',
    name: '循环系统',
    symptoms: [
      { 
        id: 'c1', 
        name: 'C: 失代偿性休克 (1级)', 
        level: TriageLevel.L1, 
        helperInfo: '【Paediatric CTAS 心率分级 - 1级】\n- 心率(次/min)：>210或<80(<3月); >190或<80(3-12月); >180或<80(1-3岁); >160或<60(4-11岁); >140或<50(>=12岁)\n- 表现：面色苍白/花斑、四肢湿冷、意识下降。' 
      },
      { 
        id: 'c2', 
        name: 'C: 代偿性休克 (2级)', 
        level: TriageLevel.L2, 
        helperInfo: '【Paediatric CTAS 心率分级 - 2级】\n- 心率(次/min)：180-210(<3月); 170-190(3-12月); 150-180(1-3岁); 130-160(4-11岁); 110-140(>=12岁)\n- 表现：组织灌注不良、CRT 3-5s、心动过速。' 
      },
      { id: 'c3', name: 'C: 心动过速/过缓伴血压正常 (3级)', level: TriageLevel.L3 },
      { id: 'c4', name: '心搏骤停 (1级)', level: TriageLevel.L1 },
      { id: 'c5', name: '活动性大出血 (2级)', level: TriageLevel.L2 }
    ]
  },
  {
    id: 'gi',
    name: '消化系统',
    symptoms: [
      { id: 'gi1', name: '消化道大出血 (1级)', level: TriageLevel.L1 },
      { id: 'gi2', name: '频繁呕吐/脱水 (2级)', level: TriageLevel.L2 },
      { id: 'gi3', name: '轻度脱水 (3级)', level: TriageLevel.L3 },
      { id: 'gi4', name: '急性腹痛 (疑似急腹症) (3级)', level: TriageLevel.L3 },
      { id: 'gi5', name: '无脱水呕吐/腹泻 (4级)', level: TriageLevel.L4 }
    ]
  },
  {
    id: 'surg',
    name: '外科/创伤',
    symptoms: [
      { id: 's1', name: '严重多发伤 (1级)', level: TriageLevel.L1 },
      { id: 's2', name: '骨筋膜室综合征 (2级)', level: TriageLevel.L2 },
      { id: 's3', name: '开放性骨折 (2级)', level: TriageLevel.L2 },
      { id: 's4', name: '单纯骨折 (3级)', level: TriageLevel.L3 },
      { id: 's5', name: '轻微切割伤 (4级)', level: TriageLevel.L4 }
    ]
  },
  {
    id: 'allergy',
    name: '过敏反应',
    symptoms: [
      { id: 'a1', name: '过敏性休克 (1级)', level: TriageLevel.L1 },
      { id: 'a2', name: '广泛皮疹伴呼吸窘迫 (2级)', level: TriageLevel.L2 },
      { id: 'a3', name: '广泛皮疹伴剧烈腹痛 (2级)', level: TriageLevel.L2 },
      { id: 'a4', name: '单纯皮疹 (3级)', level: TriageLevel.L3 }
    ]
  },
  {
    id: 'blood',
    name: '血液/代谢',
    symptoms: [
      { id: 'b1', name: '凝血障碍伴大出血 (1级)', level: TriageLevel.L1 },
      { id: 'b2', name: '血小板极低伴出血 (2级)', level: TriageLevel.L2 },
      { id: 'b3', name: '低血糖伴神志改变 (2级)', level: TriageLevel.L2 },
      { id: 'b4', name: '糖尿病酮症 (2级)', level: TriageLevel.L2 }
    ]
  },
  {
    id: 'toxic',
    name: '中毒及环境',
    symptoms: [
      { id: 'o1', name: '中毒伴生命体征不稳定 (1级)', level: TriageLevel.L1 },
      { id: 'o2', name: '溺水 / 触电 (1级)', level: TriageLevel.L1 },
      { id: 'o3', name: '急性中毒 (生命体征稳定) (2级)', level: TriageLevel.L2 },
      { id: 'o4', name: '动物咬伤伴全身症状 (2级)', level: TriageLevel.L2 },
      { id: 'o5', name: '局部动物咬伤 (3级)', level: TriageLevel.L3 }
    ]
  }
];

export const TRIAGE_RESULT_CONFIG: Record<TriageLevel, TriageResult> = {
  [TriageLevel.L1]: {
    level: TriageLevel.L1,
    levelName: '1级: 濒危',
    responseTime: '立即',
    zone: '抢救室',
    zoneColor: 'bg-red-600',
    description: '病情濒危，随时可能危及生命，需立即投入抢救。',
    interventions: ['进入红区', '气道/呼吸支持', '团队立即介入']
  },
  [TriageLevel.L2]: {
    level: TriageLevel.L2,
    levelName: '2级: 危重',
    responseTime: '≤15min',
    zone: '抢救室',
    zoneColor: 'bg-orange-500',
    description: '病情危重，生命体征不稳定，需尽快救治。',
    interventions: ['安排红区', '医生15min内接诊', '心电监护']
  },
  [TriageLevel.L3]: {
    level: TriageLevel.L3,
    levelName: '3级: 急症',
    responseTime: '≤1h',
    zone: '优先区',
    zoneColor: 'bg-yellow-500',
    description: '病情急，潜在风险，需优先处理。',
    interventions: ['黄区诊疗', '医生1h内接诊']
  },
  [TriageLevel.L4]: {
    level: TriageLevel.L4,
    levelName: '4级: 亚急症',
    responseTime: '≤2h',
    zone: '普通候诊区',
    zoneColor: 'bg-green-500',
    description: '病情稳定，恶化风险低，允许适度候诊。',
    interventions: ['绿区候诊', '医生2h内接诊']
  },
  [TriageLevel.L5]: {
    level: TriageLevel.L5,
    levelName: '5级: 非急症',
    responseTime: '≤4h',
    zone: '普通候诊区',
    zoneColor: 'bg-blue-500',
    description: '症状轻微，无恶化倾向。',
    interventions: ['普通诊查', '建议门诊随访']
  }
};
