import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	build: {
		assetsInlineLimit: 8192,
		chunkSizeWarningLimit: 800,
	},
	server: {
		port: 5173,
		host: "0.0.0.0",
		proxy: {
			"/api": {
				target: process.env.API_BASE_URL ?? "http://localhost:4200",
				changeOrigin: true,
			},
		},
	},
});
