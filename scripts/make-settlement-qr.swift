import Foundation
import CoreImage
import AppKit

let address = "https://lynch715.github.io/bank-president-simulator/"
let filter = CIFilter(name: "CIQRCodeGenerator")!
filter.setValue(address.data(using: .utf8), forKey: "inputMessage")
filter.setValue("M", forKey: "inputCorrectionLevel")
let code = filter.outputImage!
let context = CIContext()
let image = context.createCGImage(code, from: code.extent)!
let size = image.width + 8
let rgb = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
rgb.setFillColor(CGColor(gray: 1, alpha: 1))
rgb.fill(CGRect(x: 0, y: 0, width: size, height: size))
rgb.interpolationQuality = .none
rgb.draw(image, in: CGRect(x: 4, y: 4, width: image.width, height: image.height))
let bitmap = NSBitmapImageRep(cgImage: rgb.makeImage()!)
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("QR generated: \(size) x \(size), M correction, four-module quiet zone")
