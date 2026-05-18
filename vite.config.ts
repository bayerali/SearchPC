import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Using "./" (relative) so the built bundle works under ANY URL prefix —
// GitHub Pages (https://bayerali.github.io/ProduktionsDashboard/),
// local file://, the Perplexity preview, etc.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
