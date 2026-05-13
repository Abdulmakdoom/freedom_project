const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { buildTrackerSummary, normalizeDays } = require('../utils/tracker');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/tokens');

function authCookies() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
  };
}

function publicUser(user) {
  const days = normalizeDays(user.tracker?.days);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    tracker: {
      days,
      summary: buildTrackerSummary(days),
    },
  };
}

function setAuthCookies(res, tokens) {
  res.cookie('accessToken', tokens.accessToken, {
    ...authCookies(),
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    ...authCookies(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  const options = authCookies();
  res.clearCookie('accessToken', options);
  res.clearCookie('refreshToken', options);
}

function issueTokens(userId) {
  const payload = { userId };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      password: hashedPassword,
    });

    const tokens = issueTokens(user._id.toString());
    user.refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, tokens);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password +refreshTokenHash');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokens = issueTokens(user._id.toString());
    user.refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, tokens);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function refresh(req, res) {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({ message: 'Session expired' });
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId).select('+refreshTokenHash');

    if (!user) {
      return res.status(401).json({ message: 'Session expired' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (!user.refreshTokenHash || user.refreshTokenHash !== tokenHash) {
      return res.status(401).json({ message: 'Session expired' });
    }

    const tokens = issueTokens(user._id.toString());
    user.refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, tokens);
    res.json({ user: publicUser(user) });
  } catch (_error) {
    return res.status(401).json({ message: 'Session expired' });
  }
}

async function logout(req, res) {
  try {
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null });
    } else if (req.cookies?.refreshToken) {
      const decoded = verifyRefreshToken(req.cookies.refreshToken);
      const tokenHash = crypto.createHash('sha256').update(req.cookies.refreshToken).digest('hex');
      await User.findOneAndUpdate(
        { _id: decoded.userId, refreshTokenHash: tokenHash },
        { refreshTokenHash: null },
      );
    }
  } catch (_error) {
    // Ignore token decoding issues and continue clearing cookies.
  }

  clearAuthCookies(res);
  res.json({ message: 'Logged out successfully' });
}

module.exports = {
  register,
  login,
  me,
  refresh,
  logout,
};
