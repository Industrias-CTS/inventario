module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index-simple.js',
      cwd: '/home/ubuntu/inventario/inventory-app/backend',
      instances: 1,
      exec_mode: 'cluster',
      
      // Variables de entorno
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_TYPE: 'sqlite',
        JWT_SECRET: 'supersecretkey123456789inventory',
        JWT_EXPIRES_IN: '7d',
        BCRYPT_ROUNDS: 10,
        FRONTEND_URL: 'http://34.198.163.51',
        RATE_LIMIT_WINDOW_MS: 900000,
        RATE_LIMIT_MAX_REQUESTS: 100
      },

      // Configuracion de logs
      error_file: '/home/ubuntu/.pm2/logs/backend-error.log',
      out_file: '/home/ubuntu/.pm2/logs/backend-out.log',
      log_file: '/home/ubuntu/.pm2/logs/backend.log',
      time: true,
      
      // Configuracion de reinicio
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      
      // Configuracion de cluster
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // Scripts de ciclo de vida
      pre_start: 'mkdir -p data && mkdir -p logs',
      post_start: 'echo "Inventory backend started successfully"',
      
      // Configuracion adicional
      source_map_support: true,
      instance_var: 'INSTANCE_ID',
      
      // Health check
      health_check_grace_period: 3000,
      health_check_timeout: 3000
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: '34.198.163.51',
      ref: 'origin/main',
      repo: 'git@github.com:Industrias-CTS/inventario.git',
      path: '/home/ubuntu/inventario',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};