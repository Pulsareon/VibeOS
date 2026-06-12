FROM rust:1.94-slim AS builder

WORKDIR /src
COPY . .
RUN cargo build --release -p vibeos-host

FROM debian:trixie-slim

WORKDIR /opt/vibeos
COPY --from=builder /src/target/release/vibeos-host /usr/local/bin/vibeos-host
COPY manifest.webmanifest ./
COPY assets ./assets
COPY core ./core

ENV VIBE_HOST=0.0.0.0 \
    VIBE_PORT=8080 \
    VIBE_ROOT=/opt/vibeos \
    VIBE_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/usr/local/bin/vibeos-host", "--healthcheck"]

CMD ["/usr/local/bin/vibeos-host"]
