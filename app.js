// DOM Elements
const metamaskBtn = document.getElementById('metamask-btn');
const walletconnectBtn = document.getElementById('walletconnect-btn');
const walletStatus = document.getElementById('wallet-status');
const purchaseSection = document.getElementById('purchase-section');
const amountInput = document.getElementById('amount');
const buyBtn = document.getElementById('buy-btn');
const purchaseSummary = document.getElementById('purchase-summary');

// Constants
const SLOT_PRICE = 2000; // ₦2000 per slot
const API_BASE_URL = 'https://your-render-backend-url.onrender.com'; // Replace with your Render backend URL

// State
let provider, signer, userAddress;

// Initialize
checkWalletConnection();
amountInput.addEventListener('input', updatePurchaseSummary);

// 1. MetaMask Connection
metamaskBtn.addEventListener('click', connectMetaMask);

// 2. WalletConnect Connection
walletconnectBtn.addEventListener('click', connectWalletConnect);

// 3. Purchase with Flutterwave
buyBtn.addEventListener('click', initiatePurchase);

async function connectMetaMask() {
  if (window.ethereum) {
    try {
      toggleButtons(true);
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userAddress = accounts[0];
      
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      
      setupEthEventListeners();
      updateWalletStatus();
      purchaseSection.style.display = 'block';
      
    } catch (error) {
      showError(`MetaMask connection failed: ${error.message}`);
    } finally {
      toggleButtons(false);
    }
  } else {
    showError('Please install MetaMask!');
    window.open('https://metamask.io/download.html', '_blank');
  }
}

async function connectWalletConnect() {
  try {
    toggleButtons(true);
    
    const walletConnectProvider = new WalletConnectProvider.default({
      rpc: {
        56: "https://bsc-dataseed.binance.org/",
        97: "https://data-seed-prebsc-1-s1.binance.org:8545/"
      }
    });
    
    await walletConnectProvider.enable();
    
    provider = new ethers.providers.Web3Provider(walletConnectProvider);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    
    walletConnectProvider.on("accountsChanged", handleAccountsChanged);
    walletConnectProvider.on("chainChanged", handleChainChanged);
    
    updateWalletStatus();
    purchaseSection.style.display = 'block';
    
  } catch (error) {
    showError(`WalletConnect failed: ${error.message}`);
  } finally {
    toggleButtons(false);
  }
}

async function initiatePurchase() {
  const amount = parseFloat(amountInput.value);
  
  if (amount < SLOT_PRICE) {
    showError(`Minimum purchase is ₦${SLOT_PRICE}`);
    return;
  }
  
  try {
    buyBtn.disabled = true;
    
    const slots = Math.floor(amount / SLOT_PRICE);
    const remainder = amount % SLOT_PRICE;
    
    // First register the purchase with backend
    const registrationResponse = await registerPurchase(amount, slots, remainder);
    
    if (registrationResponse.success) {
      // Then initiate Flutterwave payment
      processFlutterwavePayment(amount, slots, remainder, registrationResponse.matrixPosition);
    } else {
      showError("Failed to register purchase");
    }
    
  } catch (error) {
    showError(`Payment initialization failed: ${error.message}`);
  } finally {
    buyBtn.disabled = false;
  }
}

async function registerPurchase(amount, slots, remainder) {
  const response = await fetch(`${API_BASE_URL}/api/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      walletAddress: userAddress,
      amount: amount,
      slots: slots,
      remainder: remainder,
      referralCode: getReferralCodeFromURL()
    })
  });
  
  return await response.json();
}

function processFlutterwavePayment(amount, slots, remainder, matrixPosition) {
  FlutterwaveCheckout({
    public_key: "FLWPUBK_TEST-XXXXXXXXXXXXXXXX-X", // Will be replaced by your FLW_PUBLIC_KEY
    tx_ref: "MAVIZ-" + Date.now(),
    amount: amount,
    currency: "NGN",
    payment_options: "card, banktransfer, ussd",
    customer: {
      email: "user@example.com", // Should collect in production
      phone_number: "08123456789",
      name: "MAVIZ User"
    },
    callback: function(response) {
      if (response.status === "successful") {
        alert(`Payment successful!\n\n${slots} MLM slot(s) activated at position ${matrixPosition}\n${remainder}₦ credited as MVZx tokens`);
      } else {
        showError("Payment failed or was cancelled");
      }
    },
    onclose: function() {
      buyBtn.disabled = false;
    },
    customizations: {
      title: "MAVIZ Token Purchase",
      description: `Purchase of ${slots} MLM slots`,
      logo: "https://i.imgur.com/VbxvCK6.jpeg"
    }
  });
}

// Helper Functions
function checkWalletConnection() {
  if (window.ethereum && window.ethereum.selectedAddress) {
    userAddress = window.ethereum.selectedAddress;
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    updateWalletStatus();
    purchaseSection.style.display = 'block';
  }
}

function updateWalletStatus() {
  walletStatus.textContent = `Connected: ${userAddress}`;
  walletStatus.classList.add('connected');
}

function handleDisconnect() {
  walletStatus.textContent = "Wallet disconnected";
  walletStatus.classList.remove('connected');
  purchaseSection.style.display = 'none';
  userAddress = null;
  provider = null;
  signer = null;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  walletStatus.parentNode.insertBefore(errorDiv, walletStatus.nextSibling);
  setTimeout(() => errorDiv.remove(), 5000);
}

function updatePurchaseSummary() {
  const amount = parseFloat(amountInput.value) || 0;
  const slots = Math.floor(amount / SLOT_PRICE);
  const remainder = amount % SLOT_PRICE;
  
  if (amount >= SLOT_PRICE) {
    purchaseSummary.innerHTML = `
      <p>You're purchasing: ${slots} MLM slot(s)</p>
      ${remainder > 0 ? `<p>+ ₦${remainder} will be credited as MVZx tokens</p>` : ''}
    `;
  } else {
    purchaseSummary.innerHTML = '';
  }
}

function getReferralCodeFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
}

function toggleButtons(disabled) {
  metamaskBtn.disabled = disabled;
  walletconnectBtn.disabled = disabled;
}

function setupEthEventListeners() {
  window.ethereum.on('accountsChanged', handleAccountsChanged);
  window.ethereum.on('chainChanged', handleChainChanged);
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    handleDisconnect();
  } else {
    userAddress = accounts[0];
    updateWalletStatus();
  }
}

function handleChainChanged() {
  window.location.reload();
}
