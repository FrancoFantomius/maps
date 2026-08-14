// tests/AccountController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountController } from '../js/AccountController.js';
import { getSyncSettings } from '../js/db.js';

vi.mock('../js/db.js', () => ({
  getSyncSettings: vi.fn().mockResolvedValue({
    email: 'user@example.com',
    username: 'TestUser',
    enabled: true,
  }),
  saveSyncSettings: vi.fn().mockResolvedValue(true),
  startSync: vi.fn().mockResolvedValue(true),
  stopSync: vi.fn().mockResolvedValue(true),
  destroyDatabase: vi.fn().mockResolvedValue(true),
}));

describe('AccountController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-sync-login"></button>
      <button id="btn-sync-profile"></button>
      <div id="header-profile-letter"></div>
      <div id="account-dropdown-email"></div>
      <div id="dropdown-profile-letter"></div>
      <div id="account-dropdown" style="display: none;"></div>
      <div id="login-modal" class="hidden">
        <form id="login-form">
          <input id="sync-email" />
          <input id="sync-password" />
          <button id="btn-save-sync" type="submit"></button>
        </form>
      </div>
      <button id="btn-login-close"></button>
      <button id="btn-login-cancel"></button>
      <button id="btn-dropdown-signout"></button>
      <div id="sync-settings-status"></div>
    `;
    vi.clearAllMocks();
  });

  it('initializes and updates profile UI state when user is logged in', async () => {
    await AccountController.init();

    expect(getSyncSettings).toHaveBeenCalled();
    expect(document.getElementById('btn-sync-login').style.display).toBe('none');
    expect(document.getElementById('btn-sync-profile').style.display).toBe('inline-flex');
  });

  it('shows and hides login modal', () => {
    AccountController.init();
    AccountController.showLoginModal();
    expect(document.getElementById('login-modal').classList.contains('hidden')).toBe(false);

    AccountController.hideLoginModal();
    expect(document.getElementById('login-modal').classList.contains('hidden')).toBe(true);
  });

  it('toggles account dropdown display style', () => {
    AccountController.init();
    AccountController.toggleDropdown();
    expect(document.getElementById('account-dropdown').style.display).toBe('flex');

    AccountController.toggleDropdown();
    expect(document.getElementById('account-dropdown').style.display).toBe('none');
  });
});
