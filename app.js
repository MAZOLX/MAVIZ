// DOM Elements
const metamaskBtn = document.getElementById('metamask-btn');
const walletconnectBtn = document.getElementById('walletconnect-btn');
const walletStatus = document.getElementById('wallet-status');
const purchaseSection = document.getElementById('purchase-section');

// Configuration
const BNB_CHAIN_ID = '0x38';
const DAPP_URL = window.location.hostname; // Gets your vercel.app domain

// State
let provider, userAddress;

// Initialize
checkWalletConnection();

// 1. Fixed MetaMask Connection
metamaskBtn.addEventListener('click', async () => {
  if (isMobile()) {
    // Corrected deep link format
    const deeplink = `https://metamask.app.link/dapp/${DAPP_URL}`;
    
    // Open MetaMask with proper URL
    window.location.href = deeplink;
    
    // Check if returned to dapp after connection
    setTimeout(() => {
      if (!window.ethereum?.isConnected()) {
        window.open("https://metamask.io/download.html", "_blank");
      }
    }, 3000);
  } else {
    if (!window.ethereum) {
      window.open("https://metamask.io/download.html", "_blank");
      return;
    }
    await connectMetaMask();
  }
});

// 2. Fixed WalletConnect Connection
walletconnectBtn.addEventListener('click', async () => {
  try {
    const walletConnectProvider = new WalletConnectProvider.default({
      rpc: { 56: "https://bsc-dataseed.binance.org/" },
      chainId: 56,
      qrcodeModalOptions: {
        mobileLinks: ["metamask", "trust"]
      }
    });

    await walletConnectProvider.enable();
    provider = new ethers.providers.Web3Provider(walletConnectProvider);
    userAddress = await provider.getSigner().getAddress();
    
    // Force UI update after connection
    handleSuccessfulConnection();
    
  } catch (error) {
    showError(`WalletConnect failed: ${error.message}`);
  }
});

// Proper MetaMask connection handler
async function connectMetaMask() {
  try {
    // Switch to BNB Chain first
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BNB_CHAIN_ID }],
    });

    // Then request accounts
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (accounts.length > 0) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      userAddress = accounts[0];
      handleSuccessfulConnection();
    }
  } catch (error) {
    showError(`Connection failed: ${error.message}`);
  }
}

// Handles post-connection flow
function handleSuccessfulConnection() {
  // Update UI
  walletStatus.textContent = `Connected: ${shortenAddress(userAddress)}`;
  walletStatus.classList.add('connected');
  purchaseSection.style.display = 'block';
  
  // Initialize MLM purchase flow
  initMLM();
}

// Initialize MLM purchase interface
function initMLM() {
  const buyBtn = document.getElementById('buy-btn');
  const amountInput = document.getElementById('amount');
  
  buyBtn.addEventListener('click', () => {
    const amount = parseFloat(amountInput.value);
    if (amount < 2000) {
      showError('Minimum purchase is ₦2000');
      return;
    }
    
    const slots = Math.floor(amount / 2000);
    const remainder = amount % 2000;
    
    alert(`Ready to purchase ${slots} MLM slots + ₦${remainder} MVZx tokens`);
    // Initialize Flutterwave payment here
  });
}

// Helper Functions
function checkWalletConnection() {
  if (window.ethereum?.selectedAddress) {
    userAddress = window.ethereum.selectedAddress;
    provider = new ethers.providers.Web3Provider(window.ethereum);
    handleSuccessfulConnection();
  }
}

function shortenAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(38)}`;
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}
