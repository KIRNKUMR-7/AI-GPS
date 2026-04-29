import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// A tiny in-memory backend for local Wi-Fi testing across phone & laptop
function localNetworkMockPlugin() {
  const store = new Map();
  return {
    name: 'local-network-mock',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/api/local-mock' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.action === 'ping') {
                store.set(data.deviceId, data.payload);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
              } else if (data.action === 'getAll') {
                const obj = Object.fromEntries(store);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(obj));
              }
            } catch (e) {
              res.statusCode = 400;
              res.end('Bad Request');
            }
          });
          return;
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "0.0.0.0", // ensures it's available over local Wi-Fi
    port: 5173,      // standardized on 5173 since 8080 might be blocked by some firewalls
    strictPort: false,
  },
  plugins: [react(), localNetworkMockPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
