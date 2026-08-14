// tests/setup.js
import { vi, beforeEach } from 'vitest';
import PouchDB from 'pouchdb';
import PouchDBMemory from 'pouchdb-adapter-memory';
import maplibreglMock from './mocks/maplibregl.mock.js';

// Use memory adapter for PouchDB in tests to prevent file locking issues
PouchDB.plugin(PouchDBMemory);
PouchDB.defaults({ adapter: 'memory' });

vi.mock('maplibre-gl', () => ({
  default: maplibreglMock,
  ...maplibreglMock
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock URL.createObjectURL
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-id');
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

// Reset DOM body before each test
beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllMocks();
});
