# TAMPtools DevSecOps

## CI gates

Every pull request runs:

1. Node.js product validation and backend tests.
2. Gitleaks full-history secret detection.
3. npm audit (high and critical vulnerabilities fail the check).
4. Docker image build and Trivy filesystem/image vulnerability and secret scans.
5. Trivy Kubernetes manifest misconfiguration scan.
6. Minikube deployment and HTTP health smoke test, including the monitoring stack.
7. SonarQube analysis when the repository is connected to a SonarQube Server or SonarQube Cloud project.

Security findings are not suppressed to make a pipeline green. Resolve or explicitly review each finding before merging.

## Docker local development

Requirements: Docker Engine/Desktop with Compose v2.

```bash
# Optional: set a non-default Grafana password before starting.
export GRAFANA_ADMIN_PASSWORD='replace-with-a-strong-local-password'
docker compose up --build -d
docker compose ps
curl --fail http://localhost:4000/api/health
docker compose logs -f app
```

The Compose stack starts the API, PostgreSQL, Redis, BullMQ worker, Prometheus, Grafana and Blackbox Exporter. Prometheus checks the API health endpoint through Blackbox Exporter and also scrapes its own and Grafana's metrics. Grafana is preconfigured with Prometheus as its data source.

- TAMPtools API: http://localhost:4000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (user `admin`; password from `GRAFANA_ADMIN_PASSWORD`, or the local-only fallback)

Prometheus retains 15 days of time-series data. Named volumes preserve the database, queue, uploads, Prometheus data and Grafana data. Replace all local-only credentials before sharing or deploying this stack.

Stop the stack with `docker compose down`. Add `-v` only when you intentionally want to delete its persistent volumes.

## Kubernetes deployment

The manifests in k8s/ create the namespace, PostgreSQL StatefulSet with persistent storage, Redis, API and worker Deployments, Prometheus, Grafana and Blackbox Exporter. Prometheus probes the API health endpoint; Grafana is provisioned with Prometheus as its default data source. Prometheus and Grafana data use persistent volume claims.

Create the application and monitoring Secrets before applying the workloads. Supply real values privately; never commit populated Secret manifests:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n tamptools create secret generic tamptools-runtime \
  --from-literal=POSTGRES_DB='tamptools' \
  --from-literal=POSTGRES_USER='tamptools' \
  --from-literal=POSTGRES_PASSWORD='REPLACE_WITH_STRONG_PASSWORD' \
  --from-literal=DATABASE_URL='postgresql://tamptools:URL_ENCODED_PASSWORD@postgres:5432/tamptools' \
  --from-literal=APP_BASE_URL='https://YOUR_API_DOMAIN' \
  --from-literal=PUBLIC_APP_URL='https://YOUR_PUBLIC_APP_DOMAIN' \
  --from-literal=FRONTEND_ORIGIN='https://YOUR_FRONTEND_DOMAIN' \
  --from-literal=FRONTEND_ORIGINS='https://YOUR_FRONTEND_DOMAIN'
kubectl -n tamptools create secret generic tamptools-monitoring \
  --from-literal=GRAFANA_ADMIN_PASSWORD='REPLACE_WITH_A_STRONG_PASSWORD'
kubectl apply -f k8s/
kubectl -n tamptools rollout status statefulset/postgres
kubectl -n tamptools rollout status deployment/redis
kubectl -n tamptools rollout status deployment/tamptools
kubectl -n tamptools rollout status deployment/tamptools-worker
kubectl -n tamptools rollout status deployment/blackbox-exporter
kubectl -n tamptools rollout status deployment/prometheus
kubectl -n tamptools rollout status deployment/grafana
```

Access the dashboards locally with port forwarding:

```bash
kubectl -n tamptools port-forward service/prometheus 9090:9090
kubectl -n tamptools port-forward service/grafana 3000:3000
```

Build and publish the root Dockerfile to your container registry, then update image in k8s/app.yaml to the immutable image tag or digest before production deployment. Configure TLS/Ingress, backups, production Redis HA and appropriate access controls before exposing monitoring dashboards publicly.

The application currently stores advert uploads and local user files on mounted persistent storage. For horizontally scaled production, configure the existing Cloudflare R2 storage integration and a shared/object-backed advert upload strategy before scaling API replicas. The included PVC uses ReadWriteOnce; it is suitable for a single API replica and is not a shared multi-node file system.

## SonarQube connection

Create a project in SonarQube Server or SonarQube Cloud, then add:

- Repository secret SONAR_TOKEN
- Repository variable SONAR_PROJECT_KEY
- Repository variable SONAR_ORGANIZATION

The workflow skips the scan if these are not configured. Once configured, the scan waits for the quality gate and fails the job when the gate fails.

## Security notes

- Never put database passwords, OAuth secrets, API keys or Sonar tokens in Git.
- Rotate the sample Compose password before sharing the stack.
- Keep npm audit, Trivy and Gitleaks blocking checks enabled.
- The API and worker run as the unprivileged node user in the supplied image.

## Dependency lockfiles

The repository maintains both the root and backend npm manifests for the supported root-level and backend-level workflows. Keep both lockfiles aligned when upgrading runtime packages. CI verifies the backend install/test path and Trivy scans both lockfiles; the dependency refresh step regenerates the root lockfile from the root manifest before the remaining gates run.
