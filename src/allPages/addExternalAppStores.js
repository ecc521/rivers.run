if (!window.Capacitor && !window.isAndroid) {
  let externalAppStoresDiv = document.createElement("div")
  externalAppStoresDiv.id = "externalAppStoresDiv"
  document.documentElement.appendChild(externalAppStoresDiv)

  function createButton(href, src, text) {
    let link = document.createElement("a")
    link.href = href
    link.target = "_blank"

    let img = document.createElement("img")
    img.src = src
    img.alt = text

    link.appendChild(img)
    externalAppStoresDiv.appendChild(link)
  }

  createButton(
    "https://apps.apple.com/us/app/rivers-run/id1552809249",
    "resources/badges/appstore.svg",
    "Get Rivers.run on the App Store"
  )

  createButton(
    "https://play.google.com/store/apps/details?id=run.rivers.twa",
    "resources/badges/googleplay.svg",
    "Get Rivers.run on Google Play"
  )
}
