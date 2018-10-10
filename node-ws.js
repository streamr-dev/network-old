const { startNode } = require('./src/composition-ws')

const port = process.argv[2] || 30301

startNode('127.0.0.1', port, 'node' + port)
    .then(() => {})
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
