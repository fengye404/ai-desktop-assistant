const {app} = require('electron'); console.log('APP:', typeof app); app.on('ready', () => { console.log('READY, path:', app.getAppPath()); app.quit(); });
