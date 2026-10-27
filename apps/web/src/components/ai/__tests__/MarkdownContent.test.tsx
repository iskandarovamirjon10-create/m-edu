/**
 * MarkdownContent tests — rendering coverage plus injection safety.
 * The renderer must never create elements from user/LLM HTML.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MarkdownContent } from '../MarkdownContent';

describe('MarkdownContent rendering', () => {
  it('renders nothing for empty content', () => {
    const { container } = render(<MarkdownContent content="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders headings, bold, italic, strikethrough and inline code', () => {
    render(
      <MarkdownContent content={'# Sarlavha\n\n**kuchli** *yozuv* ~~o\'chirilgan~~ va `kod`'} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Sarlavha' })).toBeInTheDocument();
    expect(screen.getByText('kuchli').tagName).toBe('STRONG');
    expect(screen.getByText('yozuv').tagName).toBe('EM');
    expect(screen.getByText('o\'chirilgan').tagName).toBe('S');
    expect(screen.getByText('kod').tagName).toBe('CODE');
  });

  it('renders fenced code blocks inside <pre><code>', () => {
    const { container } = render(<MarkdownContent content={'```\nconst x = 1;\n```'} />);
    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain('const x = 1;');
  });

  it('renders bullet and ordered lists', () => {
    render(<MarkdownContent content={'- bir\n- ikki\n\n1. birinchi\n2. ikkinchi'} />);
    const lists = screen.getAllByRole('list');
    expect(lists).toHaveLength(2);
    expect(lists[0].tagName).toBe('UL');
    expect(within(lists[0]).getAllByRole('listitem')).toHaveLength(2);
    expect(lists[1].tagName).toBe('OL');
    expect(within(lists[1]).getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders one level of nested lists', () => {
    render(<MarkdownContent content={'- tashqi\n  - ichki'} />);
    const lists = screen.getAllByRole('list');
    expect(lists).toHaveLength(2);
    expect(lists[0].querySelectorAll(':scope > li')).toHaveLength(1);
    expect(within(lists[0]).getByText('tashqi')).toBeInTheDocument();
    expect(within(lists[0]).getByText('ichki')).toBeInTheDocument();
    expect(lists[1].closest('li')).toBeTruthy();
  });

  it('renders blockquotes and horizontal rules', () => {
    const { container } = render(<MarkdownContent content={'> eslatma\n\n---'} />);
    expect(screen.getByText('eslatma').tagName).toBe('BLOCKQUOTE');
    expect(container.querySelector('hr')).toBeTruthy();
  });

  it('renders tables with header and body cells', () => {
    render(<MarkdownContent content={'| Guruh | Soni |\n| --- | --- |\n| A-1 | 20 |'} />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Guruh' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Soni' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'A-1' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '20' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it('renders safe links with target/rel protections', () => {
    render(<MarkdownContent content="[docs](https://example.com/a)" />);
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  });

  it('renders allowed internal routes without opening new tab', () => {
    render(<MarkdownContent content="[Davomat](/attendance) va [Talaba](/students/std-123)" />);
    const attLink = screen.getByRole('link', { name: 'Davomat' });
    expect(attLink).toHaveAttribute('href', '/attendance');
    expect(attLink).not.toHaveAttribute('target');

    const stdLink = screen.getByRole('link', { name: 'Talaba' });
    expect(stdLink).toHaveAttribute('href', '/students/std-123');
    expect(stdLink).not.toHaveAttribute('target');
  });

  it('renders callout alerts [!TIP], [!NOTE], [!WARNING] with styled callout cards', () => {
    render(
      <MarkdownContent
        content={
          "> [!TIP]\n> O'quvchilarga to'lov muddati bo'yicha bildirishnoma yuborish tavsiya etiladi.\n\n> [!NOTE]\n> Bugungi davomat to'liq qayd etildi."
        }
      />
    );
    expect(screen.getByText(/Maslahat va Tavsiya/i)).toBeInTheDocument();
    expect(screen.getByText(/O'quvchilarga to'lov muddati bo'yicha bildirishnoma yuborish tavsiya etiladi/i)).toBeInTheDocument();
    expect(screen.getByText('Eslatma')).toBeInTheDocument();
    expect(screen.getByText(/Bugungi davomat to'liq qayd etildi/i)).toBeInTheDocument();
  });

  it('rejects disallowed internal routes and traversal attempts', () => {
    const { container } = render(
      <MarkdownContent content="[Secret](/secret/admin) va [Traverse](/students/../../etc/passwd)" />
    );
    expect(screen.queryByRole('link', { name: 'Secret' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Traverse' })).toBeNull();
    expect(container.textContent).toContain('Secret (/secret/admin)');
    expect(container.textContent).toContain('Traverse (/students/../../etc/passwd)');
  });
});

describe('MarkdownContent safety', () => {
  it('refuses javascript: URLs and shows them as plain text', () => {
    render(<MarkdownContent content="[click](javascript:alert(1))" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('click (javascript:alert(1))')).toBeInTheDocument();
  });

  it('never creates elements from raw HTML (no script/img injection)', () => {
    const { container } = render(
      <MarkdownContent
        content={'<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>'}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.textContent).toContain('<script>alert(2)</script>');
  });

  it('does not interpret HTML comments or entities as markup', () => {
    const { container } = render(<MarkdownContent content="<!-- hidden --> & <b>bold</b>" />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<!-- hidden -->');
  });
});
