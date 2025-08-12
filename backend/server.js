 require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const Joi = require('joi');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/maviz', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
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

// Blockchain Setup
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
const mvzxContract = new ethers.Contract(
  process.env.MVZX_TOKEN_CONTRACT,
  [
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ],
  adminWallet
);

// Validation Schemas
const purchaseSchema = Joi.object({
  wallet: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  amount: Joi.number().min(2000).required(),
  type: Joi.string().valid('auto', 'manual').required()
});

// API Endpoints
app.post('/api/purchase/auto', async (req, res) => {
  try {
    // Validate input
    const { error, value } = purchaseSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Calculate slots and remainder
    const slotCost = parseInt(process.env.SLOT_COST_NGN);
    const slotCount = Math.floor(value.amount / slotCost);
    const remainder = value.amount % slotCost;

    // Process slots
    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      const slot = await createSlot(value.wallet, 'auto');
      slots.push(slot._id);
    }

    // Process remainder
    let mvzxCredited = 0;
    if (remainder > 0) {
      mvzxCredited = (remainder * parseFloat(process.env.MVZX_USDT_RATE)) / (process.env.USDT_TO_NGN || 1500);
      await creditUserWallet(value.wallet, mvzxCredited);
    }

    // Update user
    await User.findOneAndUpdate(
      { wallet: value.wallet },
      { $push: { slots: { $each: slots } }, $inc: { balance: mvzxCredited } },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Purchased ${slotCount} slots and credited ${mvzxCredited.toFixed(2)} MVZx`,
      slots: slotCount,
      mvzxCredited: mvzxCredited
    });

  } catch (error) {
    console.error('Auto purchase error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/purchase/manual', async (req, res) => {
  try {
    // Similar to auto purchase but with position selection
    // Implement your manual placement logic here
    res.json({ success: true, message: 'Manual placement logic will be implemented' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper Functions
async function createSlot(owner, position = 'auto') {
  // Implement your slot creation logic
  const newSlot = new Slot({
    owner,
    position: position === 'auto' ? (Math.random() > 0.5 ? 'right' : 'left') : position,
    level: 1 // Implement level calculation based on parent
  });
  return await newSlot.save();
}

async function creditUserWallet(wallet, amount) {
  const decimals = await mvzxContract.decimals();
  const amountWei = ethers.utils.parseUnits(amount.toString(), decimals);
  const tx = await mvzxContract.transfer(wallet, amountWei);
  await tx.wait();
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'active',
    network: 'BNB Smart Chain',
    contract: process.env.MVZX_TOKEN_CONTRACT,
    lastBlock: provider.blockNumber
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
