import '@testing-library/jest-dom';

// Polyfills / mocks for browser APIs used across tests
if (typeof window !== 'undefined') {
  // Mock crypto.randomUUID
  if (!window.crypto?.randomUUID) {
    let count = 0;
    (window as any).crypto = {
      ...window.crypto,
      randomUUID: () => `test-uuid-${++count}-${Math.random().toString(36).slice(2, 9)}`,
    };
  }

  // Mock clipboard
  if (!navigator.clipboard) {
    (navigator as any).clipboard = {
      writeText: async () => {},
      readText: async () => '',
    };
  }

  // Polyfill scrollIntoView for JSDOM
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// Polyfill Blob.prototype.text and arrayBuffer for JSDOM
if (typeof Blob !== 'undefined') {
  if (!Blob.prototype.text) {
    Blob.prototype.text = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(this);
      });
    };
  }
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(this);
      });
    };
  }
}
