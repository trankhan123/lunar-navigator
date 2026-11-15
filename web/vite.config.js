import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { createMissionChatHandler } from './server/missionChat.js'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), {
    name: 'mission-chat-dev-api',
    configureServer(server) {
      const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
      server.middlewares.use('/api/mission-chat', createMissionChatHandler({ env }))
    },
  }],
}))
