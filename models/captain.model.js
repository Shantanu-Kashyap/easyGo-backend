const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const captainSchema = new mongoose.Schema({
  fullname: {
    firstname: { type: String, required: true, minlength: [3, 'First name must be at least 3 characters long'] },
    lastname: { type: String }
  },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  socketId: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'busy'], default: 'inactive' },
  vehicle: {
    color: { type: String, minlength: [3, 'Color must be at least 3 characters long'] },
    plate: { type: String, minlength: [3, 'Plate must be at least 3 characters long'] },
    capacity: { type: Number, min: [1, 'Capacity must be at least 1'] },
    vehicleType: { type: String, enum: ['car', 'motorcycle', 'auto', 'moto'] }
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  }
}, { timestamps: true });

captainSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

captainSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ _id: this._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
  return token;
};

captainSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const captainModel = mongoose.model('captain', captainSchema);

module.exports = captainModel;