#!/bin/sh

# Update date in plugin.json
sed -i "s/\"updated\": \".*\"/\"updated\": \"`date +%Y-%m-%d`\"/" plugin.json

# Build & bump
grunt && git add dist && grunt bump
