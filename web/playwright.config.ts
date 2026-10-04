import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { channel: "chrome", baseURL: "http://127.0.0.1:5173" },
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
    {
      command: "PYTHONPATH=.. ../.venv/bin/python ../tests/browser_server.py",
      url: "http://127.0.0.1:8766/api/health",
      reuseExistingServer: false,
    },
  ],
});
