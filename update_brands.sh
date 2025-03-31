#!/bin/bash

cd public/brands

# Function to clean folder name
clean_name() {
    echo "$1" | tr -d ' &' | tr '[:lower:]' '[:upper:]'
}

# Rename folders
for dir in */; do
    if [ -d "$dir" ]; then
        old_name="${dir%/}"
        new_name=$(clean_name "$old_name")
        if [ "$old_name" != "$new_name" ]; then
            mv "$old_name" "$new_name"
            echo "Renamed folder: $old_name -> $new_name"
        fi
    fi
done

# Rename files in each folder
for dir in */; do
    if [ -d "$dir" ]; then
        folder_name="${dir%/}"
        echo "Processing $folder_name..."
        
        # Rename white logo
        find "$folder_name" -type f \( -name "*_w.png" -o -name "*w.png" -o -name "*WHITE.png" -o -name "*white.png" \) -exec mv {} "$folder_name/${folder_name}_w.png" \;
        
        # Rename black logo
        find "$folder_name" -type f \( -name "*_b.png" -o -name "*b.png" -o -name "*BLACK.png" -o -name "*black.png" \) -exec mv {} "$folder_name/${folder_name}_b.png" \;
        
        # Remove non-standard files
        find "$folder_name" -type f -not -name "${folder_name}_w.png" -not -name "${folder_name}_b.png" -delete
    fi
done

# Add changes to git
cd ../..
git add public/brands/
git commit -m "fix: standardize brand folders and files"
git push origin main 