import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { PageHeader, pageUi } from '@/components/PageHeader';
import { FoundationScreen } from '@/components/FoundationScreen';
import { signIn } from '@/lib/session';
import { useSession } from './SessionProvider';

export function AccountScreen() {
  const { loading, error: restoreError, retry } = useSession();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try { await signIn(email.trim(), password, register ? name.trim() : undefined); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <FoundationScreen compact hideHeading fill safeAreaTop title="ShelfMate" description="">
    <Text style={{ color: colors.green, fontSize: 28, fontWeight: '800', marginBottom: 16 }}>ShelfMate</Text>
    <PageHeader title={register ? 'Create your account' : 'Welcome back'} />
    <Text style={pageUi.body}>Keep track of what’s at home, together.</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Restoring session" /> : restoreError ? <View style={pageUi.panel}><Text accessibilityRole="alert" style={styles.error}>{restoreError}</Text><Action title="Retry session restore" onPress={retry} /></View> : <View style={pageUi.panel}>
      {register && <Field label="Display name" value={name} onChangeText={setName} maxLength={80} editable={!busy} autoComplete="name" />}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} autoComplete="email" editable={!busy} autoCorrect={false} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} editable={!busy} returnKeyType="done" onSubmitEditing={() => { if (!busy && email.trim() && password && (!register || name.trim())) void submit(); }} />
      {register && <Text style={styles.body}>Use at least 12 characters for your password.</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Action title={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} fullWidth disabled={busy || !email.trim() || !password || (register && !name.trim())} onPress={submit} />
      <Pressable accessibilityRole="button" accessibilityLabel={register ? 'Already have an account? Sign in' : 'New here? Create an account'} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { setRegister(!register); setError(''); }} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 8 }}><Text style={[pageUi.body, { color: colors.green, fontWeight: '600', textAlign: 'center' }]}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text></Pressable>
    </View>}
  </FoundationScreen></KeyboardAvoidingView>;
}
export function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={styles.body}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} placeholderTextColor="#596b62" {...props} /></View>;
}
export function Action({ title, onPress, disabled, variant = 'primary', label, fullWidth }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger'; label?: string; fullWidth?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, fullWidth && { alignSelf: 'stretch' }, variant === 'secondary' && styles.secondaryButton, variant === 'danger' && styles.dangerButton, pressed && { opacity: 0.8 }, disabled && { opacity: 0.45 }]}><Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryText, variant === 'danger' && styles.dangerText]}>{title}</Text></Pressable>;
}
export const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 20, gap: 16, borderWidth: 1, borderColor: '#e0e8e2' },
  heading: { fontSize: 22, fontWeight: '600', color: '#193b2e' },
  body: { fontSize: 15, lineHeight: 23, color: '#52665a' },
  input: { borderWidth: 1, borderColor: '#b5c5ba', backgroundColor: '#fbfcfb', borderRadius: 10, padding: 14, minHeight: 50, fontSize: 16, color: '#193b2e' },
  button: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, backgroundColor: '#22634b', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#f0f5f1', borderWidth: 1, borderColor: '#dce6df' },
  secondaryText: { color: '#22634b' },
  dangerButton: { backgroundColor: '#fff4f1', borderWidth: 1, borderColor: '#f0d4ce' },
  dangerText: { color: '#9c2727' },
  error: { color: '#9c2727', fontSize: 15, lineHeight: 24 },
});
