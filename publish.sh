#!/bin/bash
set -e

# Safety guard: direct publish bypasses CI version validation, dry-run, and
# environment protection gates. Use the GitHub Actions workflow instead.
if [ -z "$CI" ]; then
  echo "ERROR: publish.sh must not be run locally."
  echo "Use the GitHub Actions workflow (sdk-release-publish.yml) to publish."
  echo "If you must publish manually, run: npm publish --access public"
  exit 1
fi

# Clean and rebuild
rm -rf ./dist
echo "Cleaned dist/"

npm run build
echo "Build complete"

# Publish to npmjs.com (requires prior: npm login)
npm publish --access public
echo "Published to npmjs.com"
