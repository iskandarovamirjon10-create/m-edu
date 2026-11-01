import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingActionIsland } from '../FloatingActionIsland';

describe('FloatingActionIsland (Mobile Responsive Apple Liquid Glass)', () => {
  it('does not render when selectedCount is 0', () => {
    const { container } = render(
      <FloatingActionIsland
        selectedCount={0}
        actions={[{ label: "To'langan deb belgilash", onClick: vi.fn() }]}
      />,
    );
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it('renders counter and actions when selectedCount > 0', () => {
    const handleAction = vi.fn();
    const handleClear = vi.fn();

    render(
      <FloatingActionIsland
        selectedCount={2}
        entityName="to'lov"
        onClearSelection={handleClear}
        actions={[
          {
            label: "To'langan deb belgilash",
            variant: 'primary',
            onClick: handleAction,
          },
          {
            label: 'Eksport (CSV)',
            variant: 'default',
            onClick: vi.fn(),
          },
        ]}
      />,
    );

    // Counter check
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText("to'lov tanlandi")).toBeInTheDocument();

    // Actions check - both fully rendered
    const markPaidBtn = screen.getByText("To'langan deb belgilash");
    expect(markPaidBtn).toBeInTheDocument();
    const exportBtn = screen.getByText('Eksport (CSV)');
    expect(exportBtn).toBeInTheDocument();

    // Trigger action
    fireEvent.click(markPaidBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);

    // Clear selection
    const clearBtn = screen.getByLabelText('Tanlovni bekor qilish');
    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('has mobile-safe floating placement above MobileNav', () => {
    render(
      <FloatingActionIsland
        selectedCount={1}
        entityName="to'lov"
        actions={[{ label: "To'langan deb belgilash", onClick: vi.fn() }]}
      />,
    );

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.className).toContain('bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]');
    expect(toolbar.className).toContain('w-[calc(100vw-1.25rem)]');
  });
});
