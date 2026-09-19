# Native Packaging Blockers

Audit date: 2026-09-18. This is a product and release-readiness audit, not legal advice.

## Decision

**No confirmed blocker prevents starting native packaging.** The web core has no login, account backend, payments, analytics SDK, push requirement, camera, microphone, contacts, photos, or background location path. Location is requested only after an explicit user action, and manual city search remains available.

**Store submission is not cleared yet.** The following must be resolved before submitting either store build:

- Confirm commercial distribution rights for every remote edition actually displayed, especially Peninei Halakhah (`CC-BY-NC`) and the Steinsaltz/William Davidson Talmud editions.
- Publish the privacy policy at a stable HTTPS URL and ensure its wording matches the native wrapper, service-worker/cache behavior, and external requests.
- Complete final store identity, support contact, screenshots, age rating, data-safety/privacy declarations, bundle/application IDs, signing, and device QA.
- Demonstrate that the wrapped app provides an app-like, stable experience rather than only a thin website shell.

## Technical findings

- Confirmed: same-origin service-worker caches are versioned, old app caches are removed during activation, and non-success responses are no longer cached.
- Confirmed: no credentials or API keys are present in the inspected client code.
- Confirmed: local progress, preferences, favorites, location, and reading settings use device storage.
- Confirmed: external requests go to Hebcal, Sefaria, Nominatim, and TimeAPI; exact request behavior is documented in [privacy-data-map](privacy-data-map.md).
- Potential: remote API availability and terms can change; native builds need offline and network-recovery QA.
- Unknown: final legal permission for each edition and image scan, including whether any source permits commercial app-store distribution.

## Start order

1. Resolve the rights and privacy publication questions.
2. Create the native wrapper and add only required platform bridges.
3. Test permissions, navigation, offline behavior, accessibility, and external links on real devices.
4. Prepare store metadata and submit only after the content and privacy review is signed off.
