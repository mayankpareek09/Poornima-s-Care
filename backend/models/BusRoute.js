const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  time:      { type: String, default: '' },
  landmark:  { type: String, default: '' },
}, { _id: false });

const busRouteSchema = new mongoose.Schema({
  routeNo:     { type: String, required: true, unique: true },
  routeName:   { type: String, required: true },
  stops:       [stopSchema],
  driver:      { type: String, default: '' },
  driverPhone: { type: String, default: '' },
  vehicle:     { type: String, default: '' },
  morning:     { type: String, default: '' },
  evening:     { type: String, default: '' },
  annualFee:   { type: Number, default: null },  // e.g. 20000, 30000, 35000
  notes:       { type: String, default: '' },    // e.g. 50% rebate info
  isActive:    { type: Boolean, default: true },
  updatedBy:   { type: String },
}, { timestamps: true });

module.exports = mongoose.model('BusRoute', busRouteSchema);
