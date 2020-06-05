const OverlayTopology = require('../../src/logic/OverlayTopology')

const numOfNeighbors = 4
const numOfRounds = 100000
const numOfNodes = 10
const printProgress = false

const idxToNodeId = (idx) => `${idx + 1}`
const nodeIdToIdx = (nodeId) => parseInt(nodeId, 10) - 1

// Run topology experiment
const states = []
for (let i = 0; i < numOfRounds; ++i) {
    const topology = new OverlayTopology(numOfNeighbors)

    for (let j = 0; j < numOfNodes; ++j) {
        const nodeId = idxToNodeId(j)
        topology.update(nodeId, [])
        topology.formInstructions(nodeId)
    }

    states.push(topology.state())
    if (printProgress && i % 100 === 0) {
        console.info(`Running topology experiment... ${Math.round((i / numOfRounds) * 100)}%`)
    }
}

// Set up occurrence matrix filled with zeroes
const occurrenceMatrix = []
for (let i = 0; i < numOfNodes; ++i) {
    occurrenceMatrix[i] = []
    for (let j = 0; j < numOfNodes; ++j) {
        occurrenceMatrix[i][j] = 0
    }
}

// Tally up numbers
states.forEach((state) => {
    Object.entries(state).forEach(([nodeId, neighbors]) => {
        const idx = nodeIdToIdx(nodeId)
        neighbors.forEach((neighbor) => {
            occurrenceMatrix[idx][nodeIdToIdx(neighbor)] += 1
        })
    })
})

/*
// Print raw data as CSV
console.info('round,node,neighbor')
states.forEach((state, round) => {
    Object.entries(state).forEach(([nodeId, neighbors]) => {
        neighbors.forEach((neighbor) => {
            console.info([round, nodeId, neighbor].join(","))
        })
    })
})
return
 */

// Print as grid
console.info(`Pair-wise occurrences with rounds=${numOfRounds}, nodes=${numOfNodes}, neighbors=${numOfNeighbors}`)
occurrenceMatrix.forEach((row) => {
    console.info(row.join(' '))
})

// Print summary statistics
const expectedCount = (1 / (numOfNodes - 1)) * numOfNeighbors * numOfRounds
console.info(`Expected count (per cell): ${expectedCount}`)
