// DOM Elements
const metamaskBtn = document.getElementById('metamask-btn');
const walletconnectBtn = document.getElementById('walletconnect-btn');
const walletStatus = document.getElementById('wallet-status');
const purchaseSection = document.getElementById('purchase-section');
const amountInput = document.getElementById('amount');
const buyBtn = document.getElementById('buy-btn');
const purchaseSummary = document.getElementById('purchase-summary');

// BNB Chain Configuration
const BNB_CHAIN_ID = '0x38'; // 56 in decimal
const BNB_RPC_URL = 'https://bsc-dataseed.binance.org/';
const MVZX_TOKEN_ADDRESS = '0x8Da1a166d8cd2218003549B57e90D8E586023D00';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

// Initialize
checkWalletConnection();
amountInput.addEventListener('input', updatePurchaseSummary);

// 1. MetaMask Connection with BNB Chain support
metamaskBtn.addEventListener('click', async () => {
  if (!window.ethereum) {
    window.open(isMobile() ? 'https://metamask.app.link/dapp/' + encodeURIComponent(window.location.hostname) 
                          : 'https://metamask.io/download.html', '_blank');
    return;
  }

  try {
    toggleButtons(true);
    
    // Switch to BNB Chain if needed
    await switchToBNBChain();
    
    // This will trigger the account selection prompt
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (accounts.length === 0) throw new Error("No accounts selected");
    
    userAddress = accounts[0];
    provider = new ethers.providers.Web3Provider(window.ethereum);
    
    setupEthEventListeners();
    updateUI();
    initMLM();
    
  } catch (error) {
    showError(`Connection failed: ${error.message}`);
  } finally {
    toggleButtons(false);
  }
});

// 2. WalletConnect with BNB Chain
walletconnectBtn.addEventListener('click', async () => {
  try {
    toggleButtons(true);
    
    const walletConnectProvider = new WalletConnectProvider.default({
      rpc: {
        56: BNB_RPC_URL
      },
      chainId: 56
    });
    
    await walletConnectProvider.enable();
    provider = new ethers.providers.Web3Provider(walletConnectProvider);
    userAddress = await provider.getSigner().getAddress();
    
    walletConnectProvider.on("accountsChanged", handleAccountsChanged);
    walletConnectProvider.on("chainChanged", handleChainChanged);
    
    updateUI();
    initMLM();
    
  } catch (error) {
    showError(`WalletConnect failed: ${error.message}`);
  } finally {
    toggleButtons(false);
  }
});

// 3. Initialize MLM with BEP-20 token support
function initMLM() {
  buyBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    if (amount < 2000) {
      showError('Minimum purchase is ₦2000');
      return;
    }
    
    try {
      buyBtn.disabled = true;
      const slots = Math.floor(amount / 2000);
      const remainder = amount % 2000;
      
      // Initialize payment
      initializePayment(amount, slots, remainder);
      
    } catch (error) {
      showError(`Payment error: ${error.message}`);
    } finally {
      buyBtn.disabled = false;
    }
  });
}

// 4. Switch to BNB Chain if not already
async function switchToBNBChain() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  
  if (chainId !== BNB_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BNB_CHAIN_ID }],
      });
    } catch (error) {
      // If chain not added, add it
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BNB_CHAIN_ID,
            chainName: 'BNB Smart Chain',
            nativeCurrency: {
              name: 'BNB',
              symbol: 'BNB',
              decimals: 18
            },
            rpcUrls: [BNB_RPC_URL],
            blockExplorerUrls: ['https://bscscan.com/']
          }]
        });
      } else {
        throw error;
      }
    }
  }
}

// Helper Functions
function checkWalletConnection() {
  if (window.ethereum?.selectedAddress) {
    userAddress = window.ethereum.selectedAddress;
    provider = new ethers.providers.Web3Provider(window.ethereum);
    updateUI();
    initMLM();
  }
}

function updateUI() {
  if (userAddress) {
    walletStatus.textContent = `Connected: ${shortenAddress(userAddress)} (BNB Chain)`;
    walletStatus.className = 'connected';
    purchaseSection.style.display = 'block';
  } else {
    walletStatus.textContent = 'Wallet not connected';
    walletStatus.className = '';
    purchaseSection.style.display = 'none';
  }
}

function updatePurchaseSummary() {
  const amount = parseFloat(amountInput.value) || 0;
  const slots = Math.floor(amount / 2000);
  const remainder = amount % 2000;
  
  purchaseSummary.innerHTML = amount >= 2000 ? `
    <p>Purchasing: ${slots} slot(s) (₦${slots * 2000})</p>
    ${remainder > 0 ? `<p>+ ₦${remainder} as MVZx tokens</p>` : ''}
  ` : '';
}

function initializePayment(amount, slots, remainder) {
  // Convert amount to USDT equivalent using your rate
  const usdtAmount = (amount / parseFloat(MVZX_USDT_RATE)).toFixed(2);
  
  FlutterwaveCheckout({
    public_key: process.env.FLW_PUBLIC_KEY,
    tx_ref: 'MVZX-' + Date.now(),
    amount: amount,
    currency: 'NGN',
    payment_options: 'card, banktransfer, ussd',
    customer: {
      email: getUserEmail(), // Implement this
      phone_number: getUserPhone(), // Implement this
      name: 'MVZX Buyer'
    },
    callback: async function(response) {
      if (response.status === 'successful') {
        // On successful payment
        const tx = await processBNBChainTransaction(userAddress, slots, remainder);
        alert(`Success! ${slots} slots purchased\nTx Hash: ${tx.hash}`);
      } else {
        showError('Payment failed');
      }
    },
    customizations: {
      title: 'MAVIZ Token Purchase',
      description: `${slots} MLM slots purchase`,
      logo: 'https://i.imgur.com/VbxvCK6.jpeg'
    }
  });
}

async function processBNBChainTransaction(walletAddress, slots, remainder) {
  // Initialize contracts
  const mvzxContract = new ethers.Contract(
    MVZX_TOKEN_ADDRESS,
    ['function transfer(address to, uint256 amount) returns (bool)'],
    provider.getSigner()
  );
  
  // Calculate token amounts (adjust based on your token decimals)
  const remainderTokens = ethers.utils.parseUnits((remainder * MVZX_USDT_RATE).toString(), 18);
  
  // Send transaction
  return await mvzxContract.transfer(walletAddress, remainderTokens);
}

// Utility Functions
function shortenAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(38)}`;
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function toggleButtons(disabled) {
  metamaskBtn.disabled = disabled;
  walletconnectBtn.disabled = disabled;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

function setupEthEventListeners() {
  window.ethereum.on('accountsChanged', handleAccountsChanged);
  window.ethereum.on('chainChanged', handleChainChanged);
}

function handleAccountsChanged(accounts) {
  userAddress = accounts[0] || null;
  updateUI();
}

function handleChainChanged(chainId) {
  if (chainId !== BNB_CHAIN_ID) {
    showError('Please switch to BNB Chain');
    handleDisconnect();
  } else {
    window.location.reload();
  }
}

function handleDisconnect() {
  userAddress = null;
  provider = null;
  updateUI();
}
