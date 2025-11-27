# Deploy Lambda functions
$functions = @("profiles", "links", "upload", "post-confirmation")

# Get script directory and resolve paths relative to it
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaBasePath = Join-Path (Split-Path -Parent $scriptDir) "modules\lambda"

foreach ($func in $functions) {
    Write-Host "Packaging $func..." -ForegroundColor Cyan
    
    # Create deployment package paths
    $zipPath = Join-Path $lambdaBasePath "$func.zip"
    $sourcePath = Join-Path $lambdaBasePath $func
    
    # Check if source directory exists
    if (-not (Test-Path $sourcePath)) {
        Write-Host "[ERROR] Source directory not found: $sourcePath" -ForegroundColor Red
        continue
    }
    
    # Remove existing zip if it exists
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
        Write-Host "  Removed existing $func.zip" -ForegroundColor Yellow
    }
    
    # Get all files in the directory (including hidden files)
    $files = Get-ChildItem -Path $sourcePath -File
    
    if ($files.Count -eq 0) {
        Write-Host "[WARNING] No files found in $sourcePath" -ForegroundColor Yellow
        continue
    }
    
    # Zip the function files
    try {
        $files | Compress-Archive -DestinationPath $zipPath -Force
        Write-Host "[SUCCESS] $func packaged successfully ($($files.Count) files)" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to package $func : $_" -ForegroundColor Red
    }
}

Write-Host "`nAll functions packaged. Run 'terraform apply' to deploy." -ForegroundColor Cyan