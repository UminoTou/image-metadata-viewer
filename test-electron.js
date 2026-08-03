const electron = require('electron')
console.log('electron type:', typeof electron)
console.log('has app:', 'app' in electron)
console.log('app type:', typeof electron.app)
