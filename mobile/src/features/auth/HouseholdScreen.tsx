import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, router } from 'expo-router';
import { ActivityIndicator, Platform, Share, Text, View } from 'react-native';
import { PageHeader, pageUi } from '@/components/PageHeader';
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
export function HouseholdScreen({ settings = false, safeAreaTop = false }: { settings?: boolean; safeAreaTop?: boolean }) {
  const { session } = useSession();
  const household = useHousehold(); const queryClient = useQueryClient();
  const [setupMode, setSetupMode] = useState<'create' | 'join' | null>(null);
  const [name, setName] = useState('');
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bahrain');
  const [token, setToken] = useState(''); const [email, setEmail] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null); const [message, setMessage] = useState('');
  const [now] = useState(() => Date.now());
  const owner = household.data?.ownerUserId === session?.user.id;
  const members = useQuery({ queryKey: ['members', household.data?.id], queryFn: () => api<Member[]>('/households/current/members'), enabled: !!household.data, retry: false });
  const invites = useQuery({ queryKey: ['invites', household.data?.id], queryFn: () => api<InviteSummary[]>('/households/current/invites'), enabled: !!household.data && owner && settings, retry: false });
  const activeInvites = invites.data?.filter(i => !i.redeemedAt && !i.revokedAt && Date.parse(i.expiresAt) > now) ?? [];
  const action = useMutation({ mutationFn: async (task: () => Promise<unknown>) => task(), onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['household'] });
    await queryClient.invalidateQueries({ queryKey: ['members'] });
    await queryClient.invalidateQueries({ queryKey: ['invites'] });
  }});
  function run(task: () => Promise<unknown>) { setMessage(''); action.mutate(task); }
  return <FoundationScreen title={settings ? 'Settings' : 'Your household'} description="" hideHeading compact fill topPadding={safeAreaTop ? undefined : 8} safeAreaTop={safeAreaTop}>
    <PageHeader title={settings ? 'Settings' : household.data ? 'Your household' : 'Set up your home'} onBack={settings ? () => router.replace('/') : undefined} backLabel="Back to Home" />
    {settings && <View style={pageUi.panel}>
      <Text accessibilityRole="header" style={pageUi.sectionTitle}>Account</Text>
      <Text style={styles.heading}>{session?.user.displayName}</Text>
      <Text selectable style={pageUi.body}>{session?.user.email}</Text>
    </View>}
    {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <View style={pageUi.panel}><Text accessibilityRole="alert" style={styles.error}>{household.error.message}</Text><Action title="Retry" onPress={() => { household.refetch(); }} /></View> : !household.data ? <View style={pageUi.panel}>
      {setupMode === null ? <>
        <Text style={pageUi.body}>Start a shared household, or use an invitation to join one.</Text>
        <Action fullWidth title="Create a household" onPress={() => { action.reset(); setSetupMode('create'); }} />
        <Action fullWidth variant="secondary" title="Join a household" onPress={() => { action.reset(); setSetupMode('join'); }} />
      </> : <>
        <Text accessibilityRole="header" style={pageUi.sectionTitle}>{setupMode === 'create' ? 'Create a household' : 'Join a household'}</Text>
        {setupMode === 'create' ? <>
          <Field label="Household name" value={name} onChangeText={setName} maxLength={80} editable={!action.isPending} autoFocus />
          <Field label="Household time zone" value={zone} onChangeText={setZone} autoCapitalize="none" autoCorrect={false} editable={!action.isPending} />
          <Text style={pageUi.body}>Confirm your local time zone. Expiry dates and reminders use this calendar.</Text>
          <Action fullWidth title="Create household" disabled={action.isPending || !name.trim() || !zone.trim()} onPress={() => run(() => api('/households', { name: name.trim(), timeZone: zone.trim() }, 'POST'))} />
        </> : <>
          <Text style={pageUi.body}>Enter the invitation shared with you. You’ll join using your own account.</Text>
          <Field label="Invitation code" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} maxLength={64} editable={!action.isPending} autoFocus />
          <Action fullWidth title="Join household" disabled={action.isPending || !token.trim()} onPress={() => run(() => api('/household-invites/redeem', { token: token.trim() }, 'POST'))} />
        </>}
        <Action variant="secondary" title="Back to household choices" disabled={action.isPending} onPress={() => { action.reset(); setSetupMode(null); }} />
      </>}

    </View> : <>
      <View style={pageUi.panel}>
        <Text accessibilityRole="header" style={pageUi.sectionTitle}>Household</Text>
        <Text style={styles.heading}>{household.data.name}</Text>
        <Text style={pageUi.body}>Time zone: {household.data.timeZone}</Text>
        <Link href={{ pathname: '/reminder-preferences', params: { from: settings ? 'settings' : 'alerts' } }} style={{ color: '#22634b', fontSize: 15, fontWeight: '600', minHeight: 48, paddingVertical: 14 }}>Reminder preferences →</Link>
      </View>
      <View style={pageUi.panel}>
        <Text accessibilityRole="header" style={pageUi.sectionTitle}>Members{members.data ? ` · ${members.data.length}` : ''}</Text>
        {members.isPending ? <ActivityIndicator accessibilityLabel="Loading members" /> : members.isError ? <><Text style={styles.error}>{members.error.message}</Text><Action title="Retry members" onPress={() => { members.refetch(); }} /></> : members.data?.map(m => <View key={m.userId} style={pageUi.row}>
          <View style={pageUi.copy}><Text style={pageUi.sectionTitle}>{m.displayName}</Text>{m.userId === session?.user.id && <Text style={pageUi.caption}>You</Text>}</View>
          <Text style={{ color: '#22634b', backgroundColor: '#edf5ef', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, fontWeight: '600' }}>{m.role}</Text>
        </View>)}
        {members.data?.length === 1 && <Text style={pageUi.body}>Your household is ready. Invite household members from Settings.</Text>}
      </View>
        {settings && owner && <View style={pageUi.panel}>
          <Text accessibilityRole="header" style={pageUi.sectionTitle}>Invitations</Text>
          {invites.isError && <><Text style={styles.error}>{invites.error.message}</Text><Action title="Retry invitations" onPress={() => { invites.refetch(); }} /></>}
          {activeInvites.length > 0 && <>
            <Text style={pageUi.sectionTitle}>Active invitations</Text>
            {activeInvites.map(i => <View key={i.id} style={{ gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#dce6df' }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.body, { flexGrow: 1, flexShrink: 1 }]}>For {i.invitedEmail ?? 'a household member'} · expires {new Date(i.expiresAt).toLocaleDateString()}</Text>
                {revokeId !== i.id && <Action variant="danger" title="Revoke" label={`Revoke invitation for ${i.invitedEmail ?? 'a household member'}`} disabled={action.isPending} onPress={() => setRevokeId(i.id)} />}
              </View>
              {revokeId === i.id && <>
                <Text style={pageUi.body}>Revoke this invitation? Its code will stop working.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Action variant="danger" title="Confirm revocation" disabled={action.isPending} onPress={() => run(async () => { await api(`/households/current/invites/${i.id}`, undefined, 'DELETE'); if (invite?.id === i.id) setInvite(null); setRevokeId(null); setMessage('Invitation revoked.'); })} />
                  <Action variant="secondary" title="Keep invitation" disabled={action.isPending} onPress={() => setRevokeId(null)} />
                </View>
              </>}
            </View>)}
          </>}
          <Text style={pageUi.sectionTitle}>Invite a household member</Text>
          <Field label="Member email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" maxLength={254} />
          <Action title="Create invitation" disabled={action.isPending} onPress={() => run(async () => { const result = await api<Invite>('/households/current/invites', { invitedEmail: email.trim() || null }, 'POST'); setInvite(result); })} />
          {invite && <>
            <Text style={pageUi.body}>Share this code privately. It can be used once, before {new Date(invite.expiresAt).toLocaleString()}.</Text>
            <Text selectable style={[pageUi.body, { padding: 12, borderRadius: 10, backgroundColor: '#edf5ef' }]}>{invite.token}</Text>
            {Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function')
              ? <Action title="Share invitation code" onPress={() => run(async () => { await Share.share({ message: `Join my ShelfMate household. Sign in with your own account and enter this invitation code: ${invite.token}` }); })} />
              : <Text style={pageUi.body}>Select and copy the code above to share it privately.</Text>}
          </>}
        </View>}

      {!settings && <View style={pageUi.panel}>
        <Text style={pageUi.sectionTitle}>Know what’s on your shelf</Text>
        <Text style={pageUi.body}>Add your first product to start your shared inventory.</Text>
        <Link href="/inventory" style={{ color: '#22634b', fontSize: 16, fontWeight: '700', minHeight: 48, paddingVertical: 14 }}>Open inventory →</Link>
      </View>}
      <Action variant="secondary" title="Refresh household" disabled={action.isPending} onPress={() => run(async () => { await household.refetch(); await members.refetch(); if (settings && owner) await invites.refetch(); })} />
    </>}
    {action.isPending && <ActivityIndicator accessibilityLabel="Saving" />}
    {action.isError && <Text accessibilityRole="alert" style={styles.error}>{action.error.message}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={pageUi.success}>{message}</Text>}
    {settings && <View style={pageUi.panel}><Action variant="secondary" title="Sign out" disabled={action.isPending} onPress={() => run(signOut)} /></View>}
  </FoundationScreen>;
}
