; Scopes

[
  (source_file)
  (function_definition)
  (law_declaration)
  (block)
  (lambda)
  (case_clause)
  (dependent_function_type)
  (exists_type)
] @local.scope

; Definitions

(function_definition
  name: [
    (identifier) @local.definition.function
    (scoped_identifier
      (identifier) @local.definition.function .)
  ])

(law_declaration
  name: [
    (identifier) @local.definition.function
    (scoped_identifier
      (identifier) @local.definition.function .)
  ])

(type_declaration
  name: [
    (identifier) @local.definition.type
    (scoped_identifier
      (identifier) @local.definition.type .)
  ])

(constructor_declaration
  name: [
    (identifier) @local.definition.type
    (scoped_identifier
      (identifier) @local.definition.type .)
  ])

(import_declaration
  alias: (identifier) @local.definition.namespace)

(parameter
  name: (identifier) @local.definition.parameter)

(for_clause
  name: (identifier) @local.definition.parameter)

(exists_clause
  name: (identifier) @local.definition.parameter)

(lambda
  parameter: (identifier) @local.definition.parameter)

(dependent_function_type
  name: (identifier) @local.definition.parameter)

(exists_type
  name: (identifier) @local.definition.parameter)

(let_statement
  pattern: (identifier) @local.definition.var)

(let_statement
  pattern: (pattern
    (identifier) @local.definition.var))

(quantified_pattern
  name: (identifier) @local.definition.var)

(parallel_let_statement
  name: (identifier) @local.definition.var)

(bind_statement
  name: (identifier) @local.definition.var)

(case_clause
  pattern: (identifier) @local.definition.var)

(case_clause
  pattern: (pattern
    (identifier) @local.definition.var))

(rewrite
  name: (identifier) @local.definition.var)

; References

(identifier) @local.reference
