import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from '../AuthLayout';

describe('AuthLayout', () => {
  it('renders the title, subtitle, and children', () => {
    render(
      <AuthLayout title="Welcome back" subtitle="Sign in to continue">
        <button type="button">Sign in</button>
      </AuthLayout>,
    );
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders without a subtitle', () => {
    render(<AuthLayout title="Register">form content</AuthLayout>);
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText('form content')).toBeInTheDocument();
  });
});
