#!/bin/bash

cd public/brands

# Remove non-standard files
find . -type f -not -name "*_b.png" -not -name "*_w.png" -exec rm {} \; 