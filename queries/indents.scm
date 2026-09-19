[
  (function_definition)
  (type_declaration)
  (law_declaration)
  (match_statement)
  (case_clause)
  (do_block)
  (lambda)
] @indent.begin

((arguments) @indent.align
  (#set! indent.open_delimiter "(")
  (#set! indent.close_delimiter ")"))

((parameters) @indent.align
  (#set! indent.open_delimiter "(")
  (#set! indent.close_delimiter ")"))

((tuple) @indent.align
  (#set! indent.open_delimiter "(")
  (#set! indent.close_delimiter ")"))

((list) @indent.align
  (#set! indent.open_delimiter "[")
  (#set! indent.close_delimiter "]"))

((constructor) @indent.align
  (#set! indent.open_delimiter "{")
  (#set! indent.close_delimiter "}"))

[
  ")"
  "]"
  "}"
] @indent.end

(case_clause
  "case" @indent.branch)

(comment) @indent.auto
