document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectBtn = document.getElementById('connect-btn');
  const walletStatus = document.getElementById('wallet-status');
  const purchaseForm = document.getElementById('purchase-form');
  const amountInput = document.getElementById('amount');
  const slotsDisplay = document.getElementById('slots-display');
  const payWithWalletBtn = document.getElementById('pay-with-wallet');
  const payWithCashBtn = document.getElementById('pay-with-cash');
  const loadingDiv = document.getElementById('loading');

  // Constants
  const SLOT_PRICE = 2000; // ₦2000 per slot
  let userAddress = null;

  // Initialize
  updateSlotsDisplay();
  checkPersistedWallet();

  // Event Listeners
  connectBtn.addEventListener('click', connectWallet);
  amountInput.addEventListener('input', updateSlotsDisplay);
  payWithWalletBtn.addEventListener('click', processWalletPayment);
  payWithCashBtn.addEventListener('click', processCashPayment);

  // 1. Wallet Connection
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
        persistWalletConnection();
        showPurchaseForm();
      }
    } catch (error) {
      showError(`Connection failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // 2. Show Purchase Form After Connection
  function showPurchaseForm() {
    walletStatus.textContent = `Connected: ${shortenAddress(userAddress)}`;
    walletStatus.classList.add('connected');
    purchaseForm.classList.remove('hidden');
    
    // Listen for account changes
    window.ethereum.on('accountsChanged', (newAccounts) => {
      if (newAccounts.length === 0) {
        resetConnection();
      } else {
        userAddress = newAccounts[0];
        walletStatus.textContent = `Connected: ${shortenAddress(userAddress)}`;
      }
    });
  }

  // 3. Process USDT Payment
  async function processWalletPayment() {
    if (!validateForm()) return;
    
    const amount = parseFloat(amountInput.value);
    const slots = Math.floor(amount / SLOT_PRICE);
    
    showLoading();
    
    try {
      // In production: Implement actual USDT contract call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Submit to MLM system
      const mlmData = {
        walletAddress: userAddress,
        name: document.getElementById('full-name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        amount,
        slots
      };
      
      // Here you would send mlmData to your backend
      console.log('Submitting to MLM:', mlmData);
      
      showSuccess(`Success! ${slots} slot(s) purchased. MLM activated.`);
      resetForm();
    } catch (error) {
      showError(`Transaction failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // 4. Process Flutterwave Payment
  function processCashPayment() {
    if (!validateForm()) return;
    
    const amount = parseFloat(amountInput.value);
    const slots = Math.floor(amount / SLOT_PRICE);
    const userData = {
      name: document.getElementById('full-name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value
    };
    
    FlutterwaveCheckout({
      public_key: process.env.FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: 'MVZX-' + Date.now(),
      amount: amount,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd",
      customer: {
        email: userData.email,
        phone_number: userData.phone,
        name: userData.name
      },
      callback: function(response) {
        if (response.status === "successful") {
          // Submit to MLM system
          const mlmData = {
            ...userData,
            amount,
            slots,
            paymentRef: response.transaction_id
          };
          
          // Here you would send mlmData to your backend
          console.log('Submitting to MLM:', mlmData);
          
          showSuccess(`Payment successful! ${slots} slot(s) purchased. MLM activated.`);
          resetForm();
        } else {
          showError("Payment failed or was cancelled");
        }
      },
      customizations: {
        title: "MAVIZ Token Purchase",
        description: `Purchase of ${slots} MLM slots`,
        logo: "https://i.imgur.com/VbxvCK6.jpeg"
      }
    });
  }

  // Helper Functions
  function updateSlotsDisplay() {
    const amount = parseFloat(amountInput.value) || 0;
    const slots = Math.floor(amount / SLOT_PRICE);
    const effectiveAmount = slots * SLOT_PRICE;
    
    if (amount >= SLOT_PRICE) {
      slotsDisplay.textContent = `You get: ${slots} slot(s) (₦${effectiveAmount})`;
    } else {
      slotsDisplay.textContent = `Minimum: ₦${SLOT_PRICE} for 1 slot`;
    }
  }

  function validateForm() {
    const name = document.getElementById('full-name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const amount = parseFloat(amountInput.value);
    
    if (!name || !email || !phone) {
      showError("Please fill all required fields");
      return false;
    }
    
    if (amount < SLOT_PRICE) {
      showError(`Minimum investment is ₦${SLOT_PRICE}`);
      return false;
    }
    
    return true;
  }

  function checkPersistedWallet() {
    if (localStorage.getItem('mavizConnected') && window.ethereum?.selectedAddress) {
      userAddress = window.ethereum.selectedAddress;
      showPurchaseForm();
    }
  }

  function persistWalletConnection() {
    localStorage.setItem('mavizConnected', 'true');
  }

  function resetConnection() {
    userAddress = null;
    localStorage.removeItem('mavizConnected');
    walletStatus.textContent = "Not connected";
    walletStatus.classList.remove('connected');
    purchaseForm.classList.add('hidden');
  }

  function resetForm() {
    document.getElementById('full-name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    amountInput.value = SLOT_PRICE;
    updateSlotsDisplay();
  }

  function shortenAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(38)}`;
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
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'error';
    successDiv.style.backgroundColor = 'var(--accent)';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
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
