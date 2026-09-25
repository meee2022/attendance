import { mkdirSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
    plugins: [react(), tailwind(), { name: "pdf-test-output", configureServer(server) { server.middlewares.use("/__test-pdf", (req, res) => { if (req.method !== "POST") { res.statusCode = 405; res.end(); return; } const chunks: Buffer[] = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => { mkdirSync(".cache/pdf-check", { recursive: true }); writeFileSync(".cache/pdf-check/official-form.pdf", Buffer.concat(chunks)); res.end("ok"); }); }); } }],
    resolve: { alias: [{ find: /.*lib\/supervisionSession$/, replacement: fileURLToPath(new URL("./sessionMock.tsx", import.meta.url)) }] },
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
