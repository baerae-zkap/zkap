#!/bin/bash
# remove dist directory
rm -rf ./dist
echo remove ./dist 'done'

# generate dist
npm run build
echo build 'done'

# publish!
npm publish
