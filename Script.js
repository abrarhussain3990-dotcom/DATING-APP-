import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-analytics.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnRVGZNdmrAAuvxTTHGtDYDcFQnbXrJVA",
  authDomain: "love-dating-b4b20.firebaseapp.com",
  databaseURL: "https://love-dating-b4b20-default-rtdb.firebaseio.com",
  projectId: "love-dating-b4b20",
  storageBucket: "love-dating-b4b20.firebasestorage.app",
  messagingSenderId: "720253439790",
  appId: "1:720253439790:web:a7e0189a6bd052d9fbb4bf",
  measurementId: "G-2GG80906BS"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let discoverProfiles = [];
let currentIndex = 0;
let matches = [];
let selectedMatch = null;
let unsubscribeMessages = null;
let unsubscribeIncomingCalls = null;

let mediaRecorder = null;
let recordedChunks = [];

let peerConnection = null;
let localStream = null;
let currentCallId = null;
let incomingCallData = null;

const authPage = document.getElementById("authPage");
const mainPage = document.getElementById("mainPage");
const logoutBtn = document.getElementById("logoutBtn");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const navButtons = document.querySelectorAll(".navBtn");
const tabs = document.querySelectorAll(".tab");

const profileCard = document.getElementById("profileCard");
const skipBtn = document.getElementById("skipBtn");
const likeBtn = document.getElementById("likeBtn");

const matchesList = document.getElementById("matchesList");
const chatSelect = document.getElementById("chatSelect");
const messagesBox = document.getElementById("messagesBox");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const recordBtn = document.getElementById("recordBtn");
const stopRecordBtn = document.getElementById("stopRecordBtn");

const callBtn = document.getElementById("callBtn");
const hangupBtn = document.getElementById("hangupBtn");
const remoteAudio = document.getElementById("remoteAudio");

const incomingCall = document.getElementById("incomingCall");
const incomingText = document.getElementById("incomingText");
const answerBtn = document.getElementById("answerBtn");
const rejectBtn = document.getElementById("rejectBtn");

const profileForm = document.getElementById("profileForm");

const defaultPhoto = "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=800";

function showAuth() {
  authPage.classList.add("active");
  mainPage.classList.remove("active");
  logoutBtn.classList.add("hidden");
}

function showMain() {
  authPage.classList.remove("active");
  mainPage.classList.add("active");
  logoutBtn.classList.remove("hidden");
}

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});

registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      email,
      name: "New User",
      age: 18,
      gender: "Other",
      city: "",
      bio: "",
      photo: defaultPhoto,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    alert(error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    showAuth();
    return;
  }

  showMain();
  await createProfileIfMissing();
  await loadDiscoverProfiles();
  await loadMatches();
  fillProfileForm();
  listenForIncomingCalls();
});

async function createProfileIfMissing() {
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: currentUser.uid,
      email: currentUser.email,
      name: "New User",
      age: 18,
      gender: "Other",
      city: "",
      bio: "",
      photo: defaultPhoto,
      createdAt: serverTimestamp()
    });
  }
}

navButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    navButtons.forEach((btn) => btn.classList.remove("active"));
    tabs.forEach((tab) => tab.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");

    if (button.dataset.tab === "discoverTab") {
      await loadDiscoverProfiles();
    }

    if (button.dataset.tab === "matchesTab") {
      await loadMatches();
    }

    if (button.dataset.tab === "chatTab") {
      await loadMatches();
      renderChatSelect();
    }

    if (button.dataset.tab === "profileTab") {
      fillProfileForm();
    }
  });
});

async function loadDiscoverProfiles() {
  const usersSnapshot = await getDocs(collection(db, "users"));
  const likesSnapshot = await getDocs(
    query(collection(db, "likes"), where("fromUserId", "==", currentUser.uid))
  );

  const likedIds = likesSnapshot.docs.map((item) => item.data().toUserId);

  discoverProfiles = usersSnapshot.docs
    .map((item) => item.data())
    .filter((user) => user.uid !== currentUser.uid)
    .filter((user) => !likedIds.includes(user.uid));

  currentIndex = 0;
  renderProfileCard();
}

function renderProfileCard() {
  if (discoverProfiles.length === 0 || currentIndex >= discoverProfiles.length) {
    profileCard.innerHTML = `
      <div class="empty">
        <div>
          <h3>No profiles found</h3>
          <p>More users will appear here after they register.</p>
        </div>
      </div>
    `;
    return;
  }

  const profile = discoverProfiles[currentIndex];

  profileCard.innerHTML = `
    <img src="${profile.photo || defaultPhoto}" alt="${profile.name}">
    <div class="profile-info">
      <h3>${profile.name}, ${profile.age}</h3>
      <div class="meta">${profile.city || "Unknown city"} · ${profile.gender || "Other"}</div>
      <p>${profile.bio || "No bio added yet."}</p>
    </div>
  `;
}

skipBtn.addEventListener("click", () => {
  currentIndex++;
  renderProfileCard();
});

likeBtn.addEventListener("click", async () => {
  if (discoverProfiles.length === 0 || currentIndex >= discoverProfiles.length) return;

  const likedUser = discoverProfiles[currentIndex];
  const likeId = `${currentUser.uid}_${likedUser.uid}`;

  await setDoc(doc(db, "likes", likeId), {
    fromUserId: currentUser.uid,
    toUserId: likedUser.uid,
    createdAt: serverTimestamp()
  });

  const reverseLike = await getDoc(doc(db, "likes", `${likedUser.uid}_${currentUser.uid}`));

  if (reverseLike.exists()) {
    const matchId = getMatchId(currentUser.uid, likedUser.uid);

    await setDoc(doc(db, "matches", matchId), {
      id: matchId,
      users: [currentUser.uid, likedUser.uid],
      createdAt: serverTimestamp()
    });

    alert(`It's a match with ${likedUser.name}!`);
  } else {
    alert(`You liked ${likedUser.name}`);
  }

  currentIndex++;
  renderProfileCard();
  await loadMatches();
});

function getMatchId(userA, userB) {
  return [userA, userB].
