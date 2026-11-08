/**
 * MarkdownContent — Premium Edition v2 (Spatial Glass & Callouts)
 *
 * Safe, HTML-free markdown renderer for AI replies.
 *
 * Craft:
 *  - Suite-consistent tokens (--ai-*) throughout
 *  - Callout alerts: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION], [!RECOMMENDATION], [!SUCCESS]
 *  - Refined typography scale (15px base, 1.7 line-height, tracking-tight)
 *  - Premium code blocks: subtle inset highlight + monospace + copy-friendly
 *  - Premium inline code: soft chip with hairline border
 *  - Premium tables: hairline borders, alternating rows, uppercase header
 *  - Premium lists: custom bullets, tight nesting, generous spacing
 *  - Internal Links: instant SPA routing via 'medu:navigate' event (no full-page reloads)
 *
 * Everything is rendered as React elements: no `dangerouslySetInnerHTML`,
 * no HTML strings, therefore no script/style injection is possible.
 */

import { useMemo, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import {
  Check,
  Copy,
  Terminal,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';

/* ----------------------------- inline ----------------------------- */

const INLINE_SOURCE = [
  '(`[^`\\n]+`)',
  '(\\*\\*[^*]+\\*\\*)',
  '(\\*[^*\\n]+\\*)',
  '(_[^_\\n]+_)',
  '(\\[[^\\]]+\\]\\([^)\\s]+\\))',
  '(~~[^~]+~~)',
].join('|');

export const ALLOWED_INTERNAL_PREFIXES = [
  '/attendance',
  '/payments',
  '/invoices',
  '/schedule',
  '/students',
  '/teachers',
  '/groups',
  '/courses',
  '/settings',
  '/dashboard',
  '/analytics',
  '/reports',
  '/leads',
  '/branches',
  '/rooms',
  '/finance',
  '/inventory',
  '/tasks',
  '/homework',
  '/academic-risk',
  '/notifications',
  '/teacher-cockpit',
  '/ai-copilot',
] as const;

export function isSafeInternalRoute(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//') || trimmed.includes('\\')) return false;
  if (trimmed.includes('..')) return false;
  if (trimmed.toLowerCase().includes('javascript:') || trimmed.toLowerCase().includes('data:')) return false;

  return ALLOWED_INTERNAL_PREFIXES.some(
    (prefix) =>
      trimmed === prefix ||
      trimmed.startsWith(`${prefix}/`) ||
      trimmed.startsWith(`${prefix}?`) ||
      trimmed.startsWith(`${prefix}#`)
  );
}

function isSafeHref(url: string): boolean {
  const value = url.trim().toLowerCase();
  if (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('mailto:')
  ) {
    return true;
  }
  if (value.startsWith('/')) {
    return isSafeInternalRoute(url);
  }
  if (value.startsWith('#')) {
    return true;
  }
  return false;
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let cursor = 0;
  const pattern = new RegExp(INLINE_SOURCE, 'g');

  let match = pattern.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyBase}-${cursor}`;
    cursor += 1;

    const [raw, code, bold, italicStar, italicUnderscore, link, strike] = match;

    if (code) {
      nodes.push(
        <code
          key={key}
          className="mx-[1px] inline-flex items-center rounded-md px-[6px] py-[1px] font-mono text-[0.86em] font-medium leading-[1.5]"
          style={{
            background: 'var(--ai-bg-hover, rgba(0,0,0,0.04))',
            color: 'var(--ai-text-primary, #1D1D1F)',
            border: '1px solid var(--ai-border, rgba(0,0,0,0.06))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          {code.slice(1, -1)}
        </code>,
      );
    } else if (bold) {
      nodes.push(
        <strong
          key={key}
          className="font-bold tracking-[-0.005em]"
          style={{ color: 'var(--ai-text-primary, #1D1D1F)' }}
        >
          {renderInline(bold.slice(2, -2), `${key}b`)}
        </strong>,
      );
    } else if (italicStar || italicUnderscore) {
      const inner = (italicStar ?? italicUnderscore ?? '').slice(1, -1);
      nodes.push(
        <em
          key={key}
          className="italic tracking-[-0.005em]"
          style={{ color: 'var(--ai-text-primary, #1D1D1F)' }}
        >
          {renderInline(inner, `${key}i`)}
        </em>,
      );
    } else if (link) {
      const split = link.lastIndexOf('](');
      const label = link.slice(1, split);
      const href = link.slice(split + 2, -1);
      if (isSafeHref(href)) {
        const isInternal = href.startsWith('/');
        nodes.push(
          <a
            key={key}
            href={href}
            onClick={
              isInternal
                ? (e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(
                          new CustomEvent('medu:navigate', { detail: { path: href } })
                        );
                      }
                    }
                  }
                : undefined
            }
            target={isInternal ? undefined : '_blank'}
            rel={isInternal ? undefined : 'noopener noreferrer nofollow'}
            className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-[3px] decoration-[1.5px] transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai-primary)]/40 rounded-sm hover:opacity-90"
            style={{
              color: 'var(--ai-primary, #007AFF)',
              textDecorationColor: 'color-mix(in srgb, var(--ai-primary, #007AFF) 40%, transparent)',
            }}
          >
            {renderInline(label, `${key}a`)}
          </a>,
        );
      } else {
        nodes.push(`${label} (${href})`);
      }
    } else if (strike) {
      nodes.push(
        <s key={key} style={{ color: 'var(--ai-text-muted, #86868B)' }}>
          {strike.slice(2, -2)}
        </s>,
      );
    }

    lastIndex = match.index + raw.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/* ------------------------------ blocks ---------------------------- */

export type CalloutType =
  | 'NOTE'
  | 'TIP'
  | 'IMPORTANT'
  | 'WARNING'
  | 'CAUTION'
  | 'RECOMMENDATION'
  | 'SUCCESS';

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; code: string; lang?: string }
  | { kind: 'quote'; text: string }
  | { kind: 'callout'; alertType: CalloutType; text: string }
  | { kind: 'hr' }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

interface ListItem {
  id: string;
  text: string;
  children: ListItem[];
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const UNORDERED_RE = /^(\s*)[-*+]\s+(.*)$/;
const HR_RE = /^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE_RE = /^\s*```/;

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function indentDepth(raw: string): number {
  return raw.replace(/\t/g, '  ').length >= 2 ? 1 : 0;
}

function pushListItem(items: ListItem[], item: ListItem, depth: number): void {
  if (depth === 0 || items.length === 0) {
    items.push(item);
    return;
  }
  const parent = items[items.length - 1];
  parent.children.push(item);
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (FENCE_RE.test(line)) {
      const code: string[] = [];
      const langMatch = line.match(/^\s*```(\w+)?/);
      const lang = langMatch?.[1];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ kind: 'code', code: code.join('\n'), lang });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (HR_RE.test(line) && !UNORDERED_RE.test(line)) {
      blocks.push({ kind: 'hr' });
      index += 1;
      continue;
    }

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      const rawText = quote.join('\n').trim();
      const calloutMatch = rawText.match(
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|RECOMMENDATION|SUCCESS|MUHIM|MASLAHAT|OGOHLANTIRISH|ESLATMA)\](?:\s*([^\n\r]*))?(?:\r?\n)?([\s\S]*)$/i
      );

      if (calloutMatch) {
        const rawAlert = calloutMatch[1].toUpperCase();
        let alertType: CalloutType = 'NOTE';
        if (rawAlert === 'TIP' || rawAlert === 'MASLAHAT') alertType = 'TIP';
        else if (rawAlert === 'RECOMMENDATION') alertType = 'RECOMMENDATION';
        else if (rawAlert === 'IMPORTANT' || rawAlert === 'MUHIM') alertType = 'IMPORTANT';
        else if (rawAlert === 'WARNING' || rawAlert === 'OGOHLANTIRISH') alertType = 'WARNING';
        else if (rawAlert === 'CAUTION') alertType = 'CAUTION';
        else if (rawAlert === 'SUCCESS') alertType = 'SUCCESS';
        else alertType = 'NOTE';

        const titleExtra = calloutMatch[2]?.trim();
        const bodyText = calloutMatch[3]?.trim() || '';
        const combinedText = titleExtra ? (bodyText ? `${titleExtra}\n${bodyText}` : titleExtra) : bodyText;

        blocks.push({ kind: 'callout', alertType, text: combinedText });
      } else {
        blocks.push({ kind: 'quote', text: rawText });
      }
      continue;
    }

    const unordered = UNORDERED_RE.exec(line);
    const ordered = ORDERED_RE.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: ListItem[] = [];
      let listId = 0;

      while (index < lines.length) {
        const current = lines[index];
        const currentOrdered = ORDERED_RE.exec(current);
        const currentUnordered = UNORDERED_RE.exec(current);
        if (!currentOrdered && !currentUnordered) break;
        if (currentOrdered && !isOrdered) break;
        if (currentUnordered && isOrdered) break;

        const match = (isOrdered ? currentOrdered : currentUnordered) as RegExpExecArray;
        const depth = indentDepth(match[1]);
        const text = isOrdered ? match[3] : match[2];
        listId += 1;
        pushListItem(items, { id: `li-${index}-${listId}`, text, children: [] }, depth);
        index += 1;
      }

      blocks.push({ kind: 'list', ordered: isOrdered, items });
      continue;
    }

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index];
      if (
        next.trim() === '' ||
        FENCE_RE.test(next) ||
        HEADING_RE.test(next) ||
        HR_RE.test(next) ||
        UNORDERED_RE.test(next) ||
        ORDERED_RE.test(next) ||
        /^\s*>/.test(next)
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

/* ----------------------------- rendering -------------------------- */

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-[1.25rem] font-bold tracking-[-0.02em] leading-[1.3]',
  2: 'text-[1.1rem]  font-bold tracking-[-0.015em] leading-[1.35]',
  3: 'text-[1rem]    font-semibold tracking-[-0.01em] leading-[1.4]',
  4: 'text-[0.94rem] font-semibold tracking-[-0.005em] leading-[1.4]',
  5: 'text-[0.82rem] font-semibold uppercase tracking-[0.06em]',
  6: 'text-[0.78rem] font-semibold uppercase tracking-[0.08em]',
};

function renderListItems(items: ListItem[], ordered: boolean, keyBase: string, depth = 0): ReactNode {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag
      className={[
        ordered ? 'list-decimal' : 'list-disc',
        'pl-5 space-y-1',
        depth > 0 ? 'mt-1' : '',
      ].join(' ')}
      style={{
        listStylePosition: 'outside',
      }}
    >
      {items.map((item, position) => (
        <li
          key={item.id ? `${keyBase}-${item.id}` : `${keyBase}-${position}`}
          className="leading-[1.65] tracking-[-0.005em] marker:text-[var(--ai-text-soft,#A1A1A6)]"
          style={{ color: 'var(--ai-text-primary, #1D1D1F)' }}
        >
          <span className="pl-0.5">{renderInline(item.text, `${keyBase}-${position}-t`)}</span>
          {item.children.length > 0 &&
            renderListItems(item.children, ordered, `${keyBase}-${position}-n`, depth + 1)}
        </li>
      ))}
    </Tag>
  );
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'import', 'export', 'from',
  'class', 'interface', 'type', 'extends', 'implements', 'if', 'else',
  'for', 'while', 'switch', 'case', 'break', 'continue', 'default',
  'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'typeof',
  'instanceof', 'void', 'yield', 'public', 'private', 'protected', 'static',
  'readonly', 'as', 'in', 'of', 'def', 'elif', 'lambda', 'pass', 'print',
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'SET', 'DELETE',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT',
]);

const LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'None', 'True', 'False',
]);

function highlightCodeTokens(source: string): ReactNode[] {
  const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|[^\s\w]+|\s+)/g;
  const nodes: ReactNode[] = [];
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = regex.exec(source)) !== null) {
    const token = match[0];
    const key = `tok-${keyIndex++}`;

    if (token.startsWith('//') || token.startsWith('/*') || token.startsWith('#')) {
      nodes.push(
        <span key={key} className="text-[#8e8e93] dark:text-[#71717a] italic">
          {token}
        </span>
      );
    } else if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('`') && token.endsWith('`'))
    ) {
      nodes.push(
        <span key={key} className="text-[#2e7d32] dark:text-[#4ade80]">
          {token}
        </span>
      );
    } else if (/^\d+(\.\d+)?$/.test(token)) {
      nodes.push(
        <span key={key} className="text-[#e65100] dark:text-[#fb923c]">
          {token}
        </span>
      );
    } else if (KEYWORDS.has(token)) {
      nodes.push(
        <span key={key} className="font-semibold text-[#6a1b9a] dark:text-[#c084fc]">
          {token}
        </span>
      );
    } else if (LITERALS.has(token)) {
      nodes.push(
        <span key={key} className="font-semibold text-[#c2185b] dark:text-[#f43f5e]">
          {token}
        </span>
      );
    } else {
      nodes.push(token);
    }
  }

  return nodes.length > 0 ? nodes : [source];
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      /* ignore */
    }
  }, [code]);

  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const highlighted = useMemo(() => highlightCodeTokens(code), [code]);

  return (
    <div className="group/code relative my-3.5 overflow-hidden rounded-2xl border border-[var(--ai-border,rgba(0,0,0,0.08))] bg-[var(--ai-bg-elevated,#FAFAFC)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--ai-border,rgba(0,0,0,0.06))] bg-[var(--ai-bg-hover,rgba(0,0,0,0.02))] px-3.5 py-1.5 text-[11px] font-medium text-[var(--ai-text-muted,#86868B)]">
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-[var(--ai-primary,#007AFF)]" />
          <span className="font-bold uppercase tracking-wider text-[10px]">
            {lang || 'code'}
          </span>
          <span className="opacity-40">·</span>
          <span className="text-[10px] opacity-75">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all hover:bg-[var(--ai-bg-hover,rgba(0,0,0,0.08))] text-[var(--ai-text-primary,#1D1D1F)]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} />
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Nusxalandi!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 opacity-70" strokeWidth={1.8} />
              <span className="text-[10px]">Nusxalash</span>
            </>
          )}
        </button>
      </div>

      <pre
        className="overflow-x-auto p-4 text-[0.84rem] leading-[1.65]"
        style={{
          background: 'transparent',
          color: 'var(--ai-text-primary, #1D1D1F)',
        }}
      >
        <code className="font-mono whitespace-pre">{highlighted}</code>
      </pre>
    </div>
  );
}

/* ----------------------------- Callout Block ---------------------- */

const CALLOUT_CONFIG: Record<
  CalloutType,
  {
    title: string;
    fg: string;
    bg: string;
    border: string;
    glow: string;
    icon: (className?: string) => ReactNode;
  }
> = {
  NOTE: {
    title: 'Eslatma',
    fg: '#007AFF',
    bg: 'rgba(0, 122, 255, 0.08)',
    border: 'rgba(0, 122, 255, 0.25)',
    glow: 'rgba(0, 122, 255, 0.20)',
    icon: (c = 'h-4 w-4') => <Info className={c} strokeWidth={2.2} />,
  },
  TIP: {
    title: 'Maslahat va Tavsiya',
    fg: '#D97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.25)',
    glow: 'rgba(217, 119, 6, 0.20)',
    icon: (c = 'h-4 w-4') => <Lightbulb className={c} strokeWidth={2.2} />,
  },
  RECOMMENDATION: {
    title: 'Boshqaruv Qarori',
    fg: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.08)',
    border: 'rgba(99, 102, 241, 0.25)',
    glow: 'rgba(99, 102, 241, 0.20)',
    icon: (c = 'h-4 w-4') => <Sparkles className={c} strokeWidth={2.2} />,
  },
  IMPORTANT: {
    title: "Muhim E'tibor",
    fg: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.08)',
    border: 'rgba(139, 92, 246, 0.25)',
    glow: 'rgba(139, 92, 246, 0.20)',
    icon: (c = 'h-4 w-4') => <Sparkles className={c} strokeWidth={2.2} />,
  },
  WARNING: {
    title: 'Ogohlantirish',
    fg: '#EA580C',
    bg: 'rgba(234, 88, 12, 0.08)',
    border: 'rgba(234, 88, 12, 0.25)',
    glow: 'rgba(234, 88, 12, 0.20)',
    icon: (c = 'h-4 w-4') => <AlertTriangle className={c} strokeWidth={2.2} />,
  },
  CAUTION: {
    title: 'Kritik Xavf',
    fg: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.25)',
    glow: 'rgba(239, 68, 68, 0.20)',
    icon: (c = 'h-4 w-4') => <AlertOctagon className={c} strokeWidth={2.2} />,
  },
  SUCCESS: {
    title: 'Muvaffaqiyatli',
    fg: '#10B981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    glow: 'rgba(16, 185, 129, 0.20)',
    icon: (c = 'h-4 w-4') => <CheckCircle2 className={c} strokeWidth={2.2} />,
  },
};

function CalloutBlock({ alertType, text }: { alertType: CalloutType; text: string }) {
  const cfg = CALLOUT_CONFIG[alertType] ?? CALLOUT_CONFIG.NOTE;

  return (
    <div
      className="relative my-3.5 overflow-hidden rounded-2xl border p-3.5 sm:p-4 text-[13.5px] leading-relaxed shadow-sm transition-all"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 20px -8px ${cfg.glow}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div
        className="flex items-center gap-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: cfg.fg }}
      >
        <span className="shrink-0">{cfg.icon('h-4 w-4')}</span>
        <span>{cfg.title}</span>
      </div>
      <div
        className="text-[var(--ai-text-primary,#1D1D1F)] leading-[1.65]"
        style={{ overflowWrap: 'anywhere' }}
      >
        {renderInline(text, `callout-${alertType}`)}
      </div>
    </div>
  );
}

function renderBlock(block: Block, index: number): ReactNode {
  const key = `b${index}`;

  switch (block.kind) {
    case 'heading': {
      const level = Math.min(Math.max(block.level, 1), 6);
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const isSmall = level >= 5;
      return (
        <Tag
          key={key}
          className={[
            'first:mt-0',
            level <= 4 ? 'mt-5 mb-2' : 'mt-4 mb-1.5',
            HEADING_CLASSES[level] ?? HEADING_CLASSES[4],
          ].join(' ')}
          style={{
            color: isSmall
              ? 'var(--ai-text-muted, #86868B)'
              : 'var(--ai-text-primary, #1D1D1F)',
          }}
        >
          {renderInline(block.text, key)}
        </Tag>
      );
    }

    case 'paragraph':
      return (
        <p
          key={key}
          className="my-2.5 leading-[1.7] tracking-[-0.005em] first:mt-0 last:mb-0"
          style={{ color: 'var(--ai-text-primary, #1D1D1F)' }}
        >
          {renderInline(block.text, key)}
        </p>
      );

    case 'code':
      return <CodeBlock key={key} code={block.code} lang={block.lang} />;

    case 'callout':
      return <CalloutBlock key={key} alertType={block.alertType} text={block.text} />;

    case 'quote':
      return (
        <blockquote
          key={key}
          className="my-3 rounded-r-lg py-1 pl-4 pr-3 text-[0.92rem] italic leading-[1.65]"
          style={{
            borderLeft: '3px solid var(--ai-primary, #007AFF)',
            background: 'color-mix(in srgb, var(--ai-primary, #007AFF) 6%, transparent)',
            color: 'var(--ai-text-muted, #86868B)',
          }}
        >
          {renderInline(block.text, key)}
        </blockquote>
      );

    case 'hr':
      return (
        <hr
          key={key}
          className="my-4 border-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--ai-border, rgba(0,0,0,0.10)) 20%, var(--ai-border, rgba(0,0,0,0.10)) 80%, transparent)',
          }}
        />
      );

    case 'list':
      return (
        <div
          key={key}
          className="my-3 text-[0.93rem] tracking-[-0.005em] [&_ol_ul]:my-1 [&_ul_ul]:my-1 [&_ol]:my-0 [&_ul]:my-0"
        >
          {renderListItems(block.items, block.ordered, key, 0)}
        </div>
      );

    case 'table':
      return (
        <div
          key={key}
          className="my-3.5 overflow-x-auto rounded-2xl border border-[var(--ai-border,rgba(0,0,0,0.08))] bg-[var(--ai-bg-glass,rgba(255,255,255,0.7))] shadow-sm backdrop-blur-md"
        >
          <table className="w-full border-collapse text-[0.875rem]">
            <thead>
              <tr className="border-b border-[var(--ai-border,rgba(0,0,0,0.08))] bg-black/[0.03] dark:bg-white/[0.04]">
                {block.header.map((cell, position) => (
                  <th
                    key={`${key}-h-${position}`}
                    className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--ai-text-muted,#86868B)]"
                  >
                    {renderInline(cell, `${key}-h-${position}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ai-border,rgba(0,0,0,0.05))]">
              {block.rows.map((row, rowIndex) => (
                <tr
                  key={`${key}-r-${rowIndex}`}
                  className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  {row.map((cell, position) => (
                    <td
                      key={`${key}-c-${rowIndex}-${position}`}
                      className="px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--ai-text-primary,#1D1D1F)]"
                    >
                      {renderInline(cell, `${key}-c-${rowIndex}-${position}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

export interface ParsedThought {
  thoughtText: string | null;
  isStreamingThought: boolean;
  cleanContent: string;
}

export function extractThought(rawContent: string): ParsedThought {
  if (!rawContent) {
    return { thoughtText: null, isStreamingThought: false, cleanContent: '' };
  }

  // 1. Match all completed <think>...</think> or <thought>...</thought>
  const thinkClosedRegex = /<(think|thought)>([\s\S]*?)<\/\1>/gi;
  const thoughts: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = thinkClosedRegex.exec(rawContent)) !== null) {
    const text = match[2].trim();
    if (text) {
      thoughts.push(text);
    }
  }

  let cleanContent = rawContent.replace(thinkClosedRegex, '').trim();

  // 2. Match unclosed <think> or <thought> (active streaming)
  const openMatch = cleanContent.match(/<(think|thought)>([\s\S]*)$/i);
  let isStreamingThought = false;
  if (openMatch) {
    isStreamingThought = true;
    const partial = openMatch[2].trim();
    if (partial) {
      thoughts.push(partial);
    }
    cleanContent = cleanContent.slice(0, openMatch.index).trim();
  }

  const thoughtText = thoughts.length > 0 ? thoughts.join('\n\n') : null;
  return {
    thoughtText,
    isStreamingThought,
    cleanContent,
  };
}

export interface AiThinkingAccordionProps {
  thought: string;
  isStreaming?: boolean;
}

export function AiThinkingAccordion({ thought, isStreaming = false }: AiThinkingAccordionProps) {
  const [isOpen, setIsOpen] = useState(isStreaming);
  const wordCount = useMemo(() => {
    return thought.trim().split(/\s+/).filter(Boolean).length;
  }, [thought]);

  return (
    <div
      data-testid="ai-thinking-accordion"
      className="mb-3.5 overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.05] via-purple-500/[0.02] to-transparent shadow-[0_4px_20px_-4px_rgba(139,92,246,0.12)] backdrop-blur-md transition-all duration-300 dark:border-violet-400/25 dark:from-violet-500/[0.10]"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-violet-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-sm">
            <Sparkles className={`h-3.5 w-3.5 ${isStreaming ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            {isStreaming && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500"></span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold tracking-tight text-violet-950 dark:text-violet-100">
              {isStreaming ? "Fikrlash jarayoni (Tahlil qilinmoqda...)" : "Fikrlash jarayoni (Thinking Process)"}
            </span>
            <span className="hidden sm:inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
              {isStreaming ? "Jonli tahlil" : `${wordCount} ta so'z`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-violet-600/70 dark:text-violet-400/70">
          <span className="text-[11px] font-medium hidden sm:inline">
            {isOpen ? "Yashirish" : "Ko'rish"}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-violet-500/10 px-4 py-3 text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-300 font-mono select-text bg-black/[0.015] dark:bg-white/[0.015]">
          <div className="whitespace-pre-wrap break-words opacity-90 max-h-[320px] overflow-y-auto pr-1">
            {thought}
          </div>
        </div>
      )}
    </div>
  );
}

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const { thoughtText, isStreamingThought, cleanContent } = useMemo(
    () => extractThought(content ?? ''),
    [content],
  );

  const blocks = useMemo(() => parseBlocks(cleanContent), [cleanContent]);

  if (!content || !content.trim()) return null;

  return (
    <div
      className={[
        'ai-markdown break-words text-[0.94rem] tracking-[-0.005em] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      ].join(' ')}
      style={{
        overflowWrap: 'anywhere',
        color: 'var(--ai-text-primary, #1D1D1F)',
      }}
    >
      {thoughtText && (
        <AiThinkingAccordion
          thought={thoughtText}
          isStreaming={isStreamingThought}
        />
      )}
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

export default MarkdownContent;
