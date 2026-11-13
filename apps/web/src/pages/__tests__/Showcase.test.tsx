import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Showcase } from '../Showcase';

describe('Showcase Page', () => {
  it('renders showcase keynote stage and navigation header', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Showcase />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('M-EDU Spatial Keynote Showcase')).toBeInTheDocument();
    expect(screen.getByText(/NEXT-GEN INNOVATION SUITE/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Executive Suite/i })).toBeInTheDocument();
  });
});
