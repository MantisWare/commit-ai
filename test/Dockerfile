FROM ubuntu:latest

RUN apt-get update && apt-get install -y curl git

# Install Node.js v20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Setup git
RUN git config --global user.email "test@example.com"
RUN git config --global user.name "Test User"

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/

RUN ls -la

RUN pnpm install --frozen-lockfile
COPY . /app
RUN ls -la
RUN pnpm -s build
