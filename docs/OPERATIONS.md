# Production operations

## Deploy gate

Before deployment run `npm test`, `npm run test:bot`, and `npm run test:e2e` from the repository root. Apply Prisma migrations before starting the new backend image. Never enable `NEWS_AGGREGATOR_AUTO_PUBLISH` until REVIEW quality is consistently acceptable.

## Backup and restore

1. Enable Railway PostgreSQL backups or snapshots when the plan supports them.
2. Until then, create an encrypted daily `pg_dump --format=custom --no-owner` from a trusted machine and store it outside Railway.
3. Keep at least 7 daily and 4 weekly backups.
4. Every month restore the newest backup into a disposable PostgreSQL database and run `SELECT COUNT(*)` for `Article`, `User`, `MediaFile`, and `WebPushSubscription`.
5. Record the restore date, duration, and row counts. A backup that has not been restored in a test is not considered verified.

## Monitoring

GitHub Actions calls the public site and `/api/health` every 30 minutes. The health response verifies PostgreSQL and Redis. Railway logs contain JSON entries for failed or slower-than-1.5-second HTTP requests and include `X-Request-ID` for correlation.

## Secrets

Use unique random values for access JWT, refresh JWT, bot service secret, PostgreSQL, VAPID, OpenAI, and Telegram. Rotate any secret that appears in chat, screenshots, logs, or git history. After refresh-JWT rotation all admins must sign in again and reconfigure 2FA if encrypted TOTP secrets can no longer be opened.

## Incident checklist

1. Disable aggregator and scheduled publishing if bad content is spreading.
2. Revoke the affected secret and all active refresh tokens.
3. Save Railway logs and the admin audit log before cleanup.
4. Restore only after validating the backup in an isolated database.
5. Publish a correction when an incident affected reader-visible content.
