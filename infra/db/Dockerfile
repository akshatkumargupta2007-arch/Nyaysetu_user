# Build map #A2 — one database image with PostGIS + pgvector.
#
# Built on the official Postgres bookworm image + the PGDG apt repo, added
# ourselves, rather than FROM postgis/postgis (whose current 17-3.5 tag is
# pinned to Debian bullseye, which apt.postgresql.org has since archived —
# `apt-get update` 404s on bullseye-pgdg). Bookworm is PGDG's current,
# actively-mirrored release, and this is also what Railway runs on.
FROM postgres:17-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates gnupg curl \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-17-postgis-3 \
      postgresql-17-postgis-3-scripts \
      postgresql-17-pgvector \
 && apt-get purge -y --auto-remove gnupg curl \
 && rm -rf /var/lib/apt/lists/*

COPY init.sql /docker-entrypoint-initdb.d/01-extensions.sql
