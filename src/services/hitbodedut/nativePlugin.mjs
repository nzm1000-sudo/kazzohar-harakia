// The one native plugin of התבודדות (JS name "KZHitbodedut"): ios/App/App/KZHitbodedutPlugin.swift and
// android/app/src/main/java/com/kzohaar/app/hitbodedut/KZHitbodedutPlugin.java.
//   brightness   getBrightness() · dim({level}) → {original} · restore({original?, keepRecord?}) · setKeepAwake({on})
//   sound        audioStart({sound, volume, hz, stopAt, title}) · audioPause() · audioResume({stopAt}) · audioStop({immediate})
//                audioSetVolume({volume}) · audioChime()
//   Live Activity liveSupported() → {supported, enabled} · liveStart({endsAt, durationMs, title, paused, remainingMs})
//                liveUpdate({endsAt, paused, remainingMs}) · liveEnd({completed}) · takeLiveActions() → {actions}
//   events       'remote' {action: play|pause|stop|interrupted|ended} · 'liveAction' {action: pause|resume|end, at}
// Everything stays on the device. Without the plugin (the web, an older build) each call is a quiet no-op.
import { Capacitor, registerPlugin } from '@capacitor/core';

export const KZHitbodedut = registerPlugin('KZHitbodedut');

export function nativePlatform() {
  try { return Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'; } catch { return 'web'; }
}

export function hitbodedutPluginAvailable() {
  try { return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KZHitbodedut'); } catch { return false; }
}

// The plugin when it is really there, else null (so the services fall back quietly).
export function nativeHitbodedut() {
  return hitbodedutPluginAvailable() ? KZHitbodedut : null;
}
