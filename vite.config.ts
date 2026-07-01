import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.SUPABASE_URL || env.VITE_SUPABASE_URL || '',
      ),
      'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(
        env.SUPABASE_KEY || env.VITE_SUPABASE_KEY || '',
      ),
    },
  }
})
