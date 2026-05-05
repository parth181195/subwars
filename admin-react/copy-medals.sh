#!/bin/bash
# Copy medal images from subwars-overlay to admin-react

SOURCE="/home/parth/WebstormProjects/subwars-overlay/public/assets/medals"
DEST="/home/parth/WebstormProjects/pasoll-contest/admin-react/public/assets/medals"

echo "Creating destination directory..."
mkdir -p "$DEST"

echo "Copying medal images..."
for i in {1..8}; do
  if [ -f "$SOURCE/${i}.png" ]; then
    cp "$SOURCE/${i}.png" "$DEST/${i}.png"
    echo "✓ Copied ${i}.png"
  else
    echo "✗ ${i}.png not found in source"
  fi
done

echo ""
echo "✅ Copy complete!"
echo "Files in destination:"
ls -lh "$DEST"/*.png 2>/dev/null || echo "No files found in destination"

