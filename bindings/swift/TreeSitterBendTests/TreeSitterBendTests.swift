import XCTest
import SwiftTreeSitter
import TreeSitterBend

final class TreeSitterBendTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_bend())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Bend grammar")
    }
}
