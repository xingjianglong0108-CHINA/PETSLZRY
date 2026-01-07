
import { GoogleGenAI } from "@google/genai";
import { VitalSigns } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getAIClinicalReport = async (
  age: { years: string; months: string; days: string },
  weight: string,
  vitals: VitalSigns,
  selectedSymptoms: string[],
  triageLevel: string
) => {
  const prompt = `
    作为一名资深儿科急诊专家，请针对以下患儿情况提供一份深度的临床预检分析报告：
    
    患儿基本资料：
    - 年龄：${age.years}岁 ${age.months}月 ${age.days}天
    - 体重：${weight || '未录入'}kg
    - 生命体征：
      * 体温: ${vitals.temperature || '未录入'}°C
      * 心率: ${vitals.heartRate || '未录入'}次/分
      * 呼吸: ${vitals.respRate || '未录入'}次/分
      * 血压: ${vitals.bloodPressure || '未录入'}mmHg
      * SpO2: ${vitals.spo2 || '未录入'}%
      * CRT: ${vitals.crt || '未录入'}秒
    - 预检分级结果：${triageLevel}
    - 识别到的症状：${selectedSymptoms.join('、') || '无特异性症状'}
    
    请按以下结构输出：
    1. 【病情评估】 分析当前生命体征和症状的严重性及其在儿科急诊中的临床意义。
    2. 【潜在风险】 基于当前指标，列出可能出现的恶化指标或潜在并发症。
    3. 【临床路径建议】 建议的实验室检查及影像学检查。
    4. 【干预重点】 护理及首接医生应重点监测的生命体征。
    
    语言风格：专业、严谨、简洁。
    格式：使用Markdown。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Report generation failed:", error);
    return "暂时无法生成AI临床报告，请检查网络连接或API配置。";
  }
};
