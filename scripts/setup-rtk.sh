#!/bin/bash
# Holdify RTK Setup Script
# Installs RTK to reduce LLM token consumption by 60-90%
# This means your LST yield goes further — more AI, same principal.

set -e

echo "=== Holdify RTK Setup ==="
echo "RTK reduces token usage by 60-90%, making your LST yield last longer."
echo ""

# Check if RTK is already installed
if command -v rtk &> /dev/null; then
    echo "RTK is already installed: $(rtk --version)"
else
    echo "Installing RTK..."

    # Try Homebrew first (macOS)
    if command -v brew &> /dev/null; then
        brew install rtk
    else
        # Fallback to curl installer
        curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
    fi

    echo "RTK installed successfully."
fi

echo ""

# Initialize RTK globally for Claude Code
echo "Initializing RTK for Claude Code..."
rtk init --global

echo ""
echo "=== Setup Complete ==="
echo ""
echo "RTK is now active. Token savings:"
echo "  - ls/tree:     -80% tokens"
echo "  - cat/read:    -70% tokens"
echo "  - grep/rg:     -80% tokens"
echo "  - cargo test:  -90% tokens"
echo ""
echo "Run 'rtk gain' to see your savings over time."
echo "Your LST yield now covers more AI usage automatically."
