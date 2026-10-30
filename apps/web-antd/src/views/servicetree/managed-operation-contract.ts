import type { ManagedCloudOperation, ManagedCloudSyncResult } from '#/api/core/tree/tree_cloud';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const resourceID = /^[A-Za-z0-9][A-Za-z0-9-]{1,99}$/;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
export function validManagedResult(result: ManagedCloudSyncResult | undefined, operationID: string): boolean {
 if (!result || result.operation_id !== operationID || !['success','failed','cancelled','unknown'].includes(result.status) || typeof result.retry_safe !== 'boolean' || ![result.count,result.new_count,result.update_count].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100) || result.new_count + result.update_count > result.count) return false;
 if (result.status === 'unknown' && result.retry_safe) return false;
 return result.status !== 'success' || (result.retry_safe && positive(result.history_id) && !result.error_category && result.count > 0 && result.new_count + result.update_count === result.count);
}
export function validManagedOperation(record: ManagedCloudOperation): boolean {
 if (!record || !uuid.test(record.operation_id ?? '') || !positive(record.owner_id) || !positive(record.cloud_account_id) || !positive(record.cloud_account_region_id) || !['rds','clb','cache'].includes(record.kind) || !['running','unknown','completed','reviewed'].includes(record.state) || !Array.isArray(record.resource_ids) || record.resource_ids.length > 100 || record.resource_ids.some(id => typeof id !== 'string' || !resourceID.test(id)) || new Set(record.resource_ids).size !== record.resource_ids.length) return false;
 if (record.state === 'completed') return validManagedResult(record.result, record.operation_id);
 if (record.state === 'reviewed') return typeof record.reviewed_at === 'string' && !Number.isNaN(Date.parse(record.reviewed_at)) && positive(record.reviewed_by) && typeof record.review_reason === 'string' && [...record.review_reason.trim()].length >= 10 && [...record.review_reason.trim()].length <= 1000 && ['not_recorded','running','completed'].includes(record.previous_state ?? '') && (!record.result || validManagedResult(record.result, record.operation_id));
 return true;
}
