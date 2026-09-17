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

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    $backendImage = "${DockerHubUser}/sakamchisto-backend:${Tag}"
    $frontendImage = "${DockerHubUser}/sakamchisto-frontend:${Tag}"

    if (-not $SkipBuild) {
        Write-Host "Building backend image $backendImage"
        docker build -t $backendImage ./backend
        if (-not $?) { throw "backend image build failed" }

        Write-Host "Building frontend image $frontendImage"
        docker build -t $frontendImage ./frontend
        if (-not $?) { throw "frontend image build failed" }
    }

    if (-not $SkipImport) {
        Write-Host "Importing images into k3d cluster $ClusterName"
        k3d image import $backendImage -c $ClusterName
        if (-not $?) { throw "backend image import failed" }

        k3d image import $frontendImage -c $ClusterName
        if (-not $?) { throw "frontend image import failed" }
    }

    Write-Host "Applying manifests"
    kubectl apply -f k8s/namespace.yaml
    if (-not $?) { throw "namespace apply failed" }

    kubectl apply -k k8s
    if (-not $?) { throw "kustomize apply failed" }

    Write-Host "Pointing deployments at $Tag"
    kubectl -n $Namespace set image "deployment/backend" "backend=$backendImage"
    if (-not $?) { throw "backend image update failed" }

    kubectl -n $Namespace set image "deployment/frontend" "frontend=$frontendImage"
    if (-not $?) { throw "frontend image update failed" }

    Write-Host "Waiting for rollout"
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
