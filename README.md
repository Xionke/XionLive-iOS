# XionLive iOS

iOS app for XionLive stream resolver — wraps the web app via Capacitor.

## Build IPA (GitHub Actions)

### 1. Create GitHub repo and push

```bash
cd XionLive-iOS
git remote add origin https://github.com/Xionke/XionLive-iOS.git
git add -A
git commit -m "initial iOS app"
git push -u origin main
```

### 2. Add GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE_BASE64` | Your distribution certificate `.p12` base64 encoded |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Your `.mobileprovision` file base64 encoded |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID |

### 3. Generate secrets

```bash
# Certificate
base64 -i Certificates.p12 | pbcopy

# Provisioning profile
base64 -i profile.mobileprovision | pbcopy
```

### 4. Build

Push to `main` or trigger manually from **Actions → Build IPA → Run workflow**.

The IPA will be in **Actions → Artifacts → XionLive**.

## Build locally (macOS)

```bash
npm install
npx cap sync ios
open ios/App/App.xcodeproj
```

Select your team in Xcode → Signing & Capabilities → Build & Run.
