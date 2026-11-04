import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { usePendingRevocations } from '@/features/auth/usePendingRevocations';
import { flushPendingRevocations } from '@/lib/session';

jest.mock('@/lib/session', () => ({ flushPendingRevocations: jest.fn(async () => {}) }));
function SignedOutApp() { usePendingRevocations(); return null; }

test('pending sign-outs retry while signed out, survive a failed retry, and stop on unmount', async () => {
  jest.useFakeTimers();
  let foreground!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { foreground = callback; return { remove }; });
  try {
    jest.mocked(flushPendingRevocations).mockRejectedValueOnce(new Error('Offline'));
    const view = await render(<SignedOutApp />);
    expect(flushPendingRevocations).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(30000); });
    await act(async () => { foreground('active'); });
    expect(flushPendingRevocations).toHaveBeenCalledTimes(3);
    await view.unmount();
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(flushPendingRevocations).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalled();
  } finally { listener.mockRestore(); jest.useRealTimers(); }
});
