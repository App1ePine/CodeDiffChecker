module.exports = {
  apps: [
    {
      name: 'code-diff-checker',
      script: '/path/to/your/server_binary_file',
      cwd: '/path/to/your_project',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        FRONTEND_ORIGIN: 'https://yourdomain.com',
        SHARE_BASE_URL: 'https://yourdomain.com',
      },
    },
  ],
}
