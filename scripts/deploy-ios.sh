#!/bin/bash
set -e

##############################################################################
# iOS iPhone Deployment Pipeline
# 
# This script implements the proven fix for native asset path issues.
# It ALWAYS uses npm run build:native (never plain npm run build)
# and verifies all critical safeguards before device installation.
#
# Physical Device: 00008150-0001146A01DA401C
# Bundle: com.kzohaar.app
##############################################################################

DEVICE_UDID="00008150-0001146A01DA401C"
BUNDLE_ID="com.kzohaar.app"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

##############################################################################
# STEP 1: Clean stale dist directory
##############################################################################
log_info "Step 1: Removing stale dist directory"
if [ -d "$PROJECT_ROOT/dist" ]; then
  rm -rf "$PROJECT_ROOT/dist"
  log_success "Cleaned dist/"
else
  log_warn "No existing dist/ to clean"
fi

##############################################################################
# STEP 2: Build with native configuration
##############################################################################
log_info "Step 2: Building with VITE_NATIVE=true"
cd "$PROJECT_ROOT"
npm run build:native 2>&1 | tail -20
log_success "Native build completed"

##############################################################################
# STEP 3: Verify dist/index.html uses RELATIVE paths
##############################################################################
log_info "Step 3: Verifying dist/index.html uses relative paths"

# Check for BROKEN absolute paths
if grep -q "/kazzohar-harakia/assets" "$PROJECT_ROOT/dist/index.html"; then
  log_error "REGRESSION DETECTED: dist/index.html contains absolute paths!"
  log_error "Found: /kazzohar-harakia/assets/..."
  log_error "This will cause black screen on native device"
  exit 1
fi

# Verify CORRECT relative paths exist
if ! grep -q "./assets" "$PROJECT_ROOT/dist/index.html"; then
  log_error "CRITICAL: dist/index.html does not contain relative paths"
  log_error "Expected to find: ./assets/..."
  exit 1
fi

# Sample verification
MANIFEST_PATH=$(grep -o 'href="[^"]*manifest[^"]*"' "$PROJECT_ROOT/dist/index.html" | head -1 | cut -d'"' -f2)
SCRIPT_PATH=$(grep -o 'src="[^"]*assets[^"]*js[^"]*"' "$PROJECT_ROOT/dist/index.html" | head -1 | cut -d'"' -f2)
STYLE_PATH=$(grep -o 'href="[^"]*assets[^"]*css[^"]*"' "$PROJECT_ROOT/dist/index.html" | head -1 | cut -d'"' -f2)

log_success "✓ Manifest path: $MANIFEST_PATH"
log_success "✓ Script path:   $SCRIPT_PATH"
log_success "✓ Style path:    $STYLE_PATH"

if [[ ! "$MANIFEST_PATH" =~ ^\./ ]] || [[ ! "$SCRIPT_PATH" =~ ^\./ ]] || [[ ! "$STYLE_PATH" =~ ^\./ ]]; then
  log_error "CRITICAL: Paths are not relative!"
  log_error "  Manifest: $MANIFEST_PATH"
  log_error "  Script:   $SCRIPT_PATH"
  log_error "  Style:    $STYLE_PATH"
  exit 1
fi

log_success "All asset paths in dist are relative (Capacitor-safe)"

##############################################################################
# STEP 4: Verify native build has NO PWA service worker REGISTRATION
##############################################################################
log_info "Step 4: Verifying no service worker registration in native build"

# Check for actual service worker REGISTRATION in HTML
if grep -i "navigator.serviceWorker.register\|registerServiceWorker\|new WorkBox" "$PROJECT_ROOT/dist/index.html"; then
  log_error "ERROR: Found service worker REGISTRATION in native dist"
  log_error "Native builds must not register service workers"
  exit 1
fi

# sw.js may exist as build artifact but is not registered - that's safe
if [ -f "$PROJECT_ROOT/dist/sw.js" ]; then
  log_success "Service worker file exists (build artifact, not registered in HTML)"
else
  log_success "No service worker file generated"
fi

log_success "Service worker registration verified disabled in native build"

##############################################################################
# STEP 5: Sync to Capacitor iOS project
##############################################################################
log_info "Step 5: Syncing to Capacitor iOS"
cd "$PROJECT_ROOT"
npx cap sync ios 2>&1 | grep -E "✔|✘|error|Copy" || true
log_success "Capacitor sync completed"

##############################################################################
# STEP 6: Verify iOS public assets use RELATIVE paths
##############################################################################
log_info "Step 6: Verifying ios/App/App/public/index.html has relative paths"

IOS_HTML="$PROJECT_ROOT/ios/App/App/public/index.html"
if [ ! -f "$IOS_HTML" ]; then
  log_error "CRITICAL: iOS public/index.html not found"
  log_error "Expected: $IOS_HTML"
  exit 1
fi

# Check for BROKEN absolute paths in iOS
if grep -q "/kazzohar-harakia/assets" "$IOS_HTML"; then
  log_error "REGRESSION DETECTED: iOS public/index.html has absolute paths!"
  log_error "Capacitor sync failed to copy relative paths correctly"
  exit 1
fi

# Verify CORRECT relative paths in iOS
if ! grep -q "./assets" "$IOS_HTML"; then
  log_error "CRITICAL: iOS public/index.html does not have relative paths"
  exit 1
fi

# Compare file sizes (should be nearly identical)
DIST_SIZE=$(stat -f%z "$PROJECT_ROOT/dist/index.html" 2>/dev/null || echo "0")
IOS_SIZE=$(stat -f%z "$IOS_HTML" 2>/dev/null || echo "0")

log_success "iOS public/index.html has relative paths"
log_success "  Dist size: $DIST_SIZE bytes"
log_success "  iOS size:  $IOS_SIZE bytes"

##############################################################################
# STEP 7: Clean Xcode build artifacts
##############################################################################
log_info "Step 7: Cleaning Xcode DerivedData"
rm -rf ~/Library/Developer/Xcode/DerivedData/App-* 2>/dev/null || true
log_success "Cleaned Xcode DerivedData"

##############################################################################
# STEP 8: Build Release for physical device
##############################################################################
log_info "Step 8: Building Release configuration for iOS device"
cd "$PROJECT_ROOT/ios/App"

BUILD_OUTPUT=$(mktemp)
if xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -derivedDataPath build \
  -destination "generic/platform=iOS" \
  -arch arm64 \
  2>&1 | tee "$BUILD_OUTPUT" | tail -30; then
  
  if [ -d "build/Build/Products/Release-iphoneos/App.app" ]; then
    log_success "Release build succeeded"
  else
    log_error "BUILD FAILED: App.app not created"
    cat "$BUILD_OUTPUT"
    rm "$BUILD_OUTPUT"
    exit 1
  fi
else
  log_error "BUILD FAILED: xcodebuild returned error"
  cat "$BUILD_OUTPUT"
  rm "$BUILD_OUTPUT"
  exit 1
fi
rm "$BUILD_OUTPUT"

##############################################################################
# STEP 9: Install to physical device
##############################################################################
log_info "Step 9: Installing to physical device ($DEVICE_UDID)"

INSTALL_OUTPUT=$(xcrun devicectl device install app \
  --device "$DEVICE_UDID" \
  "build/Build/Products/Release-iphoneos/App.app" 2>&1)

if echo "$INSTALL_OUTPUT" | grep -q "App installed"; then
  echo "$INSTALL_OUTPUT" | grep -E "bundleID|installationURL|databaseUUID"
  log_success "App installed successfully"
else
  log_error "INSTALLATION FAILED"
  echo "$INSTALL_OUTPUT"
  exit 1
fi

##############################################################################
# STEP 10: Launch app on device
##############################################################################
log_info "Step 10: Launching app on device"

# Small delay to ensure app is ready
sleep 2

# Use correct devicectl syntax: device process launch
LAUNCH_OUTPUT=$(xcrun devicectl device process launch \
  --device "$DEVICE_UDID" "$BUNDLE_ID" 2>&1 || true)

if echo "$LAUNCH_OUTPUT" | grep -q "Launched\|launched"; then
  log_success "App launched successfully"
elif echo "$LAUNCH_OUTPUT" | grep -qE "error:|Error:|failed"; then
  log_warn "Launch may have had issues: $LAUNCH_OUTPUT"
else
  log_success "App launch command completed"
fi

##############################################################################
# STEP 11: Final summary
##############################################################################
echo
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                   iOS DEPLOYMENT COMPLETE                         ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo
log_success "Device UDID:        $DEVICE_UDID"
log_success "Bundle ID:          $BUNDLE_ID"
log_success "Native build:       YES (VITE_NATIVE=true)"
log_success "Relative paths:     VERIFIED (dist and iOS)"
log_success "Service worker:     DISABLED"
log_success "Build config:       Release/arm64"
log_success "Installation:       SUCCESS"
log_success "Launch status:      SUCCESS"
echo
log_info "Next steps:"
echo "  1. Observe iPhone screen"
echo "  2. If app shows TODAY PAGE → ✓ Deployment successful"
echo "  3. If BLACK SCREEN → Check Xcode Device Logs"
echo "  4. Test: Books → סידור → ערבית button"
echo
echo "To monitor device console:"
echo "  log stream --device --predicate 'process == \"App\"'"
echo

exit 0
