export function formatExact(value) {
  return value === undefined || value === null ? '' : value;
}

export function formatDatetime(value) {
  return value === undefined || value === null || value === '' ? '' : new Date(value).toLocaleString();
}

export function formatBoolean(value) {
  return value === true || value === 'true' ? '✅' : '❌';
}
