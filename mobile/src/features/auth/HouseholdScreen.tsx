import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Platform, Share, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { api, ApiError, signOut } from '@/lib/session';
import { Action, Field, styles } from './AccountScreen';
import { useSession } from './SessionProvider';

export type Household = { id: string; name: string; timeZone: string; ownerUserId: string };
type Member = { userId: string; displayName: string; role: string; joinedAt: string };
type Invite = { id: string; token: string; expiresAt: string };
type InviteSummary = Omit<Invite, 'token'> & { invitedEmail: string | null; redeemedAt: string | null; revokedAt: string | null };
export function useHousehold() {
  const { session } = useSession();
  return useQuery({ queryKey: ['household', session?.user.id], queryFn: async () => {
    try { return await api<Household>('/households/current'); }
    catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
  }, retry: false, enabled: !!session });
}
export function HouseholdScreen({ settings = false }: { settings?: boolean }) {
  const { session } = useSession();
  const household = useHousehold(); const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bahrain');
  const [token, setToken] = useState(''); const [email, setEmail] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null); const [message, setMessage] = useState('');
  const [now] = useState(() => Date.now());
  const owner = household.data?.ownerUserId === session?.user.id;
  const members = useQuery({ queryKey: ['members', household.data?.id], queryFn: () => api<Member[]>('/households/current/members'), enabled: !!household.data, retry: false });
  const invites = useQuery({ queryKey: ['invites', household.data?.id], queryFn: () => api<InviteSummary[]>('/households/current/invites'), enabled: !!household.data && owner && settings, retry: false });
  const action = useMutation({ mutationFn: async (task: () => Promise<unknown>) => task(), onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['household'] });
    await queryClient.invalidateQueries({ queryKey: ['members'] });
    await queryClient.invalidateQueries({ queryKey: ['invites'] });
  }});
  function run(task: () => Promise<unknown>) { setMessage(''); action.mutate(task); }
  return <FoundationScreen title={settings ? 'Account & household' : household.data?.name ?? 'Set up your household'} description={settings ? `Manage your account and the people in your home. Signed in as ${session?.user.displayName ?? ''}.` : household.data ? `Welcome back, ${session?.user.displayName ?? 'housemate'}. Let’s see what’s at home.` : 'Start a home together, or join one with your partner’s invitation code.'}>
    <View style={styles.card}>
      {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <><Text style={styles.error}>{household.error.message}</Text><Action title="Retry" onPress={() => { household.refetch(); }} /></> : !household.data ? <>
        <Text style={styles.heading}>Create a household</Text>
        <Field label="Household name" value={name} onChangeText={setName} maxLength={80} />
        <Field label="Household time zone" value={zone} onChangeText={setZone} autoCapitalize="none" />
        <Text style={styles.body}>Confirm your local time zone. Future expiry reminders use this calendar.</Text>
        <Action title="Create household" disabled={action.isPending} onPress={() => run(() => api('/households', { name, timeZone: zone }, 'POST'))} />
        <Text style={styles.heading}>Or join your partner</Text>
        <Field label="Invitation code" value={token} onChangeText={setToken} autoCapitalize="none" maxLength={64} />
        <Action title="Join household" disabled={action.isPending} onPress={() => run(() => api('/household-invites/redeem', { token: token.trim() }, 'POST'))} />
      </> : <>
        <Text style={styles.heading}>{household.data.name}</Text>
        <Text style={styles.body}>Time zone: {household.data.timeZone}</Text>
        {members.isPending ? <ActivityIndicator /> : members.isError ? <><Text style={styles.error}>{members.error.message}</Text><Action title="Retry members" onPress={() => { members.refetch(); }} /></> : members.data?.map(m => <Text key={m.userId} style={styles.body}>{m.displayName} · {m.role}</Text>)}
        {members.data?.length === 1 && <Text style={styles.body}>Your household is ready. Invite your partner from Settings.</Text>}
        {!settings && <View style={{ gap: 16, padding: 24, borderRadius: 16, backgroundColor: '#edf5ef' }}>
          <Text style={styles.heading}>Know what’s on your shelf</Text>
          <Text style={styles.body}>Add products, find what you need, and review the dates you’ve entered. Your shared inventory starts here.</Text>
          <Link href="/inventory" style={{ color: '#22634b', fontSize: 16, fontWeight: '700', minHeight: 48, paddingVertical: 14 }}>Open inventory →</Link>
        </View>}
        {settings && owner && <>
          <Text style={styles.heading}>Invite your partner</Text>
          <Field label="Partner email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" maxLength={254} />
          <Action title="Create invitation" disabled={action.isPending || (members.data?.length ?? 0) >= 2} onPress={() => run(async () => { const result = await api<Invite>('/households/current/invites', { invitedEmail: email || null }, 'POST'); setInvite(result); })} />
          {invite && <>
            <Text style={styles.body}>Share this code privately. It can be used once, before {new Date(invite.expiresAt).toLocaleString()}.</Text>
            <Text selectable style={styles.body}>{invite.token}</Text>
            {Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function')
              ? <Action title="Share invitation code" onPress={() => run(async () => { await Share.share({ message: `Join my ShelfMate household. Sign in with your own account and enter this invitation code: ${invite.token}` }); })} />
              : <Text style={styles.body}>Select and copy the code above to share it privately.</Text>}
          </>}
          {invites.isError && <><Text style={styles.error}>{invites.error.message}</Text><Action title="Retry invitations" onPress={() => { invites.refetch(); }} /></>}
          {invites.data?.filter(i => !i.redeemedAt && !i.revokedAt && Date.parse(i.expiresAt) > now).map(i => <View key={i.id} style={{ gap: 8 }}>
            <Text style={styles.body}>Invitation for {i.invitedEmail ?? 'your partner'} · expires {new Date(i.expiresAt).toLocaleDateString()}</Text>
            {revokeId === i.id ? <>
              <Text style={styles.body}>Revoke this invitation? Its code will stop working.</Text>
              <Action title="Confirm revocation" disabled={action.isPending} onPress={() => run(async () => { await api(`/households/current/invites/${i.id}`, undefined, 'DELETE'); if (invite?.id === i.id) setInvite(null); setRevokeId(null); setMessage('Invitation revoked.'); })} />
              <Action title="Keep invitation" disabled={action.isPending} onPress={() => setRevokeId(null)} />
            </> : <Action title="Revoke invitation" disabled={action.isPending} onPress={() => setRevokeId(i.id)} />}
          </View>)}
        </>}
        <Action variant="secondary" title="Refresh household" disabled={action.isPending} onPress={() => run(async () => { await household.refetch(); await members.refetch(); })} />
      </>}
      {action.isPending && <ActivityIndicator accessibilityLabel="Saving" />}
      {action.isError && <Text accessibilityRole="alert" style={styles.error}>{action.error.message}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
      {settings && <Action variant="secondary" title="Sign out" disabled={action.isPending} onPress={() => run(signOut)} />}
    </View>
  </FoundationScreen>;
}
