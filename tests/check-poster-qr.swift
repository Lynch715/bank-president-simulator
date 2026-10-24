import Foundation
import Vision
import AppKit

let expected = "https://lynch715.github.io/bank-president-simulator/"
for file in CommandLine.arguments.dropFirst() {
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]
    try VNImageRequestHandler(url: URL(fileURLWithPath: file)).perform([request])
    let values = request.results?.compactMap { $0.payloadStringValue } ?? []
    guard values.contains(expected) else { fatalError("Game QR not decoded: \(file): \(values)") }
    print("Verified QR: \(file) -> \(expected)")
}
