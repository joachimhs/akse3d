// Akse er klient-only (Three.js + File System Access trenger window/DOM).
// Dev-previewen skal derfor ikke server-rendres — ellers feiler SSR-import av
// CommonJS-moduler som file-saver. Konsumenter (host) må sette ssr=false på sin
// /akse-route på samme måte (skaperiet-ny-front gjør det allerede).
export const ssr = false;
export const prerender = false;
