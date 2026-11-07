# TAMPtools DevSecOps

## CI gates

Every pull request runs:

1. Node.js product validation and backend tests.
2. Gitleaks full-history secret detection.
3. npm audit (high and critical vulnerabilities fail the check).
4. Docker image build and Trivy filesystem/image vulnerability and secret scans.
5. Trivy Kubernetes manifest misconfiguration scan.
6. Minikube deployment and HTTP health smoke test.
7. SonarQube analysis when the repository is connected to a SonarQube Server or SonarQube Cloud project.

Security findings are not suppressed to make a pipeline green. Resolve or explicitly review each finding before merging.

## Docker local development

Requirements: Docker Engine/Desktop with Compose v2.

\`\`\`bash
docker compose up --build -d
docker compose ps
curl --fail http://localhost:4000/api/health
docker compose logs -f app
docker compose down
\`\`\`

The Compose stack starts the API, PostgreSQL, Redis and BullMQ worker. It uses local-only development credentials; replace them before any shared deployment. Named volumes preserve the local database, queue and uploaded files.

## Kubernetes deployment

The manifests in k8s/ create a namespace, PostgreSQL StatefulSet with persistent storage, Redis, API and worker Deployments, health probes, resource limits, non-root application containers and a ClusterIP Service.

Create a Kubernetes Secret before applying the workloads. Supply real values privately; never commit a populated Secret manifest:

\`\`\`bash
kubectl apply -f k8s/namespace.yaml
kubectl -n tamptools create secret generic tamptools-runtime \\
  --from-literal=POSTGRES_DB='tamptools' \\
  --from-literal=POSTGRES_USER='tamptools' \\
  --from-literal=POSTGRES_PASSWORD='REPLACE_WITH_STRONG_PASSWORD' \\
  --from-literal=DATABASE_URL='postgresql://tamptools:URL_ENCODED_PASSWORD@postgres:5432/tamptools' \\
  --from-literal=APP_BASE_URL='https://YOUR_API_DOMAIN' \\
  --from-literal=PUBLIC_APP_URL='https://YOUR_PUBLIC_APP_DOMAIN' \\
  --from-literal=FRONTEND_ORIGIN='https://YOUR_FRONTEND_DOMAIN' \\
  --from-literal=FRONTEND_ORIGINS='https://YOUR_FRONTEND_DOMAIN'
kubectl apply -f k8s/
kubectl -n tamptools rollout status statefulset/postgres
kubectl -n tamptools rollout status deployment/redis
kubectl -n tamptools rollout status deployment/tamptools
kubectl -n tamptools rollout status deployment/tamptools-worker
\`\`\`

Build and publish the root Dockerfile to your container registry, then update image in k8s/app.yaml to the immutable image tag or digest before production deployment. Configure TLS/Ingress, backups, monitoring and a production-grade Redis deployment for a public production environment. The included Redis workload is a starter single-replica deployment, not HA.

The application currently stores advert uploads and local user files on mounted persistent storage. For horizontally scaled production, configure the existing Cloudflare R2 storage integration and a shared/object-backed advert upload strategy before scaling API replicas. The included PVC uses ReadWriteOnce; it is suitable for a single API replica and is not a shared multi-node file system.

## SonarQube connection

Create a project in SonarQube Server or SonarQube Cloud, then add:

- Repository secret SONAR_TOKEN
- Repository variable SONAR_PROJECT_KEY
- Repository variable SONAR_HOST_URL only for self-hosted SonarQube Server

The workflow skips the scan if these are not configured. Once configured, the scan waits for the quality gate and fails the job when the gate fails.

## Security notes

- Never put database passwords, OAuth secrets, API keys or Sonar tokens in Git.
- Rotate the sample Compose password before sharing the stack.
- Keep npm audit, Trivy and Gitleaks blocking checks enabled.
- The API and worker run as the unprivileged node user in the supplied image.


## Dependency lockfiles

The repository maintains both the root and backend npm manifests for the supported root-level and backend-level workflows. Keep both lockfiles aligned when upgrading runtime packages. CI verifies the backend install/test path and Trivy scans both lockfiles; the dependency refresh step regenerates the root lockfile from the root manifest before the remaining gates run.
