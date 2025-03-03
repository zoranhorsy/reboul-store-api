#!/bin/bash

cd public/brands

# Function to rename files
rename_brand_files() {
    local brand_dir="${1%/}"  # Remove trailing slash
    local brand_name=$(basename "$brand_dir" | tr -d ' ')
    
    # Find white logo variants and rename to BRAND_w.png
    find "$brand_dir" -type f \( -name "*_w.png" -o -name "*w.png" -o -name "*WHITE.png" -o -name "*white.png" \) -exec mv {} "$brand_dir/${brand_name}_w.png" \;
    
    # Find black logo variants and rename to BRAND_b.png
    find "$brand_dir" -type f \( -name "*_b.png" -o -name "*b.png" -o -name "*BLACK.png" -o -name "*black.png" \) -exec mv {} "$brand_dir/${brand_name}_b.png" \;
}

# Process each brand directory
for brand_dir in */; do
    if [ -d "$brand_dir" ]; then
        rename_brand_files "$brand_dir"
    fi
done

echo "Fichiers renommés avec succès" 