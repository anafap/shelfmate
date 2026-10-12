import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  return <FoundationScreen title="Welcome to ShelfMate" description="Your home, together. Sign in with your own account to create or join a household.">
    {loading ? <ActivityIndicator accessibilityLabel="Restoring session" /> : restoreError ? <View style={styles.card}><Text>{restoreError}</Text><Action title="Retry session restore" onPress={retry} /></View> : <View style={styles.card}>
      <Text style={styles.heading}>{register ? 'Create your account' : 'Sign in'}</Text>
      {register && <Field label="Display name" value={name} onChangeText={setName} maxLength={80} />}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} />
      {register && <Text style={styles.body}>Use at least 12 characters for your password.</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Action title={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} disabled={busy} onPress={submit} />
      <Action title={register ? 'Already have an account? Sign in' : 'New here? Create an account'} disabled={busy} onPress={() => { setRegister(!register); setError(''); }} />
    </View>}
  </FoundationScreen>;
}
export function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={styles.body}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} placeholderTextColor="#596b62" {...props} /></View>;
}
export function Action({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.6 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
export const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 20, gap: 16 },
  heading: { fontSize: 22, fontWeight: '600', color: '#193b2e' },
  body: { fontSize: 16, lineHeight: 24, color: '#33473d' },
  input: { borderWidth: 1, borderColor: '#778b80', borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16, color: '#193b2e' },
  button: { minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: '#22634b', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#9c2727', fontSize: 16, lineHeight: 24 },
});
