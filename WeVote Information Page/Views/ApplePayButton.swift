import SwiftUI
import PassKit

struct ApplePayButton: UIViewRepresentable {
    var type: PKPaymentButtonType = .donate
    var style: PKPaymentButtonStyle = .black
    var cornerRadius: CGFloat = 12
    let action: () -> Void

    func makeUIView(context: Context) -> PKPaymentButton {
        let button = PKPaymentButton(paymentButtonType: type, paymentButtonStyle: style)
        button.cornerRadius = cornerRadius
        button.addTarget(context.coordinator, action: #selector(Coordinator.didTap), for: .touchUpInside)
        button.accessibilityLabel = "Donate with Apple Pay"
        return button
    }

    func updateUIView(_ uiView: PKPaymentButton, context: Context) {
        uiView.cornerRadius = cornerRadius
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(action: action)
    }

    final class Coordinator: NSObject {
        private let action: () -> Void

        init(action: @escaping () -> Void) {
            self.action = action
        }

        @objc func didTap() {
            action()
        }
    }
}
