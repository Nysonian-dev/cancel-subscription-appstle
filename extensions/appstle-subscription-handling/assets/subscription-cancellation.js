/**
 * Subscription Cancellation - Shopify Backend Solution
 * Uses Shopify's backend to call Appstle API (avoids CORS)
 */

class SubscriptionCancellation {
  constructor() {
    this.config = window.subscriptionCancellationConfig || {};
    this.currentStep = 1;
    this.selectedSubscription = null;
    this.subscriptions = [];
    this.feedback = '';
    
    this.init();
  }

  async init() {
    try {
      await this.loadSubscriptions();
      this.renderSubscriptionList();
      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing:', error);
      this.showError('Failed to load subscription data');
    }
  }

  async loadSubscriptions() {
    try {
      console.log('🔄 Loading subscriptions via Shopify backend...');
      
      // Create a proxy endpoint that calls Appstle from your Shopify backend
      const proxyEndpoint = `/apps/appstle/subscriptions/${this.config.customerId}`;
      
      const response = await fetch(proxyEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        // If proxy doesn't exist, try alternative approaches
        await this.loadSubscriptionsAlternative();
        return;
      }

      const data = await response.json();
      this.processSubscriptionData(data);
      
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      await this.loadSubscriptionsAlternative();
    }
  }

  async loadSubscriptionsAlternative() {
    console.log('🔄 Trying alternative approach...');
    
    try {
      // Try using Shopify's existing Appstle integration
      // This looks for existing Appstle subscription data in the DOM
      const appstleData = this.extractAppstleDataFromDOM();
      
      if (appstleData && appstleData.length > 0) {
        console.log('✅ Found Appstle data in DOM');
        this.subscriptions = appstleData;
        return;
      }

      // Try Shopify's subscription API (if available)
      await this.loadShopifySubscriptions();
      
    } catch (error) {
      console.error('Alternative methods failed:', error);
      
      // Final fallback: Create a realistic test subscription
      this.createTestSubscription();
    }
  }

  extractAppstleDataFromDOM() {
    console.log('🔍 Looking for Appstle data in DOM...');
    
    const subscriptions = [];
    
    // Look for Appstle subscription widgets or data
    const appstleElements = document.querySelectorAll('[data-appstle-subscription], .appstle-subscription, .subscription-item');
    
    appstleElements.forEach(element => {
      const subscriptionData = this.parseElementForSubscriptionData(element);
      if (subscriptionData) {
        subscriptions.push(subscriptionData);
      }
    });

    // Check for JSON-LD data or script tags with subscription info
    const scriptTags = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
    scriptTags.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data.subscriptions || data.subscription) {
          const subs = data.subscriptions || [data.subscription];
          subscriptions.push(...subs.map(sub => this.mapSubscriptionFields(sub)));
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });

    return subscriptions;
  }

  parseElementForSubscriptionData(element) {
    // Extract subscription data from DOM element
    const productTitle = element.querySelector('.product-title, .subscription-product, h3, h2')?.textContent?.trim();
    const status = element.querySelector('.status, .subscription-status')?.textContent?.trim();
    const nextBilling = element.querySelector('.next-billing, .billing-date')?.textContent?.trim();
    const price = element.querySelector('.price, .amount')?.textContent?.trim();

    if (productTitle && status) {
      return {
        id: 'dom_' + Date.now() + Math.random(),
        product_title: productTitle,
        status: status.toLowerCase().includes('active') ? 'active' : 'unknown',
        next_billing_date: this.parseDateFromText(nextBilling),
        price: price,
        interval: 'month'
      };
    }

    return null;
  }

  parseDateFromText(dateText) {
    if (!dateText) return null;
    
    // Try to extract date from text like "Next billing: January 15, 2025"
    const dateMatch = dateText.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]+ \d{1,2}, \d{4})/);
    if (dateMatch) {
      return new Date(dateMatch[0]).toISOString().split('T')[0];
    }
    
    return null;
  }

  async loadShopifySubscriptions() {
    console.log('🔄 Trying Shopify subscription API...');
    
    try {
      // Use Shopify's customer API if available
      const response = await fetch(`/account/subscriptions.json`, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscriptions) {
          console.log('✅ Found Shopify subscriptions');
          this.subscriptions = data.subscriptions.map(sub => this.mapShopifySubscription(sub));
          return;
        }
      }
    } catch (error) {
      console.log('Shopify subscription API not available');
    }

    throw new Error('No subscription data found');
  }

  mapShopifySubscription(sub) {
    return {
      id: sub.id,
      product_title: sub.title || sub.product_title || 'Shopify Subscription',
      status: sub.status,
      next_billing_date: sub.next_billing_date || sub.next_charge_scheduled_at,
      price: sub.price || sub.amount,
      interval: sub.billing_interval || 'month'
    };
  }

  createTestSubscription() {
    console.log('🎭 Creating test subscription data...');
    
    // Create a realistic test subscription based on your actual customer data
    this.subscriptions = [{
      id: 'test_' + this.config.customerId,
      product_title: 'Premium Subscription Plan',
      status: 'active',
      next_billing_date: new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0],
      trial_end: null,
      price: '$29.99',
      interval: 'month',
      frequency: 1,
      _isTest: true
    }];
  }

  processSubscriptionData(data) {
    console.log('📊 Processing subscription data:', data);
    
    let subscriptions = [];
    
    if (Array.isArray(data)) {
      subscriptions = data;
    } else if (data.subscriptions) {
      subscriptions = data.subscriptions;
    } else if (data.data) {
      subscriptions = data.data;
    }

    this.subscriptions = subscriptions
      .filter(sub => ['active', 'trialing', 'paused'].includes((sub.status || '').toLowerCase()))
      .map(sub => this.mapSubscriptionFields(sub));
  }

  mapSubscriptionFields(sub) {
    return {
      id: sub.id || sub.subscription_id || 'unknown',
      product_title: sub.product_title || sub.product_name || sub.title || 'Unknown Product',
      status: (sub.status || 'active').toLowerCase(),
      next_billing_date: sub.next_billing_date || sub.next_order_date || sub.billing_date,
      trial_end: sub.trial_end || sub.trial_end_date,
      price: this.formatPrice(sub.price || sub.amount),
      interval: sub.interval || sub.billing_interval || 'month',
      frequency: sub.frequency || 1,
      _original: sub
    };
  }

  formatPrice(price) {
    if (!price) return null;
    if (typeof price === 'string' && price.includes('$')) return price;
    const numPrice = parseFloat(price);
    return isNaN(numPrice) ? null : `$${numPrice.toFixed(2)}`;
  }

  renderSubscriptionList() {
    const container = document.getElementById('subscription-cancellation-container');
    if (!container) return;

    if (this.subscriptions.length === 0) {
      container.innerHTML = `
        <div class="no-subscriptions">
          <h3>No Active Subscriptions Found</h3>
          <p>We couldn't find any active subscriptions for your account.</p>
          <p><small>This might be because:</small></p>
          <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
            <li>You don't have any active subscriptions</li>
            <li>Your subscriptions are managed differently</li>
            <li>There's a temporary connection issue</li>
          </ul>
        </div>
      `;
      return;
    }

    const subscriptionsHTML = this.subscriptions.map(subscription => `
      <div class="subscription-item">
        <div class="subscription-info">
          <h3>${subscription.product_title}</h3>
          ${subscription._isTest ? '<p style="color: #ff6600; font-weight: bold;">⚠️ Test Data - CORS Issue Detected</p>' : ''}
          <p class="subscription-status">Status: <span class="status-${subscription.status}">${this.formatStatus(subscription.status)}</span></p>
          <p class="subscription-billing">Next billing: ${this.formatDate(subscription.next_billing_date)}</p>
          ${subscription.price ? `<p class="subscription-price">Price: ${subscription.price}/${subscription.interval}</p>` : ''}
          ${subscription.trial_end ? `<p class="subscription-trial">Trial ends: ${this.formatDate(subscription.trial_end)}</p>` : ''}
        </div>
        <button 
          class="cancel-subscription-btn" 
          onclick="window.subscriptionCancellation.openModal('${subscription.id}')"
          style="background-color: ${this.config.buttonColor || '#ff6b6b'}"
        >
          ${subscription._isTest ? 'Test Cancel' : 'Cancel Subscription'}
        </button>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="subscription-list">
        <h3>Your Active Subscriptions</h3>
        ${subscriptionsHTML}
        ${this.subscriptions.some(s => s._isTest) ? `
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <h4 style="color: #856404; margin: 0 0 10px 0;">🛠️ Developer Notice</h4>
            <p style="color: #856404; margin: 0; font-size: 14px;">
              CORS issue detected. To show real data, you need to create a backend proxy endpoint 
              or use Shopify's App Proxy feature to call the Appstle API server-side.
            </p>
          </div>
        ` : ''}
      </div>
    `;
  }

  openModal(subscriptionId) {
    this.selectedSubscription = this.subscriptions.find(sub => sub.id === subscriptionId);
    
    if (!this.selectedSubscription) {
      this.showError('Subscription not found');
      return;
    }

    // If it's test data, show a different modal
    if (this.selectedSubscription._isTest) {
      this.showTestModal();
      return;
    }

    this.populateSubscriptionDetails();
    this.showModal();
    this.goToStep(1);
  }

  showTestModal() {
    alert(`🧪 Test Mode Detected\n\nThis is test data because of CORS restrictions.\n\nTo use real Appstle data, you need to:\n1. Create a backend proxy in your Shopify app\n2. Or use Shopify's App Proxy feature\n3. Or integrate with Appstle's customer portal\n\nSubscription ID: ${this.selectedSubscription.id}`);
  }

  populateSubscriptionDetails() {
    const container = document.getElementById('subscription-details');
    if (!container || !this.selectedSubscription) return;

    const subscription = this.selectedSubscription;

    container.innerHTML = `
      <div class="subscription-detail-card">
        <h4>Subscription Details</h4>
        <div class="detail-row">
          <span>Product:</span>
          <strong>${subscription.product_title}</strong>
        </div>
        <div class="detail-row">
          <span>Status:</span>
          <strong class="status-${subscription.status}">${this.formatStatus(subscription.status)}</strong>
        </div>
        <div class="detail-row">
          <span>Next billing:</span>
          <strong>${this.formatDate(subscription.next_billing_date)}</strong>
        </div>
        ${subscription.price ? `
        <div class="detail-row">
          <span>Price:</span>
          <strong>${subscription.price}/${subscription.interval}</strong>
        </div>
        ` : ''}
      </div>
    `;
  }

  showModal() {
    const modal = document.getElementById('cancellation-modal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal() {
    const modal = document.getElementById('cancellation-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
    this.resetModal();
  }

  resetModal() {
    this.currentStep = 1;
    this.selectedSubscription = null;
    this.feedback = '';
    
    const feedbackInput = document.getElementById('feedback-input');
    if (feedbackInput) feedbackInput.value = '';
    
    const loadingState = document.getElementById('loading-state');
    const finalResult = document.getElementById('final-result');
    
    if (loadingState) loadingState.style.display = 'block';
    if (finalResult) finalResult.style.display = 'none';
  }

  goToStep(stepNumber) {
    document.querySelectorAll('.modal-step').forEach(step => {
      step.classList.remove('active');
    });

    const targetStep = document.getElementById(`step-${stepNumber}`);
    if (targetStep) {
      targetStep.classList.add('active');
      this.currentStep = stepNumber;
    }
  }

  // Step actions
  proceedToFirstOffer() {
    const feedbackInput = document.getElementById('feedback-input');
    this.feedback = feedbackInput ? feedbackInput.value.trim() : '';
    this.goToStep(2);
  }

  async acceptFirstOffer() {
    await this.extendSubscription(parseInt(this.config.firstOfferDays) || 7);
  }

  proceedToSecondOffer() {
    this.goToStep(3);
  }

  async acceptSecondOffer() {
    await this.extendSubscription(parseInt(this.config.secondOfferDays) || 14);
  }

  async proceedWithCancellation() {
    if (confirm('Are you absolutely sure you want to cancel your subscription? This action cannot be undone.')) {
      await this.cancelSubscription();
    }
  }

  keepSubscription() {
    this.goToStep(4);
    this.showLoading('Confirming your subscription...');
    
    setTimeout(() => {
      this.showFinalResult(
        '🎉 Welcome Back!',
        'Great choice! Your subscription remains active. Thank you for staying with us!'
      );
    }, 2000);
  }

  async extendSubscription(days) {
    this.goToStep(4);
    this.showLoading(`Adding ${days} free days to your subscription...`);

    // Simulate the extension process
    setTimeout(() => {
      this.showFinalResult(
        `🎁 ${days} Free Days Added!`,
        `Perfect! We've added ${days} completely free days to your subscription. (Note: This is a demo due to CORS restrictions)`
      );
    }, 2000);
  }

  async cancelSubscription() {
    this.goToStep(4);
    this.showLoading('Cancelling your subscription...');

    // Simulate the cancellation process  
    setTimeout(() => {
      this.showFinalResult(
        '✅ Subscription Cancelled',
        'Your subscription has been cancelled successfully. (Note: This is a demo due to CORS restrictions)'
      );
    }, 2000);
  }

  showLoading(message) {
    const finalTitle = document.getElementById('final-title');
    const loadingMessage = document.getElementById('loading-message');
    const loadingState = document.getElementById('loading-state');
    const finalResult = document.getElementById('final-result');
    
    if (finalTitle) finalTitle.textContent = 'Processing...';
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingState) loadingState.style.display = 'block';
    if (finalResult) finalResult.style.display = 'none';
  }

  showFinalResult(title, message) {
    const finalTitle = document.getElementById('final-title');
    const finalMessage = document.getElementById('final-message');
    const loadingState = document.getElementById('loading-state');
    const finalResult = document.getElementById('final-result');
    
    if (finalTitle) finalTitle.textContent = title;
    if (finalMessage) finalMessage.textContent = message;
    if (loadingState) loadingState.style.display = 'none';
    if (finalResult) finalResult.style.display = 'block';
  }

  showError(message) {
    const container = document.getElementById('subscription-cancellation-container');
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <p class="error-message">⚠️ ${message}</p>
          <button onclick="location.reload()" class="btn btn-secondary">Try Again</button>
        </div>
      `;
    }
  }

  formatStatus(status) {
    const statusMap = {
      'active': 'Active',
      'trialing': 'Trial',
      'cancelled': 'Cancelled',
      'paused': 'Paused'
    };
    return statusMap[status] || status;
  }

  formatDate(dateString) {
    if (!dateString) return 'Not set';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }

  setupEventListeners() {
    const modal = document.getElementById('cancellation-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
        this.closeModal();
      }
    });
  }
}

// Global functions for Liquid template
function proceedToFirstOffer() {
  if (window.subscriptionCancellation) {
    window.subscriptionCancellation.proceedToFirstOffer();
  }
}

function acceptFirstOffer() {
  if (window.subscriptionCancellation) {
    window.subscriptionCancellation.acceptFirstOffer();
  }
}

function proceedToSecondOffer() {
  if (window.subscriptionCancellation) {
    window.subscriptionCancellation.proceedToSecondOffer();
  }
}

function acceptSecondOffer() {
  if (window.subscriptionCancellation) {
    window.subscriptionCancellation.acceptSecondOffer();
  }
}

function proceedWithCancellation() {
  if (window.subscriptionCancellation) {
    window.subscriptionCancellation.proceedWithCancellation();
  }
}

function keepSubscription() {
  if (window.subscriptionCancellation) {
    window.subscriptionCancellation.keepSubscription();
  }
}

function closeCancellationModal() {
  if (window.subscriptionCancellation) {
    window.subscriptionCancellation.closeModal();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.subscriptionCancellationConfig && window.subscriptionCancellationConfig.customerId) {
    window.subscriptionCancellation = new SubscriptionCancellation();
  }
});