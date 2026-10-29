/** Only the opaque operation ID is persisted; request text and credentials stay in memory. */
const prefix = 'cloudops-autofix-operation:v1:';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function key(owner: string) {
  return `${prefix}${encodeURIComponent(owner)}`;
}

export function readOperationId(owner: string): string | undefined {
  if (!owner) return undefined;
  try {
    const value = sessionStorage.getItem(key(owner));
    return value && uuid.test(value) ? value.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export function saveOperationId(owner: string, operationId: string): boolean {
  if (!owner || !uuid.test(operationId)) return false;
  try {
    sessionStorage.setItem(key(owner), operationId);
    return sessionStorage.getItem(key(owner)) === operationId;
  } catch {
    return false;
  }
}

export function removeOperationId(owner: string): void {
  if (!owner) return;
  try {
    sessionStorage.removeItem(key(owner));
  } catch {
    /* No diagnostic data is stored. */
  }
}
