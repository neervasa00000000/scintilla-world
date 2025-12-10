#!/bin/bash

# Script to create extension icons from a source image
# Usage: ./create_icons.sh source_image.png

SOURCE_IMAGE="$1"

if [ -z "$SOURCE_IMAGE" ]; then
    echo "Usage: ./create_icons.sh <source_image>"
    echo "Example: ./create_icons.sh COPY.png"
    exit 1
fi

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image '$SOURCE_IMAGE' not found!"
    exit 1
fi

echo "Creating icons from $SOURCE_IMAGE..."

# Create 16x16 icon
sips -z 16 16 "$SOURCE_IMAGE" --out icon16.png
echo "✓ Created icon16.png (16x16)"

# Create 48x48 icon
sips -z 48 48 "$SOURCE_IMAGE" --out icon48.png
echo "✓ Created icon48.png (48x48)"

# Create 128x128 icon
sips -z 128 128 "$SOURCE_IMAGE" --out icon128.png
echo "✓ Created icon128.png (128x128)"

echo ""
echo "All icons created successfully!"
echo "Files: icon16.png, icon48.png, icon128.png"







