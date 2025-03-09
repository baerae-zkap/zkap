#!/bin/bash
# remove dist directory
rm -rf ./dist
echo remove ./dist 'done'

# generate dist
yarn build
echo build 'done'

# publish!
npm publish
