/** Look up local dictionary values without consulting inherited properties. */
export function getOwnLookupValue<Value>(
  dictionary: Readonly<Record<string, Value>>,
  key: number | string,
): undefined | Value {
  return Object.prototype.hasOwnProperty.call(dictionary, key)
    ? dictionary[key]
    : undefined;
}
