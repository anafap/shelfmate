import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Field } from '@/features/auth/AccountScreen';
import { timeZoneLabel, timeZones } from '@/lib/timeZones';
import { controlUi } from '@/theme/controlStyles';
import { colors } from '@/theme/tokens';
import { pageUi } from './PageHeader';

export function TimeZonePicker({ value, onChange, disabled }: { value: string; onChange: (zone: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  // Retain a valid device alias even when it is absent from the primary IANA list.
  const zones = [...new Set([value, ...timeZones])].filter(Boolean);
  const query = search.trim().toLowerCase().replace(/_/g, ' ');
  const matches = zones.filter(zone => timeZoneLabel(zone).toLowerCase().includes(query) || zone.toLowerCase().replace(/_/g, ' ').includes(query));
  return <View style={controlUi.field}>
    <Text style={controlUi.label}>Household time zone</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Household time zone: ${timeZoneLabel(value)}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled}
      style={[controlUi.frame, { justifyContent: 'center' }]} onPress={() => { setOpen(!open); setSearch(''); setLimit(20); }}>
      <Text style={controlUi.value}>{timeZoneLabel(value)} ▾</Text>
    </Pressable>
    <Text style={pageUi.caption}>{value}</Text>
    {open && <>
      <Field label="Search city or time zone" placeholder="Bahrain, London, New York…" value={search} autoCapitalize="none" autoCorrect={false} editable={!disabled}
        onChangeText={text => { setSearch(text); setLimit(20); }} />
      <Text accessibilityLiveRegion="polite" style={pageUi.caption}>{matches.length ? `${matches.length} time zones found` : 'No matching time zones. Try a nearby major city or region.'}</Text>
      {matches.slice(0, limit).map(zone => <Pressable key={zone} accessibilityRole="button" accessibilityLabel={`Select ${timeZoneLabel(zone)}`} accessibilityState={{ selected: value === zone, disabled }} disabled={disabled}
        style={[controlUi.frame, { justifyContent: 'center', borderColor: value === zone ? colors.green : colors.border }]}
        onPress={() => { onChange(zone); setOpen(false); }}>
        <Text style={controlUi.value}>{timeZoneLabel(zone)}{value === zone ? ' ✓' : ''}</Text>
      </Pressable>)}
      {matches.length > limit && <Action variant="secondary" title="Show more time zones" disabled={disabled} onPress={() => setLimit(current => current + 20)} />}
      <Action variant="secondary" title="Close time-zone picker" disabled={disabled} onPress={() => setOpen(false)} />
    </>}
  </View>;
}
