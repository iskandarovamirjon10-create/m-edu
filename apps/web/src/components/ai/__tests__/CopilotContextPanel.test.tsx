import { render, screen } from '@testing-library/react';
import { CopilotContextPanel } from '../CopilotContextPanel';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AI_FLAGS } from '@/lib/ai/flags';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/ai', () => ({
  aiInsightsApi: { list: vi.fn().mockResolvedValue([]) },
  aiSuggestionsApi: { list: vi.fn().mockResolvedValue([]) },
}));

describe('CopilotContextPanel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('hides insights and suggestions when flags are false', () => {
    AI_FLAGS.insights = false;
    AI_FLAGS.suggestions = false;
    
    render(
      <CopilotContextPanel routeContext="/test" onActionClick={() => {}} />,
      { wrapper }
    );
    
    expect(screen.queryByText(/insights/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/suggested prompts/i)).not.toBeInTheDocument();
    // Quick actions should still be there
    expect(screen.getByText(/tezkor amallar/i)).toBeInTheDocument();
  });

  it('shows insights and suggestions when flags are true', () => {
    AI_FLAGS.insights = true;
    AI_FLAGS.suggestions = true;
    
    render(
      <CopilotContextPanel routeContext="/test" onActionClick={() => {}} />,
      { wrapper }
    );
    
    expect(screen.getByText(/signallar/i)).toBeInTheDocument();
    expect(screen.getByText(/tavsiya etilgan savollar/i)).toBeInTheDocument();
  });
});
