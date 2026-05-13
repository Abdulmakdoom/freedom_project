const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');

async function authMiddleware(req, res, next) {
  try {
    const tokenFromCookie = req.cookies?.accessToken;
    const tokenFromHeader = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('+refreshTokenHash');

    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
}

module.exports = authMiddleware;
