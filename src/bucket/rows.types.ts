/* a row store (rows.ts): the bucket kept as sealed rows, the same rows the server's sealed copy keeps */
export type RowStore = {
  /* id -> tag, the change table */
  table(): Promise<Record<string, string>>;
  get(ids: string[]): Promise<Record<string, string>>;
  put(rows: Record<string, {tag: string; blob: string}>): Promise<void>;
  /* id -> blob, every row */
  all(): Promise<Record<string, string>>;
  clear(): Promise<void>;
};
