/**
 * Copilot Icons — a bespoke, iOS-27-geometry icon language for the AI surface.
 *
 * - Consistent 24px optical grid, 1.6 stroke, round caps and joins.
 * - Monoline controls + two-tone "liquid" brand marks.
 * - Every icon inherits `currentColor` and sizes via the `size` prop, so the
 *   day/night theme drives color without hard-coded fills.
 * - Decorative by default (`aria-hidden`), unless a `title` is supplied.
 */
import type { ReactNode, SVGProps } from 'react';

export interface CopilotIconProps
  extends Omit<SVGProps<SVGSVGElement>, 'children' | 'size' | 'strokeWidth' | 'title'> {
  size?: number;
  title?: string;
}

function Svg({
  size = 18,
  title,
  weight = 1.6,
  children,
  ...rest
}: CopilotIconProps & { children: ReactNode; weight?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ── Brand ─────────────────────────────────────────────────────────────── */

/** The Copilot orb: an aperture spark with a soft internal lens. */
export function IconCopilotMark({ size = 18, ...rest }: CopilotIconProps) {
  return (
    <Svg size={size} weight={1.5} {...rest}>
      <path d="M12 3.2c.55 3.9 2.35 5.7 6.25 6.25-3.9.55-5.7 2.35-6.25 6.25-.55-3.9-2.35-5.7-6.25-6.25C9.65 8.9 11.45 7.1 12 3.2Z" />
      <path d="M18.2 15.1c.25 1.75 1.05 2.55 2.8 2.8-1.75.25-2.55 1.05-2.8 2.8-.25-1.75-1.05-2.55-2.8-2.8 1.75-.25 2.55-1.05 2.8-2.8Z" opacity=".7" />
    </Svg>
  );
}

export function IconSpark(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5C9.7 9.4 11.4 7.7 12 3.5Z" />
    </Svg>
  );
}

/* ── Navigation ────────────────────────────────────────────────────────── */

export function IconHistory(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.2 4.4v4.2h4.2" />
      <path d="M12 8v4.4l2.9 1.7" />
    </Svg>
  );
}

export function IconCompose(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h16" />
      <path d="M14.5 3.8 19 8.3 9.6 17.7l-4.9 1.4 1.4-4.9L14.5 3.8Z" />
    </Svg>
  );
}

export function IconSidebarCollapse(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M9.5 4v16" />
      <path d="m15 9.5-2.5 2.5L15 14.5" />
    </Svg>
  );
}

export function IconSidebarExpand(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M9.5 4v16" />
      <path d="m13 9.5 2.5 2.5L13 14.5" />
    </Svg>
  );
}

export function IconCompass(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9 4.9-1.9Z" />
    </Svg>
  );
}

export function IconSearch(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function IconCommand(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6.5A2.5 2.5 0 1 0 6.5 9H9V6.5ZM9 17.5A2.5 2.5 0 1 1 6.5 15H9v2.5ZM15 6.5A2.5 2.5 0 1 1 17.5 9H15V6.5ZM15 17.5a2.5 2.5 0 1 0 2.5-2.5H15v2.5Z" />
      <path d="M9 9h6v6H9z" />
    </Svg>
  );
}

/* ── Composer ──────────────────────────────────────────────────────────── */

export function IconSend(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M4.3 11.3 19.6 4.6a.6.6 0 0 1 .8.8l-6.7 15.3a.6.6 0 0 1-1.1 0l-2.4-6.1-6.1-2.4a.6.6 0 0 1 .2-.9Z" />
      <path d="m10.2 13.8 4.6-4.6" opacity=".55" />
    </Svg>
  );
}

export function IconMic(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="3.2" width="6" height="10.6" rx="3" />
      <path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0" />
      <path d="M12 17.4v3.2" />
    </Svg>
  );
}

export function IconStop(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="7" width="10" height="10" rx="2.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconClose(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function IconPlus(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconChevronDown(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </Svg>
  );
}

export function IconArrowDown(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="m6.5 13.5 5.5 5.5 5.5-5.5" />
    </Svg>
  );
}

export function IconCheck(props: CopilotIconProps) {
  return (
    <Svg weight={2} {...props}>
      <path d="m4.8 12.4 4.6 4.6L19.2 7.2" />
    </Svg>
  );
}

export function IconDownload(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10.5" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 17.5v1.2A2.3 2.3 0 0 0 6.8 20.9h10.4a2.3 2.3 0 0 0 2.3-2.2v-1.2" />
    </Svg>
  );
}

export function IconTrash(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.8h15" />
      <path d="M9.5 4.4h5" />
      <path d="M6.8 6.8 7.7 19a1.8 1.8 0 0 0 1.8 1.6h5a1.8 1.8 0 0 0 1.8-1.6l.9-12.2" />
      <path d="M10.2 10.5v6M13.8 10.5v6" opacity=".55" />
    </Svg>
  );
}

export function IconCopy(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="3" />
      <path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-5A3.5 3.5 0 0 0 4 7.5v5A2.5 2.5 0 0 0 6.5 15" />
    </Svg>
  );
}

export function IconRefresh(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.2" />
      <path d="M19.8 4.8v4.4h-4.4" />
    </Svg>
  );
}

export function IconAttach(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M17.8 11.4 12 17.2a4.2 4.2 0 0 1-6-6l6.4-6.4a2.9 2.9 0 0 1 4.1 4.1l-6.4 6.4a1.5 1.5 0 0 1-2.1-2.1l5.8-5.8" />
    </Svg>
  );
}

export function IconKeyboard(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="2.8" y="6.4" width="18.4" height="11.2" rx="3" />
      <path d="M6.4 10h.01M9.6 10h.01M12.8 10h.01M16 10h.01M6.4 13.4h.01M9.6 13.4h.01M12.8 13.4h.01M16 13.4h.01M9 16.4h6" />
    </Svg>
  );
}

export function IconWave(props: CopilotIconProps & { bars?: number }) {
  const { bars = 4, ...rest } = props;
  return (
    <Svg {...rest}>
      {Array.from({ length: bars }).map((_, i) => (
        <path key={i} d={`M${5 + i * 3.6} ${9 + (i % 2)}v${6 - (i % 2) * 2}`} />
      ))}
    </Svg>
  );
}

/* ── Theme & comfort ───────────────────────────────────────────────────── */

export function IconSun(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4.1" />
      <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" />
    </Svg>
  );
}

export function IconMoon(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M20.2 14.4A8.3 8.3 0 0 1 9.6 3.8a8.5 8.5 0 1 0 10.6 10.6Z" />
    </Svg>
  );
}

export function IconSliders(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </Svg>
  );
}

export function IconSparkleToggle(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4v4M5 6h4" />
      <path d="M16.5 13.5 15 17l-1.5-3.5L10 12l3.5-1.5L15 7l1.5 3.5L20 12l-3.5 1.5Z" />
      <path d="M18 18.5v2M17 19.5h2" opacity=".6" />
    </Svg>
  );
}

export function IconShield(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.3 5 6v5.2c0 4.1 2.8 7.5 7 9.5 4.2-2 7-5.4 7-9.5V6l-7-2.7Z" />
      <path d="m9.2 12 2 2 3.6-3.8" opacity=".7" />
    </Svg>
  );
}

export function IconPin(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 3.8h6l-.8 5 3 3.2v1.6H6.8V12l3-3.2-.8-5Z" />
      <path d="M12 13.6v6.6" />
    </Svg>
  );
}

export function IconModels(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <path d="M8.4 9.6h7.2M8.4 12.4h7.2M8.4 15.2h4.4" opacity=".8" />
    </Svg>
  );
}

export function IconGlobe(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.4 12h17.2M12 3.4c2.4 2.3 3.6 5.2 3.6 8.6s-1.2 6.3-3.6 8.6c-2.4-2.3-3.6-5.2-3.6-8.6S9.6 5.7 12 3.4Z" />
    </Svg>
  );
}

export function IconInfo(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5.4M12 7.8h.01" />
    </Svg>
  );
}

export function IconChevronRight(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />
    </Svg>
  );
}

/* ── Capabilities ──────────────────────────────────────────────────────── */

export function IconAttendance(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="5" width="17.2" height="15.4" rx="3.6" />
      <path d="M7.6 3.4v3.2M16.4 3.4v3.2M3.4 9.4h17.2" />
      <path d="m9 14.4 2 2 3.8-4" opacity=".85" />
    </Svg>
  );
}

export function IconSchedule(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="5" width="17.2" height="15.4" rx="3.6" />
      <path d="M7.6 3.4v3.2M16.4 3.4v3.2M3.4 9.4h17.2" />
      <path d="M7.8 13h3M13.4 13h2.8M7.8 16.6h2.4" />
    </Svg>
  );
}

export function IconStudents(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <circle cx="9.4" cy="8.6" r="3.2" />
      <path d="M3.8 19.2c.4-3 2.7-4.8 5.6-4.8s5.2 1.8 5.6 4.8" />
      <path d="M15.8 6.2a3 3 0 0 1 0 5.8M17.2 14.9c2 .5 3.2 2.1 3.5 4.3" opacity=".75" />
    </Svg>
  );
}

export function IconFinance(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6.2" width="18" height="12.6" rx="3.4" />
      <path d="M3 10.4h18" opacity=".6" />
      <path d="M16.4 15.4h2.2" />
    </Svg>
  );
}

export function IconReport(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.4h7.4L19 9v9.6a2.4 2.4 0 0 1-2.4 2.4H6a2.4 2.4 0 0 1-2.4-2.4V5.8A2.4 2.4 0 0 1 6 3.4Z" />
      <path d="M13.2 3.6V9H19" />
      <path d="M7.6 13h6M7.6 16.2h4" opacity=".75" />
    </Svg>
  );
}

export function IconMegaphone(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M4.4 10.2v3.6a2 2 0 0 0 2 2h1.8l5.6 3.4V4.8L8.2 8.2H6.4a2 2 0 0 0-2 2Z" />
      <path d="M17.4 9.2a3.8 3.8 0 0 1 0 5.6M19.8 6.8a7 7 0 0 1 0 10.4" opacity=".65" />
    </Svg>
  );
}

export function IconMaximize(props: CopilotIconProps) {
  return (
    <Svg {...props}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </Svg>
  );
}

export type CopilotIcon = (props: CopilotIconProps) => JSX.Element;
