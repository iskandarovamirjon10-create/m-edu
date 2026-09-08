import { usePageTitle } from '@/hooks/usePageTitle';
import { Link } from 'react-router-dom';

export function TermsPage() {
  usePageTitle('Terms of Service');
  return (
    <div className="page-container">
      <div className="orb-container" aria-hidden="true">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 glass-card" style={{ position: 'relative', zIndex: 1, padding: '32px' }}>
      <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        Terms of Service
      </h1>
      <div className="prose max-w-none space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <p>
          Welcome to M-EDU. These Terms of Service govern your use of the M-EDU
          education management platform, including all related websites, APIs,
          and services.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>1. Acceptance of Terms</h2>
        <p>
          By accessing or using M-EDU, you agree to be bound by these Terms. If
          you do not agree, do not use the service.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>2. Use of Service</h2>
        <p>
          M-EDU provides education management tools for organizations, including
          student management, attendance tracking, grading, payments, and face
          recognition features. You may use the service only for lawful purposes
          and in accordance with these Terms.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account
          credentials and for all activities that occur under your account. You
          must notify us immediately of any unauthorized use.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>4. Data</h2>
        <p>
          Your organization's data belongs to you. We process data on your behalf
          according to our Privacy Policy. We do not sell or share your data with
          third parties for marketing purposes.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>5. Termination</h2>
        <p>
          Either party may terminate this agreement. Upon termination, your right
          to use the service ceases. We will provide data export upon request.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Last updated: September 2026. These are placeholder terms for
          demonstration purposes. Consult a legal professional for production use.
        </p>
      </div>
      <Link to="/login" className="text-sm hover:underline" style={{ color: 'var(--m-vivid)' }}>
        ← Back to sign in
      </Link>
      </div>
    </div>
  );
}
