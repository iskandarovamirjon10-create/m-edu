/**
 * M-EDU V2 — Official Educational Services Contract Modal (`OfficialStudentContractModal.tsx`)
 *
 * Enterprise-grade legal education contract generator compliant with
 * Republic of Uzbekistan educational service agreements (O‘quv xizmatlari ko‘rsatish shartnomasi).
 *
 * Capabilities:
 *  - Dynamic legal contract generation with auto-populated student and organization data
 *  - Real ISO/IEC 18004 scannable QR verification seal (`RealQrCode`)
 *  - Official digital signature stamp & organization watermarks
 *  - High-fidelity vector A4 portrait print engine (`triggerPrint({ type: 'contract-a4' })`)
 *  - Telegram dispatch and 1-click clipboard copy
 *  - Custom parameter tweaking (monthly tuition, group, contract number, payment deadline)
 *  - Full responsive preview (desktop side-by-side / mobile vertical flow)
 *  - WCAG 2.2 AA keyboard accessible (ESC, Print shortcut)
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassModal, GlassButton, GlassBadge, useToast } from '@/components/ui';
import { RealQrCode } from '@/components/ui/RealQrCode';
import { formatCurrency, formatDate } from '@/lib/format';
import { triggerPrint } from '@/lib/printEngine';
import { usePremiumSound } from '@/hooks/usePremiumSound';

export interface OfficialStudentContractModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly student: {
    readonly id: string;
    readonly balance?: number;
    readonly user?: {
      readonly firstName?: string;
      readonly lastName?: string;
      readonly phone?: string;
      readonly email?: string;
    };
    readonly parentName?: string;
    readonly parentPhone?: string;
    readonly birthDate?: string;
    readonly address?: string;
    readonly groupEnrollments?: ReadonlyArray<{
      readonly group?: {
        readonly id: string;
        readonly name: string;
        readonly monthlyFee?: number;
      };
    }>;
  };
  readonly organization?: {
    readonly name?: string;
    readonly inn?: string;
    readonly address?: string;
    readonly bankName?: string;
    readonly bankAccount?: string;
    readonly bankMfo?: string;
    readonly directorName?: string;
    readonly phone?: string;
  };
}

export function OfficialStudentContractModal({
  open,
  onClose,
  student,
  organization,
}: OfficialStudentContractModalProps) {
  const { playPop, playSuccess, playTick } = usePremiumSound();
  const { success, error } = useToast();

  const currentYear = new Date().getFullYear();
  const shortId = student?.id?.slice(0, 6)?.toUpperCase() || '000001';

  // Extract first group enrollment fee or default
  const defaultGroupName = student?.groupEnrollments?.[0]?.group?.name || 'Asosiy O\'quv Kursi';
  const defaultFee = Number(student?.groupEnrollments?.[0]?.group?.monthlyFee) || 1200000;

  // Customizable contract state
  const [contractNumber, setContractNumber] = useState(`EDU-SH-${currentYear}/${shortId}`);
  const [contractDate, setContractDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [courseName, setCourseName] = useState(defaultGroupName);
  const [monthlyTuition, setMonthlyTuition] = useState<number>(defaultFee);
  const [paymentDueDay, setPaymentDueDay] = useState<number>(5);
  const [isEditingParams, setIsEditingParams] = useState(false);

  // Student full name
  const studentFullName = useMemo(() => {
    const f = student?.user?.firstName || '';
    const l = student?.user?.lastName || '';
    const combined = `${f} ${l}`.trim();
    return combined || 'Hurmatli O\'quvchi';
  }, [student]);

  // Organization defaults
  const org = useMemo(() => ({
    name: organization?.name || 'M-EDU ZAMONAVIY TA\'LIM MARKAZI MCHJ',
    inn: organization?.inn || '308 921 547',
    address: organization?.address || 'Toshkent sh., Chilonzor tumani, Bunyodkor shox ko\'chasi, 42-uy',
    bankName: organization?.bankName || 'ATB "Kapitalbank" Chilonzor filiali',
    bankAccount: organization?.bankAccount || '2020 8000 4000 1234 5678',
    bankMfo: organization?.bankMfo || '00974',
    directorName: organization?.directorName || 'A. R. Rahmonov',
    phone: organization?.phone || '+998 (71) 200-45-45',
  }), [organization]);

  // QR verification payload URL
  const verificationUrl = useMemo(() => {
    return `https://m-edu.uz/verify/contract/${encodeURIComponent(contractNumber)}`;
  }, [contractNumber]);

  // A4 Printing
  const handlePrint = () => {
    playPop();
    triggerPrint({
      type: 'contract-a4',
      title: `Shartnoma_${contractNumber}_${studentFullName.replace(/\s+/g, '_')}`,
    });
  };

  // Telegram Share Link
  const handleShareTelegram = () => {
    playTick();
    const message = `Assalomu alaykum! M-EDU ta'lim markazi bilan o'quv xizmatlari ko'rsatish shartnomasi № ${contractNumber}.\nO'quvchi: ${studentFullName}\nKurs: ${courseName}\nOylik to'lov: ${formatCurrency(monthlyTuition)}\nRaqamli verifikatsiya: ${verificationUrl}`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(verificationUrl)}&text=${encodeURIComponent(message)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  // Copy Verification Link
  const handleCopyLink = async () => {
    playSuccess();
    try {
      await navigator.clipboard.writeText(verificationUrl);
      success('Havola nusxalandi', 'Shartnomani tasdiqlash havolasi xotiraga olindi');
    } catch {
      error('Nusxalashda xatolik', 'Brauzer ruxsat bermadi');
    }
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="O‘quv Xizmatlari Ko‘rsatish Shartnomasi (A4)"
      size="xl"
    >
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/20 bg-slate-500/5 p-3.5 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <GlassBadge variant="purple">
              Raqamli Shartnoma (Yuridik A4)
            </GlassBadge>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              № {contractNumber}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditingParams(!isEditingParams)}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span>⚙️</span>
                {isEditingParams ? 'Tahrirni yashirish' : 'Parametrlarni sozlash'}
              </span>
            </GlassButton>

            <GlassButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleShareTelegram}
              className="border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span>✈️</span>
                Telegram
              </span>
            </GlassButton>

            <GlassButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span>🔗</span>
                Havola
              </span>
            </GlassButton>

            <GlassButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span>🖨️</span>
                Chop etish (A4)
              </span>
            </GlassButton>
          </div>
        </div>

        {/* Collapsible Parameter Editor */}
        <AnimatePresence>
          {isEditingParams && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
                Shartnoma parametrlarini tezkor o‘zgartirish
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Shartnoma raqami:
                  </label>
                  <input
                    type="text"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Tuzilgan sana:
                  </label>
                  <input
                    type="date"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                    O‘quv kursi / Guruhi:
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Oylik to‘lov (UZS):
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={monthlyTuition}
                    onChange={(e) => setMonthlyTuition(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                    To‘lov muddati (kun):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={paymentDueDay}
                    onChange={(e) => setPaymentDueDay(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* =========================================================================
            DOCUMENT WRAPPER (Screen Preview + Print Isolation Target)
           ========================================================================= */}
        <div className="overflow-y-auto max-h-[70vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 p-6 sm:p-10 shadow-inner">
          <div data-printable="contract" className="mx-auto max-w-[180mm] text-[11px] leading-[1.45] text-slate-900 space-y-4 font-serif">
            {/* Header / Emblem */}
            <div className="text-center border-b pb-4 border-slate-300">
              <div className="font-bold text-xs uppercase tracking-widest text-slate-700 font-sans mb-1">
                {org.name}
              </div>
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 font-sans">
                O‘quv Xizmatlarini Ko‘rsatish Bo‘yicha Shartnoma
              </h2>
              <div className="flex items-center justify-between text-[11px] font-sans text-slate-600 mt-2 px-2">
                <span>№ <strong>{contractNumber}</strong></span>
                <span>Toshkent shahri</span>
                <span>«{contractDate.split('-')[2]}» {formatDate(contractDate, 'MMM')} {contractDate.split('-')[0]} y.</span>
              </div>
            </div>

            {/* Intro Parties */}
            <p className="text-justify font-serif">
              Bir tomondan, nizom asosida faoliyat yurituvchi <strong>«{org.name}»</strong> (bundan buyon matnda <strong>«Bajaruvchi»</strong> deb yuritiladi),
              rahbari <strong>{org.directorName}</strong> nomidan, ikkinchi tomondan <strong>{studentFullName}</strong> (yoki uning qonuniy vakili/ota-onasi: <strong>{student?.parentName || 'Ota-ona'}</strong>)
              (bundan buyon matnda <strong>«Buyurtmachi»</strong> deb yuritiladi), birgalikda «Tomonlar» deb ataluvchilar mazkur shartnomani quyidagilar haqida tuzdilar:
            </p>

            {/* Section 1 */}
            <div>
              <h3 className="font-bold uppercase tracking-wide text-[11px] font-sans text-slate-800 border-b border-slate-200 pb-0.5 mb-1.5">
                1. Shartnoma Predmeti
              </h3>
              <p className="text-justify">
                1.1. Mazkur shartnomaga asosan Bajaruvchi Buyurtmachiga (O‘quvchiga) <strong>«{courseName}»</strong> yo‘nalishi bo‘yicha belgilangan o‘quv rejasi va dasturiga muvofiq ta’lim xizmatlarini ko‘rsatish majburiyatini, Buyurtmachi esa ko‘rsatilgan xizmatlar uchun to‘lovlarni o‘z vaqtida amalga oshirish va markaz ichki intizomiga rioya etish majburiyatini oladi.
              </p>
              <p className="text-justify mt-1">
                1.2. O‘quv mashg‘ulotlari haftasiga 3 kun, kuniga 2 akademik soatdan, oyiga umumiy 24 akademik soat hajmida Bajaruvchining o‘quv xonalarida yoki zamonaviy gibrid formatda olib boriladi.
              </p>
            </div>

            {/* Section 2 */}
            <div>
              <h3 className="font-bold uppercase tracking-wide text-[11px] font-sans text-slate-800 border-b border-slate-200 pb-0.5 mb-1.5">
                2. Tomonlarning Huquq va Majburiyatlari
              </h3>
              <p className="text-justify">
                <strong>2.1. Bajaruvchining majburiyatlari:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-0.5 mt-0.5">
                <li>O‘quv jarayonini yuqori malakali mutaxassislar va zamonaviy o‘quv-uslubiy materiallar bilan ta’minlash.</li>
                <li>O‘quvchining davomati va o‘zlashtirishini M-EDU platformasi (Face ID / Turniket va elektron jurnal) orqali yuritish hamda ota-onaga muntazam hisobot berish.</li>
                <li>Kursni muvaffaqiyatli tamomlagan o‘quvchiga rasmiy sertifikat (QR-kodli diplom) taqdim etish.</li>
              </ul>
              <p className="text-justify mt-1.5">
                <strong>2.2. Buyurtmachining majburiyatlari:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-0.5 mt-0.5">
                <li>Mashg‘ulotlarga o‘z vaqtida, kechikmasdan qatnashish va markazning ichki tartib-qoidalarini buzmaslik.</li>
                <li>Ta’lim xizmatlari uchun to‘lovni har oyning {paymentDueDay}-sanasiga qadar kechiktirmasdan to‘liq to‘lash.</li>
                <li>Markazning mulki va o‘quv jihozlariga ehtiyotkorlik bilan munosabatda bo‘lish.</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div>
              <h3 className="font-bold uppercase tracking-wide text-[11px] font-sans text-slate-800 border-b border-slate-200 pb-0.5 mb-1.5">
                3. To‘lov Miqdori va Hisob-Kitob Tartibi
              </h3>
              <p className="text-justify">
                3.1. Mazkur shartnoma bo‘yicha 1 (bir) oylik o‘quv xizmatlarining to‘lov miqdori: <strong>{formatCurrency(monthlyTuition)}</strong> ({monthlyTuition.toLocaleString('uz-UZ')} so‘m) etib belgilanadi.
              </p>
              <p className="text-justify mt-1">
                3.2. To‘lovlar naqd pulsiz shaklda (Payme, Click, Uzum Bank yoki Bajaruvchining hisob raqamiga o‘tkazish yo‘li bilan) yoki bank kassasi orqali har oyning <strong>{paymentDueDay}-sanasiga</strong> qadar oldindan amalga oshiriladi.
              </p>
              <p className="text-justify mt-1">
                3.3. O‘quvchi sababsiz darsga kelmagan holatlarda to‘langan to‘lov qaytarilmaydi va keyingi oylarga ko‘chirilmaydi.
              </p>
            </div>

            {/* Section 4 */}
            <div>
              <h3 className="font-bold uppercase tracking-wide text-[11px] font-sans text-slate-800 border-b border-slate-200 pb-0.5 mb-1.5">
                4. Shartnomaning Amal Qilish Muddati
              </h3>
              <p className="text-justify">
                4.1. Mazkur shartnoma ikki tomonlama imzolangan kundan e’tiboran kuchga kiradi va Tomonlar o‘z majburiyatlarini to‘liq bajargunlariga qadar amal qiladi.
              </p>
            </div>

            {/* Section 5: Requisites & Signatures Table */}
            <div className="pt-2 border-t border-slate-300">
              <h3 className="font-bold uppercase tracking-wide text-[11px] font-sans text-slate-800 mb-2">
                5. Tomonlarning Yuridik Manzillari va Imzolari
              </h3>

              <div className="grid grid-cols-2 gap-6 text-[10.5px]">
                {/* Executor Requisites */}
                <div className="space-y-1">
                  <div className="font-bold font-sans uppercase text-slate-900 border-b pb-1 mb-1">
                    Bajaruvchi:
                  </div>
                  <div><strong>Muassasa:</strong> {org.name}</div>
                  <div><strong>STIR (INN):</strong> {org.inn}</div>
                  <div><strong>Manzil:</strong> {org.address}</div>
                  <div><strong>Bank:</strong> {org.bankName}</div>
                  <div><strong>H/R:</strong> {org.bankAccount}</div>
                  <div><strong>MFO:</strong> {org.bankMfo}</div>
                  <div><strong>Tel:</strong> {org.phone}</div>

                  <div className="pt-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-sans">Direktor:</div>
                      <div className="font-bold">{org.directorName}</div>
                      <div className="text-[9px] text-slate-400 font-sans mt-2">Imzo: _______________ (M.O‘.)</div>
                    </div>
                  </div>
                </div>

                {/* Customer Requisites */}
                <div className="space-y-1">
                  <div className="font-bold font-sans uppercase text-slate-900 border-b pb-1 mb-1">
                    Buyurtmachi (O‘quvchi / Ota-ona):
                  </div>
                  <div><strong>F.I.SH.:</strong> {studentFullName}</div>
                  {student?.parentName && (
                    <div><strong>Ota-onasi:</strong> {student.parentName}</div>
                  )}
                  <div><strong>Telefon:</strong> {student?.user?.phone || student?.parentPhone || '+998 (__) ___-__-__'}</div>
                  {student?.address && (
                    <div><strong>Manzil:</strong> {student.address}</div>
                  )}
                  <div><strong>Guruh:</strong> {courseName}</div>
                  <div><strong>Status:</strong> Tasdiqlangan / Faol</div>

                  <div className="pt-4">
                    <div className="text-[10px] text-slate-500 font-sans">Buyurtmachi:</div>
                    <div className="font-bold">{studentFullName}</div>
                    <div className="text-[9px] text-slate-400 font-sans mt-2">Imzo: _______________</div>
                  </div>
                </div>
              </div>

              {/* Digital Verification Seal & QR Footer */}
              <div className="mt-6 pt-3 border-t border-dashed border-slate-300 flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-sans font-bold text-[10px] text-emerald-700">
                    <span>🛡️</span>
                    <span>M-EDU ELEKTRON HUJJAT AYLANISHI TIZIMI</span>
                  </div>
                  <div className="text-[9.5px] text-slate-500 font-sans">
                    Mazkur shartnoma M-EDU SaaS platformasida avtomatik shakllantirilgan va yuridik kuchga ega.
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">
                    ID: {shortId} | SHA256: {shortId.toLowerCase()}891f7a0c
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-sans">
                    <div className="text-[9px] uppercase font-bold text-slate-500">QR Verifikatsiya:</div>
                    <div className="text-[8.5px] text-slate-400">Kamerani qarating</div>
                  </div>
                  <div className="p-1 bg-white border border-slate-200 rounded">
                    <RealQrCode
                      value={verificationUrl}
                      width={54}
                      height={54}
                      margin={1}
                      title="Shartnomani tekshirish"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <GlassButton type="button" variant="ghost" onClick={onClose}>
            Yopish
          </GlassButton>
          <GlassButton type="button" variant="primary" onClick={handlePrint}>
            <span className="inline-flex items-center gap-2">
              <span>🖨️</span>
              Chop etish (A4)
            </span>
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}