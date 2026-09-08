import { usePageTitle } from '@/hooks/usePageTitle';
import { Link } from 'react-router-dom';

export function PrivacyPage() {
  usePageTitle('Privacy Policy');
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
        Privacy Policy
      </h1>
      <div className="prose max-w-none space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <p>
          This Privacy Policy describes how M-EDU collects, uses, and protects
          your personal information when you use our education management
          platform.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>1. Information We Collect</h2>
        <p>
          We collect information you provide directly, including account
          registration details (name, email), student and teacher records
          managed by your organization, attendance data, grades, payment
          information, and face biometric templates when enrolled.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>2. How We Use Information</h2>
        <p>
          We use your information to provide and improve the M-EDU service,
          process attendance via face recognition, generate reports and analytics,
          and communicate service-related notices.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>3. Biometric Data</h2>
        <p>
          Face recognition templates are encrypted at rest using AES-256-GCM
          and are only used for attendance verification within your organization.
          Biometric data is never shared with third parties or used for any
          purpose other than the stated attendance feature.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>4. Data Security</h2>
        <p>
          We implement industry-standard security measures including encryption
          in transit (TLS) and at rest, role-based access control, rate limiting,
          and audit logging. No system is 100% secure, but we take reasonable
          measures to protect your data.
        </p>
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>5. Data Retention</h2>
        <p>
          Your data is retained as long as your account is active. Upon account
          deletion, we will remove your personal data within 30 days, except
          where required by law.
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
