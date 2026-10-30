/** Browser data is a recovery pointer, never an execution or review authority. */
export interface ManagedOperationMarker {
  version: 2;
  operation_id: string;
  resource_ids: string[];
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const resourceID = /^[A-Za-z0-9][A-Za-z0-9-]{1,99}$/;
export function parseManagedMarker(raw: string | null): ManagedOperationMarker | null {
  if (!raw || raw.length > 15000) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 2 || typeof value.operation_id !== 'string' || !uuid.test(value.operation_id) || !Array.isArray(value.resource_ids) || !value.resource_ids.length || value.resource_ids.length > 100 || value.resource_ids.some((id: unknown) => typeof id !== 'string' || !resourceID.test(id)) || new Set(value.resource_ids).size !== value.resource_ids.length) return null;
    return { version: 2, operation_id: value.operation_id, resource_ids: [...value.resource_ids] };
  } catch { return null; }
}
export function saveManagedMarker(storage: Storage, key: string, marker: ManagedOperationMarker): boolean {
  const raw = JSON.stringify(marker);
  if (!parseManagedMarker(raw)) return false;
  try {
    if (storage.getItem(key) !== null) return false;
    storage.setItem(key, raw);
    return storage.getItem(key) === raw;
  } catch { return false; }
}
export function removeManagedMarker(storage: Storage, key: string, operationID: string): boolean {
  try {
    if (parseManagedMarker(storage.getItem(key))?.operation_id !== operationID) return false;
    storage.removeItem(key);
    return storage.getItem(key) === null;
  } catch { return false; }
}
