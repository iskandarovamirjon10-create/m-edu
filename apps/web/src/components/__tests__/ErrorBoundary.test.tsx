import { describe, it, expect, vi, afterEach} from'vitest';
import { render, screen, fireEvent} from'@testing-library/react';
import { ErrorBoundary} from'../ErrorBoundary';

function Bomb({ shouldThrow}: { shouldThrow: boolean}) {
 if (shouldThrow) throw new Error('boom');
 return <div>safe content</div>;
}

describe('ErrorBoundary', () => {
 afterEach(() => {
 vi.restoreAllMocks();
});

 it('renders children when there is no error', () => {
 render(
 <ErrorBoundary>
 <Bomb shouldThrow={false} />
 </ErrorBoundary>,
 );
 expect(screen.getByText('safe content')).toBeInTheDocument();
});

 it('catches a render error and shows the fallback UI', () => {
 const spy = vi.spyOn(console,'error').mockImplementation(() => {});
 render(
 <ErrorBoundary label="Students">
 <Bomb shouldThrow />
 </ErrorBoundary>,
 );
 expect(screen.getByText(/Something went wrong while loading Students/i)).toBeInTheDocument();
 expect(screen.getByRole('button', { name:'Try again'})).toBeInTheDocument();
 expect(screen.getByRole('button', { name:'Reload app'})).toBeInTheDocument();
 spy.mockRestore();
});

 it('recovers after a retry when the error is transient', () => {
 const spy = vi.spyOn(console,'error').mockImplementation(() => {});
 let throwing = true;
 function Flaky() {
 if (throwing) throw new Error('transient');
 return <div>recovered</div>;
}
 render(
 <ErrorBoundary>
 <Flaky />
 </ErrorBoundary>,
 );
 expect(screen.getByRole('button', { name:'Try again'})).toBeInTheDocument();
 throwing = false;
 fireEvent.click(screen.getByRole('button', { name:'Try again'}));
 expect(screen.getByText('recovered')).toBeInTheDocument();
 spy.mockRestore();
});
});
