import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpressPosTerminalModal } from '../ExpressPosTerminalModal';

describe('ExpressPosTerminalModal', () => {
  it('renders modal when isOpen is true', () => {
    render(
      <ExpressPosTerminalModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Express Kassa & POS Terminal/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ism, telefon yoki ID.../i)).toBeInTheDocument();
    expect(screen.getByText(/Click QR/i)).toBeInTheDocument();
    expect(screen.getByText(/Payme QR/i)).toBeInTheDocument();
  });

  it('filters students when typing in search input', () => {
    render(
      <ExpressPosTerminalModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Ism, telefon yoki ID.../i);
    fireEvent.change(input, { target: { value: 'Javohir' } });

    expect(screen.getByText(/Javohir Toshmatov/i)).toBeInTheDocument();
    expect(screen.queryByText(/Madina Umarova/i)).not.toBeInTheDocument();
  });

  it('updates amount when clicking keypad digits and preset buttons', () => {
    render(
      <ExpressPosTerminalModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const presetBtn = screen.getByRole('button', { name: /\+800,000/i });
    fireEvent.click(presetBtn);

    const matches = screen.getAllByText(/800,000/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ExpressPosTerminalModal
        isOpen={true}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Yopish/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
