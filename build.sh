#!/usr/bin/env bash

rm -rf ./dist
tsc
cp src/api-spec.yaml dist/api-spec.yaml
