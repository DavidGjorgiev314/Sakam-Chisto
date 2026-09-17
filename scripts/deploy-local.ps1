[CmdletBinding()]
param(
    [string]$DockerHubUser = "sakamchisto",
    [string]$Tag = "local",
    [string]$ClusterName = "my-local-cluster",
    [string]$Namespace = "sakamchisto",
    [string]$HostName = "sakamchisto.local",
    [int]$IngressPort = 8081,
    [switch]$SkipBuild,
    [switch]$SkipImport
)

$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    $backendImage = "${DockerHubUser}/sakamchisto-backend:${Tag}"
    $frontendImage = "${DockerHubUser}/sakamchisto-frontend:${Tag}"

    if (-not $SkipBuild) {
        Write-Host "==> Building backend image $backendImage"
        docker build -t $backendImage ./backend
        if ($LASTEXITCODE -ne 0) { throw "backend image build failed (exit $LASTEXITCODE)" }

        Write-Host "==> Building frontend image $frontendImage"
        docker build -t $frontendImage ./frontend
        if ($LASTEXITCODE -ne 0) { throw "frontend image build failed (exit $LASTEXITCODE)" }
    }

    if (-not $SkipImport) {
        Write-Host "==> Importing images into k3d cluster $ClusterName"
        k3d image import $backendImage -c $ClusterName
        if ($LASTEXITCODE -ne 0) { throw "backend image import failed (exit $LASTEXITCODE)" }

        k3d image import $frontendImage -c $ClusterName
        if ($LASTEXITCODE -ne 0) { throw "frontend image import failed (exit $LASTEXITCODE)" }
    }

    Write-Host "==> Applying manifests"
    kubectl apply -f k8s/namespace.yaml
    if ($LASTEXITCODE -ne 0) { throw "namespace apply failed (exit $LASTEXITCODE)" }

    kubectl apply -k k8s
    if ($LASTEXITCODE -ne 0) { throw "kustomize apply failed (exit $LASTEXITCODE)" }

    Write-Host "==> Pointing deployments at tag $Tag"
    kubectl -n $Namespace set image "deployment/backend" "backend=$backendImage"
    if ($LASTEXITCODE -ne 0) { throw "backend image update failed (exit $LASTEXITCODE)" }

    kubectl -n $Namespace set image "deployment/frontend" "frontend=$frontendImage"
    if ($LASTEXITCODE -ne 0) { throw "frontend image update failed (exit $LASTEXITCODE)" }

    Write-Host "==> Waiting for rollout"
    kubectl -n $Namespace rollout status statefulset/postgres --timeout=300s
    kubectl -n $Namespace rollout status deployment/backend --timeout=300s
    kubectl -n $Namespace rollout status deployment/frontend --timeout=300s

    kubectl -n $Namespace get pods,service,ingress

    Write-Host ""
    Write-Host "Add this line to C:\Windows\System32\drivers\etc\hosts (as Administrator):"
    Write-Host "    127.0.0.1 $HostName"
    Write-Host "Then open http://${HostName}:${IngressPort}"
}
finally {
    Pop-Location
}
