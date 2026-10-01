export function stableContentKey(prefix: string, value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `${prefix}.${(hash >>> 0).toString(36)}`;
}
