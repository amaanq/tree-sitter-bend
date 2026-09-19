package tree_sitter_bend_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_bend "github.com/amaanq/tree-sitter-bend/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_bend.Language())
	if language == nil {
		t.Errorf("Error loading Bend grammar")
	}
}
