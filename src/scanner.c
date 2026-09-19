#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"

#include <stdint.h>
#include <string.h>

enum TokenType {
   NEWLINE,
   BLOCK_BEGIN,
   LAMBDA_BEGIN,
   BLOCK_END,
   TAIL_BEGIN,
   TYPE_OPEN,
   GT,
   GE,
   SHR,
   ERROR_SENTINEL,
};

// Bodies stack by the column of their first statement, and a shallower line or a closing bracket
// ends one. The high bit marks a lambda's body.
#define LAMBDA_BIT 0x8000
#define COLUMN_MASK 0x7fff

typedef struct {
   Array(uint16_t) blocks;
} Scanner;

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline bool is_name_head(int32_t c) {
   return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
}

static inline bool is_name_char(int32_t c) {
   return is_name_head(c) || (c >= '0' && c <= '9') || c == '.';
}

static inline uint16_t block_column(uint16_t block) { return block & COLUMN_MASK; }

static inline bool block_is_lambda(uint16_t block) { return (block & LAMBDA_BIT) != 0; }

static bool scan_statement_keyword(TSLexer *lexer) {
   const char *word = lexer->lookahead == 'c' ? "case" : lexer->lookahead == 'r' ? "return" : NULL;
   if (word == NULL) {
      return false;
   }
   for (const char *p = word; *p != '\0'; p++) {
      if (lexer->lookahead != *p) {
         return false;
      }
      advance(lexer);
   }
   return !is_name_char(lexer->lookahead);
}

static bool scan_angle(TSLexer *lexer, const bool *valid_symbols, bool spaced) {
   if (lexer->lookahead == '<') {
      if (spaced || !valid_symbols[TYPE_OPEN]) {
         return false;
      }
      advance(lexer);
      lexer->mark_end(lexer);
      lexer->result_symbol = TYPE_OPEN;
      switch (lexer->lookahead) {
         // "<-" binds, but "<-x" opens a telescope on an erased binder.
         case '-':
            advance(lexer);
            return is_name_head(lexer->lookahead);
         // "<&>" is the meet, "<&2" a quantity argument.
         case '&':
            advance(lexer);
            return lexer->lookahead != '>';
         case '=':
         case '<':
            return false;
         default:
            return true;
      }
   }

   // A ">" operator needs a space before it, so List<List<A>> closes twice.
   if (lexer->lookahead == '>' && spaced) {
      advance(lexer);
      if (lexer->lookahead == '=') {
         if (!valid_symbols[GE]) {
            return false;
         }
         advance(lexer);
         lexer->mark_end(lexer);
         lexer->result_symbol = GE;
         return true;
      }
      if (lexer->lookahead == '>') {
         if (!valid_symbols[SHR]) {
            return false;
         }
         advance(lexer);
         lexer->mark_end(lexer);
         lexer->result_symbol = SHR;
         return true;
      }
      if (valid_symbols[GT]) {
         lexer->mark_end(lexer);
         lexer->result_symbol = GT;
         return true;
      }
   }

   return false;
}

bool tree_sitter_bend_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
   Scanner *scanner = (Scanner *)payload;
   bool recovering = valid_symbols[ERROR_SENTINEL];

   lexer->mark_end(lexer);

   bool spaced = false;
   bool newline = false;
   for (;;) {
      int32_t c = lexer->lookahead;
      if (c == ' ' || c == '\t' || c == '\r') {
         spaced = true;
         skip(lexer);
      } else if (c == '\n') {
         newline = true;
         skip(lexer);
      } else if (c == '#') {
         spaced = true;
         while (lexer->lookahead != '\n' && !lexer->eof(lexer)) {
            skip(lexer);
         }
      } else {
         break;
      }
   }

   uint16_t block = *array_back(&scanner->blocks);
   uint16_t top = block_column(block);
   bool nested = scanner->blocks.size > 1;

   if (lexer->eof(lexer)) {
      if (valid_symbols[BLOCK_END] && nested) {
         array_pop(&scanner->blocks);
         lexer->result_symbol = BLOCK_END;
         return true;
      }
      return false;
   }

   int32_t c = lexer->lookahead;
   // get_column rescans the line, so only pay for it where a column matters.
   bool needs_column = newline || valid_symbols[BLOCK_BEGIN] || valid_symbols[LAMBDA_BEGIN];
   uint32_t column = needs_column ? lexer->get_column(lexer) : 0;

   if (recovering) {
      if (newline && column < top && nested) {
         array_pop(&scanner->blocks);
         lexer->result_symbol = BLOCK_END;
         return true;
      }
      return false;
   }

   // A spaced operator at line start continues the line before.
   if (newline && c == '>') {
      return scan_angle(lexer, valid_symbols, true);
   }
   if (newline && (c == '|' || c == '.' || c == '*' || c == '/' || c == '=' || c == '<')) {
      return false;
   }
   if (newline && (c == '&' || c == '+' || c == '-' || c == '%')) {
      advance(lexer);
      int32_t next = lexer->lookahead;
      if (next == ' ' || next == '\t' || (c == '-' && next == '>')) {
         return false;
      }
   }

   // A rewrite's ";" opens its tail, not the end of the enclosing lambda.
   bool closes = c == ')' || c == ']' || c == '}' || c == ',' || (c == '>' && !spaced) ||
                 (block_is_lambda(block) && (c == ':' || (c == ';' && !valid_symbols[TAIL_BEGIN])));

   // A required body starts wherever its first token is, so an "x =>" chain
   // may drop left on the next line; match cases, being optional, must indent
   // past the body around the match, as in "def f(x): match x:".
   if ((valid_symbols[BLOCK_BEGIN] || valid_symbols[LAMBDA_BEGIN]) && !closes) {
      bool required = !valid_symbols[NEWLINE] && !valid_symbols[BLOCK_END];
      uint16_t bound = required ? 0
                       : nested ? block_column(scanner->blocks.contents[scanner->blocks.size - 2])
                                : 0;
      if (column > bound) {
         bool lambda = valid_symbols[LAMBDA_BEGIN];
         array_push(&scanner->blocks, (uint16_t)(column | (lambda ? LAMBDA_BIT : 0)));
         lexer->result_symbol = lambda ? LAMBDA_BEGIN : BLOCK_BEGIN;
         return true;
      }
   }

   if (valid_symbols[BLOCK_END] && nested && (closes || (newline && column < top))) {
      array_pop(&scanner->blocks);
      lexer->result_symbol = BLOCK_END;
      return true;
   }

   if (newline && column == top && valid_symbols[NEWLINE]) {
      lexer->result_symbol = NEWLINE;
      return true;
   }

   if (valid_symbols[TAIL_BEGIN] && newline && !closes && column > 0) {
      array_push(&scanner->blocks, (uint16_t)column);
      lexer->result_symbol = TAIL_BEGIN;
      return true;
   }

   // A case or a do-statement may sit deeper than its siblings.
   if (newline && column > top && valid_symbols[NEWLINE] && is_name_head(c)) {
      if (scan_statement_keyword(lexer)) {
         lexer->result_symbol = NEWLINE;
         return true;
      }
      return false;
   }

   return scan_angle(lexer, valid_symbols, spaced || newline);
}

unsigned tree_sitter_bend_external_scanner_serialize(void *payload, char *buffer) {
   Scanner *scanner = (Scanner *)payload;
   unsigned size = 0;
   for (uint32_t i = 1;
        i < scanner->blocks.size && size + 1 < TREE_SITTER_SERIALIZATION_BUFFER_SIZE; i++) {
      uint16_t block = scanner->blocks.contents[i];
      buffer[size++] = (char)(block & 0xff);
      buffer[size++] = (char)(block >> 8);
   }
   return size;
}

void tree_sitter_bend_external_scanner_deserialize(void *payload, const char *buffer,
                                                   unsigned length) {
   Scanner *scanner = (Scanner *)payload;
   array_clear(&scanner->blocks);
   array_push(&scanner->blocks, 0);
   for (unsigned i = 0; i + 1 < length; i += 2) {
      uint16_t block = (uint16_t)((uint8_t)buffer[i] | ((uint8_t)buffer[i + 1] << 8));
      array_push(&scanner->blocks, block);
   }
}

void *tree_sitter_bend_external_scanner_create(void) {
   Scanner *scanner = ts_calloc(1, sizeof(Scanner));
   array_init(&scanner->blocks);
   tree_sitter_bend_external_scanner_deserialize(scanner, NULL, 0);
   return scanner;
}

void tree_sitter_bend_external_scanner_destroy(void *payload) {
   Scanner *scanner = (Scanner *)payload;
   array_delete(&scanner->blocks);
   ts_free(scanner);
}
