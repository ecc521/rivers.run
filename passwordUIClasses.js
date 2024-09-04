class AutoCompleteValues {
  static CURRENT_PASSWORD = "current-password"
  static NEW_PASSWORD = "new-password"
}


class PasswordEntryBox {
  //A box for handling password entry for login, password changes, and account creation.
  //This box will not contain any validation whatsoever and is a building block for the forms.

  container = document.createElement("div")
  input = document.createElement("input")

  constructor({hidden, placeholder, minLength, autoComplete} = {}) {
    this.input.minLength = minLength
    this.input.placeholder = placeholder
    this.input.autocomplete = autoComplete

    //Checkbox to hide / show the password.
    let randomId = "passwordVisibilityToggle" + Math.random().toString(36).substring(2)
    this._hideShowButton = document.createElement("input")
    this._hideShowButton.type = "checkbox"
    this._hideShowButton.id = randomId
    this._hideShowButton.style.verticalAlign = "middle"
    this._hideShowButton.addEventListener("input", (function() {
      this.setHidden(!this._hideShowButton.checked)
    }).bind(this))

    this._hideShowLabel = document.createElement("label")
    this._hideShowLabel.htmlFor = randomId
    this._hideShowLabel.innerText = "Show"
    this._hideShowLabel.style.verticalAlign = "middle"

    this.container.appendChild(this.input)
    this.container.appendChild(this._hideShowButton)
    this.container.appendChild(this._hideShowLabel)

    this.setHidden(hidden)
    this._hideShowButton.checked = !hidden
  }

  setHidden(newHidden) {
    this.input.type = newHidden ? "password" : "text"
  }

  reset() {
    this.input.value = ""
  }

  getValue() {
    return this.input.value
  }
}


class PasswordConfirmingUnit {
  //Manages both a password entry and a password confirmation entry.
  //If the two do not match, a validity error will be raised on the form automatically.
  //getValue will return the value contained in both password entries, or null if the passwords do not match.

  constructor({hidden = true, minLength = 6, autoComplete = AutoCompleteValues.CURRENT_PASSWORD} = {}) {
    this.container = document.createElement("div")

    this._passwordEntry = new PasswordEntryBox({hidden, minLength, placeholder: "Enter Password"})
    this.container.appendChild(this._passwordEntry.container)

    this._passwordConfirm = new PasswordEntryBox({hidden, minLength, placeholder: "Confirm Password"})
    this.container.appendChild(this._passwordConfirm.container)

    this._passwordEntry.input.addEventListener("keyup", this._validate.bind(this))
    this._passwordConfirm.input.addEventListener("keyup", this._validate.bind(this))
  }

  passwordsMatch() {
    return this._passwordEntry.getValue() === this._passwordConfirm.getValue()
  }

  _validate() {
    if (!this.passwordsMatch()) {
      this._passwordConfirm.input.setCustomValidity("Passwords do not match")
    }
    else {
      this._passwordConfirm.input.setCustomValidity("")
    }
  }

  getValue() {
    if (!this.passwordsMatch()) {
      return null
    }
    return this._passwordEntry.getValue()
  }
}


//Login: One field, no confirm, reset option
//Create: Two fields, confirm
//Change: Two fields, confirm



export {PasswordEntryBox, PasswordConfirmingUnit}