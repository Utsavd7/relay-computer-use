/** Central persistence boundary. No raw parameters, output values, DOM or model text in logs. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /^(?:password|secret|token|access_token|api_key|credentials?|member_id|balance|email|authorization)$/i.test(
          k,
        )
          ? '[REDACTED]'
          : redact(v),
      ]),
    );
  if (typeof value === 'string')
    return value
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{5,}\b/g, '[ID]')
      .replace(/(?:USD|\$)\s*[\d,.]+/g, '[AMOUNT]')
      .replace(/Bearer\s+\S+/gi, '[TOKEN]');
  return value;
}
