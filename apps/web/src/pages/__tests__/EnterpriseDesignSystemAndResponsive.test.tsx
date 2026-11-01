import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlassCard, GlassButton, GlassModal, GlassTable, GlassTHead, GlassTR, GlassTH, GlassTD, GlassBadge, GlassStatCard, GlassInput, GlassSelect, GlassPagination, ToastItemView, ConfirmDialog } from '@/components/ui';
import { userStore } from '@/lib/api';

describe('Enterprise Design System & Responsive Layout Suite', () => {
  it('renders GlassCard with adaptive responsive padding and containment', () => {
    const { container } = render(
      <GlassCard variant="elevated" padding="md">
        <h3 className="text-primary font-bold">Executive Card</h3>
        <p className="text-secondary">Summary content</p>
      </GlassCard>,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.className).toContain('rounded-2xl');
    expect(card.className).toContain('min-w-0');
    expect(card.className).toContain('max-w-full');
    expect(card.className).toContain('sm:p-5');
  });

  it('renders GlassStatCard with responsive containment and truncated metrics', () => {
    render(
      <GlassStatCard
        label="Jami o'quvchilar"
        value="1,450"
        trend={{ value: "+12%", direction: "up", label: "vs o'tgan oy" }}
        accent="emerald"
        size="md"
      />
    );

    expect(screen.getByText("Jami o'quvchilar")).toBeInTheDocument();
    expect(screen.getByText("1,450")).toBeInTheDocument();
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it('renders GlassButton with primary enterprise styling and accessible touch target', () => {
    render(
      <GlassButton variant="primary" size="md">
        Confirm Action
      </GlassButton>,
    );

    const btn = screen.getByRole('button', { name: /confirm action/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('h-10');
    expect(btn.className).toContain('bg-[var(--primary)]');
    expect(btn.className).toContain('max-w-full');
    expect(btn.className).toContain('min-w-0');
  });

  it('renders GlassModal and handles escape key closure correctly', () => {
    const handleClose = vi.fn();
    render(
      <GlassModal open={true} onClose={handleClose} title="Responsive Modal Dialog">
        <div>Modal Content</div>
      </GlassModal>,
    );

    expect(screen.getByText('Responsive Modal Dialog')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('contains table inside a horizontal scroll container to prevent page overflow', () => {
    const { container } = render(
      <GlassTable minWidth={800}>
        <GlassTHead>
          <GlassTR>
            <GlassTH>Student Name</GlassTH>
            <GlassTH>Course</GlassTH>
            <GlassTH>Balance</GlassTH>
          </GlassTR>
        </GlassTHead>
        <tbody>
          <GlassTR>
            <GlassTD>Alisher Navoiy</GlassTD>
            <GlassTD>Matematika Pro</GlassTD>
            <GlassTD>500,000 UZS</GlassTD>
          </GlassTR>
        </tbody>
      </GlassTable>,
    );

    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table?.style.minWidth).toBe('800px');
  });

  it('supports semantic tone badges across status states', () => {
    render(
      <div>
        <GlassBadge variant="green">ACTIVE</GlassBadge>
        <GlassBadge variant="red">SUSPENDED</GlassBadge>
        <GlassBadge variant="amber">TRIALING</GlassBadge>
        <GlassBadge variant="purple">ENTERPRISE</GlassBadge>
      </div>,
    );

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
    expect(screen.getByText('TRIALING')).toBeInTheDocument();
    expect(screen.getByText('ENTERPRISE')).toBeInTheDocument();
  });

  it('renders GlassInput and GlassSelect with iOS zoom prevention and responsive tokens', () => {
    render(
      <div>
        <GlassInput placeholder="Enter username" size="md" />
        <GlassSelect
          placeholder="Select role"
          size="md"
          options={[{ label: 'Admin', value: 'admin' }]}
        />
      </div>,
    );

    const input = screen.getByPlaceholderText('Enter username');
    expect(input).toBeInTheDocument();
    expect(input.className).toContain('text-[16px]');
    expect(input.className).toContain('sm:text-sm');

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select.className).toContain('text-[16px]');
    expect(select.className).toContain('sm:text-sm');
  });

  it('safely handles edge-case pagination inputs without crashing or producing NaN', () => {
    const handlePageChange = vi.fn();
    const { rerender } = render(
      <GlassPagination
        page={-5 as any}
        totalPages={0}
        onPageChange={handlePageChange}
      />
    );

    // totalPages <= 1 should safely return null and not crash
    expect(screen.queryByRole('navigation')).toBeNull();

    // Re-render with valid numbers
    rerender(
      <GlassPagination
        page={2}
        totalPages={5}
        totalItems={50}
        onPageChange={handlePageChange}
      />
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText(/50 results — page 2 of 5/i)).toBeInTheDocument();
  });

  it('renders ToastItemView with responsive width and accessible close button', () => {
    const handleClose = vi.fn();
    render(
      <ToastItemView
        toast={{ id: 'toast-1', type: 'success', title: 'To`lov muvaffaqiyatli', description: 'Kassaga qabul qilindi' }}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('To`lov muvaffaqiyatli')).toBeInTheDocument();
    expect(screen.getByText('Kassaga qabul qilindi')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /dismiss|yopish/i });
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.className).toContain('min-h-[28px]');
    expect(closeBtn.className).toContain('min-w-[28px]');
  });

  it('renders ConfirmDialog with responsive stacked action buttons on mobile', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="O'chirishni tasdiqlang"
        description="Ushbu ma'lumot qayta tiklanmaydi."
      />
    );

    expect(screen.getByText("O'chirishni tasdiqlang")).toBeInTheDocument();
    const deleteBtn = screen.getByRole('button', { name: /delete|o'chirish/i });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn.className).toContain('w-full');
    expect(deleteBtn.className).toContain('sm:w-auto');
  });

  it('userStore safely handles storage quota limits and private browsing without throwing', () => {
    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;
    try {
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError: DOM Exception 22');
      });
      localStorage.removeItem = vi.fn(() => {
        throw new Error('SecurityError: Access is denied for this document');
      });

      expect(() => {
        userStore.set({ id: 'user-1', name: 'John Doe', password: 'secret-to-strip' });
      }).not.toThrow();

      expect(() => {
        userStore.clear();
      }).not.toThrow();
    } finally {
      localStorage.setItem = originalSetItem;
      localStorage.removeItem = originalRemoveItem;
    }
  });
});
