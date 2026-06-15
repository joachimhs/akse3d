import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // SPA-modus: appen er klient-only (ssr=false i +layout.js) og lagrer i
    // localStorage → ingen server. fallback gir én HTML som alle ruter laster.
    adapter: adapter({ fallback: 'index.html' })
  }
};

export default config;
