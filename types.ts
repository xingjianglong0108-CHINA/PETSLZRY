
export enum TriageLevel {
  L1 = 1, // 濒危
  L2 = 2, // 危重
  L3 = 3, // 急症
  L4 = 4, // 亚急症
  L5 = 5  // 非急症
}

export interface Symptom {
  id: string;
  name: string;
  level: TriageLevel;
  description?: string;
  helperInfo?: string; // 表3/表4/表5等详细判定标准内容
}

export interface TriageCategory {
  id: string;
  name: string;
  symptoms: Symptom[];
}

export interface TriageResult {
  level: TriageLevel;
  levelName: string;
  responseTime: string;
  zone: string;
  zoneColor: string;
  description: string;
  interventions: string[];
}

export interface VitalSigns {
  temperature: string;
  heartRate: string;
  respRate: string;
  bloodPressure: string;
  spo2: string;
  crt: string;
}

export interface PatientState {
  ageYears: string;
  ageMonths: string;
  ageDays: string;
  weight: string;
  vitals: VitalSigns;
  selectedSymptoms: Set<string>;
  highRiskFactors: Set<string>;
}
