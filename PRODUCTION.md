# Jubilee OS: Production Guide

## 1. Secrets Management 🔐
Never run in production with default passwords.

1. **Generate Keys**:
   ```bash
   bun run scripts/generate-secret.ts
   ```
2. **Update .env**:
   Copy the generated keys into your `.env` file (server-side).

## 2. HTTPS & Gateway 🌐
We use Nginx as a reverse proxy ("The Gateway").

1. **Start the OS**:
   ```bash
   docker compose up --build -d
   ```
2. **Access**:
   *   **Frontend**: `http://localhost` (Port 80)
   *   **API**: `http://localhost/api` (Proxied to internal:3001)

### Enabling SSL (Let's Encrypt)
To enable HTTPS:
1.  Mount your certs in `docker-compose.yml` under `jubilee-gateway`.
2.  Update `nginx/default.conf` to listen on 443 and specify `ssl_certificate`.

## 3. Database Backups 💾
The database volume is `jubilee_db_data`.
*   **Backup**: `docker run --rm -v jubilee_db_data:/volume -v $(pwd):/backup alpine tar -czf /backup/db_backup.tar.gz /volume`
*   **Restore**: Reverse the process.
