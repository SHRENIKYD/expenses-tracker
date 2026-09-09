function name(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80;
}
function amount(value, positive = true) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  if (String(value).trim() === '') return false;
  const n = Number(value);
  return (
    Number.isFinite(n) &&
    Math.abs(n) <= 9999999999.99 &&
    (!positive || n >= 0.01) &&
    Math.abs(n * 100 - Math.round(n * 100)) < 0.0001
  );
}
function uuid(value) {
  return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
module.exports = { name, amount, uuid };
