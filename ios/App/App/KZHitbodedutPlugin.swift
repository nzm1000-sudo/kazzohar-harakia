import AVFoundation
import Capacitor
import Foundation
import MediaPlayer
import UIKit
#if canImport(ActivityKit)
import ActivityKit
#endif

// התבודדות — the native side (JS name "KZHitbodedut", src/services/hitbodedut/nativePlugin.mjs).
//
// Brightness: the person's own brightness is saved (UserDefaults) before the first dim and always comes back — on end,
// when the app resigns active (the Lock button, the app switcher, a call; re-dimmed on return while the session is on),
// on termination, and on the next launch after a crash (load()). Keep-awake: isIdleTimerDisabled, released on end.
//
// Sound: the same recipes as src/services/ambientAudio/noise.mjs (white; pink — Paul Kellet's filter; brown — leaky
// integration with a DC blocker; a plain sine; צליל עמוק — 500 Hz left / 501.5 Hz right), and the bundled nature
// recordings (public/audio/ambient/*.m4a): each is decoded once to PCM (AVAudioFile) and its middle loop window
// (recordings.mjs) is played round and round sample by sample — gap-free, unlike a file player's own looping, which
// leaves the AAC priming as a tiny gap at every turn. Everything is rendered by one stereo AVAudioSourceNode at 44.1 kHz
// (the mixer converts to the hardware rate) under an AVAudioSession of category .playback, so it goes on with the
// screen locked (UIBackgroundModes: audio). Gentle fades in and out; at
// `stopAt` it fades out and stops by itself. The Lock Screen shows it (MPNowPlayingInfoCenter) with play / pause
// (MPRemoteCommandCenter), which act like the Live Activity's buttons. Background sound for focus only.
//
// Live Activity (iOS 16.2+): start / update / end; the buttons' actions come back through KZHitbodedutActions.
@objc(KZHitbodedutPlugin)
public class KZHitbodedutPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KZHitbodedutPlugin"
    public let jsName = "KZHitbodedut"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getBrightness", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dim", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKeepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioPause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioResume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioStop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioSetVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioRetime", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioChime", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveUpdate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveEnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeLiveActions", returnType: CAPPluginReturnPromise),
    ]

    private static let originalKey = "kz.hitbodedut.originalBrightness"
    private var dimLevel: CGFloat?          // set while a session dims the screen
    private var suspended = false           // the app is not active: the person's brightness is showing
    private var observers: [NSObjectProtocol] = []
    private let synth = KZAmbientSynth()
    private var remoteReady = false

    // MARK: lifecycle

    public override func load() {
        // A brightness left saved means the app ended while dimmed (a crash or a kill): put it back now.
        DispatchQueue.main.async { self.restoreSaved(clear: true) }
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            // Leaving halfway through the climb back: the person's brightness at once (a timer does not run in the
            // background, and iOS keeps an app's brightness system-wide — it must never stay part-way dark).
            if self.dimLevel == nil, self.rampTimer != nil { self.restoreSaved(clear: true); return }
            guard self.dimLevel != nil else { return }
            self.suspended = true
            self.restoreSaved(clear: false)
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, let level = self.dimLevel, self.suspended else { return }
            self.suspended = false
            self.screen.brightness = level
        })
        observers.append(center.addObserver(forName: UIApplication.willTerminateNotification, object: nil, queue: .main) { [weak self] _ in
            self?.restoreSaved(clear: true)
            UIApplication.shared.isIdleTimerDisabled = false
            #if canImport(ActivityKit)
            if #available(iOS 16.2, *) { KZHitbodedutPlugin.endAllActivitiesSync() }
            #endif
        })
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            self?.handleInterruption(note)
        })
        synth.onFinished = { [weak self] in
            self?.clearNowPlaying()
            self?.notifyListeners("remote", data: ["action": "ended"])
        }
        // The Lock Screen's buttons and the Live Activity's intents land here while the app runs.
        KZHitbodedutActions.handler = { [weak self] action, id, at in
            self?.handleAction(action, id: id, at: at)
        }
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    private var screen: UIScreen {
        bridge?.viewController?.view.window?.windowScene?.screen ?? UIScreen.main
    }

    private func restoreSaved(clear: Bool) {
        cancelRamp()
        if let saved = UserDefaults.standard.object(forKey: Self.originalKey) as? Double {
            screen.brightness = CGFloat(saved)
        }
        if clear {
            UserDefaults.standard.removeObject(forKey: Self.originalKey)
            dimLevel = nil
            suspended = false
        }
    }

    // MARK: brightness and keep-awake

    @objc func getBrightness(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["brightness": Double(self.screen.brightness)]) }
    }

    @objc func dim(_ call: CAPPluginCall) {
        let level = CGFloat(min(1, max(0.02, call.getDouble("level") ?? 0.12)))
        DispatchQueue.main.async {
            self.cancelRamp()
            if UserDefaults.standard.object(forKey: Self.originalKey) == nil {
                UserDefaults.standard.set(Double(self.screen.brightness), forKey: Self.originalKey)
            }
            self.dimLevel = level
            self.suspended = UIApplication.shared.applicationState != .active
            if !self.suspended { self.screen.brightness = level }
            call.resolve(["original": UserDefaults.standard.double(forKey: Self.originalKey)])
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        let keep = call.getBool("keepRecord") ?? false
        let fallback = call.getDouble("original")
        let rampMs = call.getDouble("rampMs") ?? 0
        DispatchQueue.main.async {
            self.cancelRamp()
            let saved = UserDefaults.standard.object(forKey: Self.originalKey) as? Double
            // The end of a session in the open app: the brightness climbs back gently (rampMs), so the eyes are not
            // dazzled and the screen is never left dark. The saved original is cleared only when the climb is done, so
            // a kill halfway still restores it on the next launch.
            if !keep, rampMs > 0, UIApplication.shared.applicationState == .active, let target = saved ?? fallback {
                self.dimLevel = nil
                self.suspended = false
                self.ramp(to: CGFloat(target), seconds: rampMs / 1000) {
                    UserDefaults.standard.removeObject(forKey: Self.originalKey)
                }
                call.resolve(["ramp": true])
                return
            }
            if saved == nil, let fallback {
                self.screen.brightness = CGFloat(fallback)
            }
            if keep { self.suspended = true; self.restoreSaved(clear: false) } else { self.restoreSaved(clear: true) }
            call.resolve()
        }
    }

    private var rampTimer: Timer?
    private func cancelRamp() { rampTimer?.invalidate(); rampTimer = nil }

    // Moves the brightness to `target` over `seconds` along an ease-out curve (fast at first, settling softly).
    private func ramp(to target: CGFloat, seconds: Double, done: @escaping () -> Void) {
        let from = screen.brightness
        let start = CACurrentMediaTime()
        let duration = max(0.05, seconds)
        rampTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            let t = min(1, (CACurrentMediaTime() - start) / duration)
            let eased = 1 - pow(1 - t, 3)
            self.screen.brightness = from + (target - from) * CGFloat(eased)
            if t >= 1 { timer.invalidate(); self.rampTimer = nil; done() }
        }
    }

    @objc func setKeepAwake(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = on
            call.resolve()
        }
    }

    // MARK: sound

    @objc func audioStart(_ call: CAPPluginCall) {
        let sound = call.getString("sound") ?? "silence"
        let volume = Float(min(1, max(0, call.getDouble("volume") ?? 0.4)))
        let hz = call.getDouble("hz") ?? 196
        let stopAt = call.getDouble("stopAt") ?? 0
        let title = call.getString("title") ?? "התבודדות"
        let file = call.getString("file")
        let loopFrames = call.getInt("loopFrames") ?? 0
        let begin = {
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
                try AVAudioSession.sharedInstance().setActive(true)
                let started = try self.synth.start(sound: sound, volume: volume, hz: hz, stopAt: stopAt)
                if started { self.setupRemote(); self.publishNowPlaying(title: title, playing: true) }
                call.resolve(["started": started])
            } catch {
                call.resolve(["started": false, "error": String(describing: error)])
            }
        }
        guard let file else { DispatchQueue.main.async(execute: begin); return }
        // A recording: decoded off the main thread (a few hundred ms the first time), then started. The request is
        // taken on the main queue, after any audioStop sent before it (which clears the request it would supersede).
        let request = UUID()
        DispatchQueue.main.async {
            self.loadRequest = request
            DispatchQueue.global(qos: .userInitiated).async {
                let loaded = self.synth.load(id: sound, url: Self.bundledURL(file), loopFrames: loopFrames)
                DispatchQueue.main.async {
                    guard self.loadRequest == request else { call.resolve(["started": false, "superseded": true]); return }
                    guard loaded else { call.resolve(["started": false, "error": "load"]); return }
                    begin()
                }
            }
        }
    }
    private var loadRequest: UUID?

    // "public/audio/ambient/brook.m4a" → the copy of the web assets inside the app bundle.
    static func bundledURL(_ path: String) -> URL? {
        let clean = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = Bundle.main.bundleURL.appendingPathComponent(clean)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    @objc func audioPause(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.synth.pause(); self.publishNowPlaying(title: nil, playing: false); call.resolve() }
    }

    @objc func audioResume(_ call: CAPPluginCall) {
        let stopAt = call.getDouble("stopAt") ?? 0
        DispatchQueue.main.async {
            try? AVAudioSession.sharedInstance().setActive(true)
            self.synth.resume(stopAt: stopAt)
            self.publishNowPlaying(title: nil, playing: true)
            call.resolve()
        }
    }

    @objc func audioStop(_ call: CAPPluginCall) {
        let immediate = call.getBool("immediate") ?? false
        DispatchQueue.main.async {
            self.loadRequest = nil
            self.synth.stop(immediate: immediate) { [weak self] in
                self?.clearNowPlaying()
                try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            }
            call.resolve()
        }
    }

    @objc func audioSetVolume(_ call: CAPPluginCall) {
        let volume = Float(min(1, max(0, call.getDouble("volume") ?? 0.4)))
        synth.setVolume(volume)
        call.resolve()
    }

    // The sound that plays goes on with a new end time (the setup's short listen becoming the session's sound).
    // {retimed: false} when nothing plays or it is already fading out — the page then starts it afresh.
    @objc func audioRetime(_ call: CAPPluginCall) {
        let stopAt = call.getDouble("stopAt") ?? 0
        let volume = call.getDouble("volume").map { Float(min(1, max(0, $0))) }
        DispatchQueue.main.async {
            let retimed = self.synth.retime(stopAt: stopAt, volume: volume)
            if retimed { self.publishNowPlaying(title: nil, playing: true) }
            call.resolve(["retimed": retimed])
        }
    }

    @objc func audioChime(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            self.synth.chime()
            call.resolve()
        }
    }

    private func handleInterruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .began, synth.isPlaying {
            synth.pause()
            notifyListeners("remote", data: ["action": "interrupted"])
        } else if type == .ended, synth.isPaused {
            let options = AVAudioSession.InterruptionOptions(rawValue: note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
            if options.contains(.shouldResume) {
                try? AVAudioSession.sharedInstance().setActive(true)
                synth.resume(stopAt: nil)
                notifyListeners("remote", data: ["action": "play"])
            }
        }
    }

    // MARK: Lock Screen (Now Playing)

    private func setupRemote() {
        guard !remoteReady else { return }
        remoteReady = true
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { _ in Task { await KZHitbodedutActions.apply("resume") }; return .success }
        center.pauseCommand.addTarget { _ in Task { await KZHitbodedutActions.apply("pause") }; return .success }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            let action = (self?.synth.isPlaying ?? false) ? "pause" : "resume"
            Task { await KZHitbodedutActions.apply(action) }
            return .success
        }
        [center.nextTrackCommand, center.previousTrackCommand, center.skipForwardCommand, center.skipBackwardCommand, center.changePlaybackPositionCommand].forEach { $0.isEnabled = false }
    }

    private var nowPlayingTitle = "התבודדות"
    private func publishNowPlaying(title: String?, playing: Bool) {
        if let title { nowPlayingTitle = title }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: nowPlayingTitle,
            MPMediaItemPropertyArtist: "כזוהר הרקיע",
            MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyIsLiveStream: true,
        ]
        if #available(iOS 13.0, *) { MPNowPlayingInfoCenter.default().playbackState = playing ? .playing : .paused }
    }

    private func clearNowPlaying() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        if #available(iOS 13.0, *) { MPNowPlayingInfoCenter.default().playbackState = .stopped }
    }

    // An action from the Lock Screen or the Live Activity while the app runs: act on the sound and the screen at
    // once (the web page may be suspended), and tell the page (it applies the same action to its timer, once).
    private func handleAction(_ action: String, id: String, at: Date) {
        switch action {
        case "pause":
            synth.pause(); publishNowPlaying(title: nil, playing: false)
        case "resume":
            if synth.isPaused { try? AVAudioSession.sharedInstance().setActive(true); synth.resume(stopAt: nil); publishNowPlaying(title: nil, playing: true) }
        case "end":
            synth.stop(immediate: false) { [weak self] in self?.clearNowPlaying() }
            restoreSaved(clear: true)
            UIApplication.shared.isIdleTimerDisabled = false
        default: break
        }
        notifyListeners("liveAction", data: ["action": action, "id": id, "at": at.timeIntervalSince1970 * 1000])
    }

    // MARK: Live Activity

    @objc func liveSupported(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            call.resolve(["supported": true, "enabled": ActivityAuthorizationInfo().areActivitiesEnabled])
            return
        }
        #endif
        call.resolve(["supported": false])
    }

    @objc func liveStart(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let endsAt = Date(timeIntervalSince1970: (call.getDouble("endsAt") ?? 0) / 1000)
            let started = Date(timeIntervalSince1970: (call.getDouble("startedAt") ?? Date().timeIntervalSince1970 * 1000) / 1000)
            let duration = (call.getDouble("durationMs") ?? 0) / 1000
            let title = call.getString("title") ?? "התבודדות"
            Task {
                for activity in Activity<KZHitbodedutAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
                _ = KZHitbodedutActions.take()
                do {
                    let attributes = KZHitbodedutAttributes(title: title, startedAt: started, duration: duration)
                    let state = KZHitbodedutAttributes.ContentState(endsAt: endsAt, paused: false, remaining: max(0, endsAt.timeIntervalSinceNow))
                    _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: endsAt), pushType: nil)
                    call.resolve(["started": true])
                } catch {
                    call.resolve(["started": false, "error": String(describing: error)])
                }
            }
            return
        }
        #endif
        call.resolve(["started": false])
    }

    @objc func liveUpdate(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let endsAt = Date(timeIntervalSince1970: (call.getDouble("endsAt") ?? 0) / 1000)
            let paused = call.getBool("paused") ?? false
            let remaining = (call.getDouble("remainingMs") ?? 0) / 1000
            Task {
                let state = KZHitbodedutAttributes.ContentState(endsAt: endsAt, paused: paused, remaining: remaining)
                for activity in Activity<KZHitbodedutAttributes>.activities {
                    await activity.update(ActivityContent(state: state, staleDate: paused ? nil : endsAt))
                }
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func liveEnd(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            Task {
                for activity in Activity<KZHitbodedutAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func takeLiveActions(_ call: CAPPluginCall) {
        call.resolve(["actions": KZHitbodedutActions.take()])
    }

    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    static func endAllActivitiesSync() {
        let semaphore = DispatchSemaphore(value: 0)
        Task.detached {
            for activity in Activity<KZHitbodedutAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 1.5)
    }
    #endif
}

// MARK: - The synthesizer

/// A decoded recording: 16-bit mono PCM at 44.1 kHz, exactly one loop long. Kept alive as long as the synth may render
/// it (a retired loop is released only once the engine has stopped), so the render thread never reads freed memory.
final class KZLoopBuffer {
    let id: String
    let samples: UnsafeMutablePointer<Int16>
    let count: Int
    init(id: String, samples: [Int16]) {
        self.id = id
        count = samples.count
        self.samples = UnsafeMutablePointer<Int16>.allocate(capacity: max(1, count))
        samples.withUnsafeBufferPointer { source in
            if let base = source.baseAddress { self.samples.initialize(from: base, count: count) }
        }
    }
    deinit { samples.deallocate() }
}

/// Renders the background sound sample by sample (the render thread reads `State`; the main thread writes it — plain
/// values, a torn read at worst shifts a fade by one sample).
final class KZAmbientSynth {
    static let rate = 44100.0
    static let trims: [Int: Float] = [1: 0.55, 2: 0.84, 3: 0.94]   // LEVEL_TRIM in noise.mjs: every sound near −18 LUFS
    static let deepLevel: Float = 0.11                           // DEEP_TONE in noise.mjs

    final class State {
        var kind = 0                  // 0 none · 1 white · 2 pink · 3 brown · 4 tone · 5 deep (two ears) · 6 recording
        var hz = 196.0
        var phase = 0.0
        var phaseLeft = 0.0, phaseRight = 0.0
        var gain: Float = 0
        var target: Float = 0
        var step: Float = 0           // the change per sample of the current fade
        var seed: UInt32 = 0x6b7a
        var b0: Float = 0, b1: Float = 0, b2: Float = 0, b3: Float = 0, b4: Float = 0, b5: Float = 0, b6: Float = 0
        var brown: Float = 0, dcIn: Float = 0, dcOut: Float = 0
        var chime = -1                // the sample index of the end-of-time bell, or -1
        var sampleRate = KZAmbientSynth.rate
        var loopSamples: UnsafeMutablePointer<Int16>?
        var loopCount = 0
        var loopIndex = 0
    }

    private let engine = AVAudioEngine()
    private var node: AVAudioSourceNode?
    private let state = State()
    private var volume: Float = 0.4
    private var stopWork: DispatchWorkItem?
    private var stopFinish: DispatchWorkItem?
    private(set) var isPlaying = false
    private(set) var isPaused = false
    var onFinished: (() -> Void)?
    private var loaded: KZLoopBuffer?           // the recording ready to play (or playing)
    private var retired: [KZLoopBuffer] = []    // released when the engine stops
    private let loadLock = NSLock()

    private static let fadeIn = 2.5, fadeOut = 1.2, pauseFade = 0.6

    private func ensureEngine() throws {
        if node == nil {
            let stereo = AVAudioFormat(standardFormatWithSampleRate: Self.rate, channels: 2)!
            let state = self.state
            let source = AVAudioSourceNode(format: stereo) { _, _, frameCount, bufferList -> OSStatus in
                let buffers = UnsafeMutableAudioBufferListPointer(bufferList)
                let left = buffers.count > 0 ? buffers[0].mData?.assumingMemoryBound(to: Float.self) : nil
                let right = buffers.count > 1 ? buffers[1].mData?.assumingMemoryBound(to: Float.self) : nil
                for frame in 0..<Int(frameCount) {
                    let (l, r) = KZAmbientSynth.next(state)
                    left?[frame] = l
                    right?[frame] = r
                }
                return noErr
            }
            engine.attach(source)
            engine.connect(source, to: engine.mainMixerNode, format: stereo)
            node = source
        }
        if !engine.isRunning { engine.prepare(); try engine.start() }
    }

    private func stopEngine() {
        engine.stop()
        retired.removeAll()
    }

    // Decodes a bundled recording to 16-bit mono PCM and keeps its middle loop window. Thread-safe; called off main.
    func load(id: String, url: URL?, loopFrames: Int) -> Bool {
        loadLock.lock(); defer { loadLock.unlock() }
        if DispatchQueue.main.sync(execute: { self.loaded?.id == id }) { return true }
        guard let url, let file = try? AVAudioFile(forReading: url, commonFormat: .pcmFormatFloat32, interleaved: false) else { return false }
        let format = file.processingFormat
        let total = Int(file.length)
        guard total > 0, let chunk = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 65536) else { return false }
        var mono = [Int16](repeating: 0, count: total)
        var written = 0
        let channels = Int(format.channelCount)
        while written < total {
            do { try file.read(into: chunk, frameCount: AVAudioFrameCount(min(65536, total - written))) } catch { break }
            let frames = Int(chunk.frameLength)
            if frames == 0 { break }
            guard let data = chunk.floatChannelData else { return false }
            for i in 0..<frames where written + i < total {
                var sum: Float = 0
                for c in 0..<channels { sum += data[c][i] }
                let value = max(-1, min(1, sum / Float(channels)))
                mono[written + i] = Int16(value * 32767)
            }
            written += frames
        }
        // The loop window (recordings.mjs loopWindow): exactly one loop from the middle, clear of priming and padding.
        let decoded = written
        let length = loopFrames > 0 ? Int((Double(loopFrames) * format.sampleRate / Self.rate).rounded()) : decoded
        let start = decoded > length ? (decoded - length) / 2 : 0
        let window = Array(mono[start..<min(decoded, start + length)])
        DispatchQueue.main.sync {
            if let previous = self.loaded { self.retired.append(previous) }
            self.loaded = KZLoopBuffer(id: id, samples: window)
        }
        return true
    }

    private static func random(_ s: State) -> Float {
        s.seed = s.seed &+ 0x6d2b79f5
        var r = (s.seed ^ (s.seed >> 15)) &* (1 | s.seed)
        r ^= r &+ ((r ^ (r >> 7)) &* (61 | r))
        return Float((r ^ (r >> 14))) / 4294967296.0 * 2 - 1
    }

    // One stereo sample (the recipes of noise.mjs, at one common loudness).
    private static func next(_ s: State) -> (Float, Float) {
        if s.gain != s.target {
            s.gain = s.gain < s.target ? min(s.target, s.gain + s.step) : max(s.target, s.gain - s.step)
        }
        var out: Float = 0
        var outRight: Float? = nil
        switch s.kind {
        case 1:
            out = random(s) * 0.277 * 0.55
        case 2:
            let w = random(s)
            s.b0 = 0.99886 * s.b0 + w * 0.0555179
            s.b1 = 0.99332 * s.b1 + w * 0.0750759
            s.b2 = 0.969 * s.b2 + w * 0.153852
            s.b3 = 0.8665 * s.b3 + w * 0.3104856
            s.b4 = 0.55 * s.b4 + w * 0.5329522
            s.b5 = -0.7616 * s.b5 - w * 0.016898
            let pink = s.b0 + s.b1 + s.b2 + s.b3 + s.b4 + s.b5 + s.b6 + w * 0.5362
            s.b6 = w * 0.115926
            out = pink * 0.11 * 0.828 * 0.84
        case 3:
            s.brown = (s.brown + 0.02 * random(s)) / 1.02
            let x = s.brown * 3.5
            s.dcOut = x - s.dcIn + 0.9995 * s.dcOut
            s.dcIn = x
            out = s.dcOut * 0.807 * 0.94
        case 4:
            out = Float(sin(s.phase)) * 0.18
            s.phase += 2 * Double.pi * s.hz / s.sampleRate
            if s.phase > 2 * Double.pi { s.phase -= 2 * Double.pi }
        case 5:
            out = Float(sin(s.phaseLeft)) * deepLevel
            outRight = Float(sin(s.phaseRight)) * deepLevel
            s.phaseLeft += 2 * Double.pi * 500.0 / s.sampleRate
            s.phaseRight += 2 * Double.pi * 501.5 / s.sampleRate
            if s.phaseLeft > 2 * Double.pi { s.phaseLeft -= 2 * Double.pi }
            if s.phaseRight > 2 * Double.pi { s.phaseRight -= 2 * Double.pi }
        case 6:
            let count = s.loopCount
            if let samples = s.loopSamples, count > 0 {
                if s.loopIndex >= count { s.loopIndex = 0 }
                out = Float(samples[s.loopIndex]) / 32767
                s.loopIndex += 1
                if s.loopIndex >= count { s.loopIndex = 0 }   // the last sample runs straight into the first
            }
        default:
            out = 0
        }
        var left = out * s.gain
        var right = (outRight ?? out) * s.gain
        if s.chime >= 0 {
            let t = Double(s.chime) / s.sampleRate
            let envelope = (t < 0.02 ? t / 0.02 : exp(-(t - 0.02) * 1.6)) * 0.16
            let bell = Float((sin(2 * Double.pi * 523.25 * t) + 0.25 * sin(2 * Double.pi * 1046.5 * t)) * envelope)
            left += bell
            right += bell
            s.chime = t > 4.2 ? -1 : s.chime + 1
        }
        return (max(-0.95, min(0.95, left)), max(-0.95, min(0.95, right)))
    }

    private func fade(to target: Float, seconds: Double) {
        let samples = Float(max(1, seconds * state.sampleRate))
        state.step = max(0.000001, abs(target - state.gain) / samples)
        state.target = target
    }

    private static func kind(_ sound: String) -> Int {
        switch sound {
        case "white": return 1
        case "pink": return 2
        case "brown": return 3
        case "tone": return 4
        case "deep": return 5
        case "aquarium", "brook", "flow", "rain": return 6
        default: return 0
        }
    }

    func start(sound: String, volume: Float, hz: Double, stopAt: Double) throws -> Bool {
        let kind = Self.kind(sound)
        guard kind != 0 else { return false }
        if kind == 6 { guard let loaded, loaded.id == sound else { return false } }
        cancelStop()
        try ensureEngine()
        self.volume = volume
        state.gain = 0
        state.kind = 0
        if kind == 6, let loaded {
            // Silence first (kind 0), then the new loop's count, its samples and its start, then the kind.
            state.loopCount = min(state.loopCount, loaded.count)
            state.loopSamples = loaded.samples
            state.loopCount = loaded.count
            state.loopIndex = 0
        }
        state.phaseLeft = 0
        state.phaseRight = 0
        state.hz = hz
        state.kind = kind
        fade(to: volume, seconds: Self.fadeIn)
        isPlaying = true
        isPaused = false
        scheduleStop(stopAt)
        return true
    }

    func pause() {
        guard isPlaying else { return }
        cancelStop()
        fade(to: 0, seconds: Self.pauseFade)
        isPlaying = false
        isPaused = true
        let work = DispatchWorkItem { [weak self] in if self?.isPaused == true { self?.engine.pause() } }
        stopFinish = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.pauseFade + 0.1, execute: work)
    }

    func resume(stopAt: Double?) {
        guard isPaused, state.kind != 0 else { return }
        cancelStop()
        try? ensureEngine()
        fade(to: volume, seconds: 1.2)
        isPaused = false
        isPlaying = true
        if let stopAt { scheduleStop(stopAt) }
    }

    func stop(immediate: Bool, completion: (() -> Void)? = nil) {
        cancelStop()
        isPlaying = false
        isPaused = false
        if immediate || state.gain == 0 {
            state.kind = 0; state.gain = 0; state.target = 0
            if state.chime < 0 { stopEngine() }
            completion?()
            return
        }
        fade(to: 0, seconds: Self.fadeOut)
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.state.kind = 0
            if self.state.chime < 0 { self.stopEngine() }
            completion?()
        }
        stopFinish = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.fadeOut + 0.1, execute: work)
    }

    func retime(stopAt: Double, volume next: Float?) -> Bool {
        guard isPlaying, state.kind != 0 else { return false }
        cancelStop()
        if let next { volume = next }
        fade(to: volume, seconds: 0.3)
        scheduleStop(stopAt)
        return true
    }

    func setVolume(_ value: Float) {
        volume = value
        if isPlaying { fade(to: value, seconds: 0.3) }
    }

    func chime() {
        try? ensureEngine()
        state.chime = 0
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) { [weak self] in
            guard let self, !self.isPlaying, !self.isPaused, self.state.chime < 0 else { return }
            self.stopEngine()
        }
    }

    // At the end of the chosen time the sound fades out and stops by itself (also with the screen locked).
    private func scheduleStop(_ stopAt: Double) {
        guard stopAt > 0 else { return }
        let delay = stopAt / 1000 - Date().timeIntervalSince1970 - Self.fadeOut
        let work = DispatchWorkItem { [weak self] in
            self?.stop(immediate: false) { self?.onFinished?() }
        }
        stopWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0, delay), execute: work)
    }

    private func cancelStop() {
        stopWork?.cancel(); stopWork = nil
        stopFinish?.cancel(); stopFinish = nil
    }
}
