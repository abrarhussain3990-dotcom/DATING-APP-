
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
  return [userA, userB].sort().join("_");
}

async function loadMatches() {
  const matchesSnapshot = await getDocs(
    query(collection(db, "matches"), where("users", "array-contains", currentUser.uid))
  );

  matches = [];

  for (const item of matchesSnapshot.docs) {
    const match = item.data();
    const otherUserId = match.users.find((id) => id !== currentUser.uid);
    const userSnap = await getDoc(doc(db, "users", otherUserId));

    if (userSnap.exists()) {
      matches.push({
        matchId: match.id,
        user: userSnap.data()
      });
    }
  }

  renderMatches();
  renderChatSelect();
}

function renderMatches() {
  if (matches.length === 0) {
    matchesList.innerHTML = `
      <div class="empty">
        <div>
          <h3>No matches yet</h3>
          <p>Like someone. If they like you back, match ban jayega.</p>
        </div>
      </div>
    `;
    return;
  }

  matchesList.innerHTML = matches.map((match) => `
    <div class="match-item">
      <img src="${match.user.photo || defaultPhoto}" alt="${match.user.name}">
      <div>
        <h3>${match.user.name}, ${match.user.age}</h3>
        <p>${match.user.city || ""}</p>
      </div>
    </div>
  `).join("");
}

function renderChatSelect() {
  chatSelect.innerHTML = "";

  if (matches.length === 0) {
    chatSelect.innerHTML = `<option value="">No matches</option>`;
    messagesBox.innerHTML = `<div class="empty"><p>No chat selected.</p></div>`;
    return;
  }

  matches.forEach((match) => {
    const option = document.createElement("option");
    option.value = match.matchId;
    option.textContent = match.user.name;
    chatSelect.appendChild(option);
  });

  selectedMatch = matches[0];
  chatSelect.value = selectedMatch.matchId;
  listenToMessages();
}

chatSelect.addEventListener("change", () => {
  selectedMatch = matches.find((match) => match.matchId === chatSelect.value);
  listenToMessages();
});

function listenToMessages() {
  if (unsubscribeMessages) unsubscribeMessages();

  if (!selectedMatch) return;

  const messagesQuery = query(
    collection(db, "matches", selectedMatch.matchId, "messages"),
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((item) => item.data());
    renderMessages(messages);
  });
}

function renderMessages(messages) {
  if (messages.length === 0) {
    messagesBox.innerHTML = `<div class="empty"><p>No messages yet. Say hello.</p></div>`;
    return;
  }

  messagesBox.innerHTML = messages.map((message) => {
    const className = message.senderId === currentUser.uid ? "me" : "them";

    if (message.type === "voice") {
      return `
        <div class="message ${className}">
          <audio controls src="${message.audioUrl}"></audio>
        </div>
      `;
    }

    return `
      <div class="message ${className}">
        ${escapeHtml(message.text)}
      </div>
    `;
  }).join("");

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

sendBtn.addEventListener("click", sendTextMessage);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendTextMessage();
});

async function sendTextMessage() {
  if (!selectedMatch) return;

  const text = messageInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "matches", selectedMatch.matchId, "messages"), {
    senderId: currentUser.uid,
    type: "text",
    text,
    createdAt: serverTimestamp()
  });

  messageInput.value = "";
}

recordBtn.addEventListener("click", async () => {
  if (!selectedMatch) {
    alert("Select a match first.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(recordedChunks, { type: "audio/webm" });
      const audioRef = ref(storage, `voiceMessages/${selectedMatch.matchId}/${Date.now()}.webm`);

      await uploadBytes(audioRef, audioBlob);
      const audioUrl = await getDownloadURL(audioRef);

      await addDoc(collection(db, "matches", selectedMatch.matchId, "messages"), {
        senderId: currentUser.uid,
        type: "voice",
        audioUrl,
        createdAt: serverTimestamp()
      });

      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();

    recordBtn.disabled = true;
    stopRecordBtn.disabled = false;
  } catch (error) {
    alert("Microphone permission required.");
  }
});

stopRecordBtn.addEventListener("click", () => {
  if (mediaRecorder) mediaRecorder.stop();

  recordBtn.disabled = false;
  stopRecordBtn.disabled = true;
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  await updateDoc(doc(db, "users", currentUser.uid), {
    name: document.getElementById("profileName").value,
    age: Number(document.getElementById("profileAge").value),
    gender: document.getElementById("profileGender").value,
    city: document.getElementById("profileCity").value,
    bio: document.getElementById("profileBio").value,
    photo: document.getElementById("profilePhoto").value || defaultPhoto
  });

  alert("Profile saved.");
  await loadDiscoverProfiles();
});

async function fillProfileForm() {
  if (!currentUser) return;

  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  if (!userSnap.exists()) return;

  const user = userSnap.data();

  document.getElementById("profileName").value = user.name || "";
  document.getElementById("profileAge").value = user.age || 18;
  document.getElementById("profileGender").value = user.gender || "Other";
  document.getElementById("profileCity").value = user.city || "";
  document.getElementById("profileBio").value = user.bio || "";
  document.getElementById("profilePhoto").value = user.photo || "";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

callBtn.addEventListener("click", startVoiceCall);
hangupBtn.addEventListener("click", hangUpCall);

async function startVoiceCall() {
  if (!selectedMatch) {
    alert("Select a match first.");
    return;
  }

  const otherUserId = selectedMatch.user.uid;
  currentCallId = `${selectedMatch.matchId}_${Date.now()}`;

  const callRef = doc(db, "calls", currentCallId);
  const offerCandidates = collection(db, "calls", currentCallId, "offerCandidates");
  const answerCandidates = collection(db, "calls", currentCallId, "answerCandidates");

  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  const offerDescription = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offerDescription);

  await setDoc(callRef, {
    callId: currentCallId,
    matchId: selectedMatch.matchId,
    callerId: currentUser.uid,
    receiverId: otherUserId,
    status: "ringing",
    offer: {
      type: offerDescription.type,
      sdp: offerDescription.sdp
    },
    createdAt: serverTimestamp()
  });

  onSnapshot(callRef, async (snapshot) => {
    const data = snapshot.data();

    if (!peerConnection || !data) return;

    if (data.answer && !peerConnection.currentRemoteDescription) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.status === "ended") {
      cleanupCall();
    }
  });

  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" && peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  alert("Calling...");
}

function listenForIncomingCalls() {
  if (unsubscribeIncomingCalls) unsubscribeIncomingCalls();

  const incomingQuery = query(
    collection(db, "calls"),
    where("receiverId", "==", currentUser.uid),
    where("status", "==", "ringing")
  );

  unsubscribeIncomingCalls = onSnapshot(incomingQuery, async (snapshot) => {
    if (snapshot.empty) return;

    const callDoc = snapshot.docs[0];
    incomingCallData = {
      id: callDoc.id,
      ...callDoc.data()
    };

    const callerSnap = await getDoc(doc(db, "users", incomingCallData.callerId));
    const caller = callerSnap.exists() ? callerSnap.data() : null;

    incomingText.textContent = `${caller?.name || "Someone"} is calling you`;
    incomingCall.classList.remove("hidden");
  });
}

answerBtn.addEventListener("click", answerCall);

async function answerCall() {
  if (!incomingCallData) return;

  currentCallId = incomingCallData.id;

  const callRef = doc(db, "calls", currentCallId);
  const offerCandidates = collection(db, "calls", currentCallId, "offerCandidates");
  const answerCandidates = collection(db, "calls", currentCallId, "answerCandidates");

  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));

  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);

  await updateDoc(callRef, {
    status: "connected",
    answer: {
      type: answerDescription.type,
      sdp: answerDescription.sdp
    }
  });

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" && peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  onSnapshot(callRef, (snapshot) => {
    const data = snapshot.data();

    if (data?.status === "ended") {
      cleanupCall();
    }
  });

  incomingCall.classList.add("hidden");
}

rejectBtn.addEventListener("click", async () => {
  if (incomingCallData) {
    await updateDoc(doc(db, "calls", incomingCallData.id), {
      status: "ended"
    });
  }

  incomingCall.classList.add("hidden");
  incomingCallData = null;
});

async function hangUpCall() {
  if (currentCallId) {
    await updateDoc(doc(db, "calls", currentCallId), {
      status: "ended"
    });
  }

  cleanupCall();
}

function cleanupCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  remoteAudio.srcObject = null;
  currentCallId = null;
  incomingCallData = null;
  incomingCall.classList.add("hidden");
}
