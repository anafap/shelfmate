import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { FAB_EDGE_OFFSET, FAB_MENU_GAP, FAB_SCROLL_END_PADDING, FAB_SIZE, FloatingActionButton } from '@/components/FloatingActionButton';

test.each([320, 360, 412, 768, 1024])('FAB and menu share the same anchored geometry at %i dp viewport width', async width => {
  const result = await render(<View style={{ width, height: 800 }}>
    <FloatingActionButton label="Add item" expanded onPress={() => {}} onDismiss={() => {}} bottomInset={width >= 1000 ? 24 : 0} testID="fab" menuContent={<Text>Menu option</Text>} />
  </View>);

  const buttonStyle = StyleSheet.flatten(screen.getByTestId('fab-button').props.style);
  const menuStyle = StyleSheet.flatten(screen.getByTestId('fab-menu-slot').props.style);
  const bottomInset = width >= 1000 ? 24 : 0;
  expect(buttonStyle).toEqual(expect.objectContaining({ width: FAB_SIZE, height: FAB_SIZE, right: FAB_EDGE_OFFSET, bottom: FAB_EDGE_OFFSET + bottomInset, alignItems: 'center', justifyContent: 'center' }));
  expect(menuStyle).toEqual(expect.objectContaining({ left: FAB_EDGE_OFFSET, right: FAB_EDGE_OFFSET, bottom: FAB_SIZE + FAB_EDGE_OFFSET + bottomInset + FAB_MENU_GAP }));
  expect(screen.getByText('Menu option')).toBeTruthy();
  expect(FAB_SCROLL_END_PADDING).toBe(FAB_SIZE + FAB_EDGE_OFFSET + FAB_MENU_GAP);
  result.unmount();
});

test('FAB opens and dismisses its aligned menu while preserving its action label', async () => {
  function Harness() {
    const [expanded, setExpanded] = useState(false);
    return <View style={{ width: 360, height: 800 }}>
      <FloatingActionButton label="Add item" expanded={expanded} onPress={() => setExpanded(open => !open)} onDismiss={() => setExpanded(false)} testID="fab" menuContent={<Text>Menu option</Text>} />
    </View>;
  }
  const result = await render(<Harness />);
  expect(screen.getByRole('button', { name: 'Add item' }).props.accessibilityState).toEqual({ expanded: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Add item' }));
  expect(screen.getByText('Menu option')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Close add menu' })[1].props.accessibilityState).toEqual({ expanded: true });
  result.unmount();
});
