// tests/account.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AccountController,
  LoginController,
  setupAccountUI,
  updateProfileUI,
  updateAccountStorageUI,
  toggleDropdown
} from '../js/account/index.js';
import { getSyncSettings, stopSync, saveSyncSettings, destroyDatabase } from '../js/db/index.js';

vi.mock('../js/db/index.js', () => ({
  getSyncSettings: vi.fn().mockResolvedValue({
    email: 'user@example.com',
    username: 'TestUser',
    enabled: true,
  }),
  saveSyncSettings: vi.fn().mockResolvedValue(true),
  startSync: vi.fn().mockResolvedValue(true),
  stopSync: vi.fn().mockResolvedValue(true),
  destroyDatabase: vi.fn().mockResolvedValue(true),
  loadAllPlaces: vi.fn().mockResolvedValue([]),
}));

describe('AccountController & UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-sync-login"></button>
      <div id="app-drawer" style="display: none;"></div>
      <div id="account-menu" style="display: none;"></div>
      <button id="btn-dropdown-settings"></button>
      <button id="btn-sync-profile"></button>
      <div id="header-profile-letter"></div>
      <div id="account-dropdown-email"></div>
      <div id="dropdown-profile-letter"></div>
      <div id="account-dropdown" style="display: none;"></div>
      <div id="login-modal" class="hidden"></div>
      <button id="btn-login-close"></button>
      <button id="btn-login-cancel"></button>
      <button id="btn-dropdown-signout"></button>
      <button id="btn-settings-toggle"></button>
      <input id="sync-email" />
      <input id="sync-password" />
      <div id="sync-settings-status"></div>
      <div id="account-storage-meta"></div>
      <div id="account-storage-bar-notes"></div>
      <div id="account-storage-bar-other"></div>
      <div id="account-storage-notes-text"></div>
      <div id="account-storage-other-text"></div>
      <div id="account-storage-free-text"></div>
    `;
    vi.clearAllMocks();
  });

  it('initializes and updates profile UI state when user is logged in', async () => {
    setupAccountUI(AccountController);
    await AccountController.init();

    expect(getSyncSettings).toHaveBeenCalled();
    expect(document.getElementById('btn-sync-login').style.display).toBe('none');
    expect(document.getElementById('app-drawer').style.display).toBe('inline-block');
    expect(document.getElementById('account-menu').style.display).toBe('inline-block');
    expect(document.getElementById('account-menu').name).toBe('TestUser');
    expect(document.getElementById('account-menu').email).toBe('user@example.com');
  });

  it('shows and hides login modal via LoginController', () => {
    LoginController.init();
    LoginController.showLoginModal();
    expect(document.getElementById('login-modal').classList.contains('hidden')).toBe(false);

    LoginController.hideLoginModal();
    expect(document.getElementById('login-modal').classList.contains('hidden')).toBe(true);
  });

  it('toggles account dropdown display style', () => {
    setupAccountUI(AccountController);
    toggleDropdown();
    expect(document.getElementById('account-dropdown').style.display).toBe('flex');
    expect(document.getElementById('account-menu').open).toBe(true);

    toggleDropdown();
    expect(document.getElementById('account-dropdown').style.display).toBe('none');
    expect(document.getElementById('account-menu').open).toBe(false);
  });

  it('opens login modal when btn-sync-login is clicked and shows btn-sync-login when logged out', async () => {
    LoginController.init();
    const btnLogin = document.getElementById('btn-sync-login');
    btnLogin.click();
    expect(document.getElementById('login-modal').classList.contains('hidden')).toBe(false);

    // When logged out:
    updateProfileUI({ enabled: false });
    expect(btnLogin.style.display).toBe('inline-flex');
    expect(document.getElementById('app-drawer').style.display).toBe('none');
    expect(document.getElementById('account-menu').style.display).toBe('none');
  });

  it('triggers settings toggle when btn-dropdown-settings is clicked', () => {
    setupAccountUI(AccountController);
    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    const spy = vi.spyOn(btnSettingsToggle, 'click');
    const btnDropdownSettings = document.getElementById('btn-dropdown-settings');
    btnDropdownSettings.click();
    expect(spy).toHaveBeenCalled();
  });

  it('opens settings-panel when btn-dropdown-settings is clicked without btn-settings-toggle in DOM', () => {
    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    if (btnSettingsToggle) btnSettingsToggle.remove();

    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.className = 'translate-y-full';
    document.body.appendChild(panel);

    setupAccountUI(AccountController);
    const btnDropdownSettings = document.getElementById('btn-dropdown-settings');
    btnDropdownSettings.click();

    expect(panel.classList.contains('settings-open')).toBe(true);
    expect(panel.classList.contains('translate-y-full')).toBe(false);
  });

  it('sets error state on email input when attempting to login with blank email', async () => {
    LoginController.init();
    const emailInput = document.getElementById('sync-email');
    emailInput.value = '';

    await LoginController.handleLogin();

    expect(emailInput.error).toBe(true);
    expect(emailInput.getAttribute('error-text')).toBe('Enter a valid Email Address to Sign In');

    // Typing into email input clears error
    emailInput.value = 'user@example.com';
    emailInput.dispatchEvent(new Event('input'));
    expect(emailInput.error).toBe(false);
    expect(emailInput.getAttribute('error-text')).toBeNull();
  });

  it('sets error state on password input when password is empty', async () => {
    LoginController.init();
    const emailInput = document.getElementById('sync-email');
    const passwordInput = document.getElementById('sync-password');
    emailInput.value = 'user@example.com';
    passwordInput.value = '';

    await LoginController.handleLogin();

    expect(passwordInput.error).toBe(true);
    expect(passwordInput.getAttribute('error-text')).toBe('Enter the valid Password to Sign In');

    // Typing into password input clears error
    passwordInput.value = 'secret123';
    passwordInput.dispatchEvent(new Event('input'));
    expect(passwordInput.error).toBe(false);
    expect(passwordInput.getAttribute('error-text')).toBeNull();
  });

  it('cleans password field and sets error message when login fails due to wrong email/password', async () => {
    const { startSync } = await import('../js/db/index.js');
    startSync.mockRejectedValueOnce(new Error('Invalid credentials'));

    LoginController.init();
    const emailInput = document.getElementById('sync-email');
    const passwordInput = document.getElementById('sync-password');
    emailInput.value = 'user@example.com';
    passwordInput.value = 'wrongpassword';

    await LoginController.handleLogin();

    expect(passwordInput.value).toBe('');
    expect(passwordInput.error).toBe(true);
    expect(passwordInput.getAttribute('error-text')).toBe('Email or Password are wrong');
  });

  it('handles manage-click and edit-avatar events on account-menu', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    setupAccountUI(AccountController);

    const accountMenu = document.getElementById('account-menu');
    accountMenu.dispatchEvent(new CustomEvent('manage-click', {
      detail: { manageUrl: 'https://app.filen.io/#/settings/account' }
    }));
    expect(openSpy).toHaveBeenCalledWith('https://app.filen.io/#/settings/account', '_blank', 'noopener,noreferrer');

    accountMenu.dispatchEvent(new CustomEvent('edit-avatar'));
    expect(openSpy).toHaveBeenCalledWith('https://app.filen.io/#/settings/account', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('updates account storage widget and formatBytes properly', async () => {
    expect(AccountController.formatBytes(0)).toBe('0 B');
    expect(AccountController.formatBytes(1024)).toBe('1 KB');
    expect(AccountController.formatBytes(1048576)).toBe('1 MB');

    await updateAccountStorageUI({
      storageTotal: 10 * 1024 * 1024 * 1024,
      storageUsed: 2 * 1024 * 1024 * 1024
    });

    const meta = document.getElementById('account-storage-meta');
    expect(meta.textContent).toContain('10 GB used');
  });

  it('correctly adapts other files and free quota from Filen SDK storage settings', async () => {
    // Mock loadAllPlaces to return places data of known size
    const { loadAllPlaces } = await import('../js/db/index.js');
    loadAllPlaces.mockResolvedValueOnce([
      { id: 'p1', name: 'Place 1', lat: 10, lng: 20 },
      { id: 'p2', name: 'Place 2', lat: 30, lng: 40 }
    ]);

    const total50GB = 50 * 1024 * 1024 * 1024;
    const used10GB = 10 * 1024 * 1024 * 1024;

    await updateAccountStorageUI({
      storageTotal: total50GB,
      storageUsed: used10GB
    });

    const meta = document.getElementById('account-storage-meta');
    const otherText = document.getElementById('account-storage-other-text');
    const freeText = document.getElementById('account-storage-free-text');
    const notesText = document.getElementById('account-storage-notes-text');
    const accountMenu = document.getElementById('account-menu');

    expect(meta.textContent).toBe('10 GB of 50 GB used');
    expect(freeText.textContent).toBe('Free: 40 GB');
    expect(otherText.textContent).toContain('Other files: 10 GB'); // ~10 GB since places are tiny
    expect(notesText.textContent).toContain('Places:');
    expect(accountMenu.storageTotal).toBe('50 GB');
    expect(accountMenu.storageUsed).toBe('10 GB');
    expect(accountMenu.storageProgress).toBeCloseTo(0.2, 2);
  });

  it('handles signout by stopping sync, saving settings, and destroying database without confirm prompt', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    await AccountController.handleSignout();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(stopSync).toHaveBeenCalled();
    expect(saveSyncSettings).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(destroyDatabase).toHaveBeenCalled();
    expect(AccountController.handlePurge).toBeUndefined();
    confirmSpy.mockRestore();
  });
});
