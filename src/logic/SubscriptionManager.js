module.exports = class SubscriptionManager {
    constructor() {
        this.subscriptions = new Set()
        this.pendingSubscriptions = new Set()
    }

    addSubscription(streamId) {
        this.pendingSubscriptions.delete(streamId)
        this.subscriptions.add(streamId)
    }

    addPendingSubscription(streamId) {
        this.pendingSubscriptions.add(streamId)
    }

    getPendingSubscriptions() {
        return [...this.pendingSubscriptions]
    }

    hasPendingSubscription(streamId) {
        return this.pendingSubscriptions.has(streamId)
    }

    removeSubscription(streamId) {
        this.subscriptions.delete(streamId)
    }
}
