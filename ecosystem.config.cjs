// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'cortex-backend',
      script: 'server.js',
      cwd: 'C:\\Users\\OmerShaikh\\Desktop\\cortex-lms\\backend',
      interpreter: 'node',
      env: { NODE_ENV: 'production', PORT: 5001 },
    },
    {
      name: 'cortex-frontend',
      script: 'cmd.exe',
      args: '/c node_modules\\.bin\\next.cmd start',
      cwd: 'C:\\Users\\OmerShaikh\\Desktop\\cortex-lms\\frontend',
      interpreter: 'none',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
  ],
};
