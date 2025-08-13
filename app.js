document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const usdtMethodBtn = document.getElementById('usdt-method');
  const cashMethodBtn = document.getElementById('cash-method');
  const amountInput = document.getElementById('amount');
  const currencyDisplay = document.getElementById('currency-display');
  const slotsDisplay = document.getElementById('slots-display');
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const walletConnectedDiv = document.getElementById('wallet-connected');
  const walletAddressSpan = document.getElementById('wallet-address');
  const buyBtn = document.getElementById('buy-btn');
  const loadingDiv = document.getElementById('loading');

  // Constants
  const SLOT_PRICE_NGN = 2000;
  const SLOT_PRICE_USDT = 3.33;
  const EXCHANGE_RATE = SLOT_PRICE_NGN / SLOT_PRICE_USDT;
  let currentPaymentMethod = 'usdt';
  let userAddress = null;

  // Initialize
  updateDisplay();

  // Event Listeners
  usdtMethodBtn.addEventListener('click', () => {
    currentPaymentMethod = 'usdt';
    usdtMethodBtn.classList.add('active');
    cashMethodBtn.classList.remove('active');
    updateDisplay();
  });

  cashMethodBtn.addEventListener('click', () => {
    currentPaymentMethod = 'cash';
    cashMethodBtn.classList.add('active');
    usdtMethodBtn.classList.remove('active');
    updateDisplay();
  });

  amountInput.addEventListener('input', updateDisplay);
  connectWalletBtn.addEventListener('click', connectWallet);
  buyBtn.addEventListener('click', processPurchase);

  // Update display based on selections
  function updateDisplay() {
    const amount = parseFloat(amountInput.value) || 0;
    const minAmount = currentPaymentMethod === 'usdt' ? SLOT_PRICE_USDT : SLOT_PRICE_NGN;
    
    // Set minimum amount
    amountInput.min = minAmount;
    amountInput.step = currentPaymentMethod === 'usdt' ? '0.01' : '100';
    
    // Update currency display
    currencyDisplay.textContent = currentPaymentMethod === 'usdt' ? 'USDT' : 'NGN';
    
    // Calculate slots
    const slotPrice = currentPaymentMethod === 'usdt' ? SLOT_PRICE_USDT : SLOT_PRICE_NGN;
    const slots = Math.floor(amount / slotPrice);
    const effectiveAmount = slots * slotPrice;
    
    // Update slots display
    if (amount >= minAmount) {
      slotsDisplay.textContent = `You get: ${slots} slot(s) (${formatCurrency(effectiveAmount)})`;
      slotsDisplay.style.color = 'var(--primary)';
    } else {
      slotsDisplay.textContent = `Minimum: ${formatCurrency(minAmount)} for 1 slot`;
      slotsDisplay.style.color = 'var(--error)';
    }
    
    // Update button states
    if (currentPaymentMethod === 'usdt') {
      connectWalletBtn.style.display = 'flex';
      buyBtn.classList.add('hidden');
    } else {
      connectWalletBtn.style.display = 'none';
      buyBtn.classList.remove('hidden');
    }
  }

  // Connect Wallet (MetaMask)
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
        walletAddressSpan.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        walletConnectedDiv.classList.remove('hidden');
        connectWalletBtn.classList.add('hidden');
        buyBtn.classList.remove('hidden');
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (newAccounts) => {
          if (newAccounts.length === 0) {
            resetWallet();
          } else {
            userAddress = newAccounts[0];
            walletAddressSpan.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
          }
        });
      }
    } catch (error) {
      showError(`Wallet connection failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // Process Purchase
  async function processPurchase() {
    const amount = parseFloat(amountInput.value);
    const slotPrice = currentPaymentMethod === 'usdt' ? SLOT_PRICE_USDT : SLOT_PRICE_NGN;
    const minAmount = currentPaymentMethod === 'usdt' ? SLOT_PRICE_USDT : SLOT_PRICE_NGN;
    
    if (isNaN(amount) {
      showError('Please enter a valid amount');
      return;
    }
    
    if (amount < minAmount) {
      showError(`Minimum purchase is ${formatCurrency(minAmount)}`);
      return;
    }
    
    showLoading();
    
    try {
      if (currentPaymentMethod === 'cash') {
        // Process Flutterwave payment
        processFlutterwavePayment(amount);
      } else {
        // Process USDT payment
        const slots = Math.floor(amount / SLOT_PRICE_USDT);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate tx
        showSuccess(`Success! Purchased ${slots} slot(s)`);
        resetForm();
      }
    } catch (error) {
      showError(`Payment failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // Flutterwave Payment
  function processFlutterwavePayment(amount) {
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
          showSuccess(`Success! Purchased ${slots} slot(s)`);
          resetForm();
        } else {
          showError("Payment failed or was cancelled");
        }
      },
      customizations: {
        title: "MAVIZ Token Purchase",
        description: `Purchase MVZx Tokens (₦${SLOT_PRICE_NGN}/slot)`,
        logo: "https://i.imgur.com/VbxvCK6.jpeg"
      }
    });
  }

  // Helper Functions
  function formatCurrency(amount) {
    return currentPaymentMethod === 'usdt' 
      ? `$${amount.toFixed(2)}` 
      : `₦${amount.toFixed(2)}`;
  }

  function resetWallet() {
    userAddress = null;
    walletConnectedDiv.classList.add('hidden');
    connectWalletBtn.classList.remove('hidden');
    buyBtn.classList.add('hidden');
  }

  function resetForm() {
    amountInput.value = currentPaymentMethod === 'usdt' ? SLOT_PRICE_USDT : SLOT_PRICE_NGN;
    updateDisplay();
  }

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function showLoading() {
    loadingDiv.classList.remove('hidden');
  }

  function hideLoading() {
    loadingDiv.classList.add('hidden');
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.classList.add('fade-out');
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'error-message';
    successDiv.style.backgroundColor = 'var(--accent)';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.classList.add('fade-out');
      setTimeout(() => successDiv.remove(), 300);
    }, 5000);
  }

  // Handle mobile return from MetaMask
  if (isMobile()) {
    window.addEventListener('focus', () => {
      if (window.ethereum?.selectedAddress && !userAddress) {
        connectWallet();
      }
    });
  }
});
