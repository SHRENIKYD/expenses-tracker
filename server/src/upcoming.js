// A bill counts as due soon when it falls between today and a week from today.
// Anything already past is not a reminder, it is history.
function countDueSoon(entries, todayIso, days = 7) {
  const start = new Date(`${todayIso}T00:00:00Z`);
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return entries.filter((entry) => entry.date >= todayIso && entry.date <= end).length;
}

module.exports = { countDueSoon };
