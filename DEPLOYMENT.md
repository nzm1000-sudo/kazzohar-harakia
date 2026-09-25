# Smart Maariv - iOS Deployment Guide

## Current Status
- ✅ Real Maariv text extracted and bundled (40 resources, 1.1 MB)
- ✅ All checksums verified (no placeholders)
- ✅ PrayerTableOfContents wired into ComposedPrayerReader
- ✅ Maariv accessible from Siddur UI (סידור → ערבית)
- ✅ All 625 tests passing
- ✅ Production build complete (22.4 MB)
- ✅ Pushed to GitHub (commit: efd1b21)

## iOS Installation Steps

### 1. Sync Web Code to iOS Native Project
```bash
cd /Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia
npm run build          # Already done, but ensure latest
npx cap sync ios       # Sync web code to iOS project
```

### 2. Open iOS Project in Xcode
```bash
open ios/App/App.xcworkspace  # Use .xcworkspace, not .xcodeproj
```

### 3. Connect Physical iPhone to Mac via USB

### 4. In Xcode:
- **Select Target Device**: Top toolbar → Select your iPhone
- **Select Build Target**: App → Any iOS Device (or your specific device)
- **Build & Run**: Product → Run (⌘R)
  - Xcode will build, sign, and install the app on your device

### 5. Manual Build & Install (if Xcode UI fails):
```bash
cd ios/App
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build

# Install on device:
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination "id=$(system_profiler SPUSBDataType | grep "Identifier" | head -1 | sed 's/.*: //')" \
  -derivedDataPath build
```

## Testing Checklist on Physical Device

- [ ] **App Launches**: Tap app icon on home screen
- [ ] **Siddur Opens**: Navigate to סידור (Books → Siddur)
- [ ] **Maariv Visible**: Press "ערבית" button (Evening Prayer)
- [ ] **Hebrew Text Renders**: Maariv opening visible in Hebrew
- [ ] **TOC Accessible**: Tab bar shows "☰ תוכן" (Menu button) at top
- [ ] **TOC Opens**: Tap "☰ תוכן" → Drawer slides in from right
- [ ] **TOC Shows Sections**: Drawer lists: Opening, Barechu, Shema, Amida, Aleinu
- [ ] **Current Section Highlighted**: Arrow (→) marks current section as you scroll
- [ ] **Direct Jump**: Tap "עמידה" (Amida) in TOC → Page scrolls directly to Amida
- [ ] **Mincha TOC Works**: Navigate to Mincha, verify its TOC also works
- [ ] **No Network Required**: Turn on Airplane Mode, Maariv still works completely
- [ ] **Scroll Tracking**: Scroll prayer, TOC current section updates
- [ ] **Touch Responsive**: All buttons/scrolling feel native and responsive

## Verification Commands

### Check Build Artifacts
```bash
# Verify bundled Maariv text
node -e "
  const siddur = require('./src/data/siddurOffline.mjs').default;
  const maariv = Object.keys(siddur.texts).filter(k => k.includes('Maariv'));
  console.log('✓ Maariv entries:', maariv.length);
"

# Verify no placeholders in checksums
node -e "
  const pack = require('./src/data/prayerPacks/edotHaMizrachWeekdayMaariv.mjs').default;
  let sections = 0;
  let placeholders = 0;
  pack.sections.forEach(s => {
    sections++;
    s.blocks.forEach(b => {
      if (b.checksum === 'placeholder') placeholders++;
    });
  });
  console.log(\`✓ Sections: \${sections}, Placeholders: \${placeholders}\`);
"
```

### Run Full Test Suite
```bash
npm test 2>&1 | tail -5
# Expected: ✔ 625 tests passing
```

### Build Production
```bash
npm run build
du -sh dist/
# Expected: ~50 MB total (gzipped web assets)
```

## Troubleshooting

### If Xcode Won't Build:
1. Clean build folder: Product → Clean Build Folder (⇧⌘K)
2. Refresh pod dependencies: `cd ios/App && pod repo update && cd ../..`
3. Rebuild: Product → Build (⌘B)

### If App Crashes on Launch:
1. Check Console.app for native errors
2. Verify capacitor.config.json exists and is valid
3. Ensure web assets synced correctly: `npx cap sync ios`
4. Re-run `npm run build && npx cap sync ios`

### If Maariv Text Doesn't Appear:
1. Verify siddurOffline.mjs includes 40 Maariv entries
2. Check App console (Safari DevTools → Develop → [Device])
3. Verify no network calls (Airplane Mode should still work)

## Success Criteria

Once installed on physical device, you should see:

1. **Siddur Page**: "ערבית" button immediately visible
2. **Smart Maariv Loads**: Tap button → Full Maariv composition appears instantly
3. **Hebrew Text**: All Hebrew displays correctly RTL, vowels visible
4. **TOC Works**: "☰ תוכן" accessible, sections list accurate, jump-to-section works
5. **Offline Verified**: Turn on Airplane Mode → Maariv still loads and works
6. **No Delays**: All interactions feel instant (no loading spinners)

## Notes

- Real Maariv text comes from TfilonEdotMizrach.jar (Edot HaMizrach tradition)
- 40 sections bundled covering:
  - Opening (לשם יחוד)
  - Barechu + Half Kaddish
  - Shema (all 4 paragraphs)
  - Amida (19 blessings)
  - Kaddish Titkabal
  - Aleinu
  - Conditional: Omer, Havdalah, Al Hanissim, Yaaleh V'Yavo, AYT additions

- PrayerTableOfContents works for any prayer (Mincha, Maariv, Shacharit, etc.)
- Integration validated by:
  - Unit tests (625 passing)
  - Production build (succeeds)
  - Visual inspection (all imports correct, no placeholders)

## Git Information

**Latest Commit**: `efd1b21`
**Branch**: `main`
**Repository**: https://github.com/nzm1000-sudo/kazzohar-harakia.git

Push with: `git push`
Pull with: `git pull`
