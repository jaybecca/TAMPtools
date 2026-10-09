# Operations checklist

- Use AWS RDS PostgreSQL in production; SQLite is development-only.
- Enable automated backups and point-in-time recovery.
- Test restores regularly.
- Put uploaded/generated files in encrypted object storage with lifecycle rules.
- Keep secrets in AWS Secrets Manager/SSM or an equivalent secret manager.
- Use a durable queue/worker system when traffic grows beyond a single process.
- Configure error monitoring and alerting.
- Verify Paddle/Flutterwave webhook signatures and reconcile provider state periodically.
- Maintain AI budget/credit limits and abuse controls.
- Configure email domain authentication (SPF, DKIM, DMARC) before email delivery.
- Obtain and maintain each connected-service platform's production app permissions.
- Maintain a subprocessor register and legal change log.
