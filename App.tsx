
import React, { useState, useMemo } from 'react';
import { TRIAGE_CATEGORIES, TRIAGE_RESULT_CONFIG, HIGH_RISK_FACTORS } from './constants';
import { TriageLevel, PatientState, TriageResult, VitalSigns, Symptom } from './types';
import { getAIClinicalReport } from './services/geminiService';

const App: React.FC = () => {
  const [patient, setPatient] = useState<PatientState>({
    ageYears: '',
    ageMonths: '',
    ageDays: '',
    weight: '',
    vitals: {
      temperature: '',
      heartRate: '',
      respRate: '',
      bloodPressure: '',
      spo2: '',
      crt: '',
    },
    selectedSymptoms: new Set(),
    highRiskFactors: new Set(),
  });
  const [activeTab, setActiveTab] = useState(TRIAGE_CATEGORIES[0].id);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmingSymptom, setConfirmingSymptom] = useState<Symptom | null>(null);

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
        if (sym) reasons.push(`${sym.name}`);
      });
    });
    patient.highRiskFactors.forEach(id => {
      const factor = HIGH_RISK_FACTORS.find(f => f.id === id);
      if (factor) reasons.push(`${factor.name}`);
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
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 mb-5 text-[11px] font-bold text-slate-500 leading-relaxed italic">
                {confirmingSymptom.helperInfo}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmingSymptom(null)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold">取消</button>
                <button onClick={() => executeToggleSymptom(confirmingSymptom.id)} className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">符合标准</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tighter">PETS-LZRYEK</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pediatric Emergency Triage Standard</p>
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column */}
        <div className="lg:col-span-7 space-y-4">
          {/* Base Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-id-card"></i> 基础体征录入
              </span>
              <button onClick={reset} className="text-rose-500 h-6 w-6 rounded-md hover:bg-rose-50"><i className="fas fa-sync-alt text-xs"></i></button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {['ageYears', 'ageMonths', 'ageDays', 'weight'].map((key) => (
                <div key={key}>
                  <label className="block text-[8px] text-slate-400 mb-1 ml-1 font-black uppercase">
                    {key === 'ageYears' ? '岁' : key === 'ageMonths' ? '月' : key === 'ageDays' ? '天' : '体重kg'}
                  </label>
                  <input type="text" value={(patient as any)[key]} onChange={(e) => key === 'weight' ? handleWeightChange(e.target.value) : handleAgeChange(key as any, e.target.value)} placeholder="-" className="w-full bg-slate-50 border-none rounded-lg py-2 px-1 text-center text-sm font-black focus:ring-1 focus:ring-indigo-500 outline-none" />
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
                  <input type="text" value={patient.vitals[vital.id as keyof VitalSigns]} onChange={(e) => handleVitalChange(vital.id as keyof VitalSigns, e.target.value)} placeholder="-" className="w-full bg-slate-50 border-none rounded-lg py-2 px-1 text-center text-[13px] font-black focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
              ))}
            </div>
          </div>

          {/* Adjusting factors */}
          <div className="bg-amber-50/40 rounded-2xl border border-amber-100 p-4">
            <p className="text-[8px] font-black text-amber-600 uppercase mb-2 flex items-center gap-1"><i className="fas fa-triangle-exclamation"></i> 调节因子</p>
            <div className="grid grid-cols-2 gap-2">
              {HIGH_RISK_FACTORS.map(f => (
                <button key={f.id} onClick={() => f.helperInfo ? setConfirmingSymptom(f as any) : toggleHighRisk(f.id)} className={`p-2 rounded-lg border text-[9px] text-left transition-all flex items-center gap-2 ${patient.highRiskFactors.has(f.id) ? 'bg-amber-100 border-amber-200 text-amber-900 font-bold' : 'bg-white border-slate-100 text-slate-500'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${patient.highRiskFactors.has(f.id) ? 'bg-amber-600' : 'bg-slate-200'}`}></div>
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* System Tabs (2 Rows) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-2 grid grid-cols-4 gap-1 bg-slate-50 border-b border-slate-100">
              {TRIAGE_CATEGORIES.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setActiveTab(cat.id)} 
                  className={`py-2 px-1 rounded-lg text-[9px] font-black transition-all text-center leading-tight ${
                    activeTab === cat.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {/* Symptoms list */}
            <div className="p-3 grid grid-cols-1 gap-1.5 max-h-[350px] overflow-y-auto custom-scrollbar">
              {TRIAGE_CATEGORIES.find(c => c.id === activeTab)?.symptoms.map(sym => (
                <button 
                  key={sym.id} 
                  onClick={() => toggleSymptom(sym)} 
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${
                    patient.selectedSymptoms.has(sym.id) ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900' : 'border-slate-50 bg-slate-50/30 text-slate-700 hover:border-slate-200'
                  }`}
                >
                  <span className="text-[11px] font-bold">{sym.name}</span>
                  <i className={`fas ${patient.selectedSymptoms.has(sym.id) ? 'fa-check-circle text-indigo-600' : 'fa-plus-circle text-slate-100 group-hover:text-slate-200'} text-xs`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`rounded-2xl p-6 shadow-lg text-white relative overflow-hidden transition-all duration-300 ${currentTriage.zoneColor}`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">预检决策结果</div>
                  <h2 className="text-xl font-black mb-1">{currentTriage.levelName}</h2>
                  <div className="text-[10px] font-black bg-black/10 inline-block px-2 py-0.5 rounded-md">时限: {currentTriage.responseTime}</div>
                </div>
                {/* Tiny AI Button */}
                <button 
                  onClick={handleGenerateReport} 
                  disabled={isGenerating}
                  className={`flex items-center gap-1.5 px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[8px] font-black border border-white/20 transition-all hover:bg-white/30 shrink-0 ${isGenerating ? 'animate-pulse' : ''}`}
                >
                  {isGenerating ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-bolt"></i>}
                  AI分析
                </button>
              </div>

              <div className="p-3 bg-white/10 rounded-xl border border-white/10 mb-4 text-[11px] font-bold italic leading-relaxed">
                {currentTriage.description}
              </div>

              <div className="space-y-1.5">
                <div className="text-[8px] font-black uppercase opacity-60 mb-1">处置要点</div>
                {currentTriage.interventions.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg text-[10px] font-bold border border-white/5">
                    <span className="w-4 h-4 bg-white/20 rounded flex items-center justify-center text-[8px] font-black shrink-0">{idx + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reasons tag area */}
          <div className="flex flex-wrap gap-1">
            {triageReason.map((r, i) => (
              <span key={i} className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200/50">
                <i className="fas fa-tag mr-1 opacity-50"></i> {r}
              </span>
            ))}
          </div>

          {/* AI Report */}
          {aiReport && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center"><i className="fas fa-robot text-white text-[10px]"></i></div>
                  <span className="text-[11px] font-black">AI 专家深度分析</span>
                </div>
                <button onClick={() => setAiReport(null)} className="text-slate-300 hover:text-slate-400"><i className="fas fa-times text-xs"></i></button>
              </div>
              <div className="prose prose-slate max-w-none text-[10px] font-bold text-slate-600 whitespace-pre-wrap leading-loose">
                {aiReport}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-[8px] font-black text-slate-300 uppercase tracking-widest text-center">
        PETS-LZRYEK · Smart Triage Infrastructure
      </div>
    </div>
  );
};

export default App;
