import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { Link } from 'react-router-dom';

export function TermsPage() {
  const { t } = useI18n();
  usePageTitle(t('terms.title'));
  return (
    <div className="page-container">
      

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 glass-card" style={{ position: 'relative', zIndex: 1, padding: '32px' }}>
      <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {t('terms.title')}
      </h1>
      <div className="prose max-w-none space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <p>
          {t('terms.intro')}
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('terms.section1Title')}</h2>
        <p>
          {t('terms.section1Body')}
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('terms.section2Title')}</h2>
        <p>
          {t('terms.section2Body')}
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('terms.section3Title')}</h2>
        <p>
          {t('terms.section3Body')}
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('terms.section4Title')}</h2>
        <p>
          {t('terms.section4Body')}
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('terms.section5Title')}</h2>
        <p>
          {t('terms.section5Body')}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('terms.footer')}
        </p>
      </div>
      <Link to="/login" className="text-sm hover:underline" style={{ color: 'var(--m-vivid)' }}>
        ← {t('auth.backToSignIn')}
      </Link>
      </div>
    </div>
  );
}
