import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandCenterTV } from '../CommandCenterTV';

describe('CommandCenterTV Page', () => {
  it('renders command center wall display with metrics, room matrix, and turnstile stream', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CommandCenterTV />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/M-EDU COMMAND CENTER/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE STREAM/i)).toBeInTheDocument();
    expect(screen.getByText(/Bino Ichidagi O'quvchilar/i)).toBeInTheDocument();
    expect(screen.getByText(/Bugungi Kassa Tushumi/i)).toBeInTheDocument();
    expect(screen.getByText(/Jonli Dars Xonalari/i)).toBeInTheDocument();
    expect(screen.getByText(/Turniket Face ID Aniqligi/i)).toBeInTheDocument();
    expect(screen.getByText(/Xonalar & Mashg'ulotlar Holati/i)).toBeInTheDocument();
    expect(screen.getByText(/Turniket Jonli Oqimi/i)).toBeInTheDocument();
  });
});
