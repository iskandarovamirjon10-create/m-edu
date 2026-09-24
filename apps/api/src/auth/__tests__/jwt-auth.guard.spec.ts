import { describe, it, expect } from 'vitest';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  it('instantiates and extends passport AuthGuard for jwt', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeDefined();
    expect(guard).toBeInstanceOf(AuthGuard('jwt'));
  });
});
