/*
 * THE ROOM'S STATE ON SCREEN (src/serverRoom.ts): the 🔗's icon and card (src/features/channels/mcp.tsx) and the Sync
 * tab's Features list (src/screens/SyncScreen.tsx) read the same state - the room is the sync on every shell since the
 * Bluetooth sync and the desktop's sync service went (2026-10-30). Kept current by the room's events, never polled.
 */
import {useEffect, useState} from 'react';
import {onRoomState, roomState, type RoomState} from '../serverRoom';

export function useRoom(): RoomState {
  const [s, setS] = useState<RoomState>(roomState());
  useEffect(() => onRoomState(setS), []);
  return s;
}
