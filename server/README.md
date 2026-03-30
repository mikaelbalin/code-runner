# Server Setup

This section provides instructions on how to set up and run the server component of this project.

## Prerequisites

- [Distrobox](https://distrobox.it/usage/distrobox-host-exec/)
- Podman

## Steps

1. **Build the Docker Image**
Run the following command to build the Rust runner image:

```sh
distrobox-host-exec podman build -t rust-runner .
```

2. **Run the Server Container**
After building the image, you can run the server container with the following command:

```sh
distrobox-host-exec podman run --rm --network none --memory "256m" --cpus "0.5" -v "$(pwd):/app:Z,ro" rust-runner /app/test.rs
```

This command does the following:
- `--rm`: Automatically remove the container when it exits.
- `--network none`: Disable networking for the container.
- `--memory "256m"`: Limit the memory usage of the container to 256MB.
- `--cpus "0.5"`: Limit the CPU usage of the container to half a core.
- `-v "$(pwd):/app:Z,ro"`: Mount the current directory into the `/app` directory inside the container with read-only permissions.

## Troubleshooting

### Memory cgroup error on Raspberry Pi

If you see:

```
Error: crun: opening file `memory.max` for writing: No such file or directory: OCI runtime attempted to invoke a command that was not found
```

The memory cgroup controller is not enabled in the kernel. Add the following parameters to your kernel command line in `/boot/firmware/cmdline.txt`:

```
cgroup_memory=1 cgroup_enable=memory
```

Append them to the **existing line** (do not add a newline), then reboot.
