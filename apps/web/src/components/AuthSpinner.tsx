/**
 * AuthSpinner — the small inline spinner used by the auth screens
 * (Login / ForgotPassword / ResetPassword).
 *
 * Previously this exact SVG was copy-pasted as a local `Spinner` into each of
 * those three pages. It is extracted here so the auth flow has one source of
 * truth and stays visually identical.
 */
export function AuthSpinner({ className ='h-5 w-5 animate-spin'}: { className?: string}) {
 return (
 <svg className={className} viewBox="0 0 24 24"fill="none"aria-hidden="true">
 <circle cx="12"cy="12"r="10"stroke="currentColor"strokeWidth="3"className="opacity-20"/>
 <path d="M12 2a10 10 0 0 1 10 10"stroke="currentColor"strokeWidth="3"strokeLinecap="round"className="opacity-80"/>
 </svg>
 );
}

export default AuthSpinner;
