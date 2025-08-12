 import express from 'express';
import { ethers } from 'ethers';
import mongoose from 'mongoose';
import Joi from '@hapi/joi';
import Flutterwave from 'flutterwave-node-v3';

// Database Models
const SlotSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  position: { type: String, enum: ['left', 'right'], required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Slot' }],
  level: { type: Number, default: 1 }
});

const UserSchema = new mongoose.Schema({
  wallet: { type: String, unique: true },
  pin: { type: String },
  slots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Slot' }],
  balance: { type: Number, default: 0 }
});

const Slot = mongoose.model('Slot', SlotSchema);
const User = mongoose.model('User', UserSchema);

// Payment Processing
async function processPayment(amount, userWallet, positionPreference = null) {
  const slotCost = 2000; // ₦2000 per slot
  const slotCount = Math.floor(amount / slotCost);
  const remainingAmount = amount % slotCost;
  
  // 1. Process Slots First
  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    const slot = await createSlot(userWallet, positionPreference);
    slots.push(slot);
  }
  
  // 2. Process Remaining Balance
  if (remainingAmount > 0) {
    const tokenAmount = convertNairaToMvzx(remainingAmount);
    await creditUserWallet(userWallet, tokenAmount);
  }
  
  return { slots, remainingAmount };
}

async function createSlot(owner, position = null) {
  // Automatic positioning logic
  if (!position) {
    position = await determineOptimalPosition(owner);
  }
  
  // Find parent based on spillover/spillunder
  const parent = await findAvailableParent(position);
  
  const newSlot = new Slot({
    owner,
    position,
    parent: parent?._id,
    level: parent ? parent.level + 1 : 1
  });
  
  await newSlot.save();
  
  // Update parent's children
  if (parent) {
    parent.children.push(newSlot._id);
    await parent.save();
  }
  
  return newSlot;
}

// Position Determination Logic
async function determineOptimalPosition(owner) {
  // Check user's existing slots for balance
  const userSlots = await Slot.find({ owner });
  
  const leftCount = userSlots.filter(s => s.position === 'left').length;
  const rightCount = userSlots.filter(s => s.position === 'right').length;
  
  return leftCount <= rightCount ? 'left' : 'right';
}

async function findAvailableParent(position) {
  // Find the first available parent with < 2 children in the requested position
  return await Slot.findOne({
    [`children.${position}`]: { $size: 0 }
  }).sort({ level: 1 });
}

// Manual Placement Endpoint
app.post('/api/purchase/manual', async (req, res) => {
  const { amount, wallet, pin, positions } = req.body;
  
  // Validate positions array matches slot count
  const slotCount = Math.floor(amount / 2000);
  if (positions && positions.length !== slotCount) {
    return res.status(400).json({ error: 'Position count mismatch' });
  }
  
  const result = await processPayment(amount, wallet, positions);
  
  res.json({
    success: true,
    purchasedSlots: result.slots.length,
    remainingCredit: result.remainingAmount,
    mvzxCredited: convertNairaToMvzx(result.remainingAmount)
  });
});
