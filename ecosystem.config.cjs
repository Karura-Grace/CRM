// pm2 process file for a plain Node/VPS host:  pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    { name: "pac-crm", script: "npm", args: "run start", env: { NODE_ENV: "production", PORT: 3000 } },
    { name: "pac-crm-cron", script: "npm", args: "run cron", cron_restart: "0 2 * * *", autorestart: false },
  ],
};
