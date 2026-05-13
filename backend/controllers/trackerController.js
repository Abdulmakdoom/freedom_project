const User = require('../models/User');
const { buildTrackerSummary, normalizeDays } = require('../utils/tracker');

function publicTracker(days) {
  const normalizedDays = normalizeDays(days);
  return {
    days: normalizedDays,
    summary: buildTrackerSummary(normalizedDays),
  };
}

async function getTracker(req, res) {
  const days = normalizeDays(req.user.tracker?.days);
  res.json({ tracker: publicTracker(days) });
}

async function toggleDay(req, res) {
  const dayNumber = Number(req.params.day);

  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 90) {
    return res.status(400).json({ message: 'Day must be between 1 and 90' });
  }

  const index = dayNumber - 1;
  const days = normalizeDays(req.user.tracker?.days);
  days[index] = !days[index];

  await User.findByIdAndUpdate(req.user._id, { 'tracker.days': days });

  res.json({ tracker: publicTracker(days) });
}

async function resetTracker(req, res) {
  const days = Array.from({ length: 90 }, () => false);
  await User.findByIdAndUpdate(req.user._id, { 'tracker.days': days });
  res.json({ tracker: publicTracker(days) });
}

module.exports = {
  getTracker,
  toggleDay,
  resetTracker,
};
