# Script to check CloudWatch logs for API Gateway and Lambda
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "CloudWatch Logs Checker" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

# Get project name from Terraform
$projectName = terraform output -raw project_name 2>$null
if (-not $projectName) {
    $projectName = "proLink"
    Write-Host "[INFO] Using default project name: $projectName" -ForegroundColor Yellow
}

Write-Host "`nChecking logs for project: $projectName" -ForegroundColor Yellow
Write-Host "`nTo view logs in AWS Console:" -ForegroundColor Cyan
Write-Host "1. API Gateway Access Logs:" -ForegroundColor White
Write-Host "   /aws/apigateway/$projectName-api" -ForegroundColor Gray
Write-Host "`n2. Lambda Function Logs:" -ForegroundColor White
Write-Host "   /aws/lambda/$projectName-profiles" -ForegroundColor Gray

Write-Host "`nRecent log entries (if AWS CLI is configured):" -ForegroundColor Yellow

# Check if AWS CLI is available
$awsCliAvailable = Get-Command aws -ErrorAction SilentlyContinue
if ($awsCliAvailable) {
    Write-Host "`nFetching recent Lambda logs..." -ForegroundColor Cyan
    try {
        $logGroup = "/aws/lambda/$projectName-profiles"
        $logs = aws logs tail $logGroup --since 10m --format short 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host $logs -ForegroundColor White
        } else {
            Write-Host "[INFO] No recent logs found or log group doesn't exist yet" -ForegroundColor Yellow
            Write-Host "Make sure the Lambda has been invoked at least once" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARNING] Could not fetch logs. Make sure AWS CLI is configured." -ForegroundColor Yellow
    }
    
    Write-Host "`nFetching recent API Gateway access logs..." -ForegroundColor Cyan
    try {
        $logGroup = "/aws/apigateway/$projectName-api"
        $logs = aws logs tail $logGroup --since 10m --format short 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host $logs -ForegroundColor White
        } else {
            Write-Host "[INFO] No recent logs found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARNING] Could not fetch API Gateway logs" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] AWS CLI not found. Install AWS CLI to view logs from command line." -ForegroundColor Yellow
    Write-Host "Or view logs directly in AWS Console:" -ForegroundColor Yellow
    Write-Host "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups" -ForegroundColor Cyan
}

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "Look for:" -ForegroundColor Yellow
Write-Host "- 'OPTIONS REQUEST DETECTED' in Lambda logs" -ForegroundColor White
Write-Host "- 'LAMBDA INVOCATION START' in Lambda logs" -ForegroundColor White
Write-Host "- Status codes in API Gateway access logs" -ForegroundColor White
Write-Host "- Any error messages" -ForegroundColor White
Write-Host "=" * 80 -ForegroundColor Cyan

