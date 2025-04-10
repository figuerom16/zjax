// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/main.js", // Your main library entry file
      name: "zjax", // The global variable name (e.g., window.zjax)
      fileName: () => `zjax.min.js`, // Output file name
      formats: ["iife"], // Output format: IIFE
    },
    rollupOptions: {
      output: {
        // Remove the "name" property if you don't need a global variable
        // globals: { // If you have external dependencies, define their global names
        //   'some-external-library': 'SomeExternalLibrary'
        // },
      },
    },
    minify: true,
    emptyOutDir: true,
  },
});
