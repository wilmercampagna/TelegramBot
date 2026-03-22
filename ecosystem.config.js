module.exports = {
  apps: [
    {
      name: 'telegram-doc-bot',
      script: 'dist/index.js',
      cwd: '/home/azureuser/TelegramBot',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
    },
  ],
};
