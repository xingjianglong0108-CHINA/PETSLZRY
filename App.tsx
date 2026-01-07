
import React, { useState, useMemo } from 'react';
import { TRIAGE_CATEGORIES, TRIAGE_RESULT_CONFIG, HIGH_RISK_FACTORS } from './constants';
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
  const [showRefTable, setShowRefTable] = useState<'gcs' | 'sh_table' | 'pts' | null>(null);

  // GCS Calculator State
  const [gcsE, setGcsE] = useState<number>(4);
  const [gcsV, setGcsV] = useState<number>(5);
  const [gcsM, setGcsM] = useState<number>(6);
  const gcsTotal = useMemo(() => gcsE + gcsV + gcsM, [gcsE, gcsV, gcsM]);

  // PTS Calculator State
  const [ptsWeight, setPtsWeight] = useState<number>(2);
  const [ptsAirway, setPtsAirway] = useState<number>(2);
  const [ptsBP, setPtsBP] = useState<number>(2);
  const [ptsCNS, setPtsCNS] = useState<number>(2);
  const [ptsWound, setPtsWound] = useState<number>(2);
  const [ptsFracture, setPtsFracture] = useState<number>(2);
  const ptsTotal = useMemo(() => ptsWeight + ptsAirway + ptsBP + ptsCNS + ptsWound + ptsFracture, 
    [ptsWeight, ptsAirway, ptsBP, ptsCNS, ptsWound, ptsFracture]);

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
    if (symptom.helperInfo) {
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

    // SpO2 Logic
    if (spo2 > 0) {
      if (spo2 < 90) reasons.push("V: SpO2 < 90% (1级)");
      else if (spo2 <= 94) reasons.push("V: SpO2 90-94% (2级)");
    }
    
    // CRT Logic
    if (crt > 0) {
      if (crt > 5) reasons.push("C: CRT > 5s (1级)");
      else if (crt >= 3) reasons.push("C: CRT 3-5s (2级)");
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

    // Respiratory Rate (RR) Logic - Paediatric CTAS
    if (rr > 0) {
      if (totalMonths < 3) {
        if (rr > 70) reasons.push("R: 呼吸过速 > 70 (1级)");
        else if (rr >= 60) reasons.push("R: 呼吸过速 60-70 (2级)");
        else if (rr >= 50) reasons.push("R: 呼吸过速 50-60 (3级)");
      } else if (totalMonths < 12) {
        if (rr > 60) reasons.push("R: 呼吸过速 > 60 (1级)");
        else if (rr >= 50) reasons.push("R: 呼吸过速 50-60 (2级)");
        else if (rr >= 40) reasons.push("R: 呼吸过速 40-50 (3级)");
      } else if (years >= 1 && years <= 3) {
        if (rr > 50) reasons.push("R: 呼吸过速 > 50 (1级)");
        else if (rr >= 40) reasons.push("R: 呼吸过速 40-50 (2级)");
        else if (rr >= 30) reasons.push("R: 呼吸过速 30-40 (3级)");
      } else if (years >= 4 && years <= 11) {
        if (rr > 40) reasons.push("R: 呼吸过速 > 40 (1级)");
        else if (rr >= 30) reasons.push("R: 呼吸过速 30-40 (2级)");
        else if (rr >= 20) reasons.push("R: 呼吸过速 20-30 (3级)");
      } else if (years >= 12) {
        if (rr > 30) reasons.push("R: 呼吸过速 > 30 (1级)");
        else if (rr >= 20) reasons.push("R: 呼吸过速 20-30 (2级)");
        else if (rr >= 15) reasons.push("R: 呼吸过速 15-20 (3级)");
      }
    }

    // Heart Rate (HR) Logic - Paediatric CTAS
    if (hr > 0) {
      if (totalMonths < 3) {
        if (hr > 210 || hr < 80) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 180) reasons.push(`H: 心率增快 ${hr} (2级)`);
        else if (hr >= 110) reasons.push(`H: 心率增快 ${hr} (3级)`);
      } else if (totalMonths < 12) {
        if (hr > 190 || hr < 80) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 170) reasons.push(`H: 心率增快 ${hr} (2级)`);
        else if (hr >= 110) reasons.push(`H: 心率增快 ${hr} (3级)`);
      } else if (years >= 1 && years <= 3) {
        if (hr > 180 || hr < 80) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 150) reasons.push(`H: 心率增快 ${hr} (2级)`);
        else if (hr >= 100) reasons.push(`H: 心率增快 ${hr} (3级)`);
      } else if (years >= 4 && years <= 11) {
        if (hr > 160 || hr < 60) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 130) reasons.push(`H: 心率增快 ${hr} (2级)`);
        else if (hr >= 70) reasons.push(`H: 心率增快 ${hr} (3级)`);
      } else if (years >= 12) {
        if (hr > 140 || hr < 50) reasons.push(`H: 心率异常 ${hr} (1级)`);
        else if (hr >= 110) reasons.push(`H: 心率增快 ${hr} (2级)`);
        else if (hr >= 60) reasons.push(`H: 心率增快 ${hr} (3级)`);
      }
    }
    
    if (t >= 41 || t < 35) reasons.push("V: 体温极值 (2级)");
    if (totalMonths < 3 && t >= 38) reasons.push("V: <3月龄发热 (2级)");

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
      
      {/* Dynamic Background */}
      <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-100/30 blur-[120px] rounded-full z-0 pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-100/30 blur-[120px] rounded-full z-0 pointer-events-none"></div>

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
              <div className="p-5 bg-black/5 rounded-[24px] mb-8 text-[11px] font-semibold text-slate-500 leading-relaxed italic">
                {confirmingSymptom.helperInfo}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmingSymptom(null)} className="flex-1 py-4 bg-white/60 text-slate-500 rounded-2xl text-sm font-bold border border-white transition-all active:scale-95">取消</button>
                <button onClick={() => executeToggleSymptom(confirmingSymptom.id)} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95">确认符合</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reference Calculators Modal */}
      {showRefTable && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/10 backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className="bg-white/80 backdrop-blur-3xl rounded-[40px] w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col border border-white/60 ring-1 ring-black/5">
            <div className="p-8 flex items-center justify-between border-b border-white/40">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-[22px] flex items-center justify-center shadow-lg">
                  <i className={`fas ${showRefTable === 'gcs' ? 'fa-brain' : showRefTable === 'pts' ? 'fa-user-injured' : 'fa-table'} text-white text-xl`}></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    {showRefTable === 'gcs' ? 'P-GCS 改良评分' : showRefTable === 'pts' ? 'PTS 小儿创伤评分' : 'Paediatric CTAS 共识参考'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated Clinical Scoring Tool</p>
                </div>
              </div>
              <button onClick={() => setShowRefTable(null)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"><i className="fas fa-times"></i></button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              {showRefTable === 'gcs' ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { key: 'E', label: '睁眼', state: gcsE, setter: setGcsE, options: [{s:4,l:'自发'},{s:3,l:'语音'},{s:2,l:'疼痛'},{s:1,l:'无'}] },
                      { key: 'V', label: '语言', state: gcsV, setter: setGcsV, options: [{s:5,l:'笑/搜声'},{s:4,l:'不安'},{s:3,l:'痛哭'},{s:2,l:'呻吟'},{s:1,l:'无'}] },
                      { key: 'M', label: '运动', state: gcsM, setter: setGcsM, options: [{s:6,l:'自发'},{s:5,l:'定位'},{s:4,l:'撤退'},{s:3,l:'屈曲'},{s:2,l:'伸展'},{s:1,l:'无'}] },
                    ].map(cat => (
                      <div key={cat.key} className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">{cat.key}</span>
                          <span className="text-xs font-bold text-slate-500">{cat.label}</span>
                        </div>
                        {cat.options.map(opt => (
                          <button key={opt.s} onClick={() => cat.setter(opt.s)} className={`w-full p-4 rounded-2xl text-[11px] font-bold border transition-all flex justify-between items-center ${cat.state === opt.s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md translate-y-[-2px]' : 'bg-white/60 border-slate-100 text-slate-600 hover:border-indigo-200'}`}>
                            <span>{opt.l}</span><span className="opacity-50">{opt.s}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">GCS 总分评估</p>
                      <div className="text-5xl font-black">{gcsTotal} <span className="text-lg opacity-30">/ 15</span></div>
                    </div>
                    <button onClick={applyGcsToTriage} className="px-10 py-5 bg-indigo-500 hover:bg-indigo-400 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">同步至分诊结果</button>
                  </div>
                </div>
              ) : showRefTable === 'pts' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { label: '体重 (kg)', state: ptsWeight, setter: setPtsWeight, opts: [{v:2,l:'>20'},{v:1,l:'10-20'},{v:-1,l:'<10'}] },
                      { label: '气道情况', state: ptsAirway, setter: setPtsAirway, opts: [{v:2,l:'正常'},{v:1,l:'可维持'},{v:-1,l:'受阻'}] },
                      { label: '收缩压', state: ptsBP, setter: setPtsBP, opts: [{v:2,l:'>90'},{v:1,l:'50-90'},{v:-1,l:'<50'}] },
                      { label: '中枢神经', state: ptsCNS, setter: setPtsCNS, opts: [{v:2,l:'清醒'},{v:1,l:'迟钝'},{v:-1,l:'昏迷'}] },
                      { label: '伤口类型', state: ptsWound, setter: setPtsWound, opts: [{v:2,l:'无'},{v:1,l:'轻微'},{v:-1,l:'严重'}] },
                      { label: '骨折情况', state: ptsFracture, setter: setPtsFracture, opts: [{v:2,l:'无'},{v:1,l:'单处'},{v:-1,l:'多处'}] },
                    ].map(group => (
                      <div key={group.label} className="bg-slate-50/50 p-6 rounded-[28px] border border-white/40 shadow-inner">
                        <p className="text-xs font-black text-slate-400 mb-4 uppercase">{group.label}</p>
                        <div className="grid grid-cols-1 gap-2">
                          {group.opts.map(opt => (
                            <button key={opt.v} onClick={() => group.setter(opt.v)} className={`w-full p-3 rounded-xl text-[10px] font-bold border transition-all flex justify-between items-center ${group.state === opt.v ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white border-slate-100 text-slate-600 hover:border-rose-200'}`}>
                              <span>{opt.l}</span><span>{opt.v > 0 ? `+${opt.v}` : opt.v}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">PTS 创伤评估</p>
                      <div className="text-5xl font-black">{ptsTotal} <span className="text-lg opacity-30">/ 12</span></div>
                    </div>
                    <button onClick={applyPtsToTriage} className="px-10 py-5 bg-rose-500 hover:bg-rose-400 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">同步分诊</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-10 py-4">
                  {/* Paediatric CTAS Table Ref */}
                  <div>
                    <h4 className="text-sm font-black text-indigo-600 mb-6 flex items-center gap-3">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded"></div>
                      Paediatric CTAS 呼吸频率分级 (次/min)
                    </h4>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-4 border-b font-black text-slate-500 uppercase">年龄</th>
                            <th className="p-4 border-b font-black text-rose-600 uppercase">1级 (危急)</th>
                            <th className="p-4 border-b font-black text-orange-600 uppercase">2级 (危重)</th>
                            <th className="p-4 border-b font-black text-amber-600 uppercase">3级 (急症)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { a: '<3月', l1: '>70', l2: '60-70', l3: '50-60' },
                            { a: '3-12月', l1: '>60', l2: '50-60', l3: '40-50' },
                            { a: '1-3岁', l1: '>50', l2: '40-50', l3: '30-40' },
                            { a: '4-11岁', l1: '>40', l2: '30-40', l3: '20-30' },
                            { a: '≥12岁', l1: '>30', l2: '20-30', l3: '15-20' }
                          ].map(row => (
                            <tr key={row.a} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-black text-slate-700">{row.a}</td>
                              <td className="p-4 font-bold text-rose-600/80">{row.l1}</td>
                              <td className="p-4 font-bold text-orange-600/80">{row.l2}</td>
                              <td className="p-4 font-bold text-amber-600/80">{row.l3}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-indigo-600 mb-6 flex items-center gap-3">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded"></div>
                      Paediatric CTAS 心率分级 (次/min)
                    </h4>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-4 border-b font-black text-slate-500 uppercase">年龄</th>
                            <th className="p-4 border-b font-black text-rose-600 uppercase">1级 (危急)</th>
                            <th className="p-4 border-b font-black text-orange-600 uppercase">2级 (危重)</th>
                            <th className="p-4 border-b font-black text-amber-600 uppercase">3级 (急症)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { a: '<3月', l1: '>210 / <80', l2: '180-210', l3: '110-180' },
                            { a: '3-12月', l1: '>190 / <80', l2: '170-190', l3: '110-170' },
                            { a: '1-3岁', l1: '>180 / <80', l2: '150-180', l3: '100-150' },
                            { a: '4-11岁', l1: '>160 / <60', l2: '130-160', l3: '70-130' },
                            { a: '≥12岁', l1: '>140 / <50', l2: '110-140', l3: '60-110' }
                          ].map(row => (
                            <tr key={row.a} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-black text-slate-700">{row.a}</td>
                              <td className="p-4 font-bold text-rose-600/80">{row.l1}</td>
                              <td className="p-4 font-bold text-orange-600/80">{row.l2}</td>
                              <td className="p-4 font-bold text-amber-600/80">{row.l3}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main UI Header */}
      <div className="w-full relative z-10 flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
            <div className="w-10 h-10 bg-indigo-600 rounded-[15px] flex items-center justify-center text-white shadow-xl shadow-indigo-100">
              <i className="fas fa-paw"></i>
            </div>
            <h1 className="text-3xl font-[900] text-slate-900 tracking-tighter">PETS<span className="text-indigo-600">.</span></h1>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] ml-1">Intelligent Triage Suite</p>
        </div>
        <div className="flex gap-2.5 bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/60 shadow-sm ring-1 ring-black/5">
          <button onClick={() => setShowRefTable('gcs')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">GCS 评分</button>
          <button onClick={() => setShowRefTable('pts')} className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95">PTS 创伤</button>
          <button onClick={() => setShowRefTable('sh_table')} className="px-5 py-2.5 bg-white text-slate-600 rounded-xl text-[10px] font-black border border-slate-200 hover:bg-slate-50 transition-all active:scale-95">参考标准</button>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/70 backdrop-blur-lg rounded-[36px] shadow-sm border border-white/60 p-8 ring-1 ring-black/5">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center"><i className="fas fa-vitals text-xs"></i></div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">基础数据与体征</span>
              </div>
              <button onClick={reset} className="text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-undo-alt text-xs"></i></button>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {['ageYears', 'ageMonths', 'ageDays', 'weight'].map((key) => (
                <div key={key}>
                  <label className="block text-[9px] font-black text-slate-400 mb-2 ml-1 uppercase">{key.replace('age', '').replace('Years','岁').replace('Months','月').replace('Days','天').replace('weight','体重kg')}</label>
                  <input type="text" value={(patient as any)[key]} onChange={(e) => key === 'weight' ? handleWeightChange(e.target.value) : handleAgeChange(key as any, e.target.value)} placeholder="-" className="w-full h-14 bg-white/80 border-none rounded-2xl text-center text-sm font-black focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-inner" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'temperature', label: 'T (°C)' }, { id: 'heartRate', label: 'HR (bpm)' }, { id: 'respRate', label: 'RR (bpm)' },
                { id: 'bloodPressure', label: 'BP (mmHg)' }, { id: 'spo2', label: 'SpO2 (%)' }, { id: 'crt', label: 'CRT (s)' },
              ].map((vital) => (
                <div key={vital.id}>
                  <label className="block text-[9px] font-black text-slate-400 mb-2 ml-1 uppercase">{vital.label}</label>
                  <input type="text" value={patient.vitals[vital.id as keyof VitalSigns]} onChange={(e) => handleVitalChange(vital.id as keyof VitalSigns, e.target.value)} placeholder="-" className="w-full h-14 bg-white/80 border-none rounded-2xl text-center text-sm font-black focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-inner" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-100/30 backdrop-blur-md rounded-[32px] border border-white/60 p-6 ring-1 ring-amber-200/20">
            <p className="text-[10px] font-black text-amber-600/80 uppercase mb-4 flex items-center gap-2 tracking-widest"><i className="fas fa-exclamation-circle"></i> 风险调节因子 (升级逻辑)</p>
            <div className="grid grid-cols-2 gap-3">
              {HIGH_RISK_FACTORS.map(f => (
                <button key={f.id} onClick={() => f.helperInfo ? setConfirmingSymptom(f as any) : toggleHighRisk(f.id)} className={`p-4 rounded-2xl border text-[10px] text-left transition-all flex items-center gap-3 ${patient.highRiskFactors.has(f.id) ? 'bg-amber-200/50 border-amber-300 text-amber-900 font-bold' : 'bg-white/50 border-white text-slate-500 hover:border-amber-200 shadow-sm'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${patient.highRiskFactors.has(f.id) ? 'bg-amber-600 shadow-md shadow-amber-200' : 'bg-slate-200'}`}></div>
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {isAnaphylaxisActive && (
            <div className="bg-rose-50/70 backdrop-blur-xl rounded-[40px] border-2 border-rose-100 p-8 shadow-2xl ring-1 ring-rose-200/50 animate-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 bg-rose-600 rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-rose-200 animate-pulse">
                  <i className="fas fa-biohazard text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-rose-950">严重过敏反应 (Anaphylaxis)</h3>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1">Emergency Treatment Protocol</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white/80 p-6 rounded-[28px] border border-rose-100 shadow-sm">
                  <p className="text-[10px] font-black text-rose-600 uppercase mb-4 flex items-center gap-2"><i className="fas fa-syringe"></i> 首选一线：肾上腺素 (IM)</p>
                  {drugDosages ? (
                    <div>
                      <div className="text-4xl font-black text-slate-900 mb-1">{drugDosages.epiFinal} <span className="text-base text-slate-400">mg</span></div>
                      <p className="text-[10px] font-bold text-slate-400 leading-tight">肌肉注射 (1:1000 溶液)<br/>基于 ${patient.weight}kg 计算 · 最大剂量 0.3mg</p>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-300 italic">录入体重后自动计算剂量</p>
                  )}
                </div>
                <div className="bg-white/80 p-6 rounded-[28px] border border-rose-100 shadow-sm">
                  <p className="text-[10px] font-black text-indigo-500 uppercase mb-4 flex items-center gap-2"><i className="fas fa-mortar-pestle"></i> 二线药物方案</p>
                  {drugDosages ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[9px] font-black text-slate-300 uppercase mb-1">激素治疗范围:</div>
                        <div className="text-sm font-black text-slate-800">甲泼尼龙: {drugDosages.mpMin}~{drugDosages.mpMax} mg</div>
                      </div>
                      <div className="h-px bg-slate-100"></div>
                      <div>
                        <div className="text-[9px] font-black text-slate-300 uppercase mb-1">抗组胺药:</div>
                        <div className="text-sm font-black text-slate-800">{drugDosages.antihistamine} (单次剂量)</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-300 italic">待定数据...</p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">专家共识处置要点</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    '体位管理：平卧，抬高下肢 (维持回心血量)',
                    '气道保护：大流量吸氧 (5-10 L/min)',
                    '循环支持：建立双管静脉通路，备快速扩容',
                    '严密监护：持续 ECG、NIBP、SpO2 监测',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 bg-white/50 p-4 rounded-2xl text-[11px] font-bold border border-white shadow-sm backdrop-blur-md">
                      <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</div>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/70 backdrop-blur-lg rounded-[40px] shadow-sm border border-white/60 overflow-hidden ring-1 ring-black/5">
            <div className="p-2 grid grid-cols-4 gap-2 bg-black/5">
              {TRIAGE_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveTab(cat.id)} className={`py-3.5 px-2 rounded-2xl text-[10px] font-black transition-all flex items-center justify-center text-center leading-tight h-12 ${activeTab === cat.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/50'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="p-8 grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {TRIAGE_CATEGORIES.find(c => c.id === activeTab)?.symptoms.map(sym => (
                <button key={sym.id} onClick={() => toggleSymptom(sym)} className={`w-full text-left px-7 py-5 rounded-[24px] border transition-all flex items-center justify-between group ${patient.selectedSymptoms.has(sym.id) ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-black' : 'border-white bg-white/50 text-slate-700 hover:border-indigo-200 shadow-sm'}`}>
                  <span className="text-xs font-bold">{sym.name}</span>
                  <div className="flex items-center gap-4">
                    {sym.helperInfo && <i className="fas fa-info-circle text-[11px] text-indigo-300"></i>}
                    <i className={`fas ${patient.selectedSymptoms.has(sym.id) ? 'fa-check-circle text-indigo-600' : 'fa-plus-circle text-slate-100 group-hover:text-indigo-300'} text-sm`}></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Results) */}
        <div className="lg:col-span-5 space-y-6 sticky top-8">
          <div className={`rounded-[48px] p-10 shadow-2xl text-white relative overflow-hidden transition-all duration-700 ${currentTriage.zoneColor} ring-1 ring-white/20`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-3">分诊分级决策建议</div>
                  <h2 className="text-4xl font-[900] mb-4 tracking-tighter">{currentTriage.levelName}</h2>
                  <div className="inline-flex items-center gap-3 bg-black/10 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <i className="far fa-clock text-xs"></i>
                    <span className="text-xs font-black">响应时限: {currentTriage.responseTime}</span>
                  </div>
                </div>
                <button onClick={handleGenerateReport} disabled={isGenerating} className={`flex items-center gap-3 px-6 py-4 bg-white/20 backdrop-blur-xl rounded-[26px] text-[10px] font-black border border-white/20 transition-all shadow-xl ${isGenerating ? 'animate-pulse opacity-50' : 'active:scale-90 hover:bg-white/30'}`}>
                  {isGenerating ? <i className="fas fa-sync animate-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                  AI 临床建议
                </button>
              </div>

              <div className="p-7 bg-white/10 rounded-[32px] border border-white/10 mb-10 text-sm font-bold italic leading-relaxed backdrop-blur-md">
                "{currentTriage.description}"
              </div>

              <div className="space-y-4">
                <div className="text-[10px] font-black uppercase opacity-60 mb-3 tracking-widest px-1">标准临床处置推荐</div>
                {currentTriage.interventions.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl text-xs font-bold border border-white/5 backdrop-blur-sm">
                    <span className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-2">
            {triageReason.length > 0 ? triageReason.map((r, i) => (
              <span key={i} className="px-4 py-2 bg-white/80 backdrop-blur-md text-slate-500 rounded-2xl text-[10px] font-black border border-white shadow-sm flex items-center gap-2 ring-1 ring-black/5">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-sm"></div>
                {r}
              </span>
            )) : <span className="text-[11px] text-slate-300 italic font-medium px-2">系统当前无危急体征标记</span>}
          </div>

          {aiReport && (
            <div className="bg-white/90 backdrop-blur-2xl rounded-[44px] p-10 shadow-2xl border border-white ring-1 ring-black/5 animate-in slide-in-from-bottom-10 duration-500">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-slate-900 rounded-[16px] flex items-center justify-center shadow-xl"><i className="fas fa-robot text-white text-base"></i></div>
                  <div>
                    <span className="text-xs font-black uppercase text-slate-800 tracking-tight">AI 临床决策深度分析</span>
                    <p className="text-[8px] font-bold text-slate-400 tracking-[0.2em]">GEMINI CLINICAL INTELLIGENCE</p>
                  </div>
                </div>
                <button onClick={() => setAiReport(null)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"><i className="fas fa-times text-xs"></i></button>
              </div>
              <div className="prose prose-slate max-w-none text-[11px] font-bold text-slate-600 whitespace-pre-wrap leading-[1.8] tracking-tight">
                {aiReport}
              </div>
              <div className="mt-12 pt-6 border-t border-slate-100 text-[8px] text-slate-300 uppercase font-black text-center tracking-[0.5em] opacity-60">
                PETS CORE SYSTEM · ADVANCED CLINICAL ANALYTICS
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-24 mb-12 text-[10px] font-black text-slate-200 uppercase tracking-[0.8em] text-center select-none">
        PETS-LZRYEK · Clinical Decision Support · Build 3.2
      </div>
    </div>
  );
};

export default App;
