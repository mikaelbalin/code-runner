```sh
distrobox-host-exec podman build -t rust-runner .
distrobox-host-exec podman run --rm --network none --memory "256m" --cpus "0.5" -v "$(pwd):/app:Z,ro" rust-runner /app/test.rs
```
