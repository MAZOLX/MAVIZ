 import express from 'express';
import mongoose from 'mongoose';
import { ethers } from 'ethers';
import Joi from '@hapi/joi';
import Flutterwave from 'flutterwave-node-v3';
import dotenv from 'dotenv';

dotenv.config();

// Database Connection
mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Models
const SlotSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  position: { type: String, enum: ['left', 'right'], required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Slot' }],
  level: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  slots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Slot' }],
  balance: { type: Number, default: 0 },
  referralCode: { type: String, unique: true }
});

const Slot = mongoose.model('Slot', SlotSchema);
const User = mongoose.model('User', UserSchema);

// App Setup
const app = express();
app.use(express.json());

// Flutterwave Setup
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

// Core Business Logic
async function processPayment(amount, userWallet, positions = []) {
  const slotCost = parseInt(process.env.SLOT_COST_NGN);
  const slotCount = Math.floor(amount / slotCost);
  const remainingAmount = amount % slotCost;
  
  // Process Slots
  const createdSlots = [];
  for (let i = 0; i < slotCount; i++) {
    const position = positions[i] || null;
    const slot = await createSlot(userWallet, position);
    createdSlots.push(slot);
    
    // Update user's slots
    await User.updateOne(
      { wallet: userWallet },
      { $push: { slots: slot._id } }
    );
  }

  // Process Remaining Balance
  if (remainingAmount > 0) {
    const mvzxAmount = remainingAmount * parseFloat(process.env.MVZX_PER_NAIRA);
    await User.updateOne(
      { wallet: userWallet },
      { $inc: { balance: mvzxAmount } }
    );
  }

  return { slots: createdSlots, remainingAmount };
}

async function createSlot(owner, position = null) {
  if (!position) {
    position = await determineOptimalPosition(owner);
  }

  const parent = await findAvailableParent(position);
  const newSlot = new Slot({
    owner,
    position,
    parent: parent?._id,
    level: parent ? parent.level + 1 : 1
  });

  await newSlot.save();

  if (parent) {
    parent.children.push(newSlot._id);
    await parent.save();
  }

  return newSlot;
}

// API Endpoints
app.post('/api/purchase/auto', async (req, res) => {
  const schema = Joi.object({
    amount: Joi.number().min(2000).required(),
    wallet: Joi.string().required(),
    pin: Joi.string().length(4).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const result = await processPayment(value.amount, value.wallet);
    res.json({
      success: true,
      slotsPurchased: result.slots.length,
      mvzxCredited: value.amount % 2000 * 0.0015,
      treePosition: result.slots.map(s => ({
        level: s.level,
        position: s.position
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase/manual', async (req, res) => {
  const schema = Joi.object({
    amount: Joi.number().min(2000).required(),
    wallet: Joi.string().required(),
    pin: Joi.string().length(4).required(),
    positions: Joi.array().items(Joi.string().valid('left', 'right'))
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const result = await processPayment(value.amount, value.wallet, value.positions);
    res.json({
      success: true,
      slotsPurchased: result.slots.length,
      mvzxCredited: value.amount % 2000 * 0.0015,
      positions: result.slots.map(s => s.position)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
