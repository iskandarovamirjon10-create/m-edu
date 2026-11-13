import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadCallingScriptModal } from '../LeadCallingScriptModal';

describe('LeadCallingScriptModal', () => {
  const mockLead = {
    id: 'lead-1',
    name: 'Anvar Narzullayev',
    phone: '+998 90 555 44 33',
    courseName: 'Python AI & ML',
    stage: 'NEW',
    source: 'Instagram',
  };

  it('renders modal with lead information, propensity score, and greeting hook', () => {
    render(
      <LeadCallingScriptModal
        lead={mockLead}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/AI Lead Skript & Qo'ng'iroq Yordamchisi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Anvar Narzullayev/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Propensity:/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Salomlashish & Hook/i)).toBeInTheDocument();
  });

  it('switches objection tabs and renders dynamic responses', () => {
    render(
      <LeadCallingScriptModal
        lead={mockLead}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const thinkTab = screen.getByRole('button', { name: /O'ylab ko'raman/i });
    fireEvent.click(thinkTab);
    expect(screen.getByText(/atigi 2 ta bo'sh o'rin qoldi/i)).toBeInTheDocument();

    const noTimeTab = screen.getByRole('button', { name: /Vaqtim yo'q/i });
    fireEvent.click(noTimeTab);
    expect(screen.getByText(/darslarning video yozuvi shaxsiy kabinetingizda/i)).toBeInTheDocument();
  });

  it('triggers outcome callback when action button is clicked', () => {
    const handleAdvance = vi.fn();
    render(
      <LeadCallingScriptModal
        lead={mockLead}
        isOpen={true}
        onClose={vi.fn()}
        onAdvanceStage={handleAdvance}
      />
    );

    const trialBtn = screen.getByRole('button', { name: /Sinovga Yozildi/i });
    fireEvent.click(trialBtn);

    expect(handleAdvance).toHaveBeenCalledWith('lead-1', 'TRIAL', expect.any(String));
  });
});
