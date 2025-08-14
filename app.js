document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const usdtOption = document.getElementById('usdt-option');
  const cashOption = document.getElementById('cash-option');
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const buyCashBtn = document.getElementById('buy-cash-btn');
  const amountInput = document.getElementById('amount');
  const currencyDisplay = document.getElementById('currency');
  const slotsInfo = document.getElementById('slots-info');
  const confirmPurchaseBtn = document.getElementById('confirm-purchase');
  const walletInfo = document.getElementById('wallet-info');
  const walletAddress = document.getElementById('wallet-address');
  const loading = document.getElementById('loading');

  // Constants
  const SLOT_PRICE_NGN = 2000;
  const SLOT_PRICE_USDT = 3.33;
  let currentPaymentMethod = 'usdt';
  let userAddress = null;

  // Initialize
  updateUI();

  // Event Listeners
  usdtOption.addEventListener('click', () => {
    currentPaymentMethod = 'usdt';
    usdtOption.classList.add('active');
    cashOption.classList.remove('active');
    updateUI();
  });

  cashOption.addEventListener('click', () => {
    currentPaymentMethod = 'cash';
    cashOption.classList.add('active');
    usdtOption.classList.remove('active');
    updateUI();
  });

  amountInput.addEventListener('input', updateUI);
  connectWalletBtn.addEventListener('click', connectWallet);
  buyCashBtn.addEventListener('click', processCashPayment);
  confirmPurchaseBtn.addEventListener('click', processUsdtPayment);

  // Functions
  function updateUI() {
    const amount = parseFloat(amountInput.value) || 0;
    const minAmount = currentPaymentMethod === 'usdt' ? SLOT_PRICE_USDT : SLOT_PRICE_NGN;
    
    // Set currency display
    currencyDisplay.textContent = currentPaymentMethod === 'usdt' ? 'USDT' : 'NGN';
    
    // Calculate slots
    const slotPrice = currentPaymentMethod === 'usdt' ? SLOT_PRICE_USDT : SLOT_PRICE_NGN;
    const slots = Math.floor(amount / slotPrice);
    const effectiveAmount = slots * slotPrice;
    
    // Update slots display
    if (amount >= minAmount) {
      slotsInfo.textContent = `You get: ${slots} slot(s) (${formatCurrency(effectiveAmount)})`;
    } else {
      slotsInfo.textContent = `Minimum: ${formatCurrency(minAmount)} for 1 slot`;
    }
    
    // Update button visibility
    if (currentPaymentMethod === 'usdt') {
      connectWalletBtn.style.display = 'flex';
      buyCashBtn.style.display = 'none';
      confirmPurchaseBtn.classList.toggle('hidden', !userAddress);
    } else {
      connectWalletBtn.style.display = 'none';
      buyCashBtn.style.display = 'flex';
      confirmPurchaseBtn.classList.add('hidden');
    }
  }

  async function connectWallet() {
    showLoading();
    
    try {
      if (!window.ethereum) {
        if (isMobile()) {
          // Mobile deep link
          window.location.href = `https://metamask.app.link/dapp/${window.location.host}`;
          return;
        } else {
          window.open('https://metamask.io/download.html', '_blank');
          throw new Error('MetaMask not installed');
        }
      }

      // Request accounts
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length > 0) {
        userAddress = accounts[0];
        walletAddress.textContent = userAddress;
        walletInfo.classList.remove('hidden');
        updateUI();
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (newAccounts) => {
          if (newAccounts.length === 0) {
            resetWallet();
          } else {
            userAddress = newAccounts[0];
            walletAddress.textContent = userAddress;
          }
        });
      }
    } catch (error) {
      showError(`Wallet connection failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  function processCashPayment() {
    const amount = parseFloat(amountInput.value) || SLOT_PRICE_NGN;
    
    FlutterwaveCheckout({
      public_key: process.env.FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: 'MVZX-' + Date.now(),
      amount: amount,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd",
      customer: {
        email: "user@example.com",
        phone_number: "2348012345678",
        name: "MVZx Buyer"
      },
      callback: function(response) {
        if (response.status === "successful") {
          const slots = Math.floor(amount / SLOT_PRICE_NGN);
          showMessage(`Success! Purchased ${slots} slot(s)`, 'success');
        } else {
          showMessage("Payment failed", 'error');
        }
      },
      customizations: {
        title: "MAVIZ Token Purchase",
        description: `Purchase of ${Math.floor(amount/SLOT_PRICE_NGN)} slots`,
        logo: "https://i.imgur.com/VbxvCK6.jpeg"
      }
    });
  }

  async function processUsdtPayment() {
    const amount = parseFloat(amountInput.value) || SLOT_PRICE_USDT;
    const slots = Math.floor(amount / SLOT_PRICE_USDT);
    
    showLoading();
    
    try {
      // Simulate transaction (replace with actual contract call)
      await new Promise(resolve => setTimeout(resolve, 2000));
      showMessage(`Success! Purchased ${slots} slot(s)`, 'success');
    } catch (error) {
      showMessage(`Transaction failed: ${error.message}`, 'error');
    } finally {
      hideLoading();
    }
  }

  // Helper Functions
  function formatCurrency(amount) {
    return currentPaymentMethod === 'usdt' 
      ? `$${amount.toFixed(2)}` 
      : `₦${amount.toFixed(2)}`;
  }

  function resetWallet() {
    userAddress = null;
    walletInfo.classList.add('hidden');
    updateUI();
  }

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function showLoading() {
    loading.classList.remove('hidden');
  }

  function hideLoading() {
    loading.classList.add('hidden');
  }

  function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  // Handle mobile return
  if (isMobile()) {
    window.addEventListener('focus', () => {
      if (window.ethereum?.selectedAddress && !userAddress) {
        connectWallet();
      }
    });
  }
});
