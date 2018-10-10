const { startTracker } = require('./src/composition-ws')

startTracker('127.0.0.1', 30300, 'tracker')
    .then(() => {})
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
