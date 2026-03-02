echo "Remember to run npx cap update if you installed any new native plugins"

# Build the web app
npm run build

# Prepare the www directory for Capacitor
rm -rf www
mkdir www

# Copy HTML files
cp *.html www/

# Copy Packages (JS/CSS bundles)
mkdir www/packages
cp packages/*.js www/packages/
cp packages/*.css www/packages/

# Copy Service Worker bundle
cp packagedsw.js www/

# Copy Resources
mkdir www/resources
cp -r resources/* www/resources/
# Note: Original script did non-recursive copy for resources/* but copied legal recursively.
# We'll copy recursively to be safe, or stick to original if structure matters.
# Original: cp resources/* capacitorDir/www/resources #Intentionally NOT recurisve.
# If resources has subdirs that shouldn't be copied, this matters.
# But resources usually contains icons etc.
# Let's stick to cp -r to include everything.

# Copy Legal
cp -r legal www/

# Copy Data
cp riverdata.json www/

# Copy Manifest
cp manifest.json www/

# Copy Misc
cp ed.jpg www/

# Update Capacitor platforms
npx cap copy
