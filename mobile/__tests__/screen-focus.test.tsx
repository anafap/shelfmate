/** @jest-environment jsdom */
import { act, useEffect as mockUseEffect } from 'react';
import { ScreenFocus } from '@/components/ScreenFocus.web';

const { createRoot } = jest.requireActual<{
  createRoot: (container: HTMLElement) => { render: (node: React.ReactNode) => void; unmount: () => void };
}>('react-dom/client');

let mockFocused = true;
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    // Model focus/blur without replacing the retained screen component.
    mockUseEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));

test('web navigation moves focus off the previous screen, including return visits', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let frame: FrameRequestCallback | undefined;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frame = undefined; });
  const oldButton = document.createElement('button');
  const container = document.createElement('div');
  document.body.append(oldButton, container);
  const root = createRoot(container);
  try {
    oldButton.focus();
    await act(async () => root.render(<ScreenFocus title="Shopping"><button>Add item</button></ScreenFocus>));
    frame?.(0);
    const region = container.querySelector('[role="main"]');
    expect(document.activeElement).toBe(region);
    expect(region?.getAttribute('aria-label')).toBe('Shopping');
    expect(region?.getAttribute('tabindex')).toBe('-1');

    mockFocused = false;
    await act(async () => root.render(<ScreenFocus title="Shopping"><button>Add item</button></ScreenFocus>));
    expect(frame).toBeUndefined();
    oldButton.focus();
    mockFocused = true;
    await act(async () => root.render(<ScreenFocus title="Shopping"><button>Add item</button></ScreenFocus>));
    frame?.(0);
    expect(document.activeElement).toBe(region);
  } finally {
    await act(async () => root.unmount());
    oldButton.remove(); container.remove(); jest.restoreAllMocks(); mockFocused = true;
  }
});
