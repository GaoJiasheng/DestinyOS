import SwiftUI
import WidgetKit

struct WidgetDay: Codable {
  let startsAt: Double, expiresAt: Double
  let date, title, line, stars: String
  let cardReversed: Bool
  let dimensions: [String]
  let color, colorHex, numbers, hours, card, cardLabel, url: String
  let background, foreground, accent: String
}
struct WidgetSnapshot: Codable {
  let version: Int
  let locale, stale: String
  let days: [WidgetDay]
}
struct FortuneEntry: TimelineEntry {
  let date: Date
  let day: WidgetDay?
  let message: String
}
// DESIGN-GAP: Native gallery and empty states use catalog-generated copy.json.
// All personalized fields were translated by next-intl before entering App Group storage.
func copy(_ key: String) -> String {
  let language = Locale.preferredLanguages.first ?? "en"
  let locale = language.hasPrefix("zh") ? (language.contains("Hant") || language.contains("TW") ? "zh-TW" : "zh") : "en"
  guard let url = Bundle.main.url(forResource: "copy", withExtension: "json"),
        let data = try? Data(contentsOf: url),
        let catalogs = try? JSONDecoder().decode([String: [String: String]].self, from: data) else { return "" }
  return catalogs[locale]?[key] ?? ""
}
struct FortuneProvider: TimelineProvider {
  func placeholder(in context: Context) -> FortuneEntry { FortuneEntry(date: Date(), day: nil, message: copy("mobile.widget.empty")) }
  func getSnapshot(in context: Context, completion: @escaping (FortuneEntry) -> Void) { completion(entries().first!) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<FortuneEntry>) -> Void) {
    let values = entries()
    completion(Timeline(entries: values, policy: .after(values.last!.date.addingTimeInterval(60 * 60))))
  }
  func entries() -> [FortuneEntry] {
    let now = Date()
    guard let raw = UserDefaults(suiteName: "group.pub.gavin.tianji")?.string(forKey: "tianji.widget.v1"),
          let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: Data(raw.utf8)), snapshot.version == 1 else {
      return [FortuneEntry(date: now, day: nil, message: copy("mobile.widget.empty"))]
    }
    let current = snapshot.days.first { $0.startsAt / 1000 <= now.timeIntervalSince1970 && now.timeIntervalSince1970 < $0.expiresAt / 1000 }
    var entries = [FortuneEntry(date: now, day: current, message: current?.line ?? snapshot.stale)]
    for day in snapshot.days where day.startsAt / 1000 > now.timeIntervalSince1970 {
      entries.append(FortuneEntry(date: Date(timeIntervalSince1970: day.startsAt / 1000), day: day, message: day.line))
    }
    if let last = snapshot.days.last, last.expiresAt / 1000 > now.timeIntervalSince1970 {
      entries.append(FortuneEntry(date: Date(timeIntervalSince1970: last.expiresAt / 1000), day: nil, message: snapshot.stale))
    }
    return entries
  }
}
extension Color {
  init(hex: String) {
    let value = UInt64(hex.dropFirst(), radix: 16) ?? 0
    self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
  }
}
struct FortuneView: View {
  let entry: FortuneEntry
  @Environment(\.widgetFamily) var family
  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        VStack(spacing: 2) { Image(systemName: "sparkles"); Text(entry.day?.stars.isEmpty == false ? entry.day!.stars : "✦").font(.caption2).lineLimit(1).minimumScaleFactor(0.5) }
      case .accessoryRectangular:
        VStack(alignment: .leading) { Text(entry.day?.stars ?? "✦").font(.caption); Text(entry.message).font(.caption).lineLimit(2) }
      default: content
      }
    }
    .widgetURL(URL(string: entry.day?.url ?? (entry.message == copy("mobile.widget.empty") ? "tianji:///me/birth" : "tianji:///today")))
    .containerBackground(for: .widget) { Color(hex: entry.day?.background ?? "#0b0d17") }
  }
  var content: some View {
    VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 5) {
      HStack { Text(entry.day?.title ?? copy("nav.today")).font(.caption); Spacer(); Text(entry.day?.date ?? "").font(.caption2) }
      if let day = entry.day, !day.stars.isEmpty {
        if family == .systemSmall {
          Spacer(minLength: 0)
          Text(day.stars).font(.title3).foregroundStyle(Color(hex: day.accent)).minimumScaleFactor(0.7)
          Circle().fill(Color(hex: day.colorHex)).frame(width: 32, height: 32).accessibilityLabel(day.color)
          Text(day.color).font(.caption2).lineLimit(2)
          Spacer(minLength: 0)
        } else {
          Text(day.line).font(.subheadline).lineLimit(2)
          HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
              ForEach(day.dimensions, id: \.self) { Text($0).font(.caption2).lineLimit(1).minimumScaleFactor(0.7) }
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 6) {
              HStack { Circle().fill(Color(hex: day.colorHex)).frame(width: 18, height: 18); Text(day.color).font(.caption2).lineLimit(2) }
              Text(day.numbers).font(.caption2)
            }
          }
          if family == .systemLarge {
            HStack(alignment: .center, spacing: 12) {
              Image(day.card).resizable().scaledToFit().frame(width: 52, height: 88).rotationEffect(.degrees(day.cardReversed ? 180 : 0)).accessibilityLabel(day.cardLabel)
              VStack(alignment: .leading, spacing: 8) { Text(day.cardLabel).font(.caption); Text(day.hours).font(.caption).fixedSize(horizontal: false, vertical: true) }
            }
          }
        }
      } else {
        Spacer(minLength: 0)
        Image(systemName: "sparkles").font(.title2)
        Text(entry.message).font(.subheadline).lineLimit(4)
        Spacer(minLength: 0)
      }
    }
    .foregroundStyle(Color(hex: entry.day?.foreground ?? "#ede4d3"))
  }
}
@main
struct TianjiDaily: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TianjiDaily", provider: FortuneProvider()) { FortuneView(entry: $0) }
      .configurationDisplayName(copy("mobile.widget.title"))
      .description(copy("mobile.widget.description"))
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular])
  }
}
