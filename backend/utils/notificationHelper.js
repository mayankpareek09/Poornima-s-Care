const Notification = require('../models/Notification');
const User = require('../models/User');

// Create a notification for a specific user
async function createNotification(userId, title, message, type = 'system', refId = null, priority = 'medium') {
  try {
    await Notification.create({ userId, title, message, type, refId, priority });
  } catch (err) {
    console.error('Notification create error:', err.message);
  }
}

// Notify all admins of a specific role
async function notifyAdmins(role, title, message, type = 'system', refId = null, priority = 'medium') {
  try {
    const admins = await User.find({ role });
    const notifications = admins.map(admin => ({
      userId: admin._id, title, message, type, refId, priority
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('Notify admins error:', err.message);
  }
}

// Notify all campus admins (all 3 admin types)
async function notifyAllAdmins(title, message, type = 'system', refId = null, priority = 'high') {
  const roles = ['academic_admin','hostel_admin','campus_admin'];
  for (const role of roles) {
    await notifyAdmins(role, title, message, type, refId, priority);
  }
}

module.exports = { createNotification, notifyAdmins, notifyAllAdmins };