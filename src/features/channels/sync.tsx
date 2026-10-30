/* THE SYNC CHANNEL (⇄): its status icon and its Activity card - every platform (src/features/list.*.ts) */
import React, {useEffect, useState} from 'react';
import {Pressable, Text} from 'react-native';
import {theme} from '../../ui/theme';
import {Btn, Section} from '../../ui/components';
import {barStyles, useIoPurple} from '../../ui/statusBar';
import {useSync} from '../../sync';
import {onRoomState, roomState, type RoomState} from '../../serverRoom';
import {Row, ago, lastOf, useNow} from './rows';
import {channelPlugin} from './plugin';

const styles = barStyles;

/*
 * THE SYNC SERVICE'S ICON, the desktop's in the place of the phone's Bluetooth icons (Brad, 2026-10-25: "the feel to
 * have some icon status bar at the top for desktop"). A text glyph like ᛒ ⌨ ⚿, so it takes the same colours (an emoji
 * such as 🔁 draws in its own):
 *   grey   - sync turned off (the Sync tab's switch);
 *   yellow - on, not synced with a phone yet (or the last try did not reach it);
 *   green  - on, and its last sync reached the phone;
 *   purple flashing - a sync in progress (src/btActivity.ts, the 'sync' channel): it lasts as long as the sync, as
 *     the key's ⚿ flash lasts as long as its traffic.
 * It leads to the Sync tab, as the radio icons lead to Bluetooth.
 */
/*
 * EVERY PLATFORM (Brad, 2026-10-29: "i just want to ensure its show on all platforms"): the ⇄ was the desktop's only.
 * Its sync now comes from wherever this device trades - the desktop's service (file/IPC and its phones), the phone's
 * Bluetooth, the server's room (the web app has only that) - and the purple flash from any of them (btActivity 'sync').
 */
export function useRoom(): RoomState {
  const [s, setS] = useState<RoomState>(roomState());
  useEffect(() => onRoomState(setS), []);
  return s;
}
function SyncStatus({onPress}: {onPress: () => void}) {
  const s = useSync();
  const room = useRoom();
  const io = useIoPurple(c => c === 'sync', false);
  /* the room's last trade reached the other device (its line says traded / in sync) */
  const roomOk = !!room.last && /^(traded|in sync)/.test(room.last.line);
  const color = io ? theme.io
    : (s && s.enabled && s.service === 'running' && s.last?.ok) || roomOk ? theme.ok
    : (s && s.enabled) || room.status === 'joined' ? theme.warn
    : theme.textDim;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Sync status"
      style={({pressed}) => [styles.barMid, pressed && styles.pressed]}>
      <Text style={[styles.barIcon, {color}]}>{'⇄'}</Text>
    </Pressable>
  );
}

function SyncCard({openTab}: {openTab: (name: string) => void}) {
  const s = useSync();
  const room = useRoom();
  const now = useNow();
  const syncWords = s && s.enabled
    ? (s.service === 'running' ? 'on' : s.service === 'no-peers' ? 'on - nothing paired to sync with' : s.service === 'elsewhere' ? `run by ${s.elsewhere ?? 'another program'}` : s.service)
    : s ? 'turned off' : 'no sync service on this platform - the server\'s room only';
  return (
    <Section title="⇄  Sync">
      <Row label="sync service" value={syncWords} />
      {s?.last ? <Row label="its last sync" value={`${ago(s.last.at, now)} - ${s.last.line}`} /> : null}
      {room.last ? <Row label="last trade in the room" value={`${ago(room.last.at, now)} with ${room.last.with} - ${room.last.line}`} /> : null}
      <Row label="trade traffic" value={lastOf('sync', now)} />
      <Btn title="Sync" onPress={() => openTab('Sync')} />
    </Section>
  );
}

export const syncChannel = channelPlugin({
  name: 'Sync', order: 20,
  icon: ctx => <SyncStatus onPress={() => ctx.openTab('Activity')} />,
  card: ctx => <SyncCard openTab={ctx.openTab} />,
});
