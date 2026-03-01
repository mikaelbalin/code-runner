# Project Setup

## Getting Started

This README provides the necessary steps to set up and run this project.

### Prerequisites

- Tailscale
- pnpm (or npm/yarn)
- Node.js

### Steps

1. **Enable and configure Tailscale**
```sh
   ujust enable-taiscale
   sudo tailscale set --operator=$USER
   tailscale up
```

2. **Install packages**
```sh
   pnpm i
```

3. **Configure Environment Variables**
Create a `.env` file in the `plugin` directory. Add the following variables:

```sh
OBSIDIAN_PLUGIN_DIR=your-plugin-directory
SERVER_URL=http://your-server-url
```

4. **Set up container**
Follow the instructions provided in `server/README.md`.
