import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccountScreen } from '@/features/auth/AccountScreen';
import { signIn } from '@/lib/session';

jest.mock('@/lib/session', () => ({ signIn: jest.fn() }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ loading: false, error: '', retry: jest.fn() }) }));

beforeEach(() => jest.clearAllMocks());
test('sign-in sends the entered credentials and displays connection errors', async () => {
  jest.mocked(signIn).mockRejectedValue(new Error('Unable to connect. Try again.'));
  await render(<AccountScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'LongPassword123!');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(signIn).toHaveBeenCalledWith('ana@example.com', 'LongPassword123!', undefined));
  expect(await screen.findByText('Unable to connect. Try again.')).toBeTruthy();
});
test('registration includes a separate display name', async () => {
  jest.mocked(signIn).mockResolvedValue(undefined);
  await render(<AccountScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'New here? Create an account' }));
  await fireEvent.changeText(screen.getByLabelText('Display name'), 'Ana');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'LongPassword123!');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(signIn).toHaveBeenCalledWith('ana@example.com', 'LongPassword123!', 'Ana'));
});
