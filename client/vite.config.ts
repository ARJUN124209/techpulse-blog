import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const api = 'http://localhost:5000';
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': api, '/uploads': api, '/sitemap.xml': api, '/robots.txt': api } } });
