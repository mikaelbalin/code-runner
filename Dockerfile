# Используем стабильный и легкий образ
FROM rust:1.93-slim-bookworm

# Устанавливаем минимальный набор для сборки и curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем rust-script
RUN cargo install rust-script

# Создаем пользователя 'sandbox'. 
# В Podman rootless этот пользователь внутри контейнера 
# будет отображаться на твоего текущего пользователя в ОС.
RUN useradd -m sandbox
USER sandbox
WORKDIR /home/sandbox

# Указываем ENTRYPOINT, чтобы контейнер вел себя как исполняемый файл
ENTRYPOINT ["rust-script"]