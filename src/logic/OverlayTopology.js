//https://gist.github.com/guilhermepontes/17ae0cc71fa2b13ea8c20c94c5c35dc4
const shuffleArray = (arr) => arr
    .map((a) => [Math.random(), a])
    .sort((a, b) => a[0] - b[0])
    .map((a) => a[1])

const pickRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)]

module.exports = class OverlayTopology {
    constructor(maxNeighborsPerNode, randomFunction, shuffleArrayFunction, pickRandomElementFunction) {
        if (!Number.isInteger(maxNeighborsPerNode)) {
            throw new Error('maxNeighborsPerNode is not an integer')
        }
        this.maxNeighborsPerNode = maxNeighborsPerNode
        this.nodes = {}
        this.random = randomFunction || Math.random
        this.shuffleArray = shuffleArrayFunction || shuffleArray
        this.pickRandomElement = pickRandomElementFunction || pickRandomElement
    }

    update(nodeId, neighbors) {
        this.nodes[nodeId] = new Set(neighbors)
        neighbors.forEach((neighbor) => this.nodes[neighbor].add(nodeId)) // assumption: neighbor already initialized in tracker
        Object.keys(this.nodes)
            .filter((n) => !this.nodes[nodeId].has(n))
            .forEach((n) => this.nodes[n].delete(nodeId))
    }

    leave(nodeId) {
        this.nodes[nodeId].forEach((neighbor) => this.nodes[neighbor].delete(nodeId)) // assumption: neighbor already initialized in tr
        delete this.nodes[nodeId]
    }

    state() {
        return Object.assign(...Object.entries(this.nodes).map(([nodeId, neighbors]) => {
            return {
                [nodeId]: [...neighbors]
            }
        }))
    }

    formInstructions(nodeId) {
        const excessNeighbors = this.nodes[nodeId].size - this.maxNeighborsPerNode
        if (excessNeighbors > 0) {
            const neighborsToDisconnectFrom = this.shuffleArray([...this.nodes[nodeId]]).slice(0, excessNeighbors)
            return neighborsToDisconnectFrom.map((neighbor) => {
                return {
                    action: 'disconnect',
                    source: nodeId,
                    destination: neighbor,
                }
            })
        }

        let instructions = []
        let missingNeighbors = -excessNeighbors

        if (missingNeighbors > 0) {
            const candidates = Object.entries(this.nodes)
                .filter(([n, neighbors]) => neighbors.size < this.maxNeighborsPerNode) // there are open slots
                .filter(([n, neighbors]) => !neighbors.has(nodeId)) // nodeId is not already a neighbor
                .filter(([n, _]) => n !== nodeId) // do not connect to self
                .sort(([n1, neighbors1], [n2, neighbors2]) => neighbors1.size - neighbors2.size) // sort by reserved slots (ascending)
                .map(([n, _]) => n)

            const neighborsToConnectTo = this.shuffleArray(candidates).slice(0, missingNeighbors)
            instructions = neighborsToConnectTo.map((n) => {
                const r = this.random() < 0.5
                return {
                    action: 'connect',
                    source: r ? nodeId : n,
                    destination: r ? n : nodeId,
                }
            })
            missingNeighbors -= instructions.length
        }

        if (missingNeighbors > 0) {
            const candidates = Object.entries(this.nodes)
                .filter(([n, neighbors]) => neighbors.size >= this.maxNeighborsPerNode) // there are no open slots
                .filter(([n, neighbors]) => !neighbors.has(nodeId)) // nodeId is not already a neighbor
                .filter(([n, _]) => n !== nodeId) // do not connect to self
                .map(([n, _]) => n)

            // TODO: if nodeId is already connected to one participant of a connection that will be disconnected, we will
            //  not be freeing up 2 slots but instead only 1. Should this be taken into consideration?
            const disconnectionTargets = this.shuffleArray(candidates).slice(0, Math.floor(missingNeighbors / 2))
            instructions.push(...disconnectionTargets.map((n) => {
                const r = this.random() < 0.5
                const randomNeighbor = this.pickRandomElement([...this.nodes[n]])
                return {
                    action: 'disconnect',
                    source: r ? n : randomNeighbor,
                    destination: r ? randomNeighbor : n,
                }
            }))
        }

        return instructions
    }
}
