# Deploy LinkUp transactional Edge Functions that send via Resend (Windows PowerShell).
# Shares RESEND_* secrets with notification-email in the linkup repo.
#
# Run from linkup-web root:  .\scripts\deploy-transactional-email.ps1
#
# Production sender (verified domain):  LinkUp <noreply@flowdecklabs.com>
# Dev-only sandbox (Resend signup email only):  LinkUp <onboarding@resend.dev>

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$projectRef = "othikifibhjpfgyxpzcu"

$resendKey = $env:RESEND_API_KEY
if (-not $resendKey) {
  $resendKey = Read-Host "Paste your Resend API key (re_...)"
}

$resendFrom = $env:RESEND_FROM
if (-not $resendFrom) {
  Write-Host ""
  Write-Host "Recommended production sender (verified flowdecklabs.com in Resend):"
  Write-Host "  LinkUp <noreply@flowdecklabs.com>"
  Write-Host ""
  Write-Host "Dev sandbox (only delivers to your Resend account email):"
  Write-Host "  LinkUp <onboarding@resend.dev>"
  Write-Host ""
  $input = Read-Host 'RESEND_FROM (Enter = LinkUp <noreply@flowdecklabs.com>)'
  if ([string]::IsNullOrWhiteSpace($input)) {
    $resendFrom = 'LinkUp <noreply@flowdecklabs.com>'
  } else {
    if ($input -match '@' -and $input -notmatch '[<>]') {
      $resendFrom = "LinkUp <$input>"
    } else {
      $resendFrom = $input
    }
  }
}

$appUrl = $env:APP_URL
if (-not $appUrl) {
  $appUrl = Read-Host "APP_URL for invitation magic links (Enter = https://linkup-web-eight.vercel.app)"
  if ([string]::IsNullOrWhiteSpace($appUrl)) {
    $appUrl = "https://linkup-web-eight.vercel.app"
  }
}

Write-Host "`nSetting shared transactional email secrets..."
npx supabase secrets set "RESEND_API_KEY=$resendKey" --project-ref $projectRef
npx supabase secrets set "RESEND_FROM=$resendFrom" --project-ref $projectRef
npx supabase secrets set "APP_URL=$appUrl" --project-ref $projectRef

Write-Host "`nDeploying send-plan-invitation-email..."
npx supabase functions deploy send-plan-invitation-email --project-ref $projectRef

Write-Host "`nDeploying send-meet-type-email..."
npx supabase functions deploy send-meet-type-email --project-ref $projectRef

Write-Host "`nDone."
Write-Host "notification-email (in-app notification copies) lives in the linkup repo — redeploy there if needed."
Write-Host "Auth signup / password reset uses Supabase Dashboard -> Auth -> SMTP (separate from RESEND_FROM)."
