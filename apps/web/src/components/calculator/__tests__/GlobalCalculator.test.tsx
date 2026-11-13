import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GlobalCalculator } from '../GlobalCalculator';
import { setCalculatorOpen } from '@/stores/ui.store';

describe('GlobalCalculator', () => {
  beforeEach(() => {
    act(() => {
      setCalculatorOpen(false);
    });
  });

  it('renders nothing when closed', () => {
    render(<GlobalCalculator />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders spatial calculator when opened', () => {
    act(() => {
      setCalculatorOpen(true);
    });

    render(<GlobalCalculator />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('handles digit clicking and operations', () => {
    act(() => {
      setCalculatorOpen(true);
    });

    render(<GlobalCalculator />);

    // Click '5'
    const btn5 = screen.getByRole('button', { name: '5' });
    fireEvent.click(btn5);

    // Click '+'
    const btnPlus = screen.getByRole('button', { name: /Qo'shish/i });
    fireEvent.click(btnPlus);

    // Click '3'
    const btn3 = screen.getByRole('button', { name: '3' });
    fireEvent.click(btn3);

    // Click '='
    const btnEquals = screen.getByRole('button', { name: /Teng/i });
    fireEvent.click(btnEquals);

    // The LCD display (role="textbox") should show 8
    const display = screen.getByRole('textbox');
    expect(display).toHaveTextContent('8');
  });

  it('switches to Educational Finance tab and shows Prorate / Teacher Share', async () => {
    act(() => {
      setCalculatorOpen(true);
    });

    render(<GlobalCalculator />);

    // Click on Finance tab
    const financeTab = screen.getByRole('tab', { name: /financial|moliya/i });
    fireEvent.click(financeTab);

    // Check for educational sections using findAllByText to allow Framer Motion tab transition
    const darsbayElements = await screen.findAllByText(/Darsbay/i);
    expect(darsbayElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/O'qituvchi ulushi/i)).toBeInTheDocument();
  });
});
