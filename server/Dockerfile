# Use a stable and lightweight image
FROM rust:1.93-slim-bookworm

# Install the minimal set of dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl

# Install rust-script
RUN cargo install rust-script

# Create a 'sandbox' user. In rootless Podman, this user inside the container will be mapped to your current OS user.
RUN useradd -m sandbox
USER sandbox
WORKDIR /home/sandbox

# Set ENTRYPOINT so the container behaves like an executable
ENTRYPOINT ["rust-script"]