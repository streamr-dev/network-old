const { startTracker } = require('./src/composition')

startTracker('127.0.0.1', 30300, 'tracker')
    .then(() => {})
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
