# Privacy and Data Map

This describes the current web product. The native wrapper must be reviewed again after platform plugins are added.

## Stored locally on the device

- Theme, font size, focus mode, favorites, reader position, and learning progress.
- Optional city/location choice, timezone, and daily completion history.
- Service-worker shell and successful same-origin static responses for offline startup and reload recovery.

This product currently has no user accounts, personal backend, advertising SDK, analytics SDK, or public user-generated-content system. Local values are not synced between devices and there is no in-app account deletion flow because there is no account.

## External requests

- **Hebcal:** calendar, zmanim, Hebrew date, and schedule data. Requests include the selected date/location parameters.
- **Sefaria:** text, index, search, calendar, links, and manuscript data. Requested references and search terms are sent to Sefaria.
- **Nominatim:** manual place search or reverse geocoding. Manual search sends the typed place; reverse lookup sends coordinates after location use.
- **TimeAPI:** timezone lookup from coordinates when location is selected.
- **Wikimedia Commons:** fallback Vilna scan images may load directly from Commons.

The app does not send these values to a Kazzohar Harakia account or private server. Third-party services may receive normal web request metadata such as IP address and user-agent; their own policies and terms apply.

## Location

Location is optional and requested only after the user selects the location action. If permission is denied, the user can search for a city manually. The app does not use background location or location for advertising.

## Retention and deletion

Local data can be cleared through the operating system or browser site-data controls. The app does not retain a server-side user record. External providers control their own request logs and retention under their policies.

## Native release requirement

Before submission, publish this policy at a stable HTTPS URL and verify the Apple App Store privacy answers and Google Play Data safety form against the final native permissions and plugins.
