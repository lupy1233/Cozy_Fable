# Verificare locala a joburilor de backup (stack dev-infra)

Stack pornit: `docker compose -f dev-infra/docker-compose.yml up -d` (reteaua compose `marketplace-mobilier_default`,
hosturi `postgres`, `minio`, `mailpit`). Cheile age de test si fisierele `.env` de mai jos stau in afara repo-ului
(scratchpad / `%TEMP%`), NICIODATA in `deploy/backup/`. In Git Bash prefixeaza comenzile docker cu `MSYS_NO_PATHCONV=1`.

## 1. Imagine + test de retentie (fara retea)

```bash
docker build -t cozy-backup:local deploy/backup
docker run --rm --entrypoint bash cozy-backup:local /opt/backup/test/retention.test.sh   # exit 0
```

## 2. Bucket off-site local + chei age de test

```bash
docker compose -f dev-infra/docker-compose.yml run --rm --entrypoint sh minio-init \
  -c "mc alias set local http://minio:9000 minioadmin minioadmin && mc mb --ignore-existing local/offsite-backup"
docker run --rm --entrypoint age-keygen cozy-backup:local > "$TMP/age-test.txt"   # "Public key: age1..." pe stderr
```

`$TMP/backup-daily.env` (valori DOAR pentru stack-ul local):

```
DATABASE_URL=postgresql://marketplace:marketplace@postgres:5432/marketplace
BACKUP_AGE_RECIPIENT=<age1... din age-keygen>
OFFSITE_S3_PROVIDER=Minio
OFFSITE_S3_ENDPOINT=http://minio:9000
OFFSITE_S3_REGION=us-east-1
OFFSITE_S3_ACCESS_KEY=minioadmin
OFFSITE_S3_SECRET_KEY=minioadmin
OFFSITE_S3_BUCKET=offsite-backup
SOURCE_S3_ENDPOINT=http://minio:9000
SOURCE_S3_ACCESS_KEY=minioadmin
SOURCE_S3_SECRET_KEY=minioadmin
SOURCE_S3_BUCKET=uploads
BACKUP_REPORT_TO=admin@demo.ro
BACKUP_MAIL_FROM="Cozy Home" <backup@cozy-fable.local>
BACKUP_SMTP_HOST=mailpit
BACKUP_SMTP_PORT=1025
BACKUP_SMTP_ALLOW_INSECURE=true
```

`$TMP/restore-test.env` = acelasi fisier fara `BACKUP_AGE_RECIPIENT` si `SOURCE_*`, plus
`BACKUP_AGE_IDENTITY=<linia AGE-SECRET-KEY-1... din $TMP/age-test.txt>`.

## 3. Job zilnic

```bash
docker run --rm --network marketplace-mobilier_default --env-file "$TMP/backup-daily.env" \
  -e BACKUP_FORCE_MONTHLY=true cozy-backup:local /opt/backup/backup-daily.sh      # exit 0, ultima linie "backup ok"
```

Verificari:

```bash
docker compose -f dev-infra/docker-compose.yml run --rm --entrypoint sh minio-init -c '
  mc alias set local http://minio:9000 minioadmin minioadmin >/dev/null
  mc ls --recursive local/offsite-backup/cozy-prod/db/                       # daily .dump.age/.sha256/.manifest.json + monthly cozy-YYYYMM.*
  mc cat local/offsite-backup/cozy-prod/db/daily/<stem>.dump.age | head -c 21   # age-encryption.org/v1 (NU PGDMP)
  mc cat local/offsite-backup/cozy-prod/db/daily/<stem>.manifest.json
  mc ls --recursive local/offsite-backup/cozy-prod/uploads | wc -l; mc ls --recursive local/uploads | wc -l'
docker compose -f dev-infra/docker-compose.yml exec -T postgres psql -U marketplace -Atc \
  "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"   # == migrations_finished
```

- A doua rulare in aceeasi zi (fara `BACKUP_FORCE_MONTHLY`): log „copia lunara exista deja", „retentie aplicata" cu `deleted:0`.
- Istoric fisiere: urca un obiect de test in `local/uploads/backup-test/` (NU atasamente reale), ruleaza jobul, sterge
  obiectul, ruleaza din nou → obiectul apare in `local/offsite-backup/cozy-prod/uploads-history/<azi>/backup-test/`.

## 4. Test de restaurare

```bash
docker run --rm --network marketplace-mobilier_default --env-file "$TMP/restore-test.env" \
  [-e DATABASE_URL=postgresql://marketplace:marketplace@postgres:5432/marketplace] \
  cozy-backup:local /opt/backup/restore-test.sh                                   # exit 0
curl -s "http://localhost:8025/api/v1/search?query=subject:restaurare"            # „— OK"
curl -s "http://localhost:8025/api/v1/message/<ID>"                              # migratii, trigger, tabel randuri, durata
```

## 5. Cai negative

- identitate age gresita in `restore-test.env` → exit != 0 si email „[Cozy Home] Backup EȘUAT — test lunar de restaurare"
- `-e BACKUP_AGE_IDENTITY=...` pe jobul zilnic → exit 2
- fara variabile (`docker run --rm cozy-backup:local /opt/backup/backup-daily.sh`) → exit 2 cu lista completa a lipsurilor
- niciun secret in loguri: `... 2>&1 | grep -E "minioadmin|marketplace:marketplace|AGE-SECRET"` → gol

## 6. Storage (cheie limitata + versionare) pe un bucket de test

```bash
docker compose -f dev-infra/docker-compose.yml run --rm -v "$PWD/deploy/storage:/s" \
  -e MC_ALIAS_URL=http://minio:9000 -e MC_ROOT_USER=minioadmin -e MC_ROOT_PASSWORD=minioadmin \
  -e BUCKET=uploads-policy-test --entrypoint bash minio-init /s/setup-minio-uploads.sh   # rerulare = idempotenta
TEST_S3_ENDPOINT=http://127.0.0.1:9000 TEST_S3_BUCKET=uploads-policy-test \
  TEST_S3_ACCESS_KEY=<cheia cozy-app> TEST_S3_SECRET_KEY=<secretul cozy-app> \
  NODE_OPTIONS=--experimental-vm-modules pnpm -F backend exec jest storage.integration   # verde pe bucket versionat
```

Aceeasi cheie pe bucket-ul `uploads` → `AccessDenied` (dovada limitarii).
