function buildTrackerSummary(days) {
  const completed = days.filter(Boolean).length;
  let streak = 0;

  for (let i = 0; i < days.length; i += 1) {
    if (days[i]) streak += 1;
    else break;
  }

  return {
    completed,
    remaining: Math.max(0, 90 - completed),
    percentage: Math.round((completed / 90) * 100),
    streak,
  };
}

function normalizeDays(days) {
  const result = Array.isArray(days) ? days.slice(0, 90) : [];
  while (result.length < 90) result.push(false);
  return result.map(Boolean);
}

module.exports = {
  buildTrackerSummary,
  normalizeDays,
};
