const express = require('express');
const router  = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const getModel = (name) => require(`../models/${name}`);

// GET /api/super/stats
router.get('/stats', protect, requireRole('super_admin'), async (req, res) => {
  try {
    const User=getModel('User'), Complaint=getModel('Complaint'),
          Laundry=getModel('Laundry'), Event=getModel('Event'), Club=getModel('Club');

    let canteenStats={}, messStats={};
    try {
      const CanteenOrder=getModel('CanteenOrder');
      const today=new Date(); today.setHours(0,0,0,0);
      const [todayOrders,rev]=await Promise.all([
        CanteenOrder.countDocuments({createdAt:{$gte:today}}),
        CanteenOrder.aggregate([{$match:{createdAt:{$gte:today},status:{$ne:'cancelled'}}},{$group:{_id:null,total:{$sum:'$total'}}}]),
      ]);
      canteenStats={todayOrders, todayRevenue:rev[0]?.total||0};
    } catch(e){ canteenStats={error:'Not set up'}; }

    try {
      const MessToken=getModel('MessToken');
      const today2=new Date().toISOString().slice(0,10);
      const [tokensToday,mrev]=await Promise.all([
        MessToken.countDocuments({date:today2}),
        MessToken.aggregate([{$match:{date:today2,status:{$ne:'expired'}}},{$group:{_id:null,total:{$sum:'$price'}}}]),
      ]);
      messStats={tokensToday, revenue:mrev[0]?.total||0};
    } catch(e){ messStats={error:'Not set up'}; }

    const [totalUsers,students,admins,openComplaints,escalatedComplaints,totalEvents,totalClubs,pendingLaundry]=
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({role:'student'}),
        User.countDocuments({role:{$in:['academic_admin','hostel_admin','campus_admin','laundry_admin','canteen_admin','mess_admin','super_admin']}}),
        Complaint.countDocuments({status:{$in:['open','inprogress']}}),
        Complaint.countDocuments({isEscalated:true, status:{$ne:'resolved'}}),
        Event.countDocuments(),
        Club.countDocuments(),
        Laundry.countDocuments({status:{$in:['pending','submitted','washing']}}),
      ]);

    const roleBreakdown=await User.aggregate([{$group:{_id:'$role',count:{$sum:1}}},{$sort:{count:-1}}]);
    const complaintsByDept=await Complaint.aggregate([{$group:{_id:'$routedTo',
      open:{$sum:{$cond:[{$in:['$status',['open','inprogress']]},1,0]}},
      resolved:{$sum:{$cond:[{$eq:['$status','resolved']},1,0]}}
    }}]);

    res.json({ success:true, stats:{
      users:{total:totalUsers,students,admins},
      complaints:{open:openComplaints,escalated:escalatedComplaints},
      events:totalEvents, clubs:totalClubs,
      laundry:{pending:pendingLaundry},
      canteen:canteenStats, mess:messStats,
      roleBreakdown, complaintsByDept,
    }});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

// GET /api/super/users
router.get('/users', protect, requireRole('super_admin'), async (req, res) => {
  try {
    const User=getModel('User');
    const {role,q}=req.query;
    const filter={};
    if(role) filter.role=role;
    if(q) filter.$or=[{name:{$regex:q,$options:'i'}},{userId:{$regex:q,$options:'i'}}];
    const users=await User.find(filter).select('-password -otp -otpExpires').sort({createdAt:-1}).limit(200);
    res.json({success:true,users});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

// PATCH /api/super/users/:id/role
router.patch('/users/:id/role', protect, requireRole('super_admin'), async (req, res) => {
  try {
    const User=getModel('User');
    const {role}=req.body;
    const validRoles=['student','academic_admin','hostel_admin','campus_admin','laundry_admin',
      'council_admin','canteen_admin','mess_admin','store_admin','guard','faculty','super_admin'];
    if(!validRoles.includes(role)) return res.status(400).json({success:false,message:'Invalid role'});
    const user=await User.findByIdAndUpdate(req.params.id,{role},{new:true}).select('-password');
    if(!user) return res.status(404).json({success:false,message:'User not found'});
    res.json({success:true,message:`Role updated to ${role}`,user});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

// DELETE /api/super/users/:id
router.delete('/users/:id', protect, requireRole('super_admin'), async (req, res) => {
  try {
    const User=getModel('User');
    if(req.params.id===req.user._id.toString())
      return res.status(400).json({success:false,message:"Can't delete yourself."});
    await User.findByIdAndDelete(req.params.id);
    res.json({success:true,message:'User deleted'});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

// GET /api/super/complaints
router.get('/complaints', protect, requireRole('super_admin'), async (req, res) => {
  try {
    const Complaint=getModel('Complaint');
    const {status,dept}=req.query;
    const filter={};
    if(status) filter.status=status;
    if(dept) filter.routedTo=dept;
    const complaints=await Complaint.find(filter).sort({isEscalated:-1,createdAt:-1}).limit(500);
    res.json({success:true,complaints});
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
});

module.exports = router;