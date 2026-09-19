/**
 * @file Bend grammar for tree-sitter
 * @author Amaan Qureshi <contact@amaanq.com>
 * @license MIT
 * @see {@link https://bend-lang.com|official website}
 * @see {@link https://github.com/bendlang/bend|official repository}
 * @see {@link https://github.com/bendlang/bend/blob/main/guide/GUIDE.md|language guide}
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// The levels mirror the ones in bend.ts's INFIX_OPS table.
const PREC = {
  arrow: 0,
  pair: 1,
  or: 2,
  and: 3,
  compare: 4,
  cons: 5,
  bit_or: 6,
  bit_xor: 7,
  bit_and: 8,
  shift: 9,
  plus: 10,
  times: 11,
  unary: 12,
  postfix: 13,
};

/**
 * Creates a rule to match one or more of the rules separated by the separator
 *
 * @param {RuleOrLiteral} sep
 * @param {RuleOrLiteral} rule
 * @returns {SeqRule}
 */
function sep1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

/**
 * Creates a rule to match zero or more of the rules separated by a comma,
 * with an optional trailing comma
 *
 * @param {RuleOrLiteral} rule
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(seq(sep1(',', rule), optional(',')));
}

export default grammar({
  name: 'bend',

  conflicts: $ => [
    [$.primary_expression, $.pattern],
    [$._name, $.pattern],
    [$._name, $.quantified_pattern],
    [$._name, $._binder],
    [$.list, $.list_pattern],
  ],

  externals: $ => [
    $._newline,
    $._block_begin,
    $._lambda_begin,
    $._block_end,
    $._tail_begin,
    $._type_open,
    $._gt,
    $._ge,
    $._shr,
    $._error_sentinel,
  ],

  extras: $ => [
    $.comment,
    /\s/,
  ],

  supertypes: $ => [
    $.expression,
    $.primary_expression,
    $.pattern,
    $._statement,
    $._declaration,
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._declaration),

    _declaration: $ => choice(
      $.import_declaration,
      $.type_declaration,
      $.function_definition,
      $.law_declaration,
    ),

    // Import ::= "import" "Base" | "import" Path "as" Name
    import_declaration: $ => seq(
      'import',
      field('path', $.import_path),
      optional(seq('as', field('alias', $.identifier))),
    ),
    import_path: _ => /[^\s#]+/,

    // ADT ::= "type" Name ("<" [Bind ","?] ">")? "is" Term ":" [Ctr]
    type_declaration: $ => seq(
      'type',
      field('name', $._name),
      optional(field('parameters', $.type_parameters)),
      'is',
      field('kind', $.expression),
      ':',
      optional(field('body', alias($._constructor_block, $.block))),
    ),
    type_parameters: $ => seq(
      alias($._type_open, '<'),
      commaSep($.parameter),
      '>',
    ),
    _constructor_block: $ => seq(
      $._block_begin,
      $.constructor_declaration,
      repeat(seq(optional($._newline), $.constructor_declaration)),
      $._block_end,
    ),
    // Ctr ::= Name "{" [Bind ","?] "}"
    constructor_declaration: $ => seq(
      field('name', $._name),
      '{',
      commaSep(field('field', alias($.parameter, $.field_declaration))),
      '}',
    ),

    // Def ::= ("@unsafe")? "def" Name "(" [Bind ","?] ")" ("->" Term)? ":" Body
    function_definition: $ => seq(
      optional($.decorator),
      'def',
      field('name', $._name),
      field('parameters', $.parameters),
      optional(seq('->', field('return_type', $.expression))),
      ':',
      field('body', $.block),
    ),
    decorator: _ => '@unsafe',
    parameters: $ => seq('(', commaSep($.parameter), ')'),
    // Bind ::= Quant Name ":" Term | "~" Name ":" Term | Name
    parameter: $ => choice(
      seq(
        optional(field('quantifier', choice('-', '+', '~'))),
        field('name', $.identifier),
        ':',
        field('type', $.expression),
      ),
      field('name', $.identifier),
    ),

    // Law ::= "law" Name ":" [Clause] Body
    law_declaration: $ => seq(
      'law',
      field('name', $._name),
      ':',
      field('body', alias($._law_block, $.block)),
    ),
    _law_block: $ => seq(
      $._block_begin,
      repeat(seq(choice($.for_clause, $.exists_clause), $._newline)),
      $._statements,
      $._block_end,
    ),
    // Clause ::= ("for" Quant | "exs") Name ":" Term ("where" Term)?
    for_clause: $ => seq(
      'for',
      optional(field('quantifier', choice('-', '+'))),
      field('name', $.identifier),
      ':',
      field('type', $.expression),
      optional(seq('where', field('condition', $.expression))),
    ),
    exists_clause: $ => seq(
      'exs',
      field('name', $.identifier),
      ':',
      field('type', $.expression),
    ),

    // Body ::= Match | Local | Reply
    block: $ => seq($._block_begin, $._statements, $._block_end),

    _statements: $ => sep1(choice($._newline, ';'), $._statement),

    _statement: $ => choice(
      $.let_statement,
      $.parallel_let_statement,
      $.match_statement,
      $.import_statement,
      $.expression,
    ),

    // Local ::= (Quant Name | Term)+ "=" Term+ ";"? Body
    let_statement: $ => seq(
      field('pattern', $.pattern),
      '=',
      field('value', $.expression),
    ),
    parallel_let_statement: $ => seq(
      field('name', $._binder),
      repeat1(field('name', $._binder)),
      '=',
      field('value', $._fork_value),
      repeat1(field('value', $._fork_value)),
    ),
    _binder: $ => choice($.identifier, $.quantified_pattern),
    // Juxtaposed values stop short of operators: "f(x) g(y)", never "a + b c".
    _fork_value: $ => prec(-1, $.primary_expression),

    // Match ::= "match" [Term] ":" [Case]
    match_statement: $ => seq(
      'match',
      field('scrutinee', $.identifier),
      repeat(seq(optional(','), field('scrutinee', $.identifier))),
      ':',
      optional(seq(
        $._block_begin,
        sep1($._newline, $.case_clause),
        $._block_end,
      )),
    ),
    // Case ::= "case" [Term] ":" Body
    case_clause: $ => seq(
      'case',
      field('pattern', $.pattern),
      repeat(seq(optional(','), field('pattern', $.pattern))),
      ':',
      field('body', $.block),
    ),

    // A foreign def's body names its host implementations.
    import_statement: $ => seq('import', field('path', $.string)),

    // Patterns

    pattern: $ => choice(
      $.identifier,
      $.quantified_pattern,
      $.constructor_pattern,
      $.tuple_pattern,
      $.list_pattern,
      $.cons_pattern,
      $.successor_pattern,
      $.natural,
      $.integer,
      $.float,
      $.char,
      $.string,
    ),
    quantified_pattern: $ => seq(
      field('quantifier', choice('+', '-')),
      field('name', $.identifier),
    ),
    constructor_pattern: $ => seq(
      field('name', $._name),
      '{',
      commaSep(field('field', $.pattern)),
      '}',
    ),
    tuple_pattern: $ => seq(
      '(',
      $.pattern,
      repeat1(seq(',', $.pattern)),
      ')',
    ),
    list_pattern: $ => seq('[', commaSep($.pattern), ']'),
    cons_pattern: $ => prec.right(PREC.cons, seq(
      field('head', $.pattern),
      '<>',
      field('tail', $.pattern),
    )),
    successor_pattern: $ => prec.right(PREC.arrow, seq(
      $.natural,
      token.immediate('+'),
      field('predecessor', $.pattern),
    )),

    // Terms

    expression: $ => choice(
      $.primary_expression,
      $.write_expression,
      $.lambda,
      $.function_type,
      $.dependent_function_type,
      $.exists_type,
      $.binary_expression,
      $.unary_expression,
      $.successor,
      $.rewrite,
      $.do_block,
    ),

    // The terms a call or index suffix may follow.
    primary_expression: $ => choice(
      $._name,
      $.integer,
      $.natural,
      $.float,
      $.char,
      $.string,
      $.kind,
      $.quantity,
      $.hole,
      $.constructor,
      $.call,
      $.type_application,
      $.index_expression,
      $.match_expression,
      $.annotation,
      $.equality_type,
      $.reflexivity,
      $.parenthesized_expression,
      $.tuple,
      $.list,
      $.array,
    ),

    // Typ ::= "Type" | "Data" | "Kind" "(" Term ")"; Qnt ::= "Quant"
    kind: $ => choice(
      'Type',
      'Data',
      'Quant',
      seq('Kind', '(', field('quantity', $.expression), ')'),
    ),
    // Qua ::= "&0" | "&1" | "&2"
    quantity: _ => /&[012]/,
    // Hol ::= "?" Name
    hole: $ => seq('?', field('name', $.identifier)),

    // Ctr ::= Name "{" [Term ","?] "}"
    constructor: $ => prec(PREC.postfix, seq(
      field('name', $._name),
      '{',
      commaSep(field('argument', $.expression)),
      '}',
    )),

    // App ::= Term "(" [Term ","?] ")", with "!" offloading the call
    call: $ => prec(PREC.postfix, seq(
      field('function', $.primary_expression),
      optional(field('gpu', '!')),
      field('arguments', $.arguments),
    )),
    // Outranks a tuple so that "a b = f(x) (y, z)" reads as one call.
    arguments: $ => prec(1, seq(
      '(',
      commaSep(choice($.expression, $.template_argument)),
      ')',
    )),
    template_argument: $ => seq('~', $.expression),

    // ADT ::= Name "<" [Term ","?] ">"
    type_application: $ => prec(PREC.postfix, seq(
      field('name', $._name),
      alias($._type_open, '<'),
      commaSep(field('argument', $.expression)),
      '>',
    )),

    // Index ::= x "[" i "]" ("<-" v)?
    index_expression: $ => prec(PREC.postfix, seq(
      field('array', $.primary_expression),
      '[',
      field('index', $.expression),
      ']',
    )),
    write_expression: $ => prec.dynamic(1, prec.right(PREC.or, seq(
      field('target', $.index_expression),
      '<-',
      field('value', $.expression),
    ))),

    // Lam ::= Name "=>" Body
    lambda: $ => choice(
      seq(field('parameter', $.identifier), '=>', field('body', alias($._lambda_block, $.block))),
      prec(PREC.postfix + 1, seq(
        field('quantifier', '+'),
        field('parameter', $.identifier),
        '=>',
        field('body', alias($._lambda_block, $.block)),
      )),
    ),
    // The one block a ";" or ":" may close, so the scanner tells it apart.
    _lambda_block: $ => seq($._lambda_begin, $._statements, $._block_end),

    // Arrow ::= A "->" B
    function_type: $ => prec.right(PREC.arrow, seq(
      field('parameter', $.expression),
      '->',
      field('result', $.expression),
    )),
    // All ::= "@" Bind "->" Term
    dependent_function_type: $ => prec.right(PREC.arrow, seq(
      '@',
      optional(field('quantifier', choice('-', '+'))),
      field('name', $.identifier),
      ':',
      field('parameter', $.expression),
      '->',
      field('result', $.expression),
    )),
    // Exists ::= "&" Name ":" A "->" B
    exists_type: $ => prec.right(PREC.arrow, seq(
      '&',
      field('name', $.identifier),
      ':',
      field('parameter', $.expression),
      '->',
      field('result', $.expression),
    )),

    binary_expression: $ => {
      /** @type {Array<[RuleOrLiteral | RuleOrLiteral[], number, 'left' | 'right']>} */
      const table = [
        [['&', '|'], PREC.pair, 'right'],
        ['||', PREC.or, 'left'],
        ['&&', PREC.and, 'left'],
        [['<', '<=', alias($._gt, '>'), alias($._ge, '>=')], PREC.compare, 'left'],
        [['<>', '++', '<&>'], PREC.cons, 'right'],
        ['.|.', PREC.bit_or, 'left'],
        ['.^.', PREC.bit_xor, 'left'],
        ['.&.', PREC.bit_and, 'left'],
        [['<<', alias($._shr, '>>')], PREC.shift, 'left'],
        [['+', '-'], PREC.plus, 'left'],
        [['*', '/', '%'], PREC.times, 'left'],
      ];

      return choice(...table.map(([operators, precedence, associativity]) =>
        (associativity === 'right' ? prec.right : prec.left)(precedence, seq(
          field('left', $.expression),
          field('operator', Array.isArray(operators) ? choice(...operators) : operators),
          field('right', $.expression),
        )),
      ));
    },

    // Plus ::= "+" D: a reusable datatype, or a marked binder
    unary_expression: $ => prec(PREC.unary, seq(
      field('operator', '+'),
      field('argument', $.primary_expression),
    )),

    // Nat ::= NUMBER "n" "+" Term
    successor: $ => prec.right(PREC.arrow, seq(
      $.natural,
      token.immediate('+'),
      field('predecessor', $.expression),
    )),

    // Mat ::= "\" "{" Name ":" Term ";"? Term "}"; Efq ::= "\" "{" "}"
    match_expression: $ => seq(
      '\\{',
      repeat($.match_arm),
      optional(seq(field('default', $.expression), optional(';'))),
      '}',
    ),
    match_arm: $ => seq(
      field('name', $._name),
      ':',
      field('value', $.expression),
      optional(';'),
    ),

    // Rwt ::= "%" (Name "@")? Term ":" Term ";"? Body
    rewrite: $ => prec.right(seq(
      '%',
      optional(seq(field('name', $.identifier), '@')),
      field('equation', $.expression),
      ':',
      field('motive', $._motive),
      optional(field('body', choice(
        seq(';', $.block),
        alias($._tail_block, $.block),
      ))),
    )),
    _tail_block: $ => seq($._tail_begin, $._statements, $._block_end),
    // A tail token valid after any expression would keep every expression
    // state from merging.
    _motive: $ => choice(
      $.primary_expression,
      alias($._motive_pair, $.binary_expression),
      alias($._motive_exists, $.exists_type),
      alias($._motive_all, $.dependent_function_type),
    ),
    _motive_pair: $ => prec.right(PREC.pair, seq(
      field('left', $.primary_expression),
      field('operator', '&'),
      field('right', $._motive),
    )),
    _motive_exists: $ => prec.right(PREC.arrow, seq(
      '&',
      field('name', $.identifier),
      ':',
      field('parameter', $.primary_expression),
      '->',
      field('result', $._motive),
    )),
    _motive_all: $ => prec.right(PREC.arrow, seq(
      '@',
      optional(field('quantifier', choice('-', '+'))),
      field('name', $.identifier),
      ':',
      field('parameter', $.primary_expression),
      '->',
      field('result', $._motive),
    )),

    // Ann ::= "{" Term ":" Term "}"
    annotation: $ => seq(
      '{',
      field('value', $.expression),
      ':',
      field('type', $.expression),
      '}',
    ),
    // Eql ::= "{" Term "==" Term ":" Term "}"; Not ::= "{" a "!=" b ":" T "}"
    equality_type: $ => seq(
      '{',
      field('left', $.expression),
      field('operator', choice('==', '!=')),
      field('right', $.expression),
      ':',
      field('type', $.expression),
      '}',
    ),
    // Rfl ::= "{" "==" "}"
    reflexivity: _ => seq('{', '==', '}'),

    // Grp ::= "(" Body ")"; Tuple ::= "(" A ("," B)+ ")"; the ": T" names the operators' namespace
    parenthesized_expression: $ => seq(
      '(',
      $._parenthesized_body,
      optional(seq(':', field('type', $.expression))),
      ')',
    ),
    tuple: $ => seq(
      '(',
      $._parenthesized_body,
      repeat1(seq(',', $._parenthesized_body)),
      optional(seq(':', field('type', $.expression))),
      ')',
    ),
    _parenthesized_body: $ => sep1(';', $._statement),

    // List ::= "[" [A ","?] "]"
    list: $ => seq('[', commaSep(field('element', $.expression)), ']'),
    // Array ::= "[" A ":" T ("*" N | "^" D) "]"
    array: $ => prec(PREC.unary, seq(
      '[',
      field('value', $.expression),
      ':',
      field('type', $.expression),
      field('operator', choice('*', '^')),
      field('size', $.expression),
      ']',
    )),

    // DoBlock ::= "do" Name "<" [Term ","?] ">" ":" [DoStmt]
    do_block: $ => seq(
      'do',
      field('monad', $._name),
      alias($._type_open, '<'),
      commaSep(field('argument', $.expression)),
      '>',
      ':',
      field('body', alias($._do_block_body, $.block)),
    ),
    _do_block_body: $ => seq(
      $._block_begin,
      sep1(choice($._newline, ';'), $._do_statement),
      $._block_end,
    ),
    _do_statement: $ => choice(
      $.bind_statement,
      $.let_statement,
      $.return_statement,
      $.expression,
    ),
    // DoBind ::= Name ":" Term "<-" Term; DoLet ::= Name ":" Term "=" Term; DoExec ::= Term "<-" Term
    bind_statement: $ => choice(
      seq(
        field('name', $._binder),
        ':',
        field('type', $.expression),
        field('operator', choice('<-', '=')),
        field('value', $.expression),
      ),
      seq(
        field('type', $.expression),
        field('operator', '<-'),
        field('value', $.expression),
      ),
    ),
    return_statement: $ => seq('return', field('value', $.expression)),

    // Literals

    integer: _ => /\d+/,
    natural: _ => /\d+n/,
    float: _ => /\d+\.\d+([eE][+-]?\d+)?/,
    char: $ => seq(
      '\'',
      choice($.escape_sequence, alias(token.immediate(prec(1, /[^'\\]/)), $.character)),
      '\'',
    ),
    string: $ => seq(
      '"',
      repeat(choice(
        alias(token.immediate(prec(1, /[^"\\]+/)), $.string_content),
        $.escape_sequence,
      )),
      '"',
    ),
    escape_sequence: _ => token.immediate(seq(
      '\\',
      choice(
        /[ntr0\\'"]/,
        /u\{[0-9a-fA-F]+\}/,
      ),
    )),

    // A dotted name is one lexeme to Bend, but its segments are namespaces.
    _name: $ => choice($.identifier, $.scoped_identifier),
    scoped_identifier: $ => seq(
      $.identifier,
      repeat1(seq(token.immediate('.'), alias(token.immediate(/[A-Za-z0-9_]+/), $.identifier))),
    ),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    comment: _ => token(seq('#', /.*/)),
  },
});
