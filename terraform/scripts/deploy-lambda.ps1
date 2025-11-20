# Deploy Lambda functions
$functions = @("profiles", "links", "upload")

foreach ($func in $functions) {
    Write-Host "Packaging $func..."
    
    # Create deployment package
    $zipPath = "../modules/lambda/$func.zip"
    $sourcePath = "../modules/lambda/$func"
    
    if (Test-Path $zipPath) {
        Remove-Item $zipPath
    }
    
    # Zip the function
    Compress-Archive -Path "$sourcePath/*" -DestinationPath $zipPath -Force
    
    Write-Host "$func packaged successfully"
}

Write-Host "All functions packaged. Run 'terraform apply' to deploy."