import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SessionTimer } from '../../src/components/SessionTimer';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T12:00:00Z')); });
afterEach(() => vi.useRealTimers());

test('remounting a timed session resumes the original deadline and expires exactly once', async () => {
  const onExpire = vi.fn();
  const props = { durationMinutes: 2, sessionStartedAt: '2026-01-01T12:00:00Z', onExpire };
  const view = render(<SessionTimer {...props} />);
  expect(screen.getByText('02:00')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(30000));
  expect(screen.getByText('01:30')).toBeTruthy();
  view.unmount();
  await act(() => vi.advanceTimersByTimeAsync(30000));
  render(<SessionTimer {...props} />);
  expect(screen.getByText('01:00')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(65000));
  expect(screen.getByText('00:00')).toBeTruthy();
  expect(onExpire).toHaveBeenCalledOnce();
});
