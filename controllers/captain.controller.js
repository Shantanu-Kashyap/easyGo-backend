const captainModel = require('../models/captain.model');
const rideModel = require('../models/ride.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const sanitizeCaptain = (c) => {
  if (!c) return null;
  const obj = c.toObject ? c.toObject() : { ...c };
  delete obj.password;
  return obj;
};

const isProd = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/'
};

module.exports.getProfile = async (req, res) => {
  try {
    const captain = await captainModel.findById(req.captain._id).select('-password');
    return res.status(200).json({ captain: sanitizeCaptain(captain) });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Missing credentials',
        description: 'Please provide both email and password to login.' 
      });
    }

    const captain = await captainModel.findOne({ email }).select('+password');
    if (!captain) {
      return res.status(404).json({ 
        message: 'Account not found',
        description: 'No captain account found with this email address. Please check your email or sign up for a new account.' 
      });
    }

    if (!captain.password) {
      return res.status(500).json({ 
        message: 'Account error',
        description: 'There is an issue with your account. Please contact support for assistance.' 
      });
    }

    const ok = await bcrypt.compare(password, captain.password);
    if (!ok) {
      return res.status(401).json({ 
        message: 'Login failed',
        description: 'The password you entered is incorrect. Please try again or reset your password.' 
      });
    }

    const token = jwt.sign({ _id: captain._id, userType: 'captain' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, cookieOptions);

    const captainData = await captainModel.findById(captain._id).select('-password');
    return res.status(200).json({ captain: sanitizeCaptain(captainData), token });
  } catch (err) {
    console.error('Captain login error:', err);
    return res.status(500).json({ 
      message: 'Server error',
      description: 'An unexpected error occurred while processing your login. Please try again later.' 
    });
  }
};

module.exports.register = async (req, res) => {
  try {
    const { firstname, lastname, email, password, vehicle } = req.body;
    if (!email || !password || !firstname) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        description: 'Please provide first name, email, and password to register.' 
      });
    }

    const exists = await captainModel.findOne({ email });
    if (exists) {
      return res.status(409).json({ 
        message: 'Email already registered',
        description: 'This email address is already associated with a captain account. Please login or use a different email.' 
      });
    }

    const created = await captainModel.create({
      fullname: { firstname, lastname },
      email,
      password,
      vehicle: vehicle || {}
    });

    const token = jwt.sign({ _id: created._id, userType: 'captain' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, cookieOptions);

    const captainData = await captainModel.findById(created._id).select('-password');
    return res.status(201).json({ captain: sanitizeCaptain(captainData), token });
  } catch (err) {
    console.error('Captain registration error:', err);
    return res.status(500).json({ 
      message: 'Registration failed',
      description: 'An unexpected error occurred during registration. Please check your information and try again.' 
    });
  }
};

module.exports.getCaptainStatus = async (req, res) => {
  try {
    const captain = req.captain || null;
    return res.status(200).json({
      ok: true,
      captainId: captain?._id || null,
      online: !!(captain && captain.socketId),
      status: captain?.status || 'inactive'
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.updateStatus = async (req, res) => {
  try {
    const allowed = ['active', 'inactive', 'busy'];
    const { status } = req.body;
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await captainModel.findByIdAndUpdate(
      req.captain._id,
      { status },
      { new: true }
    ).select('-password');

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.getCaptainStats = async (req, res) => {
  try {
    const captainId = req.captain._id;

    const stats = await rideModel.aggregate([
      { $match: { captain: captainId, status: { $in: ['completed', 'ended'] } } },
      {
        $group: {
          _id: '$captain',
          totalRides: { $sum: 1 },
          totalEarnings: { $sum: { $ifNull: ['$fare', 0] } },
          totalDistance: { $sum: { $ifNull: ['$distance', 0] } },
          totalDurationSeconds: { $sum: { $ifNull: ['$duration', 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      totalRides: 0,
      totalEarnings: 0,
      totalDistance: 0,
      totalDurationSeconds: 0
    };

    const totalDistance = parseFloat(result.totalDistance.toFixed(1));
    const hoursOnline = parseFloat((result.totalDurationSeconds / 3600).toFixed(1));

    const captain = await captainModel.findById(captainId).select('-password');

    return res.status(200).json({
      totalRides: result.totalRides,
      totalEarnings: result.totalEarnings,
      totalDistance: totalDistance,
      totalHours: hoursOnline,
      captain
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};