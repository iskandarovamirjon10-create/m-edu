/**
 * UnauthorizedPage — Ultra Premium Apple-Style 403 Error
 * Features soft ambient blurs, deep frosted glass container, fluid 
 * typography, and high-end squircle iconography.
 */
import { useNavigate} from'react-router-dom';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { GlassButton } from '@/components/ui';

export function UnauthorizedPage() {
 const { t } = useI18n();
 usePageTitle(t('error.forbiddenTitle'));
 const navigate = useNavigate();

 return (
 <div className="relative flex min-h-screen items-center justify-center bg-transparent overflow-hidden selection:bg-brand-500/30 p-4">
 
 {/* Soft Apple-style Background Ambient Orbs (Warning Theme) */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden>
 {/* Soft rose/orange ambient lights for a subtle "restricted"feel without being aggressive */}
 <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-rose-400/10 blur-[120px] animate-pulse-slow"/>
 <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[50%] rounded-full bg-orange-400/10 blur-[100px]"/>
 </div>

 {/* Main Glass Card */}
 <div className="relative z-10 w-full max-w-[28rem] rounded-[3rem] glass-card p-10 sm:p-12 text-center animate-in fade-in zoom-in-95 duration-700 ease-out fill-mode-both">
 
 {/* Inner Highlight for 3D Edge */}
 <div className="absolute inset-0 rounded-[3rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="relative z-10">
 
 {/* iOS Squircle Icon Container */}
 <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[1.75rem] mb-6 group">
 {/* Ambient inner glow */}
 <div className="absolute inset-0 rounded-[1.75rem] bg-gray-200/50 blur-xl group-hover:blur-2xl transition-all duration-500"/>
 
 {/* Surface */}
 <div className="relative flex h-full w-full items-center justify-center rounded-[1.75rem] bg-gradient-to-b from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 shadow-inner border border-white/60 transition-transform duration-500 group-hover:scale-105">
 <svg
 className="h-9 w-9 text-[var(--text-muted)]"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.8"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>
 </svg>
 </div>
 </div>

 {/* Typography */}
 <h1 className="text-[4.5rem] leading-none font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-gray-900 to-gray-400 dark:from-white dark:to-gray-600 mb-2 drop-shadow-sm">
 403
 </h1>
 <h2 className="text-[1.25rem] font-extrabold text-[var(--text-primary)] tracking-tight mb-3">
 {t('unauthorized.heading')}
 </h2>
 <p className="text-[0.95rem] leading-relaxed font-medium text-[var(--text-muted)] mb-10 max-w-[16rem] mx-auto">
 {t('unauthorized.description')}
 </p>

 {/* Action Buttons */}
 <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
 <GlassButton
 type="button"
 variant="primary"
 className="w-full sm:w-auto"
 onClick={() => navigate(-1)}
 >
 {t('unauthorized.goBack')}
 </GlassButton>
 <GlassButton
 type="button"
 variant="secondary"
 className="w-full sm:w-auto"
 onClick={() => navigate('/')}
 >
 {t('nav.dashboard')}
 </GlassButton>
 </div>
 </div>
 </div>
 </div>
 );
}

export default UnauthorizedPage;