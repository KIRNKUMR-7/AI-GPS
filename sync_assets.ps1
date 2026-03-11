$root = "d:\KIRN'S FOLDER\Project's\guardian-angel-alert"
$dist = Join-Path $root "dist"
$target = Join-Path $root "android\app\src\main\assets\public"

Write-Host "Syncing assets..."
if (Test-Path $target) {
    Remove-Item -Recurse -Force (Join-Path $target "*")
} else {
    New-Item -ItemType Directory -Force $target
}
Copy-Item -Recurse (Join-Path $dist "*") $target
Write-Host "Done."
