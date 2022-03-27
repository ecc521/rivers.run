npx cap add ios
npx cordova-res ios --copy

echo "Remember to set version codes in XCode"
echo "Also add deep link support:"
echo "https://capacitorjs.com/docs/guides/deep-links"

echo "Also add Location Privacy Descriptions"
echo "https://capacitorjs.com/docs/apis/geolocation#getcurrentposition"

echo "Use https://devdactic.com/capacitor-google-sign-in/ to read how to configure Google Sign in"

echo "Also set Bundle name in Info.plist to rivers.run so that the Google Authentication prompt displays rivers.run rather than App. This should replace the default value of $(PRODUCT_NAME)"
