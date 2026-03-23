import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist/embed",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/main-embed.tsx",
      output: {
        entryFileNames: "tool.js",
        assetFileNames: "tool[extname]",
        manualChunks: undefined,
      },
    },
    cssCodeSplit: false,
  },
});
