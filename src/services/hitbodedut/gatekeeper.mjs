// שומר הסף — shielding chosen apps during a session (Apple's Screen Time API: FamilyControls, ManagedSettings,
// DeviceActivity, a ManagedSettingsUI shield). It needs the com.apple.developer.family-controls entitlement, which
// Apple grants on request to a paid Apple Developer Program team only; the free personal team this app is signed with
// cannot hold it, and adding it would break signing. So the feature is built as a scaffold that is OFF:
//   · the native code is behind the KZ_FAMILY_CONTROLS compilation condition (ios/App/KZGatekeeper/README.md),
//   · the screen offers an honest explanation instead of a switch.
// docs/leatzmi/shomer-hasaf.md lists exactly what is needed to turn it on.

export const GATEKEEPER_FLAGS = Object.freeze({
  // Flip only together with: the entitlement on a paid team, the two extensions embedded, KZ_FAMILY_CONTROLS defined.
  enabled: false,
});

export const GATEKEEPER_TEXT = Object.freeze({
  title: 'שומר הסף',
  line: 'חסימת אפליקציות שבחרת, בזמן ההתבודדות',
  status: 'דורש אישור מאפל — יופעל בגרסה עתידית',
  shieldTitle: 'זה הזמן שבחרת לעצמך',
  shieldSubtitle: 'האפליקציה תחזור להיות זמינה כשההתבודדות תסתיים.',
  shieldButton: 'חזור לכזוהר הרקיע',
});

// What the screen may offer. `native` is the plugin's own answer (when the scaffold is compiled in), else null.
export function gatekeeperStatus({ platform = 'web', flags = GATEKEEPER_FLAGS, native = null } = {}) {
  if (!flags.enabled) return { available: false, reason: 'apple-approval', text: GATEKEEPER_TEXT.status };
  if (platform !== 'ios') return { available: false, reason: 'platform', text: 'זמין ב־iPhone בלבד' };
  if (!native?.compiled) return { available: false, reason: 'not-compiled', text: GATEKEEPER_TEXT.status };
  if (native.authorization !== 'approved') return { available: true, reason: 'needs-authorization', text: 'נדרש אישור של זמן מסך' };
  return { available: true, reason: 'ready', text: '' };
}
