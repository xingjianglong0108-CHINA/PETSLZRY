
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
  const [showRefTable, setShowRefTable] = useState<'gcs' | 'sh_table' | null>(null);

  // GCS Calculator State
  const [gcsE, setGcsE] = useState<number>(4);
  const [gcsV, setGcsV] = useState<number>(5);
  const [gcsM, setGcsM] = useState<number>(6);

  const gcsTotal = useMemo(() => gcsE + gcsV + gcsM, [gcsE, gcsV, gcsM]);

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
      // Remove existing GCS tags
      next.delete('n1');
      next.delete('n2');
      next.delete('n8');
      
      // Based on constants logic: 3-9 (L1), 10-13 (L2), 14-15 (L4)
      if (gcsTotal <= 9) next.add('n1');
      else if (gcsTotal <= 13) next.add('n2');
      else next.add('n8');
      
      return { ...prev, selectedSymptoms: next };
    });
    setShowRefTable(null);
  };

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
    const spo2 = parseFloat(patient.vitals.spo2);
    const crt = parseFloat(patient.vitals.crt);
    const sbp = parseFloat(patient.vitals.bloodPressure);

    if (spo2 > 0) {
      if (spo2 < 90) reasons.push("V: SpO2 < 90% (1级)");
      else if (spo2 <= 94) reasons.push("V: SpO2 90-94% (2级)");
    }
    if (crt >= 3) {
      if (crt > 5) reasons.push("C: CRT > 5s (1级)");
      else reasons.push("C: CRT 3-5s (2级)");
    }
    if (sbp > 0) {
      let isHypotension = false;
      if (years === 0 && months === 0 && days <= 28 && sbp < 60) isHypotension = true;
      else if (totalMonths <= 12 && sbp < 70) isHypotension = true;
      else if (years >= 1 && years <= 10 && sbp < (70 + years * 2)) isHypotension = true;
      else if (years > 10 && sbp < 90) isHypotension = true;
      if (isHypotension) reasons.push("C: 低血压 (1级)");
    }
    if (t > 0) {
      if (t >= 41 || t < 35) reasons.push("V: 体温极值 (2级)");
      if (totalMonths < 3 && t >= 38) reasons.push("V: <3月龄发热 (2级)");
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
    patient.selectedSymptoms.forEach(id => {
      TRIAGE_CATEGORIES.forEach(cat => {
        const sym = cat.symptoms.find(s => s.id === id);
        if (sym) baseLevel = Math.min(baseLevel, sym.level);
      });
    });
    if (triageReason.some(r => r.includes("(1级)"))) baseLevel = Math.min(baseLevel, 1);
    else if (triageReason.some(r => r.includes("(2级)"))) baseLevel = Math.min(baseLevel, 2);

    const shouldUpgrade = Array.from(patient.highRiskFactors).some(id => {
      return HIGH_RISK_FACTORS.find(f => f.id === id)?.upgrade;
    });
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
    patient.highRiskFactors.forEach(id => {
      const f = HIGH_RISK_FACTORS.find(x => x.id === id);
      if (f) symptomsList.push(`[风险] ${f.name}`);
    });
    const report = await getAIClinicalReport(
      { years: patient.ageYears, months: patient.ageMonths, days: patient.ageDays },
      patient.weight, patient.vitals, symptomsList, currentTriage.levelName
    );
    setAiReport(report || "报告生成失败");
    setIsGenerating(false);
    setTimeout(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 150);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto font-sans text-slate-900">
      {/* Helper Modal */}
      {confirmingSymptom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden border border-slate-200">
            <div className="p-4 bg-indigo-600 text-white flex items-center gap-2">
              <i className="fas fa-stethoscope text-sm"></i>
              <span className="text-sm font-bold">标准核对</span>
            </div>
            <div className="p-5">
              <p className="text-sm font-black text-slate-800 mb-3">{confirmingSymptom.name}</p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 mb-5 text-[11px] font-bold text-slate-500 leading-relaxed italic whitespace-pre-wrap">
                {confirmingSymptom.helperInfo}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmingSymptom(null)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold transition-colors">取消</button>
                <button onClick={() => executeToggleSymptom(confirmingSymptom.id)} className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold transition-colors">符合标准</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reference Tables Modal */}
      {showRefTable && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className={`fas ${showRefTable === 'gcs' ? 'fa-brain' : 'fa-table'} text-xl`}></i>
                <span className="font-black tracking-tight">{showRefTable === 'gcs' ? 'P-GCS 自动评分工具' : '上海专家共识参考 (Paediatric CTAS)'}</span>
              </div>
              <button onClick={() => setShowRefTable(null)} className="text-slate-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
              {showRefTable === 'gcs' ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Eye Opening */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-indigo-600 uppercase mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">E</span>
                        睁眼反应
                      </h4>
                      {[
                        { s: 4, l: '自发性睁眼' }, { s: 3, l: '语言刺激' }, { s: 2, l: '疼痛刺激' }, { s: 1, l: '无反应' }
                      ].map(i => (
                        <button 
                          key={i.s} 
                          onClick={() => setGcsE(i.s)}
                          className={`w-full flex justify-between items-center text-[11px] p-3 rounded-xl font-bold transition-all border ${
                            gcsE === i.s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <span>{i.l}</span>
                          <span className={gcsE === i.s ? 'text-white/80' : 'text-slate-400'}>{i.s}</span>
                        </button>
                      ))}
                    </div>
                    {/* Verbal */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-indigo-600 uppercase mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">V</span>
                        语言反应
                      </h4>
                      {[
                        { s: 5, l: '喃喃/笑/寻找声源' }, { s: 4, l: '不安/哭吵' }, { s: 3, l: '对疼刺激哭吵' }, { s: 2, l: '对疼刺激呻吟' }, { s: 1, l: '无反应' }
                      ].map(i => (
                        <button 
                          key={i.s} 
                          onClick={() => setGcsV(i.s)}
                          className={`w-full flex justify-between items-center text-[11px] p-3 rounded-xl font-bold transition-all border ${
                            gcsV === i.s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <span>{i.l}</span>
                          <span className={gcsV === i.s ? 'text-white/80' : 'text-slate-400'}>{i.s}</span>
                        </button>
                      ))}
                    </div>
                    {/* Motor */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-indigo-600 uppercase mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">M</span>
                        运动反应
                      </h4>
                      {[
                        { s: 6, l: '自发/按嘱动作' }, { s: 5, l: '疼痛定位' }, { s: 4, l: '疼痛撤退' }, { s: 3, l: '疼痛屈曲(去皮质)' }, { s: 2, l: '疼痛伸展(去大脑)' }, { s: 1, l: '无反应' }
                      ].map(i => (
                        <button 
                          key={i.s} 
                          onClick={() => setGcsM(i.s)}
                          className={`w-full flex justify-between items-center text-[11px] p-3 rounded-xl font-bold transition-all border ${
                            gcsM === i.s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <span>{i.l}</span>
                          <span className={gcsM === i.s ? 'text-white/80' : 'text-slate-400'}>{i.s}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Summary Area */}
                  <div className="p-6 bg-slate-900 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">当前评分总计</div>
                      <div className="text-5xl font-black">{gcsTotal} <span className="text-xl opacity-40">/ 15</span></div>
                    </div>
                    <div className="flex-1 max-w-xs text-center md:text-left">
                      <div className="text-[10px] font-black uppercase text-indigo-400 mb-1">病情评估</div>
                      <p className="text-sm font-bold">
                        {gcsTotal >= 14 ? '轻度脑损伤 / 神经状态基本正常' : gcsTotal >= 10 ? '中度脑损伤 (需在15分钟内处理)' : '重度脑损伤 (需立即抢救)'}
                      </p>
                    </div>
                    <button 
                      onClick={applyGcsToTriage}
                      className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 flex items-center gap-2"
                    >
                      <i className="fas fa-check-double"></i>
                      应用至分诊
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Paediatric CTAS RR */}
                  <div>
                    <h4 className="text-sm font-black text-indigo-600 mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded"></div>
                      Paediatric CTAS 呼吸频率分级 (次/min)
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="p-3 border font-black text-slate-500">年龄段</th>
                            <th className="p-3 border font-black text-rose-600">1级 (危急)</th>
                            <th className="p-3 border font-black text-orange-600">2级 (危重)</th>
                            <th className="p-3 border font-black text-amber-600">3级 (急症)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { age: '<3月', l1: '>70', l2: '60-70', l3: '50-60' },
                            { age: '3-12月', l1: '>60', l2: '50-60', l3: '40-50' },
                            { age: '1-3岁', l1: '>50', l2: '40-50', l3: '30-40' },
                            { age: '4-11岁', l1: '>40', l2: '30-40', l3: '20-30' },
                            { age: '≥12岁', l1: '>30', l2: '20-30', l3: '15-20' }
                          ].map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 border font-bold text-slate-700">{row.age}</td>
                              <td className="p-3 border font-bold">{row.l1}</td>
                              <td className="p-3 border font-bold">{row.l2}</td>
                              <td className="p-3 border font-bold">{row.l3}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Paediatric CTAS HR */}
                  <div>
                    <h4 className="text-sm font-black text-indigo-600 mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded"></div>
                      Paediatric CTAS 心率分级 (次/min)
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="p-3 border font-black text-slate-500">年龄段</th>
                            <th className="p-3 border font-black text-rose-600">1级 (危急)</th>
                            <th className="p-3 border font-black text-orange-600">2级 (危重)</th>
                            <th className="p-3 border font-black text-amber-600">3级 (急症)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { age: '<3月', l1: '>210 或 <80', l2: '180-210', l3: '110-180' },
                            { age: '3-12月', l1: '>190 或 <80', l2: '170-190', l3: '110-170' },
                            { age: '1-3岁', l1: '>180 或 <80', l2: '150-180', l3: '100-150' },
                            { age: '4-11岁', l1: '>160 或 <60', l2: '130-160', l3: '70-130' },
                            { age: '≥12岁', l1: '>140 或 <50', l2: '110-140', l3: '60-110' }
                          ].map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 border font-bold text-slate-700">{row.age}</td>
                              <td className="p-3 border font-bold">{row.l1}</td>
                              <td className="p-3 border font-bold">{row.l2}</td>
                              <td className="p-3 border font-bold">{row.l3}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowRefTable(null)} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black transition-all hover:bg-slate-800 active:scale-95">关闭参考</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">PETS-LZRYEK</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">儿科急诊预检分诊决策工具</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRefTable('gcs')} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-indigo-200 flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95">
            <i className="fas fa-brain"></i> P-GCS 自动评分
          </button>
          <button onClick={() => setShowRefTable('sh_table')} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black border border-slate-200 flex items-center gap-2 hover:bg-slate-200 transition-all active:scale-95 shadow-sm">
            <i className="fas fa-table"></i> 参考标准
          </button>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-heartbeat"></i> 患儿生命体征
              </span>
              <button onClick={reset} className="text-rose-500 h-6 w-6 rounded-md hover:bg-rose-50 transition-colors"><i className="fas fa-sync-alt text-xs"></i></button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {['ageYears', 'ageMonths', 'ageDays', 'weight'].map((key) => (
                <div key={key}>
                  <label className="block text-[8px] text-slate-400 mb-1 ml-1 font-black uppercase">
                    {key === 'ageYears' ? '岁' : key === 'ageMonths' ? '月' : key === 'ageDays' ? '天' : '体重kg'}
                  </label>
                  <input type="text" value={(patient as any)[key]} onChange={(e) => key === 'weight' ? handleWeightChange(e.target.value) : handleAgeChange(key as any, e.target.value)} placeholder="-" className="w-full bg-slate-50 border-none rounded-lg py-2 px-1 text-center text-sm font-black focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'temperature', label: 'T (°C)' }, { id: 'heartRate', label: 'HR (bpm)' }, { id: 'respRate', label: 'RR (bpm)' },
                { id: 'bloodPressure', label: 'BP (mmHg)' }, { id: 'spo2', label: 'SpO2 (%)' }, { id: 'crt', label: 'CRT (s)' },
              ].map((vital) => (
                <div key={vital.id}>
                  <label className="block text-[8px] text-slate-400 mb-1 ml-1 font-black uppercase">{vital.label}</label>
                  <input type="text" value={patient.vitals[vital.id as keyof VitalSigns]} onChange={(e) => handleVitalChange(vital.id as keyof VitalSigns, e.target.value)} placeholder="-" className="w-full bg-slate-50 border-none rounded-lg py-2 px-1 text-center text-[13px] font-black focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50/40 rounded-2xl border border-amber-100 p-4">
            <p className="text-[8px] font-black text-amber-600 uppercase mb-2 flex items-center gap-1"><i className="fas fa-exclamation-triangle"></i> 共识风险调节</p>
            <div className="grid grid-cols-2 gap-2">
              {HIGH_RISK_FACTORS.map(f => (
                <button key={f.id} onClick={() => f.helperInfo ? setConfirmingSymptom(f as any) : toggleHighRisk(f.id)} className={`p-2 rounded-lg border text-[9px] text-left transition-all flex items-center gap-2 ${patient.highRiskFactors.has(f.id) ? 'bg-amber-100 border-amber-200 text-amber-900 font-bold' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 shadow-sm'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${patient.highRiskFactors.has(f.id) ? 'bg-amber-600' : 'bg-slate-200'}`}></div>
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-1 grid grid-cols-4 gap-1 bg-slate-50 border-b border-slate-100">
              {TRIAGE_CATEGORIES.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setActiveTab(cat.id)} 
                  className={`py-2 px-1 rounded-lg text-[9px] font-black transition-all text-center leading-tight flex items-center justify-center h-10 ${
                    activeTab === cat.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="p-3 grid grid-cols-1 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
              {TRIAGE_CATEGORIES.find(c => c.id === activeTab)?.symptoms.map(sym => (
                <button 
                  key={sym.id} 
                  onClick={() => toggleSymptom(sym)} 
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${
                    patient.selectedSymptoms.has(sym.id) ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 font-black' : 'border-slate-50 bg-slate-50/30 text-slate-700 hover:border-slate-200 shadow-sm'
                  }`}
                >
                  <span className="text-[11px] font-bold">{sym.name}</span>
                  <div className="flex items-center gap-2">
                    {sym.helperInfo && <i className="fas fa-info-circle text-[10px] text-indigo-400 opacity-60"></i>}
                    <i className={`fas ${patient.selectedSymptoms.has(sym.id) ? 'fa-check-circle text-indigo-600' : 'fa-plus-circle text-slate-100 group-hover:text-slate-200'} text-xs`}></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`rounded-2xl p-6 shadow-xl text-white relative overflow-hidden transition-all duration-500 ${currentTriage.zoneColor}`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-0.5">分诊结果建议</div>
                  <h2 className="text-2xl font-black mb-1">{currentTriage.levelName}</h2>
                  <div className="text-[10px] font-black bg-black/10 inline-block px-2.5 py-1 rounded-lg">响应时限: {currentTriage.responseTime}</div>
                </div>
                <button 
                  onClick={handleGenerateReport} 
                  disabled={isGenerating}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-xl text-[9px] font-black border border-white/20 transition-all hover:bg-white/30 shrink-0 shadow-lg ${isGenerating ? 'animate-pulse cursor-wait' : 'active:scale-95'}`}
                >
                  {isGenerating ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-magic"></i>}
                  AI 分析
                </button>
              </div>
              <div className="p-3 bg-white/10 rounded-xl border border-white/10 mb-4 text-[11px] font-bold italic leading-relaxed backdrop-blur-sm">
                {currentTriage.description}
              </div>
              <div className="space-y-1.5">
                <div className="text-[8px] font-black uppercase opacity-60 mb-1 tracking-widest">共识推荐处置</div>
                {currentTriage.interventions.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg text-[10px] font-bold border border-white/5">
                    <span className="w-4 h-4 bg-white/20 rounded flex items-center justify-center text-[8px] font-black shrink-0">{idx + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {triageReason.length > 0 ? triageReason.map((r, i) => (
              <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-bold border border-slate-200/50 shadow-sm">
                <i className="fas fa-bookmark mr-1.5 opacity-40 text-indigo-500"></i> {r}
              </span>
            )) : <span className="text-[9px] text-slate-300 italic px-2">未触及危急重症指标</span>}
          </div>

          {aiReport && (
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-robot text-white text-[11px]"></i></div>
                  <span className="text-[11px] font-black uppercase tracking-tight">AI 临床专家评估报告</span>
                </div>
                <button onClick={() => setAiReport(null)} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><i className="fas fa-times text-xs"></i></button>
              </div>
              <div className="prose prose-slate max-w-none text-[10px] font-bold text-slate-600 whitespace-pre-wrap leading-loose overflow-hidden">
                {aiReport}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-50 text-[7px] text-slate-300 uppercase font-black text-center tracking-[0.4em]">
                Smart Pediatric Diagnostic Insight · Gemini 3
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 text-[8px] font-black text-slate-300 uppercase tracking-[0.6em] text-center pb-10">
        PETS-LZRYEK · Intelligent Decision Support · V2.8
      </div>
    </div>
  );
};

export default App;
