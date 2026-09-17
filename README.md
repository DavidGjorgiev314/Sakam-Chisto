# SakamChisto

A cleaner-booking web application built as a three-service system: a React single-page frontend, a Spring Boot REST backend and a PostgreSQL database.

This repository contains the full containerisation, orchestration and delivery setup for the *Continuous Integration and Delivery* course project.

## Contents

| Deliverable | Location |
| --- | --- |
| Application source | `backend/`, `frontend/` |
| Docker images | `backend/Dockerfile`, `frontend/Dockerfile` |
| Orchestration | `docker-compose.yml` |
| CI/CD pipeline | `.github/workflows/ci-cd.yml` |
| Kubernetes manifests | `k8s/` |
| Local deploy helper | `scripts/deploy-local.ps1` |

## Architecture

```
                      +---------------------------------------------+
   browser  ------>   |  Ingress (Traefik)  host: sakamchisto.local  |
                      +---------------------+-----------------------+
                                            |
                          path /            |            path /api
                                            v                       v
                                 +------------------+    +--------------------+
                                 | frontend Service |    | backend Service    |
                                 |      :80         |    |      :8080         |
                                 +--------+---------+    +---------+----------+
                                          |                        |
                                 +--------v---------+              |
                                 | frontend Pod     |              |
                                 | nginx + built SPA|              |
                                 |                  |              |
                                 | /api, /cleaners, |              |
                                 | /uploads proxy --+--------------+
                                 +------------------+
                                                                   |
                                                          +--------v---------+
                                                          | backend Pod      |
                                                          | Spring Boot REST |
                                                          | PVC: /app/uploads|
                                                          +--------+---------+
                                                                   |
                                                          +--------v---------+
                                                          | postgres-0       |
                                                          | StatefulSet      |
                                                          | PVC: /var/lib/...|
                                                          +------------------+
```

Three services:

1. **frontend** - React 19 + Vite, compiled to static files and served by nginx. nginx also acts as a reverse proxy for the backend.
2. **backend** - Spring Boot 3.5 REST API (Java 17) with JWT authentication, JPA/Hibernate and file uploads.
3. **database** - PostgreSQL 17, holding the `cleaner` and `users` tables.

Because the frontend is served from the same origin as the API, the browser never issues a cross-origin request in a deployed environment.

## Prerequisites

- Docker Desktop (with the Linux container engine)
- Node.js 22 and JDK 17 for local development
- `kubectl` and, for the local cluster demo, `k3d`

## Local development

Both halves run directly on the host and talk to a local PostgreSQL on port 5432.

```bash
# backend, from backend/
./mvnw spring-boot:run          # http://localhost:8080

# frontend, from frontend/
npm install
npm run dev                     # http://localhost:5173
```

The Vite dev server proxies `/api`, `/cleaners` and `/uploads` to `http://localhost:8080`, so no absolute backend URL is ever compiled into the application. Set `VITE_API_BASE` in `frontend/.env` only if you want to bypass the proxy and call a different origin.

The backend reads its configuration from the environment. Every value has a development default, so `application.properties` needs no editing:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/sakamchisto` | JDBC connection string |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | `admin` | Database password |
| `JWT_SECRET` | development key | HS256 signing key, minimum 32 characters |
| `UPLOADS_DIR` | `uploads` | Directory for uploaded photos |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `JPA_SHOW_SQL` | `true` | Log generated SQL |

## Containerisation

Both images are multi-stage builds, so no build toolchain or source code reaches the final layer.

**Backend** - `backend/Dockerfile`
- Stage 1: `maven:3.9.11-eclipse-temurin-17` resolves dependencies against `pom.xml` first, so the dependency layer is cached across source-only changes, then builds the fat jar.
- Stage 2: `eclipse-temurin:17-jre-alpine`, a JRE-only image, running as an unprivileged `app` user.
- `-XX:MaxRAMPercentage=75.0` and `-XX:+UseContainerSupport` make the JVM respect the container memory limit.
- A `HEALTHCHECK` polls `/cleaners`.

**Frontend** - `frontend/Dockerfile`
- Stage 1: `node:22-alpine` runs `npm ci` and `vite build`.
- Stage 2: `nginx:1.27-alpine` serving the compiled assets.

**nginx** - `frontend/nginx.conf`
- Serves the SPA with `try_files ... /index.html` so client-side routes survive a page refresh.
- Proxies the API. `/api/` and `/uploads/` are proxied by prefix; the `/cleaners` endpoints are matched by an explicit regular expression so that the SPA routes `/cleaners/add` and `/cleaners/edit/:id` are *not* swallowed by the proxy.
- Raises `client_max_body_size` to 10m to allow 5MB photo uploads, and enables gzip.

Build them manually with:

```bash
docker build -t sakamchisto/sakamchisto-backend:local  ./backend
docker build -t sakamchisto/sakamchisto-frontend:local ./frontend
```

## Orchestration with Docker Compose

```bash
cp .env.example .env      # then edit the values, especially JWT_SECRET
docker compose up -d --build
docker compose ps
```

`docker-compose.yml` defines the three services:

- `database` - PostgreSQL 17 with a named volume for data and a `pg_isready` healthcheck.
- `backend` - built from `./backend`, starts only after the database reports healthy (`depends_on: condition: service_healthy`), with a named volume mounted at `/app/uploads`.
- `frontend` - built from `./frontend`, published on `APP_PORT` (default 8080).

Open <http://localhost:8080>. The default administrator account is `admin` / `admin123`.

Tear down with `docker compose down`, or `docker compose down -v` to also remove the volumes.

## CI/CD pipeline

`.github/workflows/ci-cd.yml` runs on every push to `main`, on tags matching `v*`, on pull requests and on manual dispatch. Pull requests run the validation jobs only; publishing and deploying happen on pushes.

| Job | What it does |
| --- | --- |
| `backend` | Spins up a PostgreSQL 17 service container and runs `./mvnw verify` on JDK 17 |
| `frontend` | `npm ci`, `npm run lint`, `npm run build`, uploads the build output |
| `manifests` | Renders `k8s/` with `kubectl kustomize` and runs a server-side dry run |
| `publish` | Builds both images with Buildx and pushes them to Docker Hub, tagged `latest`, `sha-<commit>` and semver on version tags, using the GitHub Actions layer cache |
| `deploy` | Applies `k8s/`, rolls the Deployments onto the `sha-<commit>` images and waits for the rollout to complete |

### Repository configuration

Add these under **Settings -> Secrets and variables -> Actions**.

Secrets:

| Name | Value |
| --- | --- |
| `DOCKERHUB_USERNAME` | Your Docker Hub account name |
| `DOCKERHUB_TOKEN` | A Docker Hub access token with read/write scope |
| `KUBE_CONFIG` | Your kubeconfig, base64 encoded |

Variables:

| Name | Value |
| --- | --- |
| `DEPLOY_ENABLED` | `true` to enable the `deploy` job |

The `deploy` job is gated behind `DEPLOY_ENABLED` because a GitHub-hosted runner can only reach a cluster that is publicly resolvable. Point `KUBE_CONFIG` at a cloud cluster, or register a self-hosted runner inside your own network, and then flip the variable to `true`.

Generate the kubeconfig secret value with:

```bash
kubectl config view --raw --minify | base64 -w 0
```

## Kubernetes

All manifests live in `k8s/` and are wired together with `kustomization.yaml`.

| File | Kind | Notes |
| --- | --- | --- |
| `namespace.yaml` | Namespace | Dedicated `sakamchisto` namespace |
| `postgres-statefulset.yaml` | StatefulSet | Stable pod identity `postgres-0`, `volumeClaimTemplates` for durable storage, `pg_isready` probes |
| `postgres-configmap.yaml` | ConfigMap | `PGDATA` and init arguments |
| `postgres-secret.yaml` | Secret | Database name, user and password |
| `postgres-service.yaml` | Service | Headless service for the StatefulSet plus a ClusterIP service for clients |
| `backend-deployment.yaml` | Deployment | `wait-for-postgres` initContainer, ConfigMap and Secret via `envFrom`, PVC mounted at `/app/uploads`, HTTP probes |
| `backend-configmap.yaml` | ConfigMap | JDBC URL, upload directory, CORS origins |
| `backend-secret.yaml` | Secret | Database credentials and the JWT signing key |
| `backend-pvc.yaml` | PersistentVolumeClaim | Persistent storage for uploaded photos |
| `backend-service.yaml` | Service | ClusterIP on 8080 |
| `frontend-deployment.yaml` | Deployment | nginx serving the SPA |
| `frontend-service.yaml` | Service | ClusterIP on 80 |
| `ingress.yaml` | Ingress | Routes `/api` to the backend service and `/` to the frontend service |

Before deploying, replace `your-dockerhub-username` in `k8s/backend-deployment.yaml`, `k8s/frontend-deployment.yaml` and `k8s/kustomization.yaml`, and set real values in `k8s/postgres-secret.yaml` and `k8s/backend-secret.yaml`. The JWT key must match the database password convention used above and be at least 32 characters.

### Deploying

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -k k8s
kubectl -n sakamchisto get pods,service,ingress
```

### Local cluster walkthrough (k3d)

The helper script builds both images, imports them into a k3d cluster, applies the manifests, points the Deployments at the freshly built tags and waits for the rollout.

```bash
k3d cluster create my-local-cluster --agents 1 -p "8081:80@loadbalancer"
./scripts/deploy-local.ps1 -DockerHubUser sakamchisto -Tag local
```

Then map the ingress host and open the application:

```
127.0.0.1 sakamchisto.local      # add to C:\Windows\System32\drivers\etc\hosts
```

<http://sakamchisto.local:8081>

Port 8081 is used because Windows reserves port 80 for WinNAT; any free port works as long as it matches the `-p` flag given to `k3d cluster create`.

Useful commands:

```bash
kubectl -n sakamchisto get all
kubectl -n sakamchisto logs deploy/backend
kubectl -n sakamchisto describe ingress sakamchisto
kubectl -n sakamchisto exec postgres-0 -- psql -U postgres -d sakamchisto -c '\dt'
k3d cluster delete my-local-cluster
```

## API summary

| Method | Path | Authentication |
| --- | --- | --- |
| POST | `/api/auth/register` | none |
| POST | `/api/auth/login` | none |
| GET | `/cleaners` | none |
| GET | `/cleaners/{id}` | none |
| POST | `/cleaners` | none |
| PUT | `/cleaners/update/{id}` | JWT |
| DELETE | `/cleaners/delete/{id}` | JWT |
| POST | `/cleaners/{id}/upload-photo` | JWT |
| GET | `/uploads/{file}` | none |

Log in with `admin` / `admin123`, then send the returned token as `Authorization: Bearer <token>`.
