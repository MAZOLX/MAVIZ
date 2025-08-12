 require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// MLM Configuration
const SLOT_COST = 2000; // ₦2000 per slot

// Blockchain Setup
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// MLM Endpoints
app.post('/api/purchase', async (req, res) => {
  try {
    const { amount, userAddress } = req.body;
    
    // Validate
    if (amount < SLOT_COST) {
      return res.status(400).json({ error: `Minimum purchase is ₦${SLOT_COST}` });
    }

    // Process MLM slots
    const slotCount = Math.floor(amount / SLOT_COST);
    const remainder = amount % SLOT_COST;
    
    // Mock response
    res.json({
      success: true,
      slots: slotCount,
      mvzxCredit: remainder * 0.0015, // 1 MVZx = ₦0.0015
      message: `Allocated ${slotCount} slots + ${remainder}₦ MVZx credit`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`MLM Server ready`);
});
