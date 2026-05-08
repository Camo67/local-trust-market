const key = (userId: string, convId: string) => `lr:${userId}:${convId}`;

export const getLastRead = (userId: string, convId: string): number => {
  try {
    const val = localStorage.getItem(key(userId, convId));
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
};

export const setLastRead = (userId: string, convId: string, ts: number = Date.now()) => {
  try {
    localStorage.setItem(key(userId, convId), String(ts));
  } catch {}
};

export const getAllLastRead = (userId: string, convIds: string[]): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const id of convIds) result[id] = getLastRead(userId, id);
  return result;
};
