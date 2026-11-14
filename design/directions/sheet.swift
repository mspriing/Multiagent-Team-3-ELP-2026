import AppKit
// usage: sheet <dir> <prefix> <w-suffix> <cols> <cellW> <out> states...
let a = CommandLine.arguments
let dir = a[1], prefix = a[2], suf = a[3], cols = Int(a[4])!, cw = Double(a[5])!, out = a[6]
let states = Array(a[7...])
let first = NSImage(contentsOfFile: "\(dir)/\(prefix)-\(states[0])-\(suf).png")!
let ch = cw * first.size.height / first.size.width
let rows = (states.count + cols - 1) / cols
let img = NSImage(size: NSSize(width: (cw + 16) * Double(cols), height: (ch + 16) * Double(rows)))
img.lockFocus()
for (i, s) in states.enumerated() {
  let im = NSImage(contentsOfFile: "\(dir)/\(prefix)-\(s)-\(suf).png")!
  let c = i % cols, r = i / cols
  im.draw(in: NSRect(x: Double(c) * (cw + 16), y: Double(rows - 1 - r) * (ch + 16), width: cw, height: ch))
}
img.unlockFocus()
try! NSBitmapImageRep(data: img.tiffRepresentation!)!.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
