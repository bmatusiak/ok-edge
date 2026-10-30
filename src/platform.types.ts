/* the types every platform file shares (platform.ts: the contract) */
export type Shell = 'android' | 'desktop' | 'webapp';

/** The desktop bridge the preload exposes - only `invoke` on an allowlisted channel. */
export type DesktopBridge = {invoke: (channel: string, ...args: unknown[]) => Promise<unknown>};
