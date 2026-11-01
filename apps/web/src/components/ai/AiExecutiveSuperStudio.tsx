import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  CreditCard,
  GraduationCap,
  Volume2,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react';
import { aiApi } from '@/lib/api';

interface AiExecutiveSuperStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertPrompt?: (prompt: string) => void;
}

export function AiExecutiveSuperStudio({
  isOpen,
  onClose,
  onInsertPrompt,
}: AiExecutiveSuperStudioProps) {
  const [activeTab, setActiveTab] = useState<'churn' | 'debt' | 'rubric' | 'voice'>('churn');
  const [loading, setLoading] = useState(false);
  const [churnData, setChurnData] = useState<any>(null);
  const [debtData, setDebtData] = useState<any>(null);
  const [rubricData, setRubricData] = useState<any>(null);

  // Form states
  const [debtSegment, setDebtSegment] = useState<string>('ALL');
  const [debtTone, setDebtTone] = useState<string>('friendly');
  const [rubricTopic, setRubricTopic] = useState<string>('IELTS Writing Task 2 Argumentative Essay');
  const [rubricMaxScore, setRubricMaxScore] = useState<number>(100);

  // Voice speech state
  const [speechText, setSpeechText] = useState<string>(
    "Assalomu alaykum! M-EDU AI Copilot tizimi barcha darslar, to'lovlar va biometrik davomat ma'lumotlarini tahlil qildi. Bugungi umumiy ko'rsatkichlar ijobiy darajada."
  );
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fetchChurnRadar = async () => {
    setLoading(true);
    try {
      const res = await aiApi.getChurnRadar();
      setChurnData(res);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtCampaign = async () => {
    setLoading(true);
    try {
      const res = await aiApi.draftDebtRecoveryCampaign({ segment: debtSegment, tone: debtTone });
      setDebtData(res);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const generateRubric = async () => {
    setLoading(true);
    try {
      const res = await aiApi.generateRubric({ topic: rubricTopic, maxScore: rubricMaxScore });
      setRubricData(res);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'uz-UZ';
      utterance.rate = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                M-EDU AI Copilot Super Studio
              </h2>
              <p className="text-xs text-slate-400">
                Sun'iy intellekt orqali o'quv markazini boshqarish va chuqur tahlil laboratoriyasi
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isSpeaking && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2">
          {[
            { id: 'churn', label: "Ketib Qolish Radari (Churn)", icon: ShieldAlert },
            { id: 'debt', label: "Qarzdorlikni Tiklash", icon: CreditCard },
            { id: 'rubric', label: "Baholash Rubrikalari", icon: GraduationCap },
            { id: 'voice', label: "Ovozli Xabarnoma (TTS)", icon: Volume2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  active
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: CHURN RADAR */}
          {activeTab === 'churn' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    O'quvchilarning Kursni Tark Etish Xavfi Radari
                  </h3>
                  <p className="text-xs text-slate-400">
                    Davomat pasayishi, to'lov kechikishi va faollik pasayishini birgalikda o'rganuvchi AI modeli
                  </p>
                </div>
                <button
                  onClick={fetchChurnRadar}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Tahlilni Yangilash
                </button>
              </div>

              {!churnData ? (
                <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl">
                  <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    O'quvchilar xavf tahlilini boshlash uchun "Tahlilni Yangilash" tugmasini bosing
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                      <div className="text-xs text-slate-400">Tahlil qilinganlar</div>
                      <div className="text-lg font-bold text-white">{churnData.totalAnalyzed} nafar</div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                      <div className="text-xs text-rose-400">Yuqori Xavf (High Risk)</div>
                      <div className="text-lg font-bold text-rose-400">{churnData.highRiskCount} nafar</div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <div className="text-xs text-amber-400">O'rtacha Xavf (Medium)</div>
                      <div className="text-lg font-bold text-amber-400">{churnData.mediumRiskCount} nafar</div>
                    </div>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                    {churnData.students?.map((s: any) => (
                      <div key={s.studentId} className="p-3 bg-slate-900/60 hover:bg-slate-800/40 transition">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{s.name}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                s.riskLevel === 'HIGH'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              }`}
                            >
                              Xavf: {s.riskScore}%
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">{s.phone}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-2">
                          <span>Davomat: <strong className="text-slate-200">{s.attendanceRate}%</strong></span>
                          <span>•</span>
                          <span>Balans: <strong className={s.balanceUzs < 0 ? 'text-rose-400' : 'text-slate-200'}>{s.balanceUzs.toLocaleString('uz-UZ')} so'm</strong></span>
                        </div>
                        <div className="p-2 rounded bg-slate-950/50 text-xs text-slate-300 border-l-2 border-indigo-500">
                          💡 <strong>Tavsiya:</strong> {s.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DEBT CAMPAIGN */}
          {activeTab === 'debt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Avtomatlashtirilgan Qarzdorlikni Tiklash Kampaniyasi
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kechikkan muddatga qarab muloyim, rasmiy va qat'iy xabarlarni generatsiya qilish
                  </p>
                </div>
                <button
                  onClick={fetchDebtCampaign}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Xabarlarni Generatsiya Qilish
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Qarzdorlar Segmenti</label>
                  <select
                    value={debtSegment}
                    onChange={(e) => setDebtSegment(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="ALL">Barcha Qarzdorlar</option>
                    <option value="MILD_1_7_DAYS">Yengil (1 - 7 kun kechikkan)</option>
                    <option value="MODERATE_7_30_DAYS">O'rtacha (8 - 30 kun kechikkan)</option>
                    <option value="SEVERE_30_PLUS_DAYS">Og'ir (30 kundan ortiq kechikkan)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Xabar Ohangi (Tone)</label>
                  <select
                    value={debtTone}
                    onChange={(e) => setDebtTone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="friendly">Do'stona va muloyim (Tavsiya etiladi)</option>
                    <option value="official">Rasmiy / Korporativ</option>
                    <option value="urgent">Shoshilinch ogohlantirish</option>
                  </select>
                </div>
              </div>

              {debtData && (
                <div className="space-y-3 mt-3">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-indigo-300">
                      Topilgan qarzdorlar: <strong>{debtData.targetCount} nafar</strong>
                    </span>
                    <span className="text-indigo-300">
                      Umumiy qarz summasi: <strong>{debtData.totalDebtUzs?.toLocaleString('uz-UZ')} so'm</strong>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(debtData.templates || {}).map(([key, t]: any) => (
                      <div key={key} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-amber-400">{t.title}</span>
                          {onInsertPrompt && (
                            <button
                              onClick={() => {
                                onInsertPrompt(`Ushbu xabarni qarzdor o'quvchilarga yuborish rejasini tasdiqlab ber: "${t.textUz}"`);
                                onClose();
                              }}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                            >
                              Copilot'ga Joylash →
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 font-mono">
                          {t.textUz}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RUBRIC GENERATOR */}
          {activeTab === 'rubric' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Baholash Mezonlari (Rubrika) Generatori
                </h3>
                <p className="text-xs text-slate-400">
                  Imtihon, yozma ish va topshiriqlarni xolis baholash uchun Bloom taksonomiyasiga asoslangan rubrika
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Mavzu / Topshiriq Nomi</label>
                  <input
                    type="text"
                    value={rubricTopic}
                    onChange={(e) => setRubricTopic(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Maksimal Ball</label>
                  <input
                    type="number"
                    value={rubricMaxScore}
                    onChange={(e) => setRubricMaxScore(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                onClick={generateRubric}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Rubrikani Generatsiya Qilish
              </button>

              {rubricData && (
                <div className="space-y-3 border border-slate-800 rounded-xl p-4 bg-slate-900/60">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white">{rubricData.topic}</span>
                    <span className="text-xs text-indigo-400 font-semibold">Maksimal: {rubricData.maxScore} ball</span>
                  </div>

                  <div className="space-y-3">
                    {rubricData.criteria?.map((c: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 text-xs">
                        <div className="flex justify-between font-bold text-slate-200 mb-1">
                          <span>{c.name}</span>
                          <span className="text-indigo-400">{c.weightPercent}% vazn</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                            <strong>A'lo:</strong> {c.exemplary}
                          </div>
                          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                            <strong>Yaxshi:</strong> {c.proficient}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VOICE TTS */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  AI Ovozli Hisobot va Matnni O'qish (Text-to-Speech)
                </h3>
                <p className="text-xs text-slate-400">
                  Direktor va administratorlar uchun ertalabki hisobotlarni ovozli eshitish moduli
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ovozli O'qiladigan Matn</label>
                <textarea
                  rows={4}
                  value={speechText}
                  onChange={(e) => setSpeechText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSpeak}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition ${
                    isSpeaking
                      ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  {isSpeaking ? "Ovozni To'xtatish" : "Ovozli O'qishni Boshlash"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
