/// <reference types="vite/client" />

import { Buffer } from "buffer";

interface Window {
  Buffer: typeof Buffer;
}

declare global {
  var Buffer: typeof Buffer;
  var global: typeof globalThis;
}

export {};