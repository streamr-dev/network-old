# Streamr network 
 ![Travis](https://travis-ci.com/streamr-dev/network.svg?token=qNNVCnYJo1fz18VTNpPZ&branch=master)
 
> Peer-to-peer publish-subscribe network for real-time data with support for long-term data persistence

This repository/package contains an extendable server-side implementation of the 
[Streamr protocol](https://github.com/streamr-dev/streamr-specs/blob/master/PROTOCOL.md) written in Node.js.
The code contains a tracker implementation and a minimal network node implementation.
This package acts as a library for other Node.js packages, but also provides a few of its own executables as well.


The main executable for running a broker node in the Streamr Network resides in the
[Broker](https://github.com/streamr-dev/broker) repository. Although this repository does contain a
fully-operational minimal network node implementation, we recommend running the broker node because it includes
useful client-facing features for interacting with the Streamr Network. 

The [wiki](https://github.com/streamr-dev/network/wiki) of this project outlines the technical and architectural
decisions made during development. It also provides explanations of some the more involved features. There is also a
glossary for often used terms. We aim to keep the wiki updated regularly so it is an accurate reflection of the code
base.

Flexible architecture allows you to integrate any external data sources.
Check [Examples](#examples) for more information.


## Table of Contents
- [Installation](#installation)
- [Integration](#integration)
- [Architectural decisions](https://github.com/streamr-dev/network/wiki)
- [Examples](#examples)
- [Development](#development)
- [Releasing](#releasing)

## Installation

Prerequisites: [Node.js](https://nodejs.org/) (`^8.10.0`, `^10.13.0`, or `>=11.10.1`), npm version 6+.

You can install Streamr Network using npm:

```
$ npm install @streamr/streamr-p2p-network --save
```

It is also possible to install Streamr Network globally (using `npm install @streamr/streamr-p2p-network --global`)

## Integration

Integration into existing project could be found in [Examples](./examples)

## Examples

Check our [examples folder](./examples)

## Development

Install dependencies:

    npm ci
    
Run the tests:

    npm run test

Run an example network locally (10 nodes):

    npm run network

We use [eslint](https://github.com/eslint/eslint) for code formatting:

    npm run eslint

Code coverage:

    npm run coverage
    
Debugging:

To get all Streamr Network debug messages  

    export DEBUG=streamr:*
    
Or adjust debugging to desired level 

- connection layer `export DEBUG=streamr:connection:*`
- logic layer `export DEBUG=streamr:logic:*`
- protocol layer `export DEBUG=streamr:protocol:*`

Excluding level

    export DEBUG=streamr:*,-streamr:connection:*
    
    
## Releasing

To release a new version of this project to NPM

1. Update version with either `npm version patch`, `npm version minor`, or `npm version major`. Use semantic versioning
https://semver.org/. Files package.json and package-lock.json will be automatically updated, and an appropriate git commit and tag created. 
2. `git push --follow-tags`
3. Wait for Travis CI to run tests
4. If tests passed, Travis CI will publish the new version to NPM
