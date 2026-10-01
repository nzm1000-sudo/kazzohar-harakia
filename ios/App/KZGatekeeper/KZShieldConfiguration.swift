// שומר הסף — the shield shown over a blocked app (a ManagedSettingsUI "Shield Configuration" extension).
// NOT part of any target in this build (see README.md in this folder): add it to a new Shield Configuration Extension
// target only after Apple has granted the Family Controls entitlement to a paid team.
#if KZ_FAMILY_CONTROLS
import ManagedSettings
import ManagedSettingsUI
import UIKit

final class KZShieldConfiguration: ShieldConfigurationDataSource {
    private let gold = UIColor(red: 0.725, green: 0.604, blue: 0.357, alpha: 1)
    private let ink = UIColor(red: 0.914, green: 0.882, blue: 0.82, alpha: 1)

    private func configuration() -> ShieldConfiguration {
        ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor(white: 0.02, alpha: 0.92),
            icon: UIImage(systemName: "water.waves"),
            title: ShieldConfiguration.Label(text: "זה הזמן שבחרת לעצמך", color: ink),
            subtitle: ShieldConfiguration.Label(text: "האפליקציה תחזור להיות זמינה כשההתבודדות תסתיים.", color: ink.withAlphaComponent(0.7)),
            primaryButtonLabel: ShieldConfiguration.Label(text: "חזור לכזוהר הרקיע", color: UIColor(white: 0.03, alpha: 1)),
            primaryButtonBackgroundColor: gold,
            secondaryButtonLabel: nil
        )
    }

    override func configuration(shielding application: Application) -> ShieldConfiguration { configuration() }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { configuration() }
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { configuration() }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { configuration() }
}
#endif
