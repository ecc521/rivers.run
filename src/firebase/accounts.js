import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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



//
// //Database
// const usersCollectionName = "users"
// let db = getFirestore()
// let users = db.collection("users")
//
// function getUserDoc() {
//     return users.doc(getUID())
// }
//
// async function getData() {
// 	let data = (await getUserDoc().get()).data()
// 	return data
// }
//
// async function setData(data, merge = true) {
//     console.log(data)
//     return await getUserDoc().set(data, {merge})
// }
//
// async function getFavoritesLastModified(data) {
//     data = data || await getData()
// 	return data?.favoritesLastModified
// }
//
// async function getFavorites(data) {
//     data = data || await getData()
// 	return data?.favorites || {}
// }
//
// async function getNotificationsConfig(data) {
//     data = data || await getData()
//     return data?.notifications || {}
// }
//
// async function setFavorites(favorites, merge) {
//     return await setData({
//         favorites,
//         favoritesLastModified: Date.now(),
//     }, merge)
// }
//
// async function setNotificationsConfig(notifications, merge) {
//     return await setData({notifications}, merge)
// }

export {
    auth,

    //Accounts
    // getCurrentUser,
    // getUserEmail,
    // getUID,
    // signOut,

    //Database
    // getData,
    // setData,
    // getFavorites,
    // setFavorites,
    // getFavoritesLastModified,
    // getNotificationsConfig,
    // setNotificationsConfig,
}
