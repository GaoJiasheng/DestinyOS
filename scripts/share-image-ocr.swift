// DESIGN-GAP: macOS Vision supplies dependency-free PNG text verification in the local E2E suite.
import Foundation
import Vision
import ImageIO
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let handler = VNImageRequestHandler(url: url)
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-US", "zh-Hans"]
try handler.perform([request])
// DESIGN-GAP: Share cards use left/right text regions; Vision's result order can invert wrapped lines. Read each region top-to-bottom without dropping any recognized text.
let observations = (request.results ?? []).sorted { left, right in
    let leftColumn = left.boundingBox.minX < 0.5 ? 0 : 1
    let rightColumn = right.boundingBox.minX < 0.5 ? 0 : 1
    if leftColumn != rightColumn { return leftColumn < rightColumn }
    if left.boundingBox.maxY != right.boundingBox.maxY {
        return left.boundingBox.maxY > right.boundingBox.maxY
    }
    return left.boundingBox.minX < right.boundingBox.minX
}
for observation in observations {
    if let text = observation.topCandidates(1).first?.string { print(text) }
}
