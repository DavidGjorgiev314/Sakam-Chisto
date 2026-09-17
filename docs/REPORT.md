# Project Report - SakamChisto

**Course:** Continuous Integration and Delivery
**Topic:** Containerisation, orchestration and delivery of a three-service web application

---

## 1. Introduction

This report documents the containerisation, orchestration and continuous delivery setup built for **SakamChisto**, a web application for listing and managing cleaning service providers. The application already existed as a personal project; this work turns it into a reproducible, automatically delivered system.

The result is a repository that contains, alongside the application source:

- multi-stage Docker images for both application services,
- a Docker Compose file orchestrating the whole stack, including the database,
- a GitHub Actions pipeline that tests, builds, publishes images to Docker Hub and deploys them,
- a complete set of Kubernetes manifests, and
- evidence that the manifests run correctly in a dedicated namespace on a live cluster.

## 2. Application overview

SakamChisto is deliberately a **three-service** system, which satisfies the requirement that the chosen application comprise at least a frontend, a backend and a database.

| Service | Technology | Responsibility |
| --- | --- | --- |
| frontend | React 19, Vite 7, Tailwind CSS, nginx | Single-page interface, also acts as the reverse proxy for the API |
| backend | Spring Boot 3.5, Java 17, Spring Security, JPA/Hibernate | REST API, JWT authentication, photo upload handling |
| database | PostgreSQL 17 | Persists the `cleaner` and `users` tables |

### 2.1 Functional scope

- Registration and login issuing a 10-hour HS256 JSON Web Token.
- Public listing and detail views of cleaners, including photos.
- Admin-only create, update and delete operations, plus photo upload (multipart, 5 MB limit).
- A seeded `admin` / `admin123` account created on first boot.

### 2.2 Deployment topology

```
browser
   |
   v
Ingress (Traefik)  host: sakamchisto.local
   |                        \
   | path /                  \ path /api
   v                          v
frontend Service :80      backend Service :8080
   |                          |
frontend Pod (nginx) ------> backend Pod (Spring Boot)
                                  |
                             postgres Service :5432
                                  |
                             postgres-0 (StatefulSet)
```

The frontend nginx instance is the single entry point for the user interface. It serves the compiled SPA and reverse-proxies the API paths to the backend Service. Because everything is served from one origin, the browser performs no cross-origin requests in the deployed system, and CORS is never exercised.

### 2.3 A change required to make the application deployable

The original frontend hardcoded `http://localhost:8080` in thirteen places across five files. That works on a developer laptop but cannot work once the application runs anywhere else. All of these were replaced with a single origin-relative base (`frontend/src/lib/apiBase.js`), so the built bundle contains no absolute backend URL. During local development the Vite dev server proxies `/api`, `/cleaners` and `/uploads` to `localhost:8080`.

Likewise, the backend previously had its database credentials, JWT signing key, upload directory and CORS origin hardcoded in `application.properties`. These are now externalised as environment variables with development defaults:

```
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/sakamchisto}
jwt.secret=${JWT_SECRET:<development default>}
app.uploads.dir=${UPLOADS_DIR:uploads}
app.cors.allowed-origins=${CORS_ALLOWED_ORIGINS:http://localhost:5173}
```

The same artifact therefore runs unchanged in development, under Compose and in Kubernetes.

## 3. Git repository (10%)

The application is versioned in a public Git repository. Because the project previously had no commits, a root `.gitignore` was added first, covering IDE directories, Maven `target/`, `node_modules/`, build output, the runtime `uploads/` directory and all `.env` files. This prevented build artifacts, IDE metadata and user-uploaded images from entering version history.

Configuration that must not be public is kept out of the repository: `.env` is ignored while `.env.example` documents every required variable, and the frontend's `.env` was untracked in favour of a committed `.env.example`. Secrets that a cluster must materialise are supplied by Kubernetes Secrets rather than by checked-in property files.

The history is organised so that each deliverable is a separate, reviewable commit.

## 4. Containerisation (10%)

Both images use multi-stage builds so that no compiler, package manager or source code reaches the final image.

### 4.1 Backend image

Stage one uses `maven:3.9.11-eclipse-temurin-17`. It copies `pom.xml` and runs `dependency:go-offline` **before** copying the sources. Because dependency resolution depends only on the POM, that layer is cached across source-only changes, which makes routine rebuilds dramatically faster.

Stage two uses `eclipse-temurin:17-jre-alpine` - a runtime-only base. Additional hardening and operability measures:

- an unprivileged `app` user is created and the process runs as that user, so the container does not run as root;
- `/app/uploads` is created and owned by `app`, matching the mounted volume in later environments;
- `-XX:MaxRAMPercentage=75.0` and `-XX:+UseContainerSupport` make the JVM size its heap from the container's memory limit instead of the host's;
- a `HEALTHCHECK` polls the public `/cleaners` endpoint.

### 4.2 Frontend image

Stage one uses `node:22-alpine` and runs `npm ci` followed by `vite build`. `npm ci` is used rather than `npm install` so the locked dependency tree is installed reproducibly. Stage two is `nginx:1.27-alpine` with only the compiled static assets copied in.

### 4.3 nginx configuration

`frontend/nginx.conf` does more than serve files:

- `try_files $uri $uri/ /index.html` allows client-side routes such as `/cleaners/edit/3` to survive a browser refresh.
- `/api/` and `/uploads/` are proxied to `backend:8080` by prefix.
- The `/cleaners` API endpoints are matched by an explicit regular expression rather than a blanket `/cleaners` prefix. This is deliberate: a blanket prefix would also capture the SPA routes `/cleaners/add` and `/cleaners/edit/:id` and return API responses instead of the application. Matching only the numeric and verb forms (`/cleaners`, `/cleaners/{id}`, `/cleaners/{id}/upload-photo`, `/cleaners/delete/{id}`, `/cleaners/update/{id}`) keeps the two namespaces separate.
- `client_max_body_size` is raised to 10 MB so the 5 MB photo upload limit is not rejected by the proxy first, and gzip is enabled for text assets.

### 4.4 Build context hygiene

Both `.dockerignore` files exclude `target/`, `node_modules/`, `.git/` and, critically for the frontend, `.env`. Excluding `.env` guarantees that no developer-specific API URL is compiled into a published image.

A defect found during verification is worth recording: the initial frontend healthcheck used `wget http://localhost/`, which failed inside the container because `localhost` resolved to the IPv6 loopback `::1` while nginx listened on IPv4 only. The container therefore reported `unhealthy` even though it served traffic correctly. Both healthchecks now target `127.0.0.1`, which is unambiguous; all three services report `healthy`.

## 5. Orchestration with Docker Compose (10%)

`docker-compose.yml` defines the three services on a dedicated bridge network:

- **database** - `postgres:17-alpine`, a named volume for data, and a `pg_isready` healthcheck.
- **backend** - built from `./backend`, gated with `depends_on: condition: service_healthy` so it never starts against an unready database, and a named volume mounted at `/app/uploads` so uploaded photos survive container replacement.
- **frontend** - built from `./frontend`, published on `${APP_PORT}` (default 8080).

All credentials, the database URL and the JWT key are injected through environment variables read from `.env`, which is untracked. `JWT_SECRET` is declared as `${JWT_SECRET:?...}`, so Compose refuses to start rather than silently falling back to a development key.

**Verified:** `docker compose up -d --build --wait` brings all three containers to `healthy`. `GET /` returns the SPA, `POST /api/auth/login` returns a JWT, and `GET /cleaners` returns the cleaner list through the nginx proxy.

## 6. CI/CD pipeline (20% + CD bonus)

`.github/workflows/ci-cd.yml` implements a full CI/CD solution with GitHub Actions.

### 6.1 Triggers and control

Runs on pushes to `main`, on `v*` tags, on pull requests and on manual dispatch. A `concurrency` group cancels superseded runs on the same ref.

### 6.2 Jobs

| Job | Purpose | Runs when |
| --- | --- | --- |
| `backend` | Starts a PostgreSQL 17 service container and runs `./mvnw verify` on JDK 17 | always |
| `frontend` | `npm ci`, `npm run lint`, `npm run build`, then uploads the build output | always |
| `manifests` | Renders `k8s/` with `kubectl kustomize` and performs a server-side dry run | always |
| `publish` | Builds and pushes both images to Docker Hub | non-PR |
| `deploy` | Applies the manifests and rolls the Deployments onto the new image | `main` + deploy enabled |

Two details are worth highlighting. First, the backend tests genuinely require a database - the Spring Boot context test connects to the datasource - so the job provisions a real PostgreSQL service container instead of skipping tests. Second, the pipeline validates the Kubernetes manifests on every run, so a broken manifest is caught before it is ever applied to a cluster.

### 6.3 Publishing to the registry

The `publish` job authenticates to Docker Hub with a repository secret and uses `docker/build-push-action` with Buildx. Images are tagged:

- `latest` on the default branch,
- `sha-<full commit SHA>` for every build,
- semantic-version tags on `v*` releases.

Layer caching uses the GitHub Actions cache (`type=gha`) with a per-image scope, keeping build times low. The immutable `sha-` tag is what makes the rest of the pipeline safe: the exact image produced by a run is the exact image deployed, and rollback is a matter of pointing the Deployment at an earlier SHA.

### 6.4 Continuous deployment (bonus)

The `deploy` job decodes a base64 kubeconfig from the `KUBE_CONFIG` secret, applies `k8s/namespace.yaml` followed by `kubectl apply -k k8s`, sets both Deployments to the `sha-<commit>` image built in the same run, waits for the rollouts to complete with a 300-second timeout, and finally prints the cluster state.

The job is gated behind a repository variable, `DEPLOY_ENABLED`. This is a deliberate correctness decision rather than a convenience: a GitHub-hosted runner can only reach a cluster that is resolvable from the public internet, and a local development cluster is not. The gate means the pipeline stays green for anyone who has not yet supplied a reachable cluster, and the deployment path is enabled by pointing `KUBE_CONFIG` at a cloud cluster or by registering a self-hosted runner inside the target network.

### 6.5 Pipeline status

The `backend`, `frontend` and `manifests` jobs are the CI core. Everything they run has been executed locally on the same inputs: the Maven build and tests, `npm ci`, `npm run lint`, `npm run build`, and `kubectl kustomize k8s` all pass. The `publish` and `deploy` jobs require Docker Hub credentials and a reachable cluster, which are supplied as repository secrets when the repository is connected to GitHub.

## 7. Kubernetes manifests (40%)

The `k8s/` directory holds thirteen manifests assembled by `kustomization.yaml`, all deployed into the dedicated `sakamchisto` namespace.

### 7.1 Deployment for the application, with ConfigMaps and Secrets (10%)

`backend-deployment.yaml` and `frontend-deployment.yaml` define the application tier.

The backend Deployment is the more involved of the two:

- an `initContainer` (`wait-for-postgres`) runs `pg_isready` in a loop against the `postgres` Service, so the application never starts against an unavailable database;
- configuration arrives via `envFrom`, combining `backend-config` (ConfigMap) and `backend-secret` (Secret), which keeps non-sensitive and sensitive values in the correct object types;
- a PersistentVolumeClaim is mounted at `/app/uploads` so uploaded photos outlive the pod;
- readiness and liveness probes use HTTP `GET /cleaners`.

Both Deployments use a `RollingUpdate` strategy with `maxUnavailable: 0` and `maxSurge: 1`, which guarantees no request is served by nothing during a rollout, and pin `revisionHistoryLimit: 3` so rollbacks remain possible without unbounded ReplicaSet accumulation. Resource requests and limits are set on every container.

### 7.2 Service for the application (10%)

`backend-service.yaml` and `frontend-service.yaml` are `ClusterIP` services selecting their pods by the shared `app.kubernetes.io/name` label and exposing named ports (`http`), which the probes and the Ingress reference by name rather than by number.

### 7.3 Ingress for the application (10%)

`ingress.yaml` exposes the application under the host `sakamchisto.local` with two path rules:

- `/api` (Prefix) routes directly to the backend Service. No rewrite is needed because the backend already serves its authentication endpoints under `/api/auth/`; the prefix is forwarded verbatim.
- `/` (Prefix) routes to the frontend Service.

This gives path-based routing at the edge and, simultaneously, keeps the UI and API on one origin. It uses `ingressClassName: traefik`, matching the controller that k3s ships.

### 7.4 StatefulSet for the database, with ConfigMaps and Secrets (10%)

`postgres-statefulset.yaml` runs PostgreSQL as a StatefulSet rather than a Deployment, which is the correct choice for a database because it provides a stable pod identity (`postgres-0`) and, through `volumeClaimTemplates`, a PersistentVolumeClaim that is bound to that identity and re-attached when the pod is rescheduled.

- `postgres-config` (ConfigMap) supplies `PGDATA`, pointing the data directory at a subdirectory of the mount so the volume root is not clobbered, together with `POSTGRES_INITDB_ARGS`.
- `postgres-secret` (Secret) supplies the database name, user and password.
- A headless Service (`clusterIP: None`) governs the StatefulSet's network identity, while a separate `ClusterIP` Service named `postgres` gives the backend a stable DNS name to connect to. Splitting the two is the conventional pattern and avoids overloading the headless service.
- Readiness and liveness probes use `pg_isready`.

### 7.5 Kustomize

`kustomization.yaml` fixes the namespace, lists every resource and centralises the image tags, so promoting a new version is a single edit or a `kustomize edit set image` invocation rather than a search-and-replace across manifests. Notably, `kubectl apply -k` needs no additional tooling because Kustomize is built into kubectl.

## 8. Deployment and verification (10%)

The manifests were deployed to a dedicated namespace on a local **k3d** cluster (k3s in Docker) and verified end to end.

### 8.1 Procedure

```bash
k3d cluster create my-local-cluster --agents 1 -p "8081:80@loadbalancer"
./scripts/deploy-local.ps1 -DockerHubUser sakamchisto -Tag local
```

The helper script builds both images, imports them into the cluster, applies the manifests, retargets the Deployments at the freshly built tags and waits for the rollouts. Port 8081 is used for the load balancer because Windows reserves port 80 for WinNAT; the same walkthrough is valid on Linux with `-p "80:80@loadbalancer"`.

### 8.2 Results

All objects were created successfully in the `sakamchisto` namespace:

```
pod/backend                      1/1  Running
pod/frontend                     1/1  Running
pod/postgres-0                   1/1  Running
service/backend                  ClusterIP  10.43.206.7   8080/TCP
service/frontend                 ClusterIP  10.43.70.213  80/TCP
service/postgres                 ClusterIP  10.43.12.72   5432/TCP
service/postgres-headless        ClusterIP  None          5432/TCP
deployment.apps/backend          1/1
deployment.apps/frontend         1/1
statefulset.apps/postgres        1/1
ingress/sakamchisto  traefik  sakamchisto.local
```

Functional checks, all passing:

| # | Check | Result |
| --- | --- | --- |
| 1 | `GET /` through the Ingress | `200`, SPA HTML with correct asset links |
| 2 | `POST /api/auth/login` through the Ingress `/api` path | `200`, valid JWT returned |
| 3 | `GET /cleaners` through the Ingress to nginx and on to the backend | `200`, cleaner list |
| 4 | SPA route `/cleaners/add` | `200 text/html` - correctly not captured by the API proxy |
| 5 | `POST /cleaners` then `POST /cleaners/1/upload-photo` with a JWT | `200`, photo stored |
| 6 | `GET /uploads/...` for the uploaded photo | `200 image/jpeg`, 218217 bytes |
| 7 | Same file present on the PVC inside the backend pod | present, owned by `app` |
| 8 | `DELETE /cleaners/delete/1` without a token | `403`, JWT enforcement confirmed |
| 9 | Row readable from PostgreSQL via `psql` | present with correct `image_url` |

### 8.3 Persistence proof

To demonstrate that the StatefulSet and its volume claim genuinely persist data, the database pod was deleted outright:

```
kubectl -n sakamchisto delete pod postgres-0
```

Kubernetes recreated `postgres-0`, and it was scheduled onto a **different node** (`k3d-my-local-cluster-agent-0`) than before. Both PVCs remained `Bound` to their original volumes. After the pod returned, the cleaner row and its photo URL were still present, and the API served the record correctly:

```json
[{"id":1,"name":"Ana","surname":"Test","imageUrl":"/uploads/cleaner_1_cleaner_1_IMG_20250605_230946.jpg","pricePerHour":12.5}]
```

This confirms the database is not storing state in the container filesystem, and that the uploads volume is shared correctly between the API and its storage.

## 9. Scoring summary

| Requirement | Weight | Where |
| --- | --- | --- |
| Public Git repository | 10% | Repository root, `.gitignore`, structured commit history |
| Containerised application | 10% | `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` |
| Docker Compose orchestration | 10% | `docker-compose.yml`, `.env.example` |
| CI/CD pipeline with registry publish | 20% | `.github/workflows/ci-cd.yml` |
| Deployment + ConfigMaps/Secrets | 10% | `k8s/backend-deployment.yaml`, `backend-configmap.yaml`, `backend-secret.yaml`, `frontend-deployment.yaml` |
| Service | 10% | `k8s/backend-service.yaml`, `k8s/frontend-service.yaml` |
| Ingress | 10% | `k8s/ingress.yaml` |
| StatefulSet + ConfigMaps/Secrets | 10% | `k8s/postgres-statefulset.yaml`, `postgres-configmap.yaml`, `postgres-secret.yaml` |
| Deploy to namespace and demonstrate | 10% | Section 8 |
| CD bonus | - | `deploy` job in the pipeline, `scripts/deploy-local.ps1` |

## 10. Design decisions distinguishing this work

The assignment requires that configurations differ from those used in lectures and tutorials. The following choices are deliberate and are worth naming explicitly in the presentation:

1. **Dependency-first layer caching.** The backend Dockerfile resolves Maven dependencies from `pom.xml` alone before copying sources, so source edits do not invalidate the dependency layer.
2. **Non-root runtime user** in the backend image, with an explicitly owned uploads directory.
3. **Container-aware JVM sizing** via `MaxRAMPercentage` and `UseContainerSupport`.
4. **Regex-scoped API proxying in nginx.** Rather than a blanket `/cleaners` proxy prefix, the configuration distinguishes API endpoints from SPA routes so that deep links are not swallowed by the proxy.
5. **Origin-relative frontend.** No absolute API URL is compiled into the bundle; the same artifact is deployed everywhere.
6. **Dual database Services.** A headless Service for the StatefulSet plus a separate ClusterIP Service for clients.
7. **`initContainer` database gating** in addition to an HTTP readiness probe, preventing a boot against an unready database rather than merely detecting it.
8. **PVC-backed uploads**, so application storage is a first-class Kubernetes resource rather than container-local state.
9. **Kustomize** for manifest composition and centralised image tags, applied with the kustomize built into `kubectl`.
10. **Semantic-version plus immutable SHA tagging**, with the deployed tag being exactly the tag built in the same pipeline run.
11. **Manifest validation as a CI job**, so invalid YAML fails the pipeline instead of the cluster.
12. **Explicit `DEPLOY_ENABLED` gate**, which keeps the pipeline honest about clusters it cannot reach.

## 11. Known limitations and next steps

- **Secret handling.** Secret values live in the manifests as placeholders and must be set before deployment. In a production context these would be replaced by Sealed Secrets, External Secrets Operator or SOPS, so that no credential is ever committed. This is the main security improvement to make.
- **Single replica for the backend.** The uploads PVC uses `ReadWriteOnce`, so the backend runs one replica. Multi-replica would require a `ReadWriteMany` volume or, more appropriately, object storage such as S3 or MinIO for uploads.
- **Schema management.** Hibernate still runs with `ddl-auto=update`. A versioned migration tool such as Flyway or Liquibase would be the correct approach for a system with a stable schema.
- **Database backups.** The StatefulSet provides durable storage but no backup or point-in-time recovery, which would be needed for real use.
- **TLS.** The Ingress is HTTP-only; production would add a certificate manager and terminate TLS at the edge.
- **Pre-existing credentials.** The seeded administrator account uses a well-known default password and the original application logged login attempts to standard output; both should be removed before any public deployment.

## 12. Conclusion

SakamChisto is now fully containerised, orchestrated and automatically deliverable. Both application images are built from multi-stage Dockerfiles and published to a registry by a GitHub Actions pipeline that tests, publishes and can deploy automatically. The complete stack runs either under Docker Compose or on Kubernetes from a single set of manifests, and it has been demonstrated working in a dedicated namespace with the database surviving the destruction of its pod.
