import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { EDUPAGE_ORIGIN, EDUPAGE_PATHS } from "./netlify/lib/edupageProxy.mjs";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Registration lives in src/pwa.js so the app can check for new builds
      // on resume, not only on a cold page load.
      injectRegister: null,
      includeAssets: ["favicon.ico", "icons/*.png"],
      manifest: {
        name: "VIKO VVF Timetable",
        short_name: "VIKO VVF",
        description: "VIKO VVF lecture timetable — view your class schedule.",
        theme_color: "#080b11",
        background_color: "#080b11",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["education", "utilities"],
        icons: [
          {
            src: "/icons/icon-120x120.png",
            sizes: "120x120",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-180x180.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            // Maskable — Android adaptive icons (squircle/circle shapes)
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,json,woff2}"],
        // Serve cached version when offline
        navigateFallback: "index.html",
      },
      devOptions: { enabled: false },
    }),
  ],
  // Dev stand-in for netlify/functions: the same paths, proxied to EduPage
  server: {
    proxy: Object.fromEntries(
      Object.entries(EDUPAGE_PATHS).map(([name, path]) => [
        `/.netlify/functions/${name}`,
        { target: EDUPAGE_ORIGIN, changeOrigin: true, rewrite: () => path },
      ])
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ["react", "react-dom", "react-router-dom"],
          utils:    ["moment", "react-toastify"],
        },
      },
    },
  },
});
