// שומר הסף — lifts the shield when the chosen time ends, even if the app is not running (a DeviceActivity Monitor
// extension). NOT part of any target in this build — see README.md.
#if KZ_FAMILY_CONTROLS
import DeviceActivity
import ManagedSettings

final class KZDeviceActivityMonitor: DeviceActivityMonitor {
    private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("kz.hitbodedut"))

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        store.clearAllSettings()
    }
}
#endif
