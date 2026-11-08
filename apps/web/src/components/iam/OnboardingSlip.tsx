import React from 'react';
import { RealQrCode } from '@/components/ui/RealQrCode';

export interface OnboardingCredentialRecord {
  id?: string;
  fullName: string;
  username: string;
  temporaryPassword?: string;
  role: string;
  organizationName?: string;
  branchName?: string;
  mustChangePassword?: boolean;
  provisionedAt?: string;
  provisionedBy?: string;
}

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  PLATFORM_OWNER: 'Platforma Egasi',
  SUPER_ADMIN: 'Bosh Administrator',
  ORG_ADMIN: 'Tashkilot Administratori',
  MANAGER: 'Menejer',
  TEACHER: "O'qituvchi",
  ASSISTANT: "Yordamchi O'qituvchi",
  STUDENT: "O'quvchi",
  PARENT: 'Ota-ona',
};

interface OnboardingSlipProps {
  record: OnboardingCredentialRecord;
  showCutLine?: boolean;
  compact?: boolean;
}

export const OnboardingSlip: React.FC<OnboardingSlipProps> = ({
  record,
  showCutLine = false,
  compact = false,
}) => {
  const loginUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login?u=${encodeURIComponent(record.username)}`
    : `https://medu.uz/login?u=${encodeURIComponent(record.username)}`;

  const roleName = ROLE_DISPLAY_NAMES[record.role] || record.role;
  const provisionedDate = record.provisionedAt || new Date().toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div className={`onboarding-slip-card relative w-full ${compact ? 'py-3' : 'py-5'}`}>
      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-900 bg-white p-5 text-slate-900 shadow-sm print:rounded-lg print:border-slate-800 print:p-4">
        {/* Top Watermark & Security Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-lg tracking-wider">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight uppercase">M-EDU</span>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Ta'lim Operatsion Tizimi
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600">
                {record.organizationName || 'Bosh Ta\'lim Tashkiloti'}
                {record.branchName ? ` • ${record.branchName}` : ''}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block rounded-md border border-slate-900 bg-slate-100 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-slate-900">
              Shaxsiy va Maxfiy
            </span>
            <p className="mt-1 text-[10px] font-mono text-slate-500">
              ID: {record.id ? record.id.slice(0, 8).toUpperCase() : record.username.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Recipient Details & Role */}
        <div className="mt-3.5 grid grid-cols-12 gap-3 items-center bg-slate-50 border border-slate-200 rounded-xl p-3 print:bg-slate-50/50">
          <div className="col-span-8">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
              Hisob Egasi (F.I.SH):
            </span>
            <span className="text-base font-bold text-slate-950 block">
              {record.fullName || 'Foydalanuvchi'}
            </span>
          </div>

          <div className="col-span-4 text-right">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
              Biriktirilgan Rol:
            </span>
            <span className="inline-block mt-0.5 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white tracking-wide">
              {roleName}
            </span>
          </div>
        </div>

        {/* Credentials Grid with QR code */}
        <div className="mt-3.5 grid grid-cols-12 gap-3 items-center">
          {/* Text Credentials */}
          <div className="col-span-8 space-y-2.5">
            <div className="rounded-xl border border-slate-300 bg-slate-100/60 p-2.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                Foydalanuvchi Nomi (Login):
              </span>
              <span className="mt-0.5 font-mono text-lg font-black tracking-wide text-slate-900 block select-all">
                @{record.username}
              </span>
            </div>

            <div className="rounded-xl border-2 border-dashed border-slate-900 bg-amber-50/60 p-2.5 print:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-900 print:text-slate-900">
                  Boshlang'ich Parol:
                </span>
                <span className="text-[10px] font-bold text-rose-700 uppercase print:text-slate-700">
                  {record.mustChangePassword !== false ? '• Birinchi kirishda almashtiriladi' : ''}
                </span>
              </div>
              <span className="mt-0.5 font-mono text-xl font-black tracking-widest text-slate-950 block select-all">
                {record.temporaryPassword || '••••••••'}
              </span>
            </div>
          </div>

          {/* QR Code */}
          <div className="col-span-4 flex flex-col items-center justify-center rounded-xl border border-slate-300 bg-white p-2 text-center">
            <RealQrCode
              value={loginUrl}
              className="h-24 w-24 print:h-20 print:w-20"
              level="M"
              margin={1}
            />
            <span className="mt-1 text-[9.5px] font-semibold text-slate-600">
              Kamera bilan kiring
            </span>
          </div>
        </div>

        {/* Security Rules & Instructions */}
        <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[11px] text-slate-700 print:text-[10px] print:p-2.5">
          <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1">
            Xavfsizlik qoidalari va yo'riqnoma:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              Ushbu hisob <strong>shaxsiy</strong> hisoblanadi. Parolni begonalarga berish yoki almashish <strong>qat'iyan taqiqlanadi</strong>.
            </li>
            <li>
              Tizimga ilk marta kirganingizda, xavfsizlik talablariga asosan ushbu boshlang'ich parolni o'zingizning yangi shaxsiy parolingizga <strong>almashtirishingiz shart</strong>.
            </li>
            <li>
              Parolni unutganingizda uni faqatgina <strong>Platforma Ma'muriyati</strong> orqali xavfsiz tiklashingiz mumkin.
            </li>
          </ul>
        </div>

        {/* Slip Footer with Authority stamp and date */}
        <div className="mt-3.5 flex items-center justify-between border-t border-slate-300 pt-2.5 text-[10px] text-slate-500">
          <div>
            <span>Rasmiylashtirildi: </span>
            <strong className="text-slate-800 font-mono">{provisionedDate}</strong>
            {record.provisionedBy && (
              <span> • Ma'mur: <strong className="text-slate-800">{record.provisionedBy}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span>Tasdiq: </span>
            <span className="rounded border border-slate-400 px-2 py-0.5 text-[9px] uppercase tracking-wider font-mono">
              PLATFORM OWNER IAM
            </span>
          </div>
        </div>
      </div>

      {/* Perforation Cut Line */}
      {showCutLine && (
        <div className="mt-4 flex items-center gap-2 text-slate-400 print:text-slate-500">
          <span className="text-xs">✂️</span>
          <div className="flex-1 border-b-2 border-dashed border-slate-300 print:border-slate-400" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Qirqish chizig'i</span>
          <div className="flex-1 border-b-2 border-dashed border-slate-300 print:border-slate-400" />
          <span className="text-xs">✂️</span>
        </div>
      )}
    </div>
  );
};
