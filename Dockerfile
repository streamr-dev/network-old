# Use official node runtime as base image
FROM node:13

# Set the working directory to /app
WORKDIR /app

# Copy app code
COPY . /app

# Logging level
ENV DEBUG=streamr:logic:*

# Install package.json dependencies
RUN npm ci

# Make port available to the world outside this container
EXPOSE 30300

CMD node bin/tracker.js --port=30300
