#!/bin/bash
# Builds the side-by-side Clay prototype app — "כזוהר Clay" (com.kzohaar.app.clay) — from the design/premium-claymorphism
# worktree. It only BUILDS; it never installs, never touches the production app, and never edits the tracked iOS project.
#
# Isolation from the production app (com.kzohaar.app):
#   • a disposable copy of ios/App in ios-clay/App (git-ignored) carries every change; ios/App stays as committed;
#   • bundle id com.kzohaar.app.clay — iOS gives it its own container, WebView storage (localStorage) and notifications;
#   • NO entitlements: no App Group (group.com.kzohaar.app) and no keychain access groups (<team>.com.kzohaar.shared),
#     and KZAppIdentifierPrefix is removed, so the widget-snapshot code can never reach the production shared stores;
#   • the widget extension is not embedded (no second "כזוהר הרקיע" widget to confuse with production's);
#   • its URL scheme is kzohaarclay://, so production's widget and notification links (kzohaar://) never open it.
# Its own DerivedData (ios-clay/build); nothing global (~/Library/Developer/Xcode/DerivedData) is touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPECTED_BRANCH="design/premium-claymorphism"
CLAY_ID="com.kzohaar.app.clay"
CLAY_NAME="כזוהר Clay"
CLAY_SCHEME="kzohaarclay"
WORK="$ROOT/ios-clay"

fail() { echo "[clay] ERROR: $*" >&2; exit 1; }
say() { echo "[clay] $*"; }

# ---- Guards: the right tree, the right branch ----
[ "$(basename "$ROOT")" = "kazzohar-harakia-clay" ] || fail "not the Clay worktree: $ROOT"
[ "$(git -C "$ROOT" branch --show-current)" = "$EXPECTED_BRANCH" ] || fail "not on $EXPECTED_BRANCH"

# ---- 1. Web bundle with the Clay flag ----
say "building the native web bundle with VITE_CLAY=true"
cd "$ROOT"
rm -rf "$ROOT/dist-native"
VITE_CLAY=true npm run build:native >/dev/null
# clayBuildEnabled() compiles to a constant: on is `="today",X=()=>{try{return!0}`, off reads an empty env object
grep -qE '="today",[A-Za-z0-9_$]+=\(\)=>\{try\{return!0\}' "$ROOT"/dist-native/assets/index-*.js || fail "the Clay flag is not compiled on in dist-native"
grep -q '/kazzohar-harakia/assets' "$ROOT/dist-native/index.html" && fail "absolute asset paths in dist-native"

# ---- 2. Capacitor sync into this worktree's own ios/ (git-ignored outputs only) ----
say "cap sync ios"
npx cap sync ios >/dev/null
if ! git -C "$ROOT" diff --quiet -- ios; then fail "cap sync changed tracked files under ios/ — inspect: git diff -- ios"; fi

# ---- 3. The disposable copy ----
say "preparing $WORK"
mkdir -p "$WORK"
rsync -a --delete --exclude build --exclude DerivedData --exclude xcuserdata "$ROOT/ios/App/" "$WORK/App/"
PBX="$WORK/App/App.xcodeproj/project.pbxproj"
PLIST="$WORK/App/App/Info.plist"

# Bundle id (the App target only; the widget target keeps its id but is no longer built into the app)
grep -c 'PRODUCT_BUNDLE_IDENTIFIER = com.kzohaar.app;' "$PBX" | grep -qx 2 || fail "unexpected App bundle id lines"
sed -i '' 's/PRODUCT_BUNDLE_IDENTIFIER = com\.kzohaar\.app;/PRODUCT_BUNDLE_IDENTIFIER = com.kzohaar.app.clay;/' "$PBX"
# No entitlements at all
cat > "$WORK/App/App/AppClay.entitlements" <<'PLISTEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
PLISTEOF
sed -i '' 's#CODE_SIGN_ENTITLEMENTS = App/App.entitlements;#CODE_SIGN_ENTITLEMENTS = App/AppClay.entitlements;#' "$PBX"
# The widget extension: neither a dependency of the app nor embedded in it
sed -i '' '/C0DE00142FF2000100C0FFEE \/\* Embed Foundation Extensions \*\/,$/d; /C0DE00152FF2000100C0FFEE \/\* PBXTargetDependency \*\/,$/d' "$PBX"
grep -q 'App/App.entitlements' "$PBX" && fail "the production entitlements are still referenced"
grep -q 'PRODUCT_BUNDLE_IDENTIFIER = com.kzohaar.app;' "$PBX" && fail "the production bundle id is still set"

# Name, URL scheme, and no shared keychain prefix
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $CLAY_NAME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLName $CLAY_ID.open" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLSchemes:0 $CLAY_SCHEME" "$PLIST"
/usr/libexec/PlistBuddy -c "Delete :KZAppIdentifierPrefix" "$PLIST"

# ---- 4. Build (its own DerivedData) ----
say "xcodebuild (Release, device) — this takes a few minutes"
cd "$WORK/App"
rm -rf build/Build/Products/Release-iphoneos/App.app
xcodebuild -project App.xcodeproj -scheme App -configuration Release -derivedDataPath build \
  -destination "generic/platform=iOS" -allowProvisioningUpdates > "$WORK/xcodebuild.log" 2>&1 || { tail -40 "$WORK/xcodebuild.log"; fail "xcodebuild failed (log: $WORK/xcodebuild.log)"; }
APP="$WORK/App/build/Build/Products/Release-iphoneos/App.app"
[ -d "$APP" ] || fail "App.app was not produced"

# ---- 5. Verify the product ----
BID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Info.plist")
[ "$BID" = "$CLAY_ID" ] || fail "built bundle id is $BID"
[ -d "$APP/PlugIns" ] && fail "an extension is embedded: $(ls "$APP/PlugIns")"
ENT=$(codesign -d --entitlements :- "$APP" 2>/dev/null)
echo "$ENT" | grep -q 'application-groups' && fail "App Group entitlement present"
echo "$ENT" | grep -q 'keychain-access-groups' && fail "keychain access group entitlement present"
echo "$ENT" | grep -q 'com.kzohaar.shared\|group.com.kzohaar' && fail "a production shared group is referenced"
/usr/libexec/PlistBuddy -c "Print :KZAppIdentifierPrefix" "$APP/Info.plist" >/dev/null 2>&1 && fail "KZAppIdentifierPrefix present"
say "OK  $APP"
say "    bundle id  $BID"
say "    name       $(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' "$APP/Info.plist")"
say "    scheme     $(/usr/libexec/PlistBuddy -c 'Print :CFBundleURLTypes:0:CFBundleURLSchemes:0' "$APP/Info.plist")"
