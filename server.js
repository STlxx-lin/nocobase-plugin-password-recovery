const path = require('path');
const fs = require('fs');

if (!process.env.NODE_MODULES_PATH) {
  process.env.NODE_MODULES_PATH = path.resolve(process.cwd(), 'node_modules');
}

try {
  const { PluginManager } = require('@nocobase/server');
  if (PluginManager) {
    const parsedNames = PluginManager.parsedNames || (PluginManager.parsedNames = {});
    parsedNames['password-recovery'] = {
      name: 'password-recovery',
      packageName: '@nocobase/plugin-password-recovery',
    };
    parsedNames['@nocobase/plugin-password-recovery'] = {
      name: 'password-recovery',
      packageName: '@nocobase/plugin-password-recovery',
    };
  }
} catch (e) {}

let plugin;
if (fs.existsSync(path.join(__dirname, 'dist', 'server', 'index.js'))) {
  plugin = require('./dist/server/index.js');
} else {
  plugin = require('./src/server');
}

module.exports = plugin.default || plugin;
