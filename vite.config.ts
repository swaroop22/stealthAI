import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { exec, spawn } from 'child_process'

function desktopLauncherPlugin() {
  return {
    name: 'desktop-launcher-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/launch-desktop', (req: any, res: any) => {
        const isMac = process.platform === 'darwin';
        const isWin = process.platform === 'win32';

        let urlObj: URL;
        try {
          urlObj = new URL(req.url || '', 'http://localhost');
        } catch {
          urlObj = new URL('http://localhost');
        }

        const sessionId = urlObj.searchParams.get('id') || '';
        const company = urlObj.searchParams.get('company') || '';
        const protocolUrl = sessionId
          ? `stealthai://start-session?id=${encodeURIComponent(sessionId)}&company=${encodeURIComponent(company)}`
          : 'stealthai://start-session';

        let command = '';
        if (isMac) {
          command = `open "${protocolUrl}" || open -a StealthAI || open /Applications/StealthAI.app`;
        } else if (isWin) {
          command = `start "" "${protocolUrl}" || start "" "StealthAI.exe"`;
        } else {
          command = `xdg-open "${protocolUrl}"`;
        }

        exec(command, (err: any) => {
          res.setHeader('Content-Type', 'application/json');
          if (err) {
            // Development fallback: spawn electron detached so it runs without hanging the HTTP request
            try {
              const child = spawn('npx', ['electron', '.', '--dev'], {
                detached: true,
                stdio: 'ignore'
              });
              child.unref();
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, mode: 'dev-spawn' }));
            } catch (spawnErr: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err?.message || spawnErr?.message }));
            }
          } else {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), desktopLauncherPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**', 'src/utils/**', 'src/components/**'],
      exclude: ['src/test/**', 'src/components/CodingAssitant.tsx'],
    },
  },
} as any)
