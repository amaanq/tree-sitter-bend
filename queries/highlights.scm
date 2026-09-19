; Variables
(identifier) @variable

((identifier) @variable.builtin
  (#eq? @variable.builtin "_"))

; A capitalized name is a datatype or a family
((identifier) @type
  (#lua-match? @type "^[A-Z][A-Za-z0-9_]*$"))

; The segments before the last one are namespaces
(scoped_identifier
  (identifier) @module
  .
  (identifier))

((scoped_identifier
  (identifier) @type
  .
  (identifier))
  (#lua-match? @type "^[A-Z][A-Za-z0-9_]*$"))

((identifier) @type.builtin
  (#any-of? @type.builtin
    "Empty" "Unit" "Bool" "Cmp" "Either" "Sigma" "Pair" "Nat" "U32" "F32" "Char" "String"
    "Maybe" "Result" "List" "Word" "Array" "Map" "Set" "Equal" "IO" "Chan" "File" "Socket"
    "Listener" "Window" "Audio" "Image" "Event" "App"))

; Declarations
(function_definition
  name: [
    (identifier) @function
    (scoped_identifier
      (identifier) @function .)
  ])

(law_declaration
  name: [
    (identifier) @function
    (scoped_identifier
      (identifier) @function .)
  ])

(type_declaration
  name: [
    (identifier) @type.definition
    (scoped_identifier
      (identifier) @type.definition .)
  ])

(constructor_declaration
  name: [
    (identifier) @constructor
    (scoped_identifier
      (identifier) @constructor .)
  ])

(field_declaration
  name: (identifier) @variable.member)

(parameter
  name: (identifier) @variable.parameter)

(for_clause
  name: (identifier) @variable.parameter)

(exists_clause
  name: (identifier) @variable.parameter)

(lambda
  parameter: (identifier) @variable.parameter)

(dependent_function_type
  name: (identifier) @variable.parameter)

(exists_type
  name: (identifier) @variable.parameter)

(decorator) @attribute

; Modules
(import_declaration
  path: (import_path) @module)

(import_declaration
  alias: (identifier) @module)

; Types
(type_application
  name: [
    (identifier) @type
    (scoped_identifier
      (identifier) @type .)
  ])

(kind) @type.builtin

(do_block
  monad: [
    (identifier) @type
    (scoped_identifier
      (identifier) @type .)
  ])

(quantity) @constant.builtin

; Constructors
(constructor
  name: [
    (identifier) @constructor
    (scoped_identifier
      (identifier) @constructor .)
  ])

(constructor_pattern
  name: [
    (identifier) @constructor
    (scoped_identifier
      (identifier) @constructor .)
  ])

(match_arm
  name: [
    (identifier) @constructor
    (scoped_identifier
      (identifier) @constructor .)
  ])

((constructor
  name: (identifier) @boolean)
  (#any-of? @boolean "True" "False"))

((constructor_pattern
  name: (identifier) @boolean)
  (#any-of? @boolean "True" "False"))

; Functions
(call
  function: [
    (identifier) @function.call
    (scoped_identifier
      (identifier) @function.call .)
  ])

(call
  function: (type_application
    name: [
      (identifier) @function.call
      (scoped_identifier
        (identifier) @function.call .)
    ]))

(call
  "!" @punctuation.special)

(hole
  "?" @punctuation.special
  name: (identifier) @label)

; Literals
(string) @string

(escape_sequence) @string.escape

(char) @character

(integer) @number

(natural) @number

(float) @number.float

(comment) @comment @spell

; Keywords
[
  "def"
  "law"
] @keyword.function

"type" @keyword.type

[
  "match"
  "case"
] @keyword.conditional

"do" @keyword

"return" @keyword.return

[
  "import"
  "as"
] @keyword.import

[
  "for"
  "exs"
  "where"
  "is"
] @keyword

; Operators
[
  "&"
  "|"
  "||"
  "&&"
  "<"
  "<="
  ">"
  ">="
  "<>"
  "++"
  "<&>"
  ".|."
  ".^."
  ".&."
  "<<"
  ">>"
  "+"
  "-"
  "*"
  "/"
  "%"
  "^"
  "=="
  "!="
  "="
  "<-"
  "->"
  "=>"
  "@"
  "~"
] @operator

; Punctuation
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
  "\\{"
] @punctuation.bracket

(type_application
  [
    "<"
    ">"
  ] @punctuation.bracket)

(type_parameters
  [
    "<"
    ">"
  ] @punctuation.bracket)

(do_block
  [
    "<"
    ">"
  ] @punctuation.bracket)

[
  ","
  ":"
  ";"
] @punctuation.delimiter

(scoped_identifier
  "." @punctuation.delimiter)
