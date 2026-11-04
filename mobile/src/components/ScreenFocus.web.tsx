import { useFocusEffect } from 'expo-router';
import { PropsWithChildren, useCallback, useRef } from 'react';

export function ScreenFocus({ children, title }: PropsWithChildren<{ title: string }>) {
  const region = useRef<HTMLDivElement>(null);
  useFocusEffect(useCallback(() => {
    // Wait until the navigator has made this screen visible, including on return visits.
    const frame = requestAnimationFrame(() => region.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []));
  return <div ref={region} role="main" aria-label={title} tabIndex={-1}
    style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
    {children}
  </div>;
}
