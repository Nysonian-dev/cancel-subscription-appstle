/**
 * Subscription Cancellation - Direct Appstle Integration
 * No backend required - makes direct API calls to Appstle
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
      // Direct call to Appstle API
      const response = await fetch('https://subscription-admin.appstle.com/api/v1/customers/' + this.config.customerId + '/subscriptions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.appstleApiKey}`,
          'Content-Type': 'application/json',
          'X-Shop-Domain': this.config.shopDomain
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Filter active subscriptions
      this.subscriptions = (data || []).filter(sub => 
        ['active', 'trialing'].includes(sub.status)
      );
      
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      // Fallback: Create mock subscription for demo
      this.subscriptions = [{
        id: 'demo_subscription',
        product_title: 'Premium Subscription',
        status: 'active',
        next_billing_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        trial_end: null
      }];
    }
  }

  renderSubscriptionList() {
    const container = document.getElementById('subscription-cancellation-container');
    
    if (!container) return;

    if (this.subscriptions.length === 0) {
      container.innerHTML = `
        <div class="no-subscriptions">
          <p>No active subscriptions found.</p>
        </div>
      `;
      return;
    }

    const subscriptionsHTML = this.subscriptions.map(subscription => `
      <div class="subscription-item">
        <div class="subscription-info">
          <h3>${subscription.product_title || 'Subscription'}</h3>
          <p class="subscription-status">Status: ${this.formatStatus(subscription.status)}</p>
          <p class="subscription-billing">Next billing: ${this.formatDate(subscription.next_billing_date)}</p>
          ${subscription.trial_end ? `<p class="subscription-trial">Trial ends: ${this.formatDate(subscription.trial_end)}</p>` : ''}
        </div>
        <button 
          class="cancel-subscription-btn" 
          onclick="subscriptionCancellation.openModal('${subscription.id}')"
          style="background-color: ${this.config.buttonColor || '#ff6b6b'}"
        >
          Cancel Subscription
        </button>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="subscription-list">
        <h3>Your Active Subscriptions</h3>
        ${subscriptionsHTML}
      </div>
    `;
  }

  openModal(subscriptionId) {
    this.selectedSubscription = this.subscriptions.find(sub => sub.id === subscriptionId);
    
    if (!this.selectedSubscription) {
      this.showError('Subscription not found');
      return;
    }

    this.populateSubscriptionDetails();
    this.showModal();
    this.goToStep(1);
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
          <strong>${subscription.product_title || 'Premium Subscription'}</strong>
        </div>
        <div class="detail-row">
          <span>Status:</span>
          <strong class="status-${subscription.status}">${this.formatStatus(subscription.status)}</strong>
        </div>
        <div class="detail-row">
          <span>Next billing:</span>
          <strong>${this.formatDate(subscription.next_billing_date)}</strong>
        </div>
      </div>
    `;
  }

  // Modal controls
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
    
    document.getElementById('loading-state').style.display = 'block';
    document.getElementById('final-result').style.display = 'none';
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
    this.feedback = document.getElementById('feedback-input').value.trim();
    this.goToStep(2);
  }

  async acceptFirstOffer() {
    await this.extendSubscription(parseInt(this.config.firstOfferDays));
  }

  proceedToSecondOffer() {
    this.goToStep(3);
  }

  async acceptSecondOffer() {
    await this.extendSubscription(parseInt(this.config.secondOfferDays));
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

  // API calls to Appstle
  async extendSubscription(days) {
    try {
      this.goToStep(4);
      this.showLoading(`Adding ${days} free days to your subscription...`);

      // Get current subscription details
      const getResponse = await fetch(`https://subscription-admin.appstle.com/api/v1/subscriptions/${this.selectedSubscription.id}`, {
        headers: {
          'Authorization': `Bearer ${this.config.appstleApiKey}`,
          'Content-Type': 'application/json',
          'X-Shop-Domain': this.config.shopDomain
        }
      });

      if (!getResponse.ok) {
        throw new Error('Failed to get subscription details');
      }

      const subscription = await getResponse.json();
      
      // Calculate new billing date
      const currentDate = new Date(subscription.next_billing_date);
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + days);

      // Update subscription
      const updateResponse = await fetch(`https://subscription-admin.appstle.com/api/v1/subscriptions/${this.selectedSubscription.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.appstleApiKey}`,
          'Content-Type': 'application/json',
          'X-Shop-Domain': this.config.shopDomain
        },
        body: JSON.stringify({
          next_billing_date: newDate.toISOString().split('T')[0],
          notes: `Extended by ${days} days for retention - ${new Date().toISOString()}`
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to extend subscription');
      }

      this.showFinalResult(
        `🎁 ${days} Free Days Added!`,
        `Perfect! We've added ${days} completely free days to your subscription. You won't be charged during this period!`
      );
      
      // Reload subscriptions
      setTimeout(() => {
        this.loadSubscriptions().then(() => this.renderSubscriptionList());
      }, 3000);
      
    } catch (error) {
      console.error('Error extending subscription:', error);
      this.showFinalResult(
        '❌ Extension Failed',
        'We encountered an error. Please try again or contact support.'
      );
    }
  }

  async cancelSubscription() {
    try {
      this.goToStep(4);
      this.showLoading('Cancelling your subscription...');

      const response = await fetch(`https://subscription-admin.appstle.com/api/v1/subscriptions/${this.selectedSubscription.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.appstleApiKey}`,
          'Content-Type': 'application/json',
          'X-Shop-Domain': this.config.shopDomain
        },
        body: JSON.stringify({
          status: 'cancelled',
          cancellation_reason: this.feedback || 'Customer requested cancellation',
          cancel_at_period_end: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      this.showFinalResult(
        '✅ Subscription Cancelled',
        'Your subscription has been cancelled. You\'ll have access until your current period ends.'
      );
      
      // Reload subscriptions
      setTimeout(() => {
        this.loadSubscriptions().then(() => this.renderSubscriptionList());
      }, 3000);
      
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      this.showFinalResult(
        '❌ Cancellation Failed',
        'We encountered an error. Please try again or contact support.'
      );
    }
  }

  // UI helpers
  showLoading(message) {
    document.getElementById('final-title').textContent = 'Processing...';
    document.getElementById('loading-message').textContent = message;
    document.getElementById('loading-state').style.display = 'block';
    document.getElementById('final-result').style.display = 'none';
  }

  showFinalResult(title, message) {
    document.getElementById('final-title').textContent = title;
    document.getElementById('final-message').textContent = message;
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('final-result').style.display = 'block';
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
  window.subscriptionCancellation.proceedToFirstOffer();
}

function acceptFirstOffer() {
  window.subscriptionCancellation.acceptFirstOffer();
}

function proceedToSecondOffer() {
  window.subscriptionCancellation.proceedToSecondOffer();
}

function acceptSecondOffer() {
  window.subscriptionCancellation.acceptSecondOffer();
}

function proceedWithCancellation() {
  window.subscriptionCancellation.proceedWithCancellation();
}

function keepSubscription() {
  window.subscriptionCancellation.keepSubscription();
}

function closeCancellationModal() {
  window.subscriptionCancellation.closeModal();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.subscriptionCancellationConfig && window.subscriptionCancellationConfig.customerId) {
    window.subscriptionCancellation = new SubscriptionCancellation();
  }
});sh