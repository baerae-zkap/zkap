#!/bin/bash
# remove dist directory
rm -rf ./dist
echo remove ./dist 'done'

# generate dist
npm run build
echo build 'done'

gcloud auth login
echo gcloud auth login 'done'

npx google-artifactregistry-auth
echo npx google-artifactregistry-auth 'done'

# publish!
npm publish
