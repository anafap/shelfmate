import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

export const FAB_SIZE = 56;
export const FAB_EDGE_OFFSET = 16;
export const FAB_MENU_GAP = 8;
export const FAB_SCROLL_END_PADDING = FAB_SIZE + FAB_EDGE_OFFSET + FAB_MENU_GAP;

export function FloatingActionButton({ label, expanded = false, onPress, onDismiss, menuContent, bottomInset = 0, testID }: {
  label: string;
  expanded?: boolean;
  onPress: () => void;
  onDismiss?: () => void;
  menuContent?: React.ReactNode;
  bottomInset?: number;
  testID?: string;
}) {
  return <View pointerEvents="box-none" testID={testID ? `${testID}-overlay` : undefined} style={ui.layer}>
    {expanded && menuContent && <View pointerEvents="box-none" testID={testID ? `${testID}-menu-overlay` : undefined} style={ui.menuOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close add menu" style={ui.scrim} onPress={onDismiss} />
      <View testID={testID ? `${testID}-menu-slot` : undefined} style={[ui.menuSlot, { bottom: FAB_SIZE + FAB_EDGE_OFFSET + bottomInset + FAB_MENU_GAP }]}>{menuContent}</View>
    </View>}
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Close add menu' : label}
      accessibilityState={{ expanded }}
      testID={testID ? `${testID}-button` : undefined}
      style={[ui.button, { bottom: FAB_EDGE_OFFSET + bottomInset }]}
      onPress={onPress}
    >
      <SymbolView name={expanded ? { ios: 'xmark', android: 'close', web: 'close' } : { ios: 'plus', android: 'add', web: 'add' }} tintColor="#fff" size={28} />
    </Pressable>
  </View>;
}

const ui = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  button: { position: 'absolute', right: FAB_EDGE_OFFSET, width: FAB_SIZE, height: FAB_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: FAB_SIZE / 2, backgroundColor: '#008b50', borderWidth: 2, borderColor: '#fff', elevation: 6, shadowColor: '#102a30', shadowOpacity: 0.22, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  menuOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: FAB_EDGE_OFFSET },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13, 35, 27, 0.28)' },
  menuSlot: { position: 'absolute', left: FAB_EDGE_OFFSET, right: FAB_EDGE_OFFSET, alignItems: 'flex-end' },
});
