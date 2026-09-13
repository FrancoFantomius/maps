/**
 * Maps UI - Login Modal & Authentication Logic
 */

import { startSync, getSyncSettings } from '../db.js';

let elements = {};
let onLoginSuccessCallback = null;

export const LoginController = {
  init(options = {}) {
    if (options.onLoginSuccess) {
      onLoginSuccessCallback = options.onLoginSuccess;
    }

    elements = {
      loginModal: document.getElementById('login-modal'),
      btnLoginClose: document.getElementById('btn-login-close'),
      btnLoginCancel: document.getElementById('btn-login-cancel'),
      btnSaveSync: document.getElementById('btn-save-sync'),
      syncEmail: document.getElementById('sync-email'),
      syncPassword: document.getElementById('sync-password'),
      syncTwoFactor: document.getElementById('sync-twofactor'),
      syncStatusMsg: document.getElementById('sync-settings-status')
    };

    if (elements.btnLoginClose) {
      elements.btnLoginClose.addEventListener('click', () => this.hideLoginModal());
    }

    if (elements.btnLoginCancel) {
      elements.btnLoginCancel.addEventListener('click', () => this.hideLoginModal());
    }

    const handleEnterSubmit = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleLogin();
      }
    };

    if (elements.syncEmail) {
      elements.syncEmail.addEventListener('input', () => this.clearEmailError());
      elements.syncEmail.addEventListener('keydown', handleEnterSubmit);
    }

    if (elements.syncPassword) {
      elements.syncPassword.addEventListener('input', () => this.clearPasswordError());
      elements.syncPassword.addEventListener('keydown', handleEnterSubmit);
    }

    if (elements.syncTwoFactor) {
      elements.syncTwoFactor.addEventListener('keydown', handleEnterSubmit);
    }

    if (elements.loginModal) {
      elements.loginModal.addEventListener('click', (e) => {
        if (e.target === elements.loginModal) {
          this.hideLoginModal();
        }
      });
    }

    if (elements.btnSaveSync) {
      elements.btnSaveSync.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }
  },

  setOnLoginSuccess(callback) {
    onLoginSuccessCallback = callback;
  },

  clearEmailError() {
    if (!elements.syncEmail) return;
    elements.syncEmail.error = false;
    elements.syncEmail.errorText = '';
    elements.syncEmail.removeAttribute('error');
    elements.syncEmail.removeAttribute('error-text');
  },

  setEmailError(msg) {
    if (!elements.syncEmail) return;
    elements.syncEmail.error = true;
    elements.syncEmail.errorText = msg;
    elements.syncEmail.setAttribute('error', '');
    elements.syncEmail.setAttribute('error-text', msg);
  },

  clearPasswordError() {
    if (!elements.syncPassword) return;
    elements.syncPassword.error = false;
    elements.syncPassword.errorText = '';
    elements.syncPassword.removeAttribute('error');
    elements.syncPassword.removeAttribute('error-text');
  },

  setPasswordError(msg) {
    if (!elements.syncPassword) return;
    elements.syncPassword.error = true;
    elements.syncPassword.errorText = msg;
    elements.syncPassword.setAttribute('error', '');
    elements.syncPassword.setAttribute('error-text', msg);
  },

  showLoginModal() {
    if (elements.loginModal) {
      elements.loginModal.classList.remove('hidden');
    }
    if (elements.syncStatusMsg) {
      elements.syncStatusMsg.textContent = '';
      elements.syncStatusMsg.className = 'status-message text-slate-500 dark:text-slate-400 text-xs';
    }
    if (elements.syncEmail) {
      elements.syncEmail.value = '';
      this.clearEmailError();
    }
    if (elements.syncPassword) {
      elements.syncPassword.value = '';
      this.clearPasswordError();
    }
    if (elements.syncTwoFactor) {
      elements.syncTwoFactor.value = '';
    }
  },

  hideLoginModal() {
    if (elements.loginModal) {
      elements.loginModal.classList.add('hidden');
    }
    this.clearEmailError();
    this.clearPasswordError();
  },

  showStatusLoading(msg) {
    if (!elements.syncStatusMsg) return;
    elements.syncStatusMsg.textContent = msg;
    elements.syncStatusMsg.className = 'status-message text-indigo-600 dark:text-indigo-400 text-xs animate-pulse font-medium';
  },

  showStatusError(msg) {
    if (!elements.syncStatusMsg) return;
    elements.syncStatusMsg.textContent = msg;
    elements.syncStatusMsg.className = 'status-message text-red-500 dark:text-red-400 text-xs font-semibold';
  },

  async handleLogin() {
    const email = elements.syncEmail ? (elements.syncEmail.value || '').trim() : '';
    const password = elements.syncPassword ? (elements.syncPassword.value || '') : '';
    const twoFactorCode = elements.syncTwoFactor ? (elements.syncTwoFactor.value || '').trim() : '';

    if (!email) {
      this.setEmailError("Enter a valid Email Address to Sign In");
      return;
    } else {
      this.clearEmailError();
    }

    if (!password) {
      this.setPasswordError("Enter the valid Password to Sign In");
      return;
    } else {
      this.clearPasswordError();
    }

    this.showStatusLoading("Signing in & verifying credentials...");

    try {
      const initialSettings = {
        enabled: true,
        email,
        password,
        twoFactorCode
      };

      await startSync(initialSettings);

      const saved = await getSyncSettings();
      if (onLoginSuccessCallback) {
        await onLoginSuccessCallback(saved);
      }
      this.hideLoginModal();
      return saved;
    } catch (err) {
      console.error("Login verification failed:", err);
      if (elements.syncPassword) {
        elements.syncPassword.value = '';
      }
      this.setPasswordError("Email or Password are wrong");
      if (elements.syncStatusMsg) {
        elements.syncStatusMsg.textContent = '';
      }
    }
  }
};

