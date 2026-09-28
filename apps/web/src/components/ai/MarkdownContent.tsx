/**
 * MarkdownContent — safe, HTML-free markdown renderer for AI replies.
 *
 * Everything is rendered as React elements: no `dangerouslySetInnerHTML`,
 * no HTML strings, therefore no script/style injection is possible. Link
 * targets are restricted to http(s)/mailto/relative URLs so `javascript:`
 * and friends never reach an `href`.
 *
 * Supported: headings, bold, italic, strikethrough, inline code, fenced
 * code blocks, bullet/numbered/nested lists, blockquotes, horizontal
 * rules, tables and links.
 */

import { useMemo, type ReactNode } from 'react';

/* ----------------------------- inline ----------------------------- */

const INLINE_SOURCE = [
  '(`[^`\\n]+`)', // 1 inline code
  '(\\*\\*[^*]+\\*\\*)', // 2 bold
  '(\\*[^*\\n]+\\*)', // 3 italic (*)
  '(_[^_\\n]+_)', // 4 italic (_)
  '(\\[[^\\]]+\\]\\([^)\\s]+\\))', // 5 link
  '(~~[^~]+~~)', // 6 strikethrough
].join('|');

function isSafeHref(url: string): boolean {
  const value = url.trim().toLowerCase();
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//') ||
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('mailto:')
  );
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let cursor = 0;
  // A fresh regex per call: recursion would otherwise reset a shared
  // `lastIndex` and corrupt the outer scan.
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
          className="rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--primary)]"
        >
          {code.slice(1, -1)}
        </code>,
      );
    } else if (bold) {
      nodes.push(
        <strong key={key} className="font-semibold text-[var(--text-primary)]">
          {renderInline(bold.slice(2, -2), `${key}b`)}
        </strong>,
      );
    } else if (italicStar || italicUnderscore) {
      const inner = (italicStar ?? italicUnderscore ?? '').slice(1, -1);
      nodes.push(
        <em key={key} className="italic">
          {renderInline(inner, `${key}i`)}
        </em>,
      );
    } else if (link) {
      const split = link.lastIndexOf('](');
      const label = link.slice(1, split);
      const href = link.slice(split + 2, -1);
      if (isSafeHref(href)) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]"
          >
            {renderInline(label, `${key}a`)}
          </a>,
        );
      } else {
        nodes.push(`${label} (${href})`);
      }
    } else if (strike) {
      nodes.push(
        <s key={key} className="opacity-70">
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

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; code: string }
  | { kind: 'quote'; text: string }
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
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence (or end of input)
      blocks.push({ kind: 'code', code: code.join('\n') });
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
      blocks.push({ kind: 'quote', text: quote.join('\n').trim() });
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
  1: 'text-[1.05rem] font-bold text-[var(--text-primary)]',
  2: 'text-[1.02rem] font-bold text-[var(--text-primary)]',
  3: 'text-[0.98rem] font-semibold text-[var(--text-primary)]',
  4: 'text-[0.95rem] font-semibold text-[var(--text-primary)]',
  5: 'text-[0.9rem] font-semibold uppercase tracking-wide text-[var(--text-secondary)]',
  6: 'text-[0.85rem] font-semibold uppercase tracking-wide text-[var(--text-secondary)]',
};

function renderListItems(items: ListItem[], ordered: boolean, keyBase: string): ReactNode {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={ordered ? 'list-decimal' : 'list-disc'}>
      {items.map((item, position) => (
        <li key={item.id ? `${keyBase}-${item.id}` : `${keyBase}-${position}`}>
          {renderInline(item.text, `${keyBase}-${position}-t`)}
          {item.children.length > 0 &&
            renderListItems(item.children, ordered, `${keyBase}-${position}-n`)}
        </li>
      ))}
    </Tag>
  );
}

function renderBlock(block: Block, index: number): ReactNode {
  const key = `b${index}`;

  switch (block.kind) {
    case 'heading': {
      const level = Math.min(Math.max(block.level, 1), 6);
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <Tag key={key} className={['mt-3 mb-1.5 first:mt-0', HEADING_CLASSES[level] ?? HEADING_CLASSES[4]].join(' ')}>
          {renderInline(block.text, key)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p key={key} className="my-1.5 leading-6 first:mt-0 last:mb-0">{renderInline(block.text, key)}</p>;
    case 'code':
      return (
        <pre key={key} className="my-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-[0.8rem] leading-5 text-[var(--text-primary)]">
          <code className="font-mono whitespace-pre">{block.code}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote key={key} className="my-2 border-l-2 border-[var(--border-focus)] pl-3 italic text-[var(--text-secondary)]">
          {renderInline(block.text, key)}
        </blockquote>
      );
    case 'hr':
      return <hr key={key} className="my-3 border-0 border-t border-[var(--border)]" />;
    case 'list':
      return (
        <div key={key} className="my-2 space-y-1 text-[0.9rem] leading-6 [&_ol_ul]:my-0.5 [&_ul_ul]:my-0.5 [&_ol]:my-0 [&_ul]:my-0">
          {renderListItems(block.items, block.ordered, key)}
        </div>
      );
    case 'table':
      return (
        <div key={key} className="my-2 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full border-collapse text-[0.85rem]">
            <thead>
              <tr className="bg-[var(--primary-soft)]">
                {block.header.map((cell, position) => (
                  <th
                    key={`${key}-h-${position}`}
                    className="border-b border-[var(--border)] px-3 py-2 text-left font-semibold text-[var(--text-primary)]"
                  >
                    {renderInline(cell, `${key}-h-${position}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${key}-r-${rowIndex}-c-${cellIndex}`}
                      className="px-3 py-2 align-top text-[var(--text-secondary)]"
                    >
                      {renderInline(cell, `${key}-r-${rowIndex}-c-${cellIndex}`)}
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

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const blocks = useMemo(() => parseBlocks(content ?? ''), [content]);

  if (!content || !content.trim()) return null;

  return (
    <div
      className={[
        'ai-markdown break-words text-[0.925rem] text-[var(--text-primary)] [&>*:first-child]:mt-0',
        className,
      ].join(' ')}
      style={{ overflowWrap: 'anywhere' }}
    >
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

export default MarkdownContent;
