import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// התבודדות — the Live Activity (attributes and intents: Shared/KZHitbodedutActivity.swift).
//   Lock Screen:     the mark · "התבודדות" · "18:42 נותרו" (ticking by itself), pause / resume and end (iOS 17+)
//   Dynamic Island:  compact — the mark and the remaining time; minimal — the mark; expanded — the same with buttons
// Very dark and quiet, the app's muted gold; a tap opens the session (kzohaar://open/hitbodedut).

private enum KZHPalette {
    static let gold = Color(red: 0.725, green: 0.604, blue: 0.357)
    static let ink = Color(red: 0.914, green: 0.882, blue: 0.82)
    static let muted = Color(red: 0.608, green: 0.576, blue: 0.518)
    static let background = Color(red: 0.03, green: 0.03, blue: 0.028)
}

private let kzhOpenURL = URL(string: "kzohaar://open/hitbodedut")

/// The small mark: a thin gold ring around still water.
private struct KZHMark: View {
    var size: CGFloat = 22
    var body: some View {
        ZStack {
            Circle().stroke(KZHPalette.gold.opacity(0.75), lineWidth: 1.1)
            Image(systemName: "water.waves")
                .font(.system(size: size * 0.42, weight: .light))
                .foregroundStyle(KZHPalette.gold)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// "18:42" — counting down by itself while running; frozen while paused; "הסתיים" at the end.
private struct KZHRemaining: View {
    let state: KZHitbodedutAttributes.ContentState
    let stale: Bool
    var body: some View {
        if state.paused {
            Text(Self.clock(state.remaining)).monospacedDigit()
        } else if stale || state.endsAt <= Date() {
            Text("הסתיים")
        } else {
            Text(timerInterval: Date()...state.endsAt, countsDown: true, showsHours: false).monospacedDigit()
        }
    }
    static func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded(.up)))
        let hours = total / 3600, minutes = (total % 3600) / 60, secs = total % 60
        return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%d:%02d", minutes, secs)
    }
}

private struct KZHButtons: View {
    let paused: Bool
    var compact = false
    var body: some View {
        HStack(spacing: compact ? 10 : 14) {
            if paused {
                Button(intent: KZHitbodedutResumeIntent()) { glyph("play", label: "המשך") }.buttonStyle(.plain)
            } else {
                Button(intent: KZHitbodedutPauseIntent()) { glyph("pause", label: "השהיה") }.buttonStyle(.plain)
            }
            Button(intent: KZHitbodedutEndIntent()) { glyph("stop", label: "סיום") }.buttonStyle(.plain)
        }
    }
    private func glyph(_ name: String, label: String) -> some View {
        Image(systemName: name)
            .font(.system(size: 13, weight: .light))
            .foregroundStyle(KZHPalette.ink)
            .frame(width: 40, height: 40)
            .overlay(Circle().stroke(KZHPalette.ink.opacity(0.25), lineWidth: 1))
            .contentShape(Circle())
            .accessibilityLabel(label)
    }
}

private struct KZHLockScreen: View {
    let context: ActivityViewContext<KZHitbodedutAttributes>
    var body: some View {
        let state = context.state
        HStack(spacing: 14) {
            KZHMark(size: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.title)
                    .font(.system(size: 15, weight: .light))
                    .foregroundStyle(KZHPalette.muted)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    KZHRemaining(state: state, stale: context.isStale)
                        .font(.system(size: 30, weight: .thin))
                        .foregroundStyle(KZHPalette.ink)
                    Text(state.paused ? "בהשהיה" : (context.isStale ? "" : "נותרו"))
                        .font(.system(size: 15, weight: .light))
                        .foregroundStyle(KZHPalette.muted)
                }
            }
            Spacer(minLength: 8)
            if !context.isStale { KZHButtons(paused: state.paused) }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }
}

struct KZHitbodedutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: KZHitbodedutAttributes.self) { context in
            KZHLockScreen(context: context)
                .activityBackgroundTint(KZHPalette.background.opacity(0.92))
                .activitySystemActionForegroundColor(KZHPalette.gold)
                .widgetURL(kzhOpenURL)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    KZHMark(size: 30).padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    KZHRemaining(state: context.state, stale: context.isStale)
                        .font(.system(size: 24, weight: .thin))
                        .foregroundStyle(KZHPalette.ink)
                        .frame(maxWidth: 96, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.paused ? "התבודדות · בהשהיה" : context.attributes.title)
                        .font(.system(size: 15, weight: .light))
                        .foregroundStyle(KZHPalette.muted)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !context.isStale { KZHButtons(paused: context.state.paused, compact: true).padding(.top, 4) }
                }
            } compactLeading: {
                KZHMark(size: 20)
            } compactTrailing: {
                KZHRemaining(state: context.state, stale: context.isStale)
                    .font(.system(size: 14, weight: .light))
                    .foregroundStyle(KZHPalette.gold)
                    .frame(maxWidth: 52)
            } minimal: {
                KZHMark(size: 20)
            }
            .widgetURL(kzhOpenURL)
            .keylineTint(KZHPalette.gold)
        }
    }
}
