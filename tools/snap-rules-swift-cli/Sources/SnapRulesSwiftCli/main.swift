// CLI entry. Reads a batch request JSON from stdin (or --in path), writes
// a batch response JSON to stdout (or --out path).
//
// Request shape:
//   {
//     "asOf": "2026-06-01",     // optional global default
//     "requests": [
//       { "state": "CA", "asOf": "2026-06-01"?, "facts": { ... v0.6 facts ... } },
//       ...
//     ]
//   }
//
// Response shape:
//   {
//     "engine": "swift:snap-rules-cli@1",
//     "responses": [
//       { "verdict": "APPROVE"|"DENY"|null, "benefit": <num>|null,
//         "reason": "...", "not_implemented_surfaces": ["..."]? },
//       ...
//     ]
//   }
//
// Same-order response for each request. Single binary invocation = fast.

import Foundation

struct Request: Codable {
    let state: String
    let asOf: String?
    let facts: Facts
}

struct BatchRequest: Codable {
    let asOf: String?
    let requests: [Request]
}

struct BatchResponse: Codable {
    let engine: String
    let responses: [VerdictResult]
}

private func parseISO(_ s: String) -> Date? {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.timeZone = TimeZone(identifier: "UTC")
    return f.date(from: s)
}

func runCli() {
    var inputPath: String? = nil
    var outputPath: String? = nil
    let args = CommandLine.arguments
    var i = 1
    while i < args.count {
        switch args[i] {
        case "--in": inputPath = args[i+1]; i += 2
        case "--out": outputPath = args[i+1]; i += 2
        case "-h", "--help":
            print("Usage: SnapRulesSwiftCli [--in <path>] [--out <path>]")
            print("Reads batch request JSON from stdin (or --in), writes batch response JSON to stdout (or --out).")
            exit(0)
        default: i += 1
        }
    }

    let inputData: Data
    if let p = inputPath {
        guard let d = try? Data(contentsOf: URL(fileURLWithPath: p)) else {
            FileHandle.standardError.write("Failed to read \(p)\n".data(using: .utf8)!)
            exit(1)
        }
        inputData = d
    } else {
        inputData = FileHandle.standardInput.readDataToEndOfFile()
    }

    let batch: BatchRequest
    do {
        batch = try JSONDecoder().decode(BatchRequest.self, from: inputData)
    } catch {
        FileHandle.standardError.write("Parse error: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

    let defaultAsOf = parseISO(batch.asOf ?? "2026-06-01") ?? Date()
    var responses: [VerdictResult] = []
    responses.reserveCapacity(batch.requests.count)

    for req in batch.requests {
        let asOf = parseISO(req.asOf ?? req.facts.as_of_date ?? batch.asOf ?? "2026-06-01") ?? defaultAsOf
        let result = composeVerdict(req.facts, state: req.state, asOf: asOf)
        responses.append(result)
    }

    let resp = BatchResponse(engine: "swift:snap-rules-cli@1", responses: responses)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted]
    let outData = try! encoder.encode(resp)

    if let p = outputPath {
        try! outData.write(to: URL(fileURLWithPath: p))
    } else {
        FileHandle.standardOutput.write(outData)
    }
}

runCli()
