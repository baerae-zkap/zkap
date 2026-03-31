#!/bin/bash
set -e

# Clean and rebuild
rm -rf ./dist
echo "Cleaned dist/"

npm run build
echo "Build complete"

# Publish to npmjs.com (requires prior: npm login)
npm publish --access public
echo "Published to npmjs.com"
