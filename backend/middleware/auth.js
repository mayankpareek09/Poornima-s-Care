const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))
      token = req.headers.authorization.split(' ')[1];
    if (!token)
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(401).json({ success: false, message: 'User no longer exists.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
};

exports.requireRole = (...roles) => (req, res, next) => {
  // Flatten in case called with array or multiple args
  const allowed = roles.flat();
  if (!allowed.includes(req.user.role))
    return res.status(403).json({ success: false, message: `Access denied. Required role: ${allowed.join(' or ')}` });
  next();
};
