// Strict Structured Outputs requires every property to be required. Represent
// optional properties as nullable on the wire, then restore only those absences
// before applying the original Zod schema. Never fill missing required values.
export function openaiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(openaiSchema);
  const result: any = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'default') continue;
    if (key === 'properties' || key === '$defs') {
      result[key] = Object.fromEntries(Object.entries(value as object).map(([name, child]) => [name, openaiSchema(child)]));
    } else {
      // Zod discriminated unions are mutually exclusive, so anyOf preserves
      // their meaning while using the Structured Outputs supported keyword.
      result[key === 'oneOf' ? 'anyOf' : key] = openaiSchema(value);
    }
  }
  if (schema.type === 'object' && schema.properties) {
    const required = new Set(schema.required || []);
    result.required = Object.keys(schema.properties);
    result.additionalProperties = false;
    for (const name of result.required) {
      if (!required.has(name)) result.properties[name] = { anyOf: [result.properties[name], { type: 'null' }] };
    }
  }
  return result;
}

export function restoreOptionalFields(value: unknown, schema: any, root = schema): unknown {
  if (!schema || typeof schema !== 'object') return value;
  if (schema.$ref?.startsWith('#/')) {
    const target = schema.$ref.slice(2).split('/').reduce((node: any, key: string) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], root);
    return target ? restoreOptionalFields(value, target, root) : value;
  }
  if (Array.isArray(value) && schema.items) return value.map(item => restoreOptionalFields(item, schema.items, root));
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) {
    const result: Record<string, unknown> = { ...value };
    const required = new Set(schema.required || []);
    for (const [key, field] of Object.entries<any>(schema.properties)) {
      if (!Object.hasOwn(result, key)) continue;
      // Nullable fields are meaningful; remove null only where the API added it
      // to represent an optional non-nullable property.
      const nullable = (node: any): boolean => node.type === 'null' || Array.isArray(node.type) && node.type.includes('null') || node.anyOf?.some(nullable) || false;
      if (result[key] === null && !required.has(key) && !nullable(field)) delete result[key];
      else result[key] = restoreOptionalFields(result[key], field, root);
    }
    return result;
  }
  return value;
}
