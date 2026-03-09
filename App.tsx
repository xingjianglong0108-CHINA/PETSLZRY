
import React, { useState, useMemo } from 'react';
import { TRIAGE_CATEGORIES, TRIAGE_RESULT_CONFIG, HIGH_RISK_FACTORS, GCS_CONFIG, PTS_CONFIG, WONG_BAKER_CONFIG } from './constants';
import { TriageLevel, PatientState, TriageResult, VitalSigns, Symptom } from './types';
import { getAIClinicalReport } from './services/geminiService';

const App: React.FC = () => {
  const [patient, setPatient] = useState<PatientState>({
    ageYears: '', ageMonths: '', ageDays: '', weight: '',
    vitals: { temperature: '', heartRate: '', respRate: '', bloodPressure: '', spo2: '', crt: '' },
    selectedSymptoms: new Set(), highRiskFactors: new Set(),
  });
  const [activeTab, setActiveTab] = useState(TRIAGE_CATEGORIES[0].id);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmingSymptom, setConfirmingSymptom] = useState<Symptom | null>(null);
  const [showRefTable, setShowRefTable] = useState<'gcs' | 'sh_table' | 'pts' | 'wong_baker' | null>(null);
  const [wongBakerScore, setWongBakerScore] = useState<number>(0);

  // GCS Calculator State
  const [gcsE, setGcsE] = useState<number>(4);
  const [gcsV, setGcsV] = useState<number | 'T'>(5);
  const [gcsM, setGcsM] = useState<number>(6);
  const gcsTotal = useMemo(() => {
    const vScore = gcsV === 'T' ? 1 : gcsV;
    return gcsE + vScore + gcsM;
  }, [gcsE, gcsV, gcsM]);

  // PTS Calculator State
  const [ptsSize, setPtsSize] = useState<number>(2);
  const [ptsAirway, setPtsAirway] = useState<number>(2);
  const [ptsSbp, setPtsSbp] = useState<number>(2);
  const [ptsCns, setPtsCns] = useState<number>(2);
  const [ptsSkeletal, setPtsSkeletal] = useState<number>(2);
  const [ptsCutaneous, setPtsCutaneous] = useState<number>(2);
  const ptsTotal = useMemo(() => {
    return ptsSize + ptsAirway + ptsSbp + ptsCns + ptsSkeletal + ptsCutaneous;
  }, [ptsSize, ptsAirway, ptsSbp, ptsCns, ptsSkeletal, ptsCutaneous]);

  const gcsClinicalSignificance = useMemo(() => {
    if (gcsTotal === 15) return { label: '清醒', color: 'text-emerald-600' };
    if (gcsTotal >= 13) return { label: '轻度', color: 'text-amber-600' };
    if (gcsTotal >= 9) return { label: '中度', color: 'text-orange-600' };
    return { label: '重度 (严重脑损伤)', color: 'text-rose-600' };
  }, [gcsTotal]);

  const handleAgeChange = (field: keyof Pick<PatientState, 'ageYears' | 'ageMonths' | 'ageDays'>, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setPatient(prev => ({ ...prev, [field]: value }));
  };

  const handleWeightChange = (value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setPatient(prev => ({ ...prev, weight: value }));
  };

  const handleVitalChange = (field: keyof VitalSigns, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setPatient(prev => ({
      ...prev,
      vitals: { ...prev.vitals, [field]: value }
    }));
  };

  const toggleSymptom = (symptom: Symptom) => {
    if (patient.selectedSymptoms.has(symptom.id)) {
      setPatient(prev => {
        const next = new Set(prev.selectedSymptoms);
        next.delete(symptom.id);
        return { ...prev, selectedSymptoms: next };
      });
      return;
    }
    if (symptom.confirmMessage || symptom.helperInfo) {
      setConfirmingSymptom(symptom);
    } else {
      executeToggleSymptom(symptom.id);
    }
  };

  const executeToggleSymptom = (id: string) => {
    setPatient(prev => {
      const next = new Set(prev.selectedSymptoms);
      next.add(id);
      return { ...prev, selectedSymptoms: next };
    });
    setAiReport(null);
    setConfirmingSymptom(null);
  };

  const ptsClinicalSignificance = useMemo(() => {
    if (ptsTotal >= 9) return { label: '轻度创伤', color: 'text-emerald-600', desc: '9-12分：轻度创伤' };
    if (ptsTotal >= 6) return { label: '潜在生命危险', color: 'text-amber-600', desc: '6-8分：潜在生命危险 (注：<8分死亡风险显著增加)' };
    if (ptsTotal >= 0) return { label: '有生命危险', color: 'text-rose-600', desc: '0-5分：有生命危险 (注：<8分死亡风险显著增加)' };
    return { label: '多数死亡', color: 'text-slate-900', desc: '<0分：多数死亡 (注：<8分死亡风险显著增加)' };
  }, [ptsTotal]);

  const applyGcsToTriage = () => {
    setPatient(prev => {
      const next = new Set(prev.selectedSymptoms);
      next.delete('n1'); next.delete('n2'); next.delete('n8');
      if (gcsTotal <= 9) next.add('n1');
      else if (gcsTotal <= 13) next.add('n2');
      else next.add('n8');
      return { ...prev, selectedSymptoms: next };
    });
    setShowRefTable(null);
  };

  const applyPtsToTriage = () => {
    setPatient(prev => {
      const next = new Set(prev.selectedSymptoms);
      if (ptsTotal <= 8) next.add('s1');
      else next.delete('s1');
      return { ...prev, selectedSymptoms: next };
    });
    setShowRefTable(null);
  };

  const applyWongBakerToTriage = () => {
    setPatient(prev => {
      const next = new Set(prev.highRiskFactors);
      next.delete('p_severe');
      next.delete('p_moderate');
      next.delete('p_mild');
      if (wongBakerScore >= 7) next.add('p_severe');
      else if (wongBakerScore >= 4) next.add('p_moderate');
      else if (wongBakerScore >= 1) next.add('p_mild');
      return { ...prev, highRiskFactors: next };
    });
    setShowRefTable(null);
  };

  const isAnaphylaxisActive = useMemo(() => {
    const allergySymptoms = ['a1', 'a2', 'a3', 'a4'];
    return allergySymptoms.some(id => patient.selectedSymptoms.has(id));
  }, [patient.selectedSymptoms]);

  const drugDosages = useMemo(() => {
    const w = parseFloat(patient.weight) || 0;
    const age = parseInt(patient.ageYears) || 0;
    if (w <= 0) return null;
    const epiFinal = Math.min(w * 0.01, 0.3).toFixed(2);
    const mpMin = (w * 1).toFixed(1);
    const mpMax = (w * 2).toFixed(1);
    const hcMin = (w * 2).toFixed(1);
    const hcMax = (w * 4).toFixed(1);
    const antihistamine = age < 6 ? '5 mg' : '10 mg';
    return { epiFinal, mpMin, mpMax, hcMin, hcMax, antihistamine };
  }, [patient.weight, patient.ageYears]);

  const toggleHighRisk = (id: string) => {
    setPatient(prev => {
      const next = new Set(prev.highRiskFactors);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, highRiskFactors: next };
    });
    setAiReport(null);
  };

  const reset = () => {
    setPatient({
      ageYears: '', ageMonths: '', ageDays: '', weight: '',
      vitals: { temperature: '', heartRate: '', respRate: '', bloodPressure: '', spo2: '', crt: '' },
      selectedSymptoms: new Set(), highRiskFactors: new Set(),
    });
    setAiReport(null);
  };

  const triageReason = useMemo(() => {
    const reasons: string[] = [];
    const years = parseInt(patient.ageYears) || 0;
    const months = parseInt(patient.ageMonths) || 0;
    const days = parseInt(patient.ageDays) || 0;
    const totalMonths = (years * 12) + months;
    
    const t = parseFloat(patient.vitals.temperature);
    const rr = parseFloat(patient.vitals.respRate);
    const hr = parseFloat(patient.vitals.heartRate);
    const sbp = parseFloat(patient.vitals.bloodPressure);
    const spo2 = parseFloat(patient.vitals.spo2);
    const crt = parseFloat(patient.vitals.crt);

    // Age Logic
    const hasAgeInput = patient.ageYears !== '' || patient.ageMonths !== '' || patient.ageDays !== '';
    if (hasAgeInput) {
      if (years === 0 && months === 0 && days <= 1) {
        reasons.push("A: ≤24h新生儿 (2级)");
      } else if (totalMonths <= 3) {
        reasons.push("A: ≤3月婴儿 (3级)");
      } else if (totalMonths > 3 && years === 0) {
        reasons.push("A: >3月婴儿 (4级)");
      }
    }

    // Temperature (T) Logic - New Bug Fix
    if (t > 0) {
      // 1级：高热伴惊厥发作为1级 (n3是惊厥发作)
      if (t >= 39 && patient.selectedSymptoms.has('n3')) {
        reasons.push("V: 高热伴惊厥发作 (1级)");
      }
      // 2级：≥41 ℃ 或 ≤35 ℃
      else if (t >= 41 || t <= 35) {
        reasons.push("V: 体温极值 (2级)");
      }
      // 3级：≥39 ℃
      else if (t >= 39) {
        reasons.push("V: 体温 ≥ 39℃ (3级)");
      }
      // 4级：≥38.5 ℃
      else if (t >= 38.5) {
        reasons.push("V: 体温 ≥ 38.5℃ (4级)");
      }
      // 5级：> 38 ℃
      else if (t > 38) {
        reasons.push("V: 体温 > 38℃ (5级)");
      }
    }

    // SpO2 Logic
    if (spo2 > 0) {
      if (spo2 < 90) reasons.push("V: SpO2 < 90% (1级)");
      else if (spo2 <= 94) reasons.push("V: SpO2 90-94% (2级)");
      else if (spo2 <= 97) reasons.push("V: SpO2 95-97% (3级)");
      else reasons.push("V: SpO2 98-100% (4级)");
    }
    
    // CRT Logic
    if (crt > 0) {
      if (crt > 5) reasons.push("C: CRT > 5s (1级)");
      else if (crt >= 3) reasons.push("C: CRT 3-5s (2级)");
      else if (crt >= 2) reasons.push("C: CRT 2-3s (3级)");
      else reasons.push("C: CRT < 2s (4级)");
    }

    // BP (Hypotension) Logic
    if (sbp > 0) {
      let isHypo = false;
      if (years === 0 && months === 0 && days <= 28 && sbp < 60) isHypo = true;
      else if (totalMonths <= 12 && sbp < 70) isHypo = true;
      else if (years >= 1 && years <= 10 && sbp < (70 + years * 2)) isHypo = true;
      else if (years > 10 && sbp < 90) isHypo = true;
      if (isHypo) reasons.push("C: 低血压 (1级)");
    }

    // RR Logic
    if (rr > 0 && hasAgeInput) {
      if (totalMonths < 3) {
        if (rr > 70 || rr < 10) reasons.push(`R: 呼吸异常 ${rr} (1级)`);
        else if (rr >= 60 || rr < 15) reasons.push(`R: 呼吸异常 ${rr} (2级)`);
        else if (rr >= 50 || rr < 20) reasons.push(`R: 呼吸异常 ${rr} (3级)`);
        else if (rr >= 40) reasons.push(`R: 呼吸轻度增快 ${rr} (4级)`);
        else reasons.push(`R: 呼吸正常 ${rr} (5级)`);
      } else if (totalMonths < 12) {
        if (rr > 60 || rr < 10) reasons.push(`R: 呼吸异常 ${rr} (1级)`);
        else if (rr >= 50 || rr < 15) reasons.push(`R: 呼吸异常 ${rr} (2级)`);
        else if (rr >= 40 || rr < 20) reasons.push(`R: 呼吸异常 ${rr} (3级)`);
        else if (rr >= 30) reasons.push(`R: 呼吸轻度增快 ${rr} (4级)`);
        else reasons.push(`R: 呼吸正常 ${rr} (5级)`);
      } else if (totalMonths < 48) { // 1-3 years
        if (rr > 50 || rr < 10) reasons.push(`R: 呼吸异常 ${rr} (1级)`);
        else if (rr >= 40 || rr < 15) reasons.push(`R: 呼吸异常 ${rr} (2级)`);
        else if (rr >= 30 || rr < 20) reasons.push(`R: 呼吸异常 ${rr} (3级)`);
        else if (rr >= 25) reasons.push(`R: 呼吸轻度增快 ${rr} (4级)`);
        else reasons.push(`R: 呼吸正常 ${rr} (5级)`);
      } else if (totalMonths < 144) { // 4-11 years
        if (rr > 40 || rr < 8) reasons.push(`R: 呼吸异常 ${rr} (1级)`);
        else if (rr >= 30 || rr < 12) reasons.push(`R: 呼吸异常 ${rr} (2级)`);
        else if (rr >= 20 || rr < 15) reasons.push(`R: 呼吸异常 ${rr} (3级)`);
        else if (rr >= 18) reasons.push(`R: 呼吸轻度增快 ${rr} (4级)`);
        else reasons.push(`R: 呼吸正常 ${rr} (5级)`);
      } else { // >= 12 years
        if (rr > 30 || rr < 8) reasons.push(`R: 呼吸异常 ${rr} (1级)`);
        else if (rr >= 20 || rr < 12) reasons.push(`R: 呼吸异常 ${rr} (2级)`);
        else if (rr >= 15 || rr < 14) reasons.push(`R: 呼吸异常 ${rr} (3级)`);
        else if (rr >= 13) reasons.push(`R: 呼吸轻度增快 ${rr} (4级)`);
        else reasons.push(`R: 呼吸正常 ${rr} (5级)`);
      }
    }

    // HR Logic
    if (hr > 0 && hasAgeInput) {
      if (totalMonths < 3) {
        if (hr > 210 || hr < 80) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 180 || hr < 90) reasons.push(`H: 心率异常 ${hr} (2级)`);
        else if (hr >= 110 || hr < 100) reasons.push(`H: 心率异常 ${hr} (3级)`);
        else if (hr >= 100) reasons.push(`H: 心率轻度增快 ${hr} (4级)`);
        else reasons.push(`H: 心率正常 ${hr} (5级)`);
      } else if (totalMonths < 12) {
        if (hr > 190 || hr < 80) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 170 || hr < 90) reasons.push(`H: 心率异常 ${hr} (2级)`);
        else if (hr >= 110 || hr < 100) reasons.push(`H: 心率异常 ${hr} (3级)`);
        else if (hr >= 100) reasons.push(`H: 心率轻度增快 ${hr} (4级)`);
        else reasons.push(`H: 心率正常 ${hr} (5级)`);
      } else if (totalMonths < 48) { // 1-3 years
        if (hr > 180 || hr < 80) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 150 || hr < 90) reasons.push(`H: 心率异常 ${hr} (2级)`);
        else if (hr >= 100 || hr < 100) reasons.push(`H: 心率异常 ${hr} (3级)`);
        else if (hr >= 90) reasons.push(`H: 心率轻度增快 ${hr} (4级)`);
        else reasons.push(`H: 心率正常 ${hr} (5级)`);
      } else if (totalMonths < 144) { // 4-11 years
        if (hr > 160 || hr < 60) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 130 || hr < 65) reasons.push(`H: 心率异常 ${hr} (2级)`);
        else if (hr >= 70 || hr < 70) reasons.push(`H: 心率异常 ${hr} (3级)`);
        else if (hr >= 65) reasons.push(`H: 心率轻度增快 ${hr} (4级)`);
        else reasons.push(`H: 心率正常 ${hr} (5级)`);
      } else { // >= 12 years
        if (hr > 140 || hr < 50) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 110 || hr < 55) reasons.push(`H: 心率异常 ${hr} (2级)`);
        else if (hr >= 60 || hr < 60) reasons.push(`H: 心率异常 ${hr} (3级)`);
        else if (hr >= 55) reasons.push(`H: 心率轻度增快 ${hr} (4级)`);
        else reasons.push(`H: 心率正常 ${hr} (5级)`);
      }
    }

    patient.selectedSymptoms.forEach(id => {
      TRIAGE_CATEGORIES.forEach(cat => {
        const sym = cat.symptoms.find(s => s.id === id);
        if (sym) reasons.push(sym.name);
      });
    });
    
    patient.highRiskFactors.forEach(id => {
      const factor = HIGH_RISK_FACTORS.find(f => f.id === id);
      if (factor) reasons.push(factor.name);
    });
    
    return reasons;
  }, [patient]);

  const currentTriage = useMemo((): TriageResult => {
    let baseLevel = 5;
    
    // 基础症状等级
    patient.selectedSymptoms.forEach(id => {
      TRIAGE_CATEGORIES.forEach(cat => {
        const sym = cat.symptoms.find(s => s.id === id);
        if (sym) baseLevel = Math.min(baseLevel, sym.level);
      });
    });

    // 体征计算等级
    if (triageReason.some(r => r.includes("(1级)"))) baseLevel = Math.min(baseLevel, 1);
    else if (triageReason.some(r => r.includes("(2级)"))) baseLevel = Math.min(baseLevel, 2);
    else if (triageReason.some(r => r.includes("(3级)"))) baseLevel = Math.min(baseLevel, 3);
    else if (triageReason.some(r => r.includes("(4级)"))) baseLevel = Math.min(baseLevel, 4);

    // 风险升级逻辑
    const shouldUpgrade = Array.from(patient.highRiskFactors).some(id => 
      HIGH_RISK_FACTORS.find(f => f.id === id)?.upgrade
    );
    if (shouldUpgrade && baseLevel > 1) baseLevel -= 1;

    return TRIAGE_RESULT_CONFIG[baseLevel as TriageLevel];
  }, [patient, triageReason]);

  const handleGenerateReport = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const symptomsList: string[] = [];
    TRIAGE_CATEGORIES.forEach(cat => {
      cat.symptoms.forEach(s => { if (patient.selectedSymptoms.has(s.id)) symptomsList.push(s.name); });
    });
    const report = await getAIClinicalReport(
      { years: patient.ageYears, months: patient.ageMonths, days: patient.ageDays },
      patient.weight, patient.vitals, symptomsList, currentTriage.levelName
    );
    setAiReport(report || "生成失败");
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto font-sans text-slate-900 bg-[#f8faff] selection:bg-indigo-100">
      
      {/* Helper Modal */}
      {confirmingSymptom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[32px] w-full max-w-sm shadow-2xl border border-white/50 ring-1 ring-black/5 overflow-hidden">
            <div className="p-6 bg-indigo-600/90 text-white flex items-center gap-3">
              <i className="fas fa-stethoscope text-lg"></i>
              <span className="text-lg font-bold">医学决策核对</span>
            </div>
            <div className="p-8">
              <p className="text-base font-black text-slate-800 mb-4">{confirmingSymptom.name}</p>
              <div className="p-5 bg-black/5 rounded-[24px] mb-6 text-[11px] font-semibold text-slate-500 leading-relaxed italic">
                {confirmingSymptom.confirmMessage || confirmingSymptom.helperInfo}
              </div>
              
              {confirmingSymptom.actionType === 'epinephrine_calc' && (
                <div className="mb-8 p-5 bg-rose-50 border border-rose-100 rounded-[24px]">
                  <h4 className="text-rose-800 font-bold mb-2 flex items-center gap-2">
                    <i className="fas fa-syringe"></i> 肾上腺素 (1:1000) 剂量计算
                  </h4>
                  {patient.weight ? (
                    <div className="text-sm text-rose-700">
                      <p>体重: <strong>{patient.weight} kg</strong></p>
                      <p>推荐剂量 (0.01mg/kg): <strong className="text-lg">{Math.min(parseFloat(patient.weight) * 0.01, 0.5).toFixed(2)} mg</strong></p>
                      <p className="text-xs mt-1 opacity-80">(单次最大剂量 0.5mg，大腿前外侧肌肉注射)</p>
                    </div>
                  ) : (
                    <div className="text-sm text-rose-600">
                      <i className="fas fa-exclamation-circle mr-1"></i> 请先在上方输入患儿体重以计算推荐剂量。
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setConfirmingSymptom(null)} className="flex-1 py-4 bg-white/60 text-slate-500 rounded-2xl text-sm font-bold border border-white transition-all active:scale-95">取消</button>
                <button onClick={() => {
                  executeToggleSymptom(confirmingSymptom.id);
                  setConfirmingSymptom(null);
                }} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95">确认符合</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-[15px] flex items-center justify-center text-white shadow-xl">
            <i className="fas fa-paw"></i>
          </div>
          <h1 className="text-3xl font-[900] text-slate-900 tracking-tighter">PETS<span className="text-indigo-600">.</span></h1>
        </div>
        <div className="flex gap-2 bg-white/80 backdrop-blur p-1.5 rounded-2xl border border-white shadow-sm">
          <button onClick={() => setShowRefTable('gcs')} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black">GCS评分</button>
          <button onClick={() => setShowRefTable('pts')} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black">创伤评分</button>
          <button onClick={() => setShowRefTable('wong_baker')} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black">疼痛评分</button>
          <button onClick={() => setShowRefTable('sh_table')} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black">参考表</button>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Patient Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/70 backdrop-blur rounded-[36px] shadow-sm border border-white/60 p-8">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">患者基础录入</span>
              <button onClick={reset} className="text-slate-300 hover:text-rose-500"><i className="fas fa-undo-alt text-xs"></i></button>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {['ageYears', 'ageMonths', 'ageDays', 'weight'].map((key) => (
                <div key={key}>
                  <label className="block text-[9px] font-black text-slate-400 mb-2 uppercase">{key.replace('age', '').replace('Years','岁').replace('Months','月').replace('Days','天').replace('weight','体重kg')}</label>
                  <input type="text" value={(patient as any)[key]} onChange={(e) => key === 'weight' ? handleWeightChange(e.target.value) : handleAgeChange(key as any, e.target.value)} placeholder="-" className="w-full h-12 bg-white border border-slate-100 rounded-2xl text-center text-sm font-black focus:ring-2 focus:ring-indigo-100 outline-none shadow-inner" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'temperature', label: 'T (°C)' }, { id: 'heartRate', label: 'HR (bpm)' }, { id: 'respRate', label: 'RR (bpm)' },
                { id: 'bloodPressure', label: 'SBP (mmHg)' }, { id: 'spo2', label: 'SpO2 (%)' }, { id: 'crt', label: 'CRT (s)' },
              ].map((vital) => (
                <div key={vital.id}>
                  <label className="block text-[9px] font-black text-slate-400 mb-2 uppercase">{vital.label}</label>
                  <input type="text" value={patient.vitals[vital.id as keyof VitalSigns]} onChange={(e) => handleVitalChange(vital.id as keyof VitalSigns, e.target.value)} placeholder="-" className="w-full h-12 bg-white border border-slate-100 rounded-2xl text-center text-sm font-black focus:ring-2 focus:ring-indigo-100 outline-none shadow-inner" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 rounded-[32px] border border-amber-100 p-6">
            <p className="text-[10px] font-black text-amber-600 uppercase mb-4 tracking-widest flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i> 风险调节因子</p>
            <div className="grid grid-cols-2 gap-3">
              {HIGH_RISK_FACTORS.map(f => (
                <button key={f.id} onClick={() => f.helperInfo ? setConfirmingSymptom(f as any) : toggleHighRisk(f.id)} className={`p-4 rounded-2xl border text-[10px] text-left transition-all ${patient.highRiskFactors.has(f.id) ? 'bg-amber-200 border-amber-300 text-amber-900 font-bold' : 'bg-white border-white text-slate-500 shadow-sm'}`}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Symptom Selector with 2-Row Tabs */}
          <div className="bg-white/70 backdrop-blur rounded-[40px] shadow-sm border border-white overflow-hidden">
            <div className="p-2 grid grid-cols-4 gap-2 bg-slate-50">
              {TRIAGE_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveTab(cat.id)} className={`py-3 px-2 rounded-xl text-[10px] font-black leading-tight h-12 flex items-center justify-center text-center ${activeTab === cat.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-white'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="p-6 grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {TRIAGE_CATEGORIES.find(c => c.id === activeTab)?.symptoms.map(sym => (
                <button key={sym.id} onClick={() => toggleSymptom(sym)} className={`w-full text-left px-6 py-4 rounded-2xl border transition-all flex items-center justify-between ${patient.selectedSymptoms.has(sym.id) ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-black' : 'border-slate-50 bg-white text-slate-600 hover:border-indigo-100 shadow-sm'}`}>
                  <span className="text-xs font-bold">{sym.name}</span>
                  <i className={`fas ${patient.selectedSymptoms.has(sym.id) ? 'fa-check-circle text-indigo-600' : 'fa-plus-circle text-slate-100'} text-sm`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Flow */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`rounded-[48px] p-10 shadow-2xl text-white relative overflow-hidden transition-all duration-700 ${currentTriage.zoneColor}`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">分诊分级结果</div>
                  <h2 className="text-4xl font-[900] mb-3 tracking-tighter">{currentTriage.levelName}</h2>
                  <div className="inline-flex items-center gap-2 bg-black/10 px-4 py-2 rounded-xl border border-white/10">
                    <span className="text-[10px] font-black">时限: {currentTriage.responseTime}</span>
                  </div>
                </div>
                {/* AI Button - Simplified Icon Version */}
                <button 
                  onClick={handleGenerateReport} 
                  disabled={isGenerating} 
                  className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 transition-all active:scale-90 hover:bg-white/30 shadow-xl"
                  title="获取AI深度临床建议"
                >
                   {isGenerating ? <i className="fas fa-sync animate-spin text-lg"></i> : <i className="fas fa-brain text-lg"></i>}
                </button>
              </div>

              <div className="p-6 bg-white/10 rounded-[24px] border border-white/10 mb-8 text-sm font-bold italic">
                "{currentTriage.description}"
              </div>

              <div className="space-y-3">
                {currentTriage.interventions.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl text-xs font-bold border border-white/5">
                    <span className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center text-[9px] font-black">{idx + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {triageReason.length > 0 ? triageReason.map((r, i) => (
              <span key={i} className="px-3 py-1.5 bg-white text-slate-500 rounded-xl text-[10px] font-black border border-slate-100 shadow-sm flex items-center gap-2">
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                {r}
              </span>
            )) : <span className="text-[10px] text-slate-300 italic font-medium">无危急值预警</span>}
          </div>

          {aiReport && (
            <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center"><i className="fas fa-magic text-white text-sm"></i></div>
                  <span className="text-xs font-black uppercase text-slate-800">AI 临床分析建议</span>
                </div>
                <button onClick={() => setAiReport(null)} className="text-slate-200 hover:text-rose-500"><i className="fas fa-times-circle text-lg"></i></button>
              </div>
              <div className="prose prose-slate max-w-none text-[11px] font-bold text-slate-600 whitespace-pre-wrap leading-relaxed">
                {aiReport}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlays for score tools */}
      {showRefTable && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/10 backdrop-blur animate-in fade-in">
           <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden p-8 border border-white">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-black text-slate-800">
                    {showRefTable === 'gcs' ? 'GCS 评分计算' : showRefTable === 'pts' ? '创伤评分' : showRefTable === 'wong_baker' ? 'Wong-Baker 疼痛评分' : '体征分级参考表'}
                 </h3>
                 <button onClick={() => setShowRefTable(null)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-times-circle text-2xl"></i></button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar text-[11px] font-bold text-slate-600 space-y-4">
                  {showRefTable === 'sh_table' ? (
                    <div className="space-y-6">
                       <div>
                          <p className="text-indigo-600 font-black mb-2 uppercase">病情分级标准 (专家共识)</p>
                          <ul className="space-y-1 text-[10px] list-disc list-inside">
                             <li>1级：濒危 (立即响应)，生命体征极不稳定</li>
                             <li>2级：危重 (≤15min)，生命体征不稳定</li>
                             <li>3级：急症 (≤1h)，生命体征稳定，潜在风险</li>
                             <li>4级：亚急症 (≤2h)，病情稳定</li>
                             <li>5级：非急症 (≤4h)，症状轻微</li>
                          </ul>
                       </div>
                       <div className="h-px bg-slate-100"></div>
                       <div>
                          <p className="text-indigo-600 font-black mb-2 uppercase">生理指标异常分级 (表3)</p>
                          <div className="overflow-x-auto">
                             <table className="w-full text-[9px] border-collapse border border-slate-200">
                                <thead>
                                   <tr className="bg-slate-50">
                                      <th className="border border-slate-200 p-1">年龄</th>
                                      <th className="border border-slate-200 p-1">1级</th>
                                      <th className="border border-slate-200 p-1">2级</th>
                                      <th className="border border-slate-200 p-1">3级</th>
                                      <th className="border border-slate-200 p-1">4级</th>
                                      <th className="border border-slate-200 p-1">5级</th>
                                   </tr>
                                </thead>
                                <tbody>
                                   <tr>
                                      <td className="border border-slate-200 p-1">&lt;3月</td>
                                      <td className="border border-slate-200 p-1">RR&gt;70 or &lt;10<br/>HR&gt;210 or &lt;80</td>
                                      <td className="border border-slate-200 p-1">RR 60-70 or 10-15<br/>HR 180-210 or 80-90</td>
                                      <td className="border border-slate-200 p-1">RR 50-59 or 15-20<br/>HR 110-179 or 90-100</td>
                                      <td className="border border-slate-200 p-1">RR 40-49<br/>HR 100-109</td>
                                      <td className="border border-slate-200 p-1">RR 25-40<br/>HR 100-180</td>
                                   </tr>
                                   <tr>
                                      <td className="border border-slate-200 p-1">3-12月</td>
                                      <td className="border border-slate-200 p-1">RR&gt;60 or &lt;10<br/>HR&gt;190 or &lt;80</td>
                                      <td className="border border-slate-200 p-1">RR 50-60 or 10-15<br/>HR 170-190 or 80-90</td>
                                      <td className="border border-slate-200 p-1">RR 40-49 or 15-20<br/>HR 110-169 or 90-100</td>
                                      <td className="border border-slate-200 p-1">RR 30-39<br/>HR 100-109</td>
                                      <td className="border border-slate-200 p-1">RR 20-30<br/>HR 100-160</td>
                                   </tr>
                                   <tr>
                                      <td className="border border-slate-200 p-1">1-3岁</td>
                                      <td className="border border-slate-200 p-1">RR&gt;50 or &lt;10<br/>HR&gt;180 or &lt;80</td>
                                      <td className="border border-slate-200 p-1">RR 40-50 or 10-15<br/>HR 150-180 or 80-90</td>
                                      <td className="border border-slate-200 p-1">RR 30-39 or 15-20<br/>HR 100-149 or 90-100</td>
                                      <td className="border border-slate-200 p-1">RR 25-29<br/>HR 90-99</td>
                                      <td className="border border-slate-200 p-1">RR 20-25<br/>HR 90-150</td>
                                   </tr>
                                   <tr>
                                      <td className="border border-slate-200 p-1">4-11岁</td>
                                      <td className="border border-slate-200 p-1">RR&gt;40 or &lt;8<br/>HR&gt;160 or &lt;60</td>
                                      <td className="border border-slate-200 p-1">RR 30-40 or 8-12<br/>HR 130-160 or 60-65</td>
                                      <td className="border border-slate-200 p-1">RR 20-29 or 12-15<br/>HR 70-129 or 65-70</td>
                                      <td className="border border-slate-200 p-1">RR 18-19<br/>HR 65-69</td>
                                      <td className="border border-slate-200 p-1">RR 14-18<br/>HR 70-120</td>
                                   </tr>
                                   <tr>
                                      <td className="border border-slate-200 p-1">≥12岁</td>
                                      <td className="border border-slate-200 p-1">RR&gt;30 or &lt;8<br/>HR&gt;140 or &lt;50</td>
                                      <td className="border border-slate-200 p-1">RR 20-30 or 8-12<br/>HR 110-140 or 50-55</td>
                                      <td className="border border-slate-200 p-1">RR 15-19 or 12-14<br/>HR 60-109 or 55-60</td>
                                      <td className="border border-slate-200 p-1">RR 13-14<br/>HR 55-59</td>
                                      <td className="border border-slate-200 p-1">RR 12-14<br/>HR 60-100</td>
                                   </tr>
                                </tbody>
                             </table>
                          </div>
                       </div>
                    </div>
                 ) : showRefTable === 'gcs' ? (
                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                           <div>
                              <p className="text-xs font-black text-indigo-600">儿童改良版 GCS 评分</p>
                              <p className="text-[10px] opacity-50 italic">请根据患儿反应选择...</p>
                           </div>
                           <div className="text-right">
                              <div className={`text-xs font-black ${gcsClinicalSignificance.color}`}>{gcsClinicalSignificance.label}</div>
                              <div className="text-2xl font-black text-slate-900">{gcsTotal}{gcsV === 'T' ? 'T' : ''} <span className="text-xs font-normal opacity-30">/ 15</span></div>
                           </div>
                        </div>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Minimal GCS Inputs */}
                          <div className="space-y-2">
                             <p className="text-[10px] uppercase font-black text-slate-400">睁眼反应 (E)</p>
                             {GCS_CONFIG.eye.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setGcsE(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${gcsE === item.score ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${gcsE === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score}</span>
                                </button>
                              ))}
                          </div>
                           <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                 <p className="text-[10px] uppercase font-black text-slate-400">语言反应 (V)</p>
                                 <button 
                                    onClick={() => setGcsV(prev => prev === 'T' ? 5 : 'T')}
                                    className={`text-[9px] px-1.5 py-0.5 rounded border font-bold transition-colors ${gcsV === 'T' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
                                 >
                                    气管插管 (T)
                                 </button>
                              </div>
                              {gcsV === 'T' ? (
                                 <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-center">
                                    <p className="text-[10px] text-rose-600 font-bold">已标记为气管插管 (T)</p>
                                    <p className="text-[9px] text-rose-400 mt-1">语言评分记为 1 分</p>
                                 </div>
                              ) : (
                                 GCS_CONFIG.verbal.map(item => (
                                    <button 
                                      key={item.score} 
                                      onClick={() => setGcsV(item.score)} 
                                      className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${gcsV === item.score ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                      <span className="flex-1 leading-tight">{item.label}</span>
                                      <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${gcsV === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score}</span>
                                    </button>
                                 ))
                              )}
                           </div>
                           <div className="space-y-2">
                              <p className="text-[10px] uppercase font-black text-slate-400">运动反应 (M)</p>
                              {GCS_CONFIG.motor.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setGcsM(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${gcsM === item.score ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${gcsM === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score}</span>
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-[9px] text-slate-400 leading-relaxed">
                              <span className="font-bold text-slate-500">临床意义：</span>
                              满分15分(清醒)；轻度13-14分；中度9-12分；重度≤8分(严重脑损伤，通常需插管通气)。
                           </p>
                        </div>
                       <button onClick={applyGcsToTriage} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 transition-transform active:scale-[0.98]">
                           同步总分: {gcsTotal}{gcsV === 'T' ? 'T' : ''}
                        </button>
                    </div>
                 ) : showRefTable === 'pts' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                           <div>
                              <p className="text-xs font-black text-rose-600">儿童创伤评分 (PTS)</p>
                              <p className="text-[10px] opacity-50 italic">请根据患儿情况选择...</p>
                           </div>
                           <div className="text-right">
                              <div className={`text-xs font-black ${ptsClinicalSignificance.color}`}>{ptsClinicalSignificance.label}</div>
                              <div className="text-2xl font-black text-slate-900">{ptsTotal} <span className="text-xs font-normal opacity-30">/ 12</span></div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <p className="text-[10px] uppercase font-black text-slate-400">体重 (Size)</p>
                              {PTS_CONFIG.size.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setPtsSize(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${ptsSize === item.score ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${ptsSize === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score > 0 ? `+${item.score}` : item.score}</span>
                                </button>
                              ))}
                           </div>
                           <div className="space-y-2">
                              <p className="text-[10px] uppercase font-black text-slate-400">气道 (Airway)</p>
                              {PTS_CONFIG.airway.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setPtsAirway(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${ptsAirway === item.score ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${ptsAirway === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score > 0 ? `+${item.score}` : item.score}</span>
                                </button>
                              ))}
                           </div>
                           <div className="space-y-2">
                              <p className="text-[10px] uppercase font-black text-slate-400">收缩压 (SBP)</p>
                              {PTS_CONFIG.sbp.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setPtsSbp(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${ptsSbp === item.score ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${ptsSbp === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score > 0 ? `+${item.score}` : item.score}</span>
                                </button>
                              ))}
                           </div>
                           <div className="space-y-2">
                              <p className="text-[10px] uppercase font-black text-slate-400">中枢神经 (CNS)</p>
                              {PTS_CONFIG.cns.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setPtsCns(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${ptsCns === item.score ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${ptsCns === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score > 0 ? `+${item.score}` : item.score}</span>
                                </button>
                              ))}
                           </div>
                           <div className="space-y-2">
                              <p className="text-[10px] uppercase font-black text-slate-400">骨骼 (Skeletal)</p>
                              {PTS_CONFIG.skeletal.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setPtsSkeletal(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${ptsSkeletal === item.score ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${ptsSkeletal === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score > 0 ? `+${item.score}` : item.score}</span>
                                </button>
                              ))}
                           </div>
                           <div className="space-y-2">
                              <p className="text-[10px] uppercase font-black text-slate-400">皮肤 (Cutaneous)</p>
                              {PTS_CONFIG.cutaneous.map(item => (
                                <button 
                                  key={item.score} 
                                  onClick={() => setPtsCutaneous(item.score)} 
                                  className={`w-full p-2 rounded-xl text-[10px] border flex justify-between items-center text-left transition-all ${ptsCutaneous === item.score ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}
                                >
                                  <span className="flex-1 leading-tight">{item.label}</span>
                                  <span className={`ml-2 font-black px-1.5 py-0.5 rounded ${ptsCutaneous === item.score ? 'bg-white/20' : 'bg-slate-100'}`}>{item.score > 0 ? `+${item.score}` : item.score}</span>
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-[9px] text-slate-400 leading-relaxed">
                              <span className="font-bold text-slate-500">临床意义：</span>
                              {ptsClinicalSignificance.desc}。
                           </p>
                        </div>
                        <button onClick={applyPtsToTriage} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-100 transition-transform active:scale-[0.98]">
                           同步总分: {ptsTotal}
                        </button>
                    </div>
                 ) : showRefTable === 'wong_baker' ? (
                    <div className="space-y-6">
                       <div className="flex justify-between items-end">
                           <div>
                              <p className="text-xs font-black text-amber-500">Wong-Baker 面部表情疼痛量表</p>
                              <p className="text-[10px] opacity-50 italic">请根据患儿面部表情选择...</p>
                           </div>
                           <div className="text-right">
                              <div className="text-xs font-black text-amber-600">{WONG_BAKER_CONFIG.find(c => c.score === wongBakerScore)?.label || ''}</div>
                              <div className="text-2xl font-black text-slate-900">{wongBakerScore} <span className="text-xs font-normal opacity-30">/ 10</span></div>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                           {WONG_BAKER_CONFIG.map(item => (
                             <button 
                               key={item.score} 
                               onClick={() => setWongBakerScore(item.score)} 
                               className={`w-full p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${wongBakerScore === item.score ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'}`}
                             >
                               <span className="text-4xl">{item.emoji}</span>
                               <span className="font-black text-sm">{item.score}分 - {item.label}</span>
                               <span className={`text-[9px] ${wongBakerScore === item.score ? 'text-amber-100' : 'text-slate-400'}`}>{item.desc}</span>
                             </button>
                           ))}
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-[9px] text-slate-400 leading-relaxed">
                              <span className="font-bold text-slate-500">临床意义：</span>
                              0分：无痛；1-3分：轻度疼痛；4-6分：中度疼痛；7-10分：重度/剧烈疼痛。
                           </p>
                        </div>
                        <button onClick={applyWongBakerToTriage} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black shadow-lg shadow-amber-100 transition-transform active:scale-[0.98]">
                           同步疼痛评分: {wongBakerScore}
                        </button>
                    </div>
                 ) : null}
              </div>
           </div>
        </div>
      )}
      
      <div className="mt-12 text-[9px] font-black text-slate-200 uppercase tracking-[1em]">
        PETS-LZRYEK · Clinical Decision Support System
      </div>
    </div>
  );
};

export default App;
