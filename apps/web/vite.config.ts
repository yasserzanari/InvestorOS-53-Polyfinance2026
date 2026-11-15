import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_API_TARGET;
  const profileApiTarget = env.VITE_PROFILE_API_TARGET || 'http://127.0.0.1:8010';

  if (mode === 'aws' && !apiTarget) {
    throw new Error('VITE_API_TARGET is required for AWS-backed local development. Copy .env.aws.example to .env.aws and set the API Gateway URL.');
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/profile-api': {
          target: profileApiTarget,
          rewrite: (path) => path.replace(/^\/profile-api/, ''),
        },
        ...(apiTarget ? {
            '/api': {
              target: apiTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          } : {}),
      },
    },
  };
});
