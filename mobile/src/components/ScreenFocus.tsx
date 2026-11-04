import { PropsWithChildren } from 'react';

export function ScreenFocus({ children }: PropsWithChildren<{ title: string }>) {
  return <>{children}</>;
}
