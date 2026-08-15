import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed to GitHub Pages as a project site, so assets live under the repo name.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/zmk-feature-gesture-action/",
});
