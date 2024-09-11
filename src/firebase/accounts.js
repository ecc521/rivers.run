import {initializeApp} from "firebase/app";
import {getAnalytics} from "firebase/analytics";
import {browserLocalPersistence, getAuth, setPersistence} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  setDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA8hvftc7idpGNcj5I9gvOqk-DQrTrkQco",
  authDomain: "rivers-run.firebaseapp.com",
  projectId: "rivers-run",
  storageBucket: "rivers-run.appspot.com",
  messagingSenderId: "781093992108",
  appId: "1:781093992108:web:a5a9db5b62f1d554c61109",
  measurementId: "G-ZP92G9QBYB"
};

const app = initializeApp(firebaseConfig);

if (!window.isNative) {
  //When native we use native firebase analytics (web analytics doesn't work due to lack of cookies in iOS webviews.
  const analytics = getAnalytics(app);
}

//Accounts
let auth = getAuth(app)
setPersistence(auth, browserLocalPersistence)





function getCurrentUser() {
  return auth.currentUser
}

function getCurrentUserDetails() {
  //If we are not currently signed in, the fields will be undefined.
  //{email: string, displayName: string}
  let user = getCurrentUser()
  let userDetails = {}
  user?.providerData.forEach((profile) => {
    userDetails.displayName = userDetails.displayName ?? profile.displayName
    userDetails.email = userDetails.email ?? profile.email
  });
  return userDetails
}

function deleteCurrentUserAccount() {
  return auth.currentUser.delete()
}




//Database
const usersCollectionName = "users"
let db = getFirestore(app)
let users = collection(db, usersCollectionName)

function getUID() {
    return auth.currentUser?.uid
}

function getUserEmail() {
    return getCurrentUserDetails().email
}

function signOut() {
  return auth.signOut()
}

function getUserDoc() {
  return doc(users, getUID())
}

async function getData() {
  return (await getDoc(getUserDoc())).data()
}

async function setData(data, merge = true) {
  return await setDoc(getUserDoc(), data, {merge})
}

async function getFavoritesLastModified(data) {
  data = data || await getData()
	return data?.favoritesLastModified
}

async function getFavorites(data) {
  data = data || await getData()
	return data?.favorites || {}
}

async function getNotificationsConfig(data) {
    data = data || await getData()
    return data?.notifications || {}
}

async function setFavorites(favorites, merge) {
    return await setData({
        favorites,
        favoritesLastModified: Date.now(),
    }, merge)
}

async function setNotificationsConfig(notifications, merge) {
    return await setData({notifications}, merge)
}

export {
    auth,

    //Accounts
    getCurrentUser,
    getUserEmail,
    getUID,
    signOut,
    getCurrentUserDetails,

    //Database
    getData,
    setData,
    getFavorites,
    setFavorites,
    getFavoritesLastModified,
    getNotificationsConfig,
    setNotificationsConfig,
}
