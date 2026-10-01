// שומר הסף — what the shield's button does (a ManagedSettings "Shield Action" extension): "חזור לכזוהר הרקיע" closes
// the blocked app's shield (the system returns to the Home Screen; an extension cannot open another app directly).
// NOT part of any target in this build — see README.md.
#if KZ_FAMILY_CONTROLS
import ManagedSettings

final class KZShieldAction: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(action == .primaryButtonPressed ? .close : .none)
    }
    override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(.close)
    }
    override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(.close)
    }
}
#endif
