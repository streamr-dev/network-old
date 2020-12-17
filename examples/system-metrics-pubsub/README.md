# System-metric-pubsub example

An example of using streamr network in a pub/sub setting. Node `publisherNode` publishes system metrics to a stream. Two
subscribes, `subscriberNodeOne` and `subscriberNodeTwo`, subscribe to the stream and output arriving messages in stdout.
A tracker is also started to assist the three nodes in peer discovery (finding and connecting to each other).

Install
```
npm ci
```

Run
```
npm run demo
```

Run with debugging enabled
```
demo-with-logging
```
