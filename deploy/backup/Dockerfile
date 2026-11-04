# Imagine pentru joburile cron de backup (E-admin-platform-6): pg_dump/pg_restore 18 + age + rclone.
# Aceeasi imagine, doua servicii Railway: railway.daily.json si railway.restore-test.json.
FROM postgres:18-bookworm@sha256:3725f4e2499eef5134592b3b4ab79a543ed7f8e533b05b5b637af926630f6650

RUN apt-get update \
  && apt-get install -y --no-install-recommends age rclone curl ca-certificates tzdata jq \
  && rm -rf /var/lib/apt/lists/*

COPY lib.sh backup-daily.sh restore-test.sh row-counts.sql /opt/backup/
COPY test/ /opt/backup/test/
# normalizare CRLF (checkout pe Windows) + executabile
RUN sed -i 's/\r$//' /opt/backup/*.sh /opt/backup/row-counts.sql /opt/backup/test/*.sh \
  && chmod 0755 /opt/backup/*.sh /opt/backup/test/*.sh

ENV TZ=UTC
WORKDIR /tmp
# initdb/pg_ctl din restore-test refuza root
USER postgres
# Fara ENTRYPOINT-ul imaginii postgres (ar porni un server): comanda vine din railway.*.json.
ENTRYPOINT []
CMD ["/opt/backup/backup-daily.sh"]
