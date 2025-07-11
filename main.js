import { db }            from './firebase.js';
import { doc, setDoc, getDoc, getDocs, addDoc, onSnapshot, query, orderBy, serverTimestamp, collection, where, documentId } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import {
  renderLogin,
  renderSignupQuestion,
  renderSignupFinal,
  saveAccount,
  loginUser,
  state,
  matchQuestions,
  t,
} from './auth.js';

async function handleLogin() {
  await loginUser();                // 로그인만 수행
  listenForIncomingCalls();         // 통화 수신 대기 시작
}

function updateTopNavText() {
  if (!document.getElementById("homeMenu")) return;

  document.getElementById("navHomeBtn").textContent = t("nav.home");
  document.getElementById("navExchangeBtn").textContent = t("nav.exchange");
  document.getElementById("navMatchingBtn").childNodes[0].textContent = t("nav.match");
  document.getElementById("navChatBtn").textContent = t("nav.chat");
  document.getElementById("navProfileBtn").textContent = t("nav.profile");

  const newBadge = document.getElementById("newBadge");
  if (newBadge) {
    newBadge.textContent = t("nav.new");
  }
}
function renderSimpleNavBackButton() {
  const nav = document.createElement("nav");
  nav.innerHTML = `
    <button id="backToHomeBtn" class="active">← ${t("common.backToHome") || "홈으로 돌아가기"}</button>
  `;
  nav.style.display = "flex";
  nav.style.backgroundColor = "white";
  nav.style.borderBottom = "1px solid #ccc";
  nav.style.position = "sticky";
  nav.style.top = "0";
  nav.style.zIndex = "100";

  const btn = nav.querySelector("button");
  btn.style.flex = "1";
  btn.style.padding = "15px 0";
  btn.style.border = "none";
  btn.style.background = "white";
  btn.style.fontSize = "16px";
  btn.style.fontWeight = "700";

  btn.onclick = () => renderHome();

  return nav;
}

function renderSimpleHomeView() {
  const container = document.getElementById("app");
  container.innerHTML = "";

  const nav = renderSimpleNavBackButton(); // ✅ 똑같이 추가
  container.appendChild(nav);

  const box = document.createElement("div");
  box.style.padding = "40px 20px";
  box.style.background = "white";
  box.style.borderRadius = "10px";
  box.style.boxShadow = "0 0 10px rgba(0,0,0,0.1)";
  box.style.maxWidth = "400px";
  box.style.margin = "20px auto";
  box.style.textAlign = "center";

  box.innerHTML = `
    <h2 style="margin-bottom: 10px;">${t("home.title")}</h2>
    <p style="margin-bottom: 30px;">${t("home.welcome")}</p>
  `;

  container.appendChild(box);
}

function renderMatchingFlowLayout() {
  const container = document.getElementById("app");

  container.innerHTML = ""; // 초기화

  const nav = renderSimpleNavBackButton(); // ✅ nav 스타일 그대로 복사
  container.appendChild(nav);

  const content = document.createElement("div");
  content.id = "matchContent";
  content.style.padding = "20px";  // 여백만 조금 유지
  container.appendChild(content);

  renderCurrentMatchStep();
}

export async function findMatchCandidates() {
  const usersSnap = await getDocs(collection(db, "users"));
  const candidates = [];

  usersSnap.forEach(docSnap => {
    const user = docSnap.data();
    const email = docSnap.id;

    // 자기 자신 제외
    if (email === state.currentUserEmail) return;
    if (!user.nickname || user.nickname.trim() === "익명") return; // ✅ 익명 계정 제외

    // 선호 학교 필수 조건
    const preferredSchool = state.matchAnswers.school;
    const userSchool = user.school;
    if (!userSchool || t(userSchool) !== t(preferredSchool)) return;

    let score = 0;

    // school 제외한 조건 점수 계산
    Object.entries(state.matchAnswers).forEach(([key, selectedValue]) => {
      if (key === "school") return;

      const userValue = user[key];
      if (!userValue) return;

      if (Array.isArray(userValue)) {
        if (Array.isArray(selectedValue)) {
          if (selectedValue.some(sel => userValue.some(u => t(u) === t(sel)))) {
            score += 1;
          }
        } else {
          if (userValue.some(u => t(u) === t(selectedValue))) {
            score += 1;
          }
        }
      } else {
        if (t(userValue) === t(selectedValue)) {
          score += 1;
        }
      }
    });

    // 학교가 일치하면 점수 관계없이 추가
    candidates.push({ ...user, id: email, score });
  });

  // 점수 높은 순 정렬
  candidates.sort((a, b) => b.score - a.score);

  console.log("🔍 조건:", state.matchAnswers);
  console.log("✅ 찾은 후보 수:", candidates.length);
  state.currentMatchCandidates = candidates;
  state.currentMatchIndex = 0;
}

let localStream = null;
let peerConnection = null;
let callDoc = null;
let callId = null;
let callTimer = null;
let callStartTime = null;
let mediaRecorder = null;
let recordedChunks = [];

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// --- 홈 화면, 탭 UI 보여주기 ---
function renderHome() {
  const container = document.getElementById("app");
  container.innerHTML = `
    <nav id="homeMenu">
      <button data-tab="home" id="navHomeBtn" class="active"></button>
      <button data-tab="exchange" id="navExchangeBtn"></button>
      <button data-tab="matching" id="navMatchingBtn" class="nav-btn">
        ${t("nav.match")}
        <span id="matchNewBadge" class="new-badge" style="display: ${state.newAcceptances.length ? 'inline-block' : 'none'};">
          ${t("nav.new")}
        </span>
      </button>
      <button data-tab="chat" id="navChatBtn"></button>
      <button data-tab="profile" id="navProfileBtn"></button>
    </nav>
    <div id="homeContent" style="flex: 1; padding: 16px 10px; box-sizing: border-box;">
    </div>
  `;

  ["home", "exchange", "matching", "chat", "profile"].forEach(t => {
    const btn = document.getElementById(`nav${capitalize(t)}Btn`);
    if (btn) {
      btn.addEventListener("click", () => {
        setActiveTab(t);
      });
    }
  });

  setActiveTab("home");
  updateTopNavText();

  const homeMenu = document.getElementById("homeMenu");
  const buttons = homeMenu.querySelectorAll("button");

  function renderHomeTab() {
    const homeContent = document.getElementById("homeContent");
    homeContent.innerHTML = `
      <h2>${t("home.title")}</h2>
      <p>${t("home.welcome")}</p>
      <button id="matchBtn">${t("home.findFriend")}</button>
    `;
    document.getElementById("matchBtn").onclick = () => {
      state.matchStep = 0;
      state.matchAnswers = {};
      state.currentMatchCandidates = [];
      state.currentMatchIndex = 0;
      state.waitingForDecision = false;

      renderMatchingFlowLayout(); // ✅ nav 없이 질문 흐름만
    };
  }


  function renderCalendarTab() {
    const monthNames = [
      t("calendar.month1"), t("calendar.month2"), t("calendar.month3"), t("calendar.month4"),
      t("calendar.month5"), t("calendar.month6"), t("calendar.month7"), t("calendar.month8"),
      t("calendar.month9"), t("calendar.month10"), t("calendar.month11"), t("calendar.month12")
    ];
    let calendarYear = new Date().getFullYear();
    let calendarMonth = new Date().getMonth();

    const homeContent = document.getElementById("homeContent");
    homeContent.innerHTML = `
      <h2>${t("common.programschedule")}</h2>
      <div class="calendar-wrapper">
        <div style="text-align:center; font-size:16px; font-weight:500; margin-bottom:4px;" id="yearLabel">${calendarYear}</div>
        <div class="calendar-header">
          <button id="prevMonthBtn">&lt;</button>
          <span id="monthLabel">${monthNames[calendarMonth]}</span>
          <button id="nextMonthBtn">&gt;</button>
        </div>
        <table class="calendar">
          <thead>
            <tr>
              <th>${t("common.sun")}</th><th>${t("common.mon")}</th><th>${t("common.tue")}</th><th>${t("common.wed")}</th>
              <th>${t("common.thu")}</th><th>${t("common.fri")}</th><th>${t("common.sat")}</th>
            </tr>
          </thead>
          <tbody id="calendarBody"></tbody>
        </table>
      </div>
    `;

    const monthLabel = document.getElementById("monthLabel");
    const calendarBody = document.getElementById("calendarBody");
    const prevBtn = document.getElementById("prevMonthBtn");
    const nextBtn = document.getElementById("nextMonthBtn");

    function generateCalendar(year, month) {
      const firstDay = new Date(year, month, 1).getDay();
      const totalDays = new Date(year, month + 1, 0).getDate();

      const days = [];
      for (let i = 0; i < firstDay; i++) days.push("");
      for (let i = 1; i <= totalDays; i++) days.push(i);
      return days;
    }

    function updateCalendar() {
      // 연도와 월 모두 업데이트
      document.getElementById("yearLabel").textContent = calendarYear;
      monthLabel.textContent = `${monthNames[calendarMonth]}`;

      const days = generateCalendar(calendarYear, calendarMonth);
      let html = "";
      for (let i = 0; i < days.length; i++) {
        if (i % 7 === 0) html += "<tr>";
        html += `<td>${days[i] || ""}</td>`;
        if (i % 7 === 6) html += "</tr>";
      }
      if (days.length % 7 !== 0) {
        html += "<td></td>".repeat(7 - (days.length % 7)) + "</tr>";
      }
      calendarBody.innerHTML = html;
    }

    prevBtn.onclick = () => {
      calendarMonth--;
      if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
      }
      updateCalendar();
    };

    nextBtn.onclick = () => {
      calendarMonth++;
      if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
      }
      updateCalendar();
    };

    updateCalendar();
  }

  async function renderMatchingTab() {
    const homeContent = document.getElementById("homeContent");
    if (!homeContent) return;

    homeContent.innerHTML = `
      <div style="text-align:center; padding:20px;">
        <p>${t("loading")}</p>
        <div class="loader" style="
          margin: 20px auto;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
        "></div>
      </div>
    `;

    if (!state.currentUserEmail) return;

    // 🔧 모든 matches 문서 불러오기 (documentId 제거)
    const snapshot = await getDocs(collection(db, "matches"));
    const matchedUsers = [];

    snapshot.forEach(docSnap => {
      const matchId = docSnap.id;
      const match = docSnap.data();

      if (!matchId.includes(state.currentUserEmail)) return;

      const [email1, email2] = matchId.split("-");
      const other = email1 === state.currentUserEmail ? email2 : email1;

      // ✅ 양쪽 모두 수락한 경우만 포함
      if (match[email1] === true && match[email2] === true) {
        matchedUsers.push(other);
      }
    });

    // 🔧 상태 업데이트 - 익명/닉네임 없는 계정 제거
    const acceptSet = new Set(
      [...(state.newAcceptances || []), ...(matchedUsers || [])]
        .filter(id => typeof id === 'string' && id.trim() !== '')
    );

    // ✅ nickname 없는 사용자 제거
    const filtered = [];
    for (const email of acceptSet) {
      const userSnap = await getDoc(doc(db, "users", email));
      const u = userSnap.exists() ? userSnap.data() : {};
      if (u.nickname && u.nickname.trim() !== "") {
        filtered.push(email);
      }
    }

    state.matchedUsers = matchedUsers;
    state.acceptOrMatched = filtered;
    state.acceptIndex = 0;

    renderAcceptedCandidate();

    // ✅ NEW 배지 업데이트는 DOM 렌더링 후에 해야 하므로 setTimeout으로
    setTimeout(() => {
      const matchNewBadge = document.getElementById("matchNewBadge");
      if (matchNewBadge) {
        matchNewBadge.style.display = (state.acceptOrMatched || []).length > 0
          ? "inline-block"
          : "none";
      }
    }, 0);
  }

  

  async function renderAcceptedCandidate() {
    const homeContent = document.getElementById("homeContent");
    homeContent.innerHTML = "";

    const candidates = state.acceptOrMatched;

    if (!candidates.length) {
      homeContent.innerHTML = `
        <h2>${t("match")}</h2>
        <p>${t("match.noCandidates")}</p>
      `;
      const matchNewBadge = document.getElementById("matchNewBadge");
      if (matchNewBadge) matchNewBadge.style.display = "none";
      return;
    }

    const email = candidates[state.acceptIndex];
    const userSnap = await getDoc(doc(db, "users", email));
    const u = userSnap.exists() ? userSnap.data() : {};

    if (!u.nickname || u.nickname.trim() === "") {
      state.acceptIndex++;
      if (state.acceptIndex < candidates.length) {
        renderAcceptedCandidate();
      } else {
        homeContent.innerHTML = `
          <h2>${t("match")}</h2>
          <p>${t("match.noCandidates")}</p>
        `;
        const matchNewBadge = document.getElementById("matchNewBadge");
        if (matchNewBadge) matchNewBadge.style.display = "none";
        return;
      }
      return;
    }

    let html = `
      <h2>${u.nickname}</h2>

      <div class="basic-info">
        <p><strong>${t("profile.age")}</strong>: ${u.age ?? '-'}</p>
        <p><strong>${t("profile.school")}</strong>: ${t(u.school ?? '-')}</p>
        <p><strong>${t("profile.major")}</strong>: ${u.major ?? '-'}</p>
        <p><strong>${t("profile.mbti")}</strong>: ${u.mbti ? t(`mbti.${u.mbti.replace(/^mbti\./, '')}`) : '-'}</p>
        <p><strong>${t("profile.personality")}</strong>: ${(u.personality || []).map(p => t(p)).join(', ')}</p>
        <p><strong>${t("profile.purpose")}</strong>: ${(u.purpose || []).map(p => t(p)).join(', ')}</p>
      </div>

      <div class="introduction" style="display:none;">
        <p>${u.bio && u.bio.trim() ? u.bio : t("common.noIntroduction")}</p>
        <div style="height: 195px;"></div>
      </div>

      <button class="toggle-intro-btn" data-email="${email}">${t("common.lookIntroduction")}</button>

      <div class="navigation-buttons" style="display:flex; gap:10px; margin-top:20px;">
        <button id="prevAccept" ${state.acceptIndex === 0 ? 'disabled' : ''}>${t("common.previous")}</button>
        <button id="nextAccept" ${state.acceptIndex === candidates.length - 1 ? 'disabled' : ''}>${t("common.next")}</button>
      </div>
    `;

    homeContent.innerHTML = html;

    const prevBtn = document.getElementById("prevAccept");
    const nextBtn = document.getElementById("nextAccept");

    const isFirst = state.acceptIndex === 0;
    const isLast = state.acceptIndex === candidates.length - 1;

    if (prevBtn) {
      prevBtn.style.opacity = isFirst ? "0.4" : "";
      prevBtn.style.pointerEvents = isFirst ? "none" : "";
      prevBtn.onclick = () => {
        if (!isFirst) {
          state.acceptIndex--;
          renderAcceptedCandidate();
        }
      };
    }

    if (nextBtn) {
      nextBtn.style.opacity = isLast ? "0.4" : "";
      nextBtn.style.pointerEvents = isLast ? "none" : "";
      nextBtn.onclick = () => {
        if (!isLast) {
          state.acceptIndex++;
          renderAcceptedCandidate();
        }
      };
    }

    const btn = document.querySelector(".toggle-intro-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        const container = btn.parentElement;
        const basicInfo = container.querySelector(".basic-info");
        const intro = container.querySelector(".introduction");
        const navBtns = container.querySelector(".navigation-buttons");

        const showingIntro = intro.style.display === "block";
        intro.style.display = showingIntro ? "none" : "block";
        basicInfo.style.display = showingIntro ? "block" : "none";
        btn.textContent = showingIntro ? t("common.lookIntroduction") : t("action.backToProfile");

        if (navBtns) {
          const prevBtn = navBtns.querySelector("#prevAccept");
          const nextBtn = navBtns.querySelector("#nextAccept");

          if (!showingIntro) {
            [prevBtn, nextBtn].forEach(btn => {
              btn.style.opacity = "0.4";
              btn.style.pointerEvents = "none";
            });
          } else {
            if (state.acceptIndex === 0) {
              prevBtn.style.opacity = "0.4";
              prevBtn.style.pointerEvents = "none";
            } else {
              prevBtn.style.opacity = "";
              prevBtn.style.pointerEvents = "";
            }

            if (state.acceptIndex === candidates.length - 1) {
              nextBtn.style.opacity = "0.4";
              nextBtn.style.pointerEvents = "none";
            } else {
              nextBtn.style.opacity = "";
              nextBtn.style.pointerEvents = "";
            }
          }
        }
      });
    }

    const chatBtn = document.getElementById("goToChatBtn");
    if (chatBtn) {
      chatBtn.onclick = async () => {
        const chatId = [state.currentUserEmail, email].sort().join("-");
        if (!document.getElementById("homeMenu")) await renderHome();
        setActiveTab("chat");
        setTimeout(() => {
          renderChatTab();
          renderChatRoom(chatId, email);
        }, 0);
      };
    }

    const rejectBtn = document.getElementById("rejectBtn");
    if (rejectBtn) {
      rejectBtn.onclick = async () => {
        await sendMatchResponse(email, false);
        state.newAcceptances = state.newAcceptances.filter(e => e !== email);
        state.acceptOrMatched = [...new Set([...state.newAcceptances, ...state.matchedUsers])];
        if (state.acceptIndex >= state.acceptOrMatched.length) {
          state.acceptIndex = Math.max(0, state.acceptOrMatched.length - 1);
        }
        renderAcceptedCandidate();
      };
    }

    const stillUnseen = state.newAcceptances.filter(email => !state.acceptOrMatched.includes(email));
    if (stillUnseen.length === 0) {
      state.newAcceptances = [];
      const badge = document.getElementById("matchNewBadge");
      if (badge) badge.style.display = "none";
    }
  }

  window.renderAcceptedCandidate = renderAcceptedCandidate;

  // 탭 전환 로직에 추가
  function setActiveTab(tab) {
    // … 기존 탭 초기화 …
    switch (tab) {
      case "home":
        renderHomeTab();
        break;
      case "exchange":
        renderCalendarTab();
        break;
      case "matching":
        renderMatchingTab();
        break;
      case "chat":
        renderChatTab();
        break;
      case "profile":
        renderProfileTab();
        break;
    }
  }
  window.setActiveTab = setActiveTab;

  // 탭 활성화 함수
  function setActiveTab(tabName, startMatchingFlow = false, callbackFn) {
    const tabs = ["home", "exchange", "matching", "chat", "profile"];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav${capitalize(t)}Btn`);
      if (btn) btn.classList.remove("active");
    });

    const activeBtn = document.getElementById(`nav${capitalize(tabName)}Btn`);
    if (activeBtn) activeBtn.classList.add("active");

    switch (tabName) {
      case "home":
        renderHomeTab();
        break;
      case "exchange":
        renderCalendarTab();
        break;
      case "matching":
        renderMatchingTab(startMatchingFlow);
        break;
      case "chat":
        renderChatTab(callbackFn); // ✅ 콜백 전달
        break;
      case "profile":
        renderProfileTab();
        break;
    }
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  async function renderChatTab(callbackFn) {
    const homeContent = document.getElementById("homeContent");
    homeContent.innerHTML = `<h2>${t("chat.chat")}</h2><div id="chatList"></div>`;

    const chatList = document.getElementById("chatList");

    const logsSnap = await getDocs(collection(db, "chatLogs"));
    const emails = new Set();

    // 🔁 채팅 로그 기준 상대 email
    logsSnap.forEach(docSnap => {
      const chatId = docSnap.id;
      const [email1, email2] = chatId.split("-");
      if (email1 === state.currentUserEmail) emails.add(email2);
      else if (email2 === state.currentUserEmail) emails.add(email1);
    });

    // ✅ 서로 수락한 matches 기준 이메일 추가
    const matchSnap = await getDocs(collection(db, "matches"));
    matchSnap.forEach(doc => {
      const id = doc.id;
      if (!id.includes(state.currentUserEmail)) return;

      const [e1, e2] = id.split("-");
      const other = e1 === state.currentUserEmail ? e2 : e1;
      const data = doc.data();

      if (data[e1] === true && data[e2] === true) {
        emails.add(other); // 중복되지 않게 Set 사용
      }
    });

    logsSnap.forEach(docSnap => {
      const chatId = docSnap.id;
      const [email1, email2] = chatId.split("-");
      if (email1 === state.currentUserEmail) emails.add(email2);
      else if (email2 === state.currentUserEmail) emails.add(email1);
    });

    if (emails.size === 0) {
      chatList.innerHTML = `<p>${t("chat.nomatch") || "아직 매칭된 친구가 없습니다."}</p>`;
      if (typeof callbackFn === "function") callbackFn();
      return;
    }

    const summaries = [];

    await Promise.all([...emails].map(async (email) => {
      const chatId = [state.currentUserEmail, email].sort().join("-");
      const userSnap = await getDoc(doc(db, "users", email));
      if (!userSnap.exists()) return;

      const user = userSnap.data();

      const q = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(q);

      let lastMessage, hasMyMessage = false;

      if (snap.docs.length > 0) {
        lastMessage = snap.docs[0].data();
        hasMyMessage = snap.docs.some(doc => doc.data().sender === state.currentUserEmail);
      } else {
        const logSnap = await getDoc(doc(db, "chatLogs", chatId));
        if (!logSnap.exists()) return;
        const logs = logSnap.data().messages || [];
        if (!logs.length) return;

        hasMyMessage = logs.some(m => m.sender === state.currentUserEmail);
        lastMessage = logs[logs.length - 1];
        lastMessage.timestamp = new Date(lastMessage.timestamp);
      }

      if (!lastMessage) return;

      const lastText = lastMessage.text || (lastMessage.imageUrl ? "📷 사진" : "대화를 시작해보세요!");
      const lastTime = lastMessage.timestamp instanceof Date
        ? lastMessage.timestamp
        : lastMessage.timestamp?.toDate?.() || new Date(0);

      const unreadCount = snap.docs.filter(d => {
        const m = d.data();
        return m.sender !== state.currentUserEmail && !m.read;
      }).length;

      summaries.push({
        chatId,
        email,
        nickname: user.nickname || email,
        photoUrl: user.photoUrl || 'https://via.placeholder.com/45',
        lastText,
        lastTime,
        lastTimeStr: formatTime(lastTime),
        unreadCount,
      });
    }));

    summaries.sort((a, b) => b.lastTime - a.lastTime);
    chatList.innerHTML = "";

    if (!summaries.length) {
      chatList.innerHTML = `<p>${t("chat.nomatch") || "아직 매칭된 친구가 없습니다."}</p>`;
    } else {
      summaries.forEach(summary => {
        const chatItem = document.createElement("div");
        chatItem.className = "chat-item";
        chatItem.innerHTML = `
          <img src="${summary.photoUrl}" class="chat-avatar" />
          <div class="chat-info">
            <div class="chat-name">${summary.nickname}</div>
            <div class="chat-last-message">${summary.lastText}</div>
          </div>
          <div class="chat-meta">
            <span class="chat-time">${summary.lastTimeStr}</span>
            ${summary.unreadCount ? `<span class="chat-unread">${summary.unreadCount}</span>` : ""}
          </div>
        `;
        chatItem.onclick = async () => {
          await renderChatRoom(summary.chatId, summary.email);
        };
        chatList.appendChild(chatItem);
      });
    }

    if (typeof callbackFn === "function") callbackFn();
  }

  function formatTime(timestamp) {
    const date = timestamp?.toDate?.() || new Date(timestamp);
    if (!date) return '';

    const lang = state.currentLang || 'en';

    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const hour12 = (hours % 12 || 12).toString().padStart(2, '0');  // 요기 고침!

    const ampmText = {
      ko: hours < 12 ? '오전' : '오후',
      en: hours < 12 ? 'AM' : 'PM',
      jp: hours < 12 ? '午前' : '午後',
      ch: hours < 12 ? '上午' : '下午'
    }[lang] || (hours < 12 ? 'AM' : 'PM');

    return `${ampmText} ${hour12}:${minutes}`;
  }

  async function renderChatRoom(chatId, partnerEmail) {
    const homeContent = document.getElementById("homeContent");
    if (!homeContent) return;

    const userSnap = await getDoc(doc(db, "users", partnerEmail));
    const partnerData = userSnap.exists() ? userSnap.data() : {};
    const nickname = partnerData.nickname || partnerEmail;

    homeContent.innerHTML = `
      <h2>${t("chat.title", { nickname })}</h2>
      <button id="callBtn" data-calling="false">${t("chat.call")}</button>
      <div id="callStatus" style="display:none; color:green; font-weight:bold;">${t("chat.inCall")}</div>
      <audio id="remoteAudio" autoplay></audio>

      <div id="chatBox" style="height:300px; overflow-y:scroll; border:1px solid #ccc; padding:10px;"></div>
      <div style="margin-top:10px;">
        <input type="file" id="imageInput" accept="image/*" style="display:none;" />
        <label for="imageInput" id="fileLabel" class="custom-file-label">${t("chat.chooseFile")}</label>
        <span id="fileName" style="margin-left:10px; color:gray;">${t("chat.noFile")}</span>
      </div>
      <input type="text" id="chatInput" placeholder="${t("chat.inputPlaceholder")}" />
      <button id="sendBtn">${t("chat.send")}</button>
      <button id="backBtn">${t("chat.back")}</button>
    `;

    const chatBox = document.getElementById("chatBox");
    const chatInput = document.getElementById("chatInput");
    const imageInput = document.getElementById("imageInput");

    document.getElementById("imageInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      const fileNameEl = document.getElementById("fileName");
      fileNameEl.textContent = file ? file.name : t("chat.noFile");
    });

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp"));

    onSnapshot(q, (snapshot) => {
      chatBox.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();
        const formattedTime = formatTime(msg.timestamp); 

        const msgElem = document.createElement("div");
        msgElem.className = `chat-bubble ${msg.sender === state.currentUserEmail ? 'sent' : 'received'}`;
        msgElem.innerHTML = `
          <div class="bubble-content">${msg.text || ''}</div>
          ${msg.imageUrl ? `<img src="${msg.imageUrl}" style="max-width:150px; margin-top:5px"/>` : ''}
          <div class="bubble-time">${formattedTime}</div>
        `;
        chatBox.appendChild(msgElem);
      });

      chatBox.scrollTop = chatBox.scrollHeight;

      snapshot.docs.forEach(docSnap => {
        const m = docSnap.data();
        if (m.sender !== state.currentUserEmail && !m.read) {
          setDoc(doc(db, "chats", chatId, "messages", docSnap.id), { read: true }, { merge: true });
        }
      });
    });

    document.getElementById("sendBtn").onclick = async () => {
      const text = chatInput.value;
      const file = imageInput.files[0];
      let imageUrl = null;

      if (file) {
        const imagePath = `chatImages/${chatId}/${Date.now()}_${file.name}`;
        const imgRef = ref(storage, imagePath);
        await uploadBytes(imgRef, file);
        imageUrl = await getDownloadURL(imgRef);
      }

      if (!text && !imageUrl) return;

      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: state.currentUserEmail,
        text: text || "",
        imageUrl: imageUrl || "",
        timestamp: serverTimestamp(),
        read: false,
      });

      chatInput.value = "";
      imageInput.value = "";
    };

    document.getElementById("backBtn").onclick = () => renderChatTab();

    // 통화 버튼 이벤트
    document.getElementById("callBtn").onclick = async function toggleCall() {
      const btn = document.getElementById("callBtn");

      if (btn.dataset.calling === "true") {
        await endCall(callId);
        btn.textContent = t("chat.call");
        btn.dataset.calling = "false";
      } else {
        await startCall(partnerEmail);
        btn.textContent = t("chat.endCall");
        btn.dataset.calling = "true";
      }
    };
  }

  function getLocale() {
    const lang = state.currentLang;
    return lang === "ko" ? "ko-KR" :
          lang === "en" ? "en-US" :
          lang === "jp" ? "jp-JP" :
          lang === "ch" ? "ch-CN" :
          "en-US";
  }

  window.renderChatRoom = renderChatRoom;

  async function startCall(calleeEmail) {
    state.currentCallPartnerEmail = calleeEmail;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(servers);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // ✅ 통화 녹음 시작
    startRecording(localStream);

    callId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    callDoc = doc(collection(db, "calls"), callId);

    const callerCandidates = collection(callDoc, "callerCandidates");
    peerConnection.onicecandidate = e => {
      if (e.candidate) {
        setDoc(doc(callerCandidates), e.candidate.toJSON());
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await setDoc(callDoc, {
      caller: state.currentUserEmail,
      callee: calleeEmail,
      offer,
      status: "calling"
    });

    onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (peerConnection && !peerConnection.currentRemoteDescription && data?.answer) {
        const answerDesc = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(answerDesc);
      }
    });

    peerConnection.ontrack = (e) => {
      document.getElementById("remoteAudio").srcObject = e.streams[0];
      document.getElementById("callStatus").style.display = "block";

      // ✅ 타이머 시작
      startCallTimer();
    };
  }

  function renderProfileTab() {
    const container = document.getElementById("homeContent");
    const data = state.currentUserData;

    if (!data) {
      container.innerHTML = `<p>${t("profile.loadError")}</p>`;
      return;
    }

    const defaultMessages = [
      "자기소개가 없습니다.",
      "自己紹介がありません。",
      "No introduction.",
      "暂无自我介绍。"
    ];
    if (defaultMessages.includes(data.bio?.trim())) {
      data.bio = "";
    }

    function formatMulti(arr) {
      if (!arr) return "";
      return Array.isArray(arr) ? arr.join(", ") : arr;
    }

    let isEditing = false;

    function renderLanguageSettingView() {
      const content = document.getElementById("homeContent");
      if (!content) return;

      const langBtnStyle = `
        background-color: #ffffff;
        border: 2px solid #6ee7b7;
        color: #10b981;
        padding: 12px 16px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
      `;

      content.innerHTML = `
        <h2 style="text-align:center; margin-bottom: 20px;">${t("profile.chooseLang") || "언어 선택"}</h2>
        <div class="lang-select-wrapper" style="display: flex; flex-direction: column; gap: 15px;">
          <button class="lang-select-btn" data-lang="ko" style="${langBtnStyle}">한국어</button>
          <button class="lang-select-btn" data-lang="en" style="${langBtnStyle}">English</button>
          <button class="lang-select-btn" data-lang="jp" style="${langBtnStyle}">日本語</button>
          <button class="lang-select-btn" data-lang="ch" style="${langBtnStyle}">中文</button>
          <button id="backToProfileBtn" style="
            margin-top: 30px;
            background-color: #10b981;
            color: white;
            border: none;
            padding: 12px 16px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
          ">${t("common.backToProfile") || "프로필로 돌아가기"}</button>
        </div>
      `;

      // 언어 버튼: 클릭 및 hover
      content.querySelectorAll(".lang-select-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const selectedLang = btn.dataset.lang;
          state.currentLang = selectedLang;
          localStorage.setItem("lang", selectedLang);
          renderProfileTab();
        });
        btn.addEventListener("mouseover", () => {
          btn.style.backgroundColor = "#ecfdf5";
        });
        btn.addEventListener("mouseout", () => {
          btn.style.backgroundColor = "#ffffff";
        });
      });

      // 돌아가기 버튼: 클릭 및 hover
      const backBtn = document.getElementById("backToProfileBtn");
      if (backBtn) {
        backBtn.onclick = () => renderProfileTab();

        backBtn.addEventListener("mouseover", () => {
          backBtn.style.backgroundColor = "#0f9f77";
        });
        backBtn.addEventListener("mouseout", () => {
          backBtn.style.backgroundColor = "#10b981";
        });
      }
    }

    function renderViewMode() {
      const u = data;  

      let rawBio = typeof u.bio === "string" ? u.bio.trim() : "";
      let bioText = () => {
        let rawBio = typeof u.bio === "string" ? u.bio.trim() : "";
        return rawBio ? rawBio : t("common.noBio");
      };

      container.innerHTML = `
        <h2>${data.nickname || t("profile.anon")}</h2>
        <div class="my-info">
          <p><strong>${t("profile.age")}</strong> ${u.age ?? '-'}</p>
          <p><strong>${t("profile.school")}</strong> ${t(u.school ?? '-')}</p>
          <p><strong>${t("profile.major")}</strong> ${u.major ?? '-'}</p>
          <p><strong>${t("profile.mbti")}</strong> ${u.mbti ? t(`mbti.${u.mbti.replace(/^mbti\./, '').replace(/^:/, '')}`) : '-'}</p>
          <p><strong>${t("profile.personality")}</strong> ${(u.personality || []).map(p => t(p)).join(', ')}</p>
          <p><strong>${t("profile.purpose")}</strong> ${(u.purpose || []).map(p => t(p)).join(', ')}</p>
        </div>

        <h3>${t("profile.bioTitle")}</h3>
        <div id="bioView" style="white-space:pre-line; margin-bottom:10px;">${bioText()}</div>
        <button id="editBioBtn">✏ ${t("profile.edit")}</button>

        <div style="margin-top: 0px;">
          <button id="langToggleBtn">🌐 ${t("profile.changeLang")}</button>
        </div>
      `;

      document.getElementById("editBioBtn").onclick = () => {
        isEditing = true;
        enableBioEditMode();
      };

      document.getElementById("langToggleBtn").onclick = () => {
        renderLanguageSettingView();
      };

      const langToggleBtn = document.getElementById("langToggleBtn");
      if (langToggleBtn) {
        langToggleBtn.style.backgroundColor = "#ffffff";
        langToggleBtn.style.border = "2px solid #6ee7b7"; // 연한 에메랄드 border
        langToggleBtn.style.color = "#10b981";             // 연한 에메랄드 글자색
        langToggleBtn.style.padding = "12px 16px";
        langToggleBtn.style.fontSize = "16px";
        langToggleBtn.style.borderRadius = "8px";
        langToggleBtn.style.cursor = "pointer";
        langToggleBtn.style.transition = "background-color 0.2s";

        langToggleBtn.addEventListener("mouseover", () => {
          langToggleBtn.style.backgroundColor = "#ecfdf5"; // hover 시 연한 배경
        });

        langToggleBtn.addEventListener("mouseout", () => {
          langToggleBtn.style.backgroundColor = "#ffffff"; // 원래대로
        });
      }
    }

    function enableBioEditMode() {
      const bioView = document.getElementById("bioView");
      const editBtn = document.getElementById("editBioBtn");

      if (!bioView || !editBtn) return;

      // bioView 영역을 textarea로 교체
      const currentBio = bioView.textContent.trim();
      bioView.outerHTML = `
        <textarea id="bioInput"
          rows="6"
          style="
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #42c7bc;
            border-radius: 12px;
            font-size: 16px;
            font-family: inherit;
            box-sizing: border-box;
            resize: vertical;
            background-color: #fff;
            line-height: 1.5;
            transition: border-color 0.3s, box-shadow 0.3s;
            outline: none;
          "
          onfocus="this.style.borderColor='#42c7bc'; this.style.boxShadow='0 0 0 4px rgba(66, 199, 188, 0.2)'"
          onblur="this.style.borderColor='#42c7bc'; this.style.boxShadow='none'"
        >${currentBio}</textarea>

        <br>
        <button id="saveBioBtn">${t("profile.save")}</button>
        <button id="cancelBioBtn">${t("profile.cancel")}</button>
      `;

      // 버튼 숨기기
      editBtn.style.display = "none";

      document.getElementById("saveBioBtn").onclick = async () => {
        const newBio = document.getElementById("bioInput").value.trim();
        state.currentUserData.bio = newBio;

        const docRef = doc(db, "users", state.currentUserEmail);
        await setDoc(docRef, state.currentUserData);
        renderProfileTab(); // 다시 보기 모드로
      };

      document.getElementById("cancelBioBtn").onclick = () => {
        renderProfileTab(); // 다시 보기 모드로
      };
    }

    renderViewMode();
  }
}

// 전역에 바로 할당
window.renderHome = renderHome;

// DOM 준비되면 로그인 화면부터 띄우기
document.addEventListener('DOMContentLoaded', () => {
  renderLogin();
});

// 달력용 변수와 초기 날짜 설정
const monthLabel = document.getElementById("monthLabel");
const calendarBody = document.getElementById("calendarBody");
let currentDate = new Date();

// 이전/다음 월 이동
window.prevMonth = () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
};

window.nextMonth = () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
};

// --- 현재 매칭 질문 단계 화면 렌더링 ---
export function renderCurrentMatchStep() {
  const content = document.getElementById("matchContent");

  // 🔒 DOM이 아직 준비되지 않았다면 실행하지 않음
  if (!content) {
    console.warn("❗ matchContent가 DOM에 아직 존재하지 않습니다. 렌더 중단.");
    return;
  }

  if (state.waitingForDecision) return;

  // ✅ 아직 질문 단계면 질문부터 표시
  if (state.matchStep < matchQuestions.length) {
    const q = matchQuestions[state.matchStep];
    content.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = t(q.textKey);
    content.appendChild(title);

    const opts = document.createElement("div");
    opts.className = "match-options";
    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.textContent = t(opt);
      if (state.matchAnswers[q.id] === opt) btn.classList.add("selected");
      btn.onclick = () => {
        state.matchAnswers[q.id] = opt;
        state.matchStep++;
        renderCurrentMatchStep();
      };
      opts.appendChild(btn);
    });
    content.appendChild(opts);

    if (state.matchStep > 0) {
      const back = document.createElement("button");
      back.textContent = t("common.back") || "뒤로";
      back.style.marginTop = "20px";
      back.onclick = () => {
        state.matchStep--;
        renderCurrentMatchStep();
      };
      content.appendChild(back);
    }

    return;
  }

  // ✅ 질문 완료 후 후보를 아직 못 불렀으면 먼저 불러오기
  if (state.currentMatchCandidates.length === 0) {
    findMatchCandidates().then(() => {
      if (state.currentMatchCandidates.length === 0) {
        content.innerHTML = `<p>${t("match.noCandidates")}</p>`;
      } else {
        renderCurrentMatchStep(); // 후보 생기면 다시 렌더링
      }
    });
    return;
  }

  // ✅ 후보가 있다면 현재 후보 보여주기
  const candidate = state.currentMatchCandidates[state.currentMatchIndex];
  if (!candidate) {
    content.innerHTML = `<p>${t("match.noCandidates") || "후보가 없습니다."}</p>`;
    return;
  }
  const html = `
    <h2>${t("match.candidateTitle")}</h2>

    <div class="basic-info">
      <p><strong>${t("profile.email")}: </strong> ${candidate.id}</p>
      <p><strong>${t("profile.age")}: </strong> ${candidate.age}</p>
      <p><strong>${t("profile.school")}: </strong> ${t(candidate.school)}</p>
      <p><strong>${t("profile.major")}: </strong> ${candidate.major}</p>
      <p><strong>${t("profile.mbti")}: </strong> ${t(candidate.mbti)}</p>
      <p><strong>${t("profile.personality")}: </strong> ${Array.isArray(candidate.personality) ? candidate.personality.map(p => t(p)).join(", ") : t(candidate.personality)}</p>
      <p><strong>${t("profile.purpose")}: </strong> ${Array.isArray(candidate.purpose) ? candidate.purpose.map(p => t(p)).join(", ") : t(candidate.purpose)}</p>
    </div>

    <div class="introduction" style="display:none;">
      <p>${candidate.bio?.trim() || t("common.noBio")}</p>
    </div>

    <button class="toggle-intro-btn" data-email="${candidate.id}">${t("action.showIntro") || "자기소개 보기"}</button>

    <div class="decision-buttons">
      <button id="acceptBtn" class="accept-btn">${t("match.accept")}</button>
      <button id="rejectBtn" class="reject-btn">${t("match.reject")}</button>
    </div>
  `;

  content.innerHTML = html;
  const toggleBtn = document.querySelector(".toggle-intro-btn");
  const intro = document.querySelector(".introduction");
  const basic = document.querySelector(".basic-info");

  if (toggleBtn && intro && basic) {
    toggleBtn.onclick = () => {
      const isIntroVisible = intro.style.display === "block";

      intro.style.display = isIntroVisible ? "none" : "block";
      basic.style.display = isIntroVisible ? "block" : "none";
      toggleBtn.textContent = isIntroVisible ? t("action.showIntro") : t("action.backToProfile");
    };
  }

  document.getElementById("acceptBtn").onclick = async () => {
    await handleDecision(true);
  };

  document.getElementById("rejectBtn").onclick = async () => {
    await handleDecision(false);
  };
}

async function handleDecision(accepted) {
  const candidate = state.currentMatchCandidates[state.currentMatchIndex];
  if (!candidate) return;

  const currentUserEmail = state.currentUserEmail;
  const otherEmail = candidate.id;

  const matchRef = doc(db, "matches", [currentUserEmail, otherEmail].sort().join("-"));
  const matchSnap = await getDoc(matchRef);
  const matchData = matchSnap.exists() ? matchSnap.data() : {};

  await setDoc(matchRef, {
    [currentUserEmail]: accepted,
    [otherEmail]: matchData[otherEmail] ?? null,
    timestamp: serverTimestamp(),
  }, { merge: true });

  const content = document.getElementById("matchContent");

  // ✅ 1. 서로 수락한 경우 → 매칭 성공 + 채팅 버튼
  if (matchData[otherEmail] === true && accepted === true) {
    content.innerHTML = `
      <h2>${t("match.successTitle")}</h2>
      <p>${t("match.success").replace("{nickname}", candidate.nickname || candidate.id)}</p>
      <button id="goToChatBtn">${t("match.goToChat") || "채팅으로 가기"}</button>
    `;

    setTimeout(() => {
      const chatBtn = document.getElementById("goToChatBtn");
      if (chatBtn) {
        chatBtn.onclick = async () => {
          const chatId = [currentUserEmail, otherEmail].sort().join("-");

          // ✅ nav 없으면 복구
          if (!document.getElementById("homeMenu")) {
            await renderHome();
          }

          // ✅ chatBox 먼저 보장해주고 → 바로 방 진입
          document.querySelectorAll("nav button").forEach(btn => btn.classList.remove("active"));
          document.getElementById("navChatBtn")?.classList.add("active");

          // ✅ chatBox 영역 준비
          document.getElementById("homeContent").innerHTML = `<div id="chatBox"></div>`;

          // ✅ 바로 채팅방 진입!
          renderChatRoom(chatId, otherEmail);
        };
      }
    }, 0);

    return;
  }

  // ✅ 2. 내가 수락, 상대는 아직 → 메시지 표시
  if (accepted === true) {
    alert(t("match.waiting") || "응답이 저장되었습니다. 상대방의 응답을 기다려주세요.");
    state.currentMatchIndex++;
    renderCurrentMatchStep();
    return;
  }

  // ✅ 3. 내가 거절 → 바로 다음 후보로
  state.currentMatchIndex++;
  renderCurrentMatchStep();
}

  const { matchStep, waitingForDecision } = state;
  const content = document.getElementById("matchContent");
  if (content) {
    content.innerHTML = "";
  }

  const q = matchQuestions[matchStep];
  const title = document.createElement("h2");
  title.textContent = t(q.textKey);
  content.appendChild(title);

  const opts = document.createElement("div");
  opts.className = "match-options";
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = t(opt);
    if (state.matchAnswers[q.id] === opt) btn.classList.add("selected");
    btn.onclick = () => {
      state.matchAnswers[q.id] = opt;
      state.matchStep++;
      renderCurrentMatchStep();
    };
    opts.appendChild(btn);
  });
  content.appendChild(opts);

  if (matchStep > 0) {
    const back = document.createElement("button");
    back.textContent = t("common.back") || "뒤로";
    back.style.marginTop = "20px";
    back.onclick = () => {
      state.matchStep--;
      renderCurrentMatchStep();
    };
    content.appendChild(back);
  }

// --- 현재 매칭 후보 보여주기 ---
function renderMatchCandidate() {
  const content = document.getElementById("matchContent");
  const candidate = state.currentMatchCandidates[state.currentMatchIndex];
  if (!candidate) {
    content.innerHTML = `<p>${t("match.noCandidates") || "후보가 없습니다."}</p>`;
    return;
  }

  content.innerHTML = `
    <h2>${t("match.candidate") || "매칭 후보"}</h2>
    <div class="basic-info">
      <p><strong>${t("age") || "나이"}:</strong> ${candidate.age}</p>
      <p><strong>${t("school") || "학교"}:</strong> ${t(candidate.school)}</p>
      <p><strong>${t("major") || "학과"}:</strong> ${candidate.major}</p>
      <p><strong>${t("mbti") || "MBTI"}:</strong> ${candidate.mbti}</p>
      <p><strong>${t("personality") || "성격"}:</strong> ${formatArray(candidate.personality)}</p>
      <p><strong>${t("purpose") || "매칭 목적"}:</strong> ${formatArray(candidate.purpose)}</p>
    </div>
    <div class="introduction" style="display:none;">
      <p>${candidate.bio?.trim() || t("common.noBio")}</p>
    </div>
    <button class="toggle-intro-btn" data-email="${candidate.id}">${t("action.showIntro") || "자기소개 보기"}</button>
    <div class="decision-buttons">
      <button class="accept-btn" id="acceptBtn">${t("accept") || "수락"}</button>
      <button class="reject-btn" id="rejectBtn">${t("reject") || "거부"}</button>
    </div>
  `;

  document.getElementById("acceptBtn").onclick = async () => {
    await sendMatchResponse(candidate.id, true);
  };
  document.getElementById("rejectBtn").onclick = async () => {
    await sendMatchResponse(candidate.id, false);
  };
} 

// --- 매칭 수락/거부 처리 ---
async function sendMatchResponse(candidateEmail, accepted) {
  if (!state.currentUserEmail) {
    alert("로그인 상태가 아닙니다.");
    return;
  }

  const ids = [state.currentUserEmail, candidateEmail].sort();
  const matchDocId = ids.join("-");
  const matchRef = doc(db, "matches", matchDocId);
  const matchSnap = await getDoc(matchRef);

  let matchData = {};
  if (matchSnap.exists()) {
    matchData = matchSnap.data();
  }

  matchData[state.currentUserEmail] = accepted;
  await setDoc(matchRef, matchData);

  const otherEmail = ids.find(id => id !== state.currentUserEmail);

  // ✅ 수락/거절 후 상태 갱신
  state.newAcceptances = state.newAcceptances.filter(e => e !== candidateEmail);
  const matchedUsers = state.matchedUsers || [];
  const usersWhoAcceptedMe = state.newAcceptances || [];

  state.acceptOrMatched = [...matchedUsers, ...usersWhoAcceptedMe].filter(Boolean);

  // ✅ 거절한 경우엔 바로 다음 후보로 넘어감
  if (!accepted) {
    state.currentMatchIndex++;
    if (state.currentMatchIndex < state.currentMatchCandidates.length) {
      renderMatchCandidate();
    } else {
      const content = document.getElementById("matchContent");
      content.innerHTML = `
        <h2>매칭 완료</h2>
        <p>더 이상의 후보가 없습니다.</p>
        <button id="goHomeBtn">홈으로 돌아가기</button>
      `;
      document.getElementById("goHomeBtn").onclick = () => renderSimpleHomeView();
    }
    return;
  }

  // ✅ 서로 수락한 경우
  if (matchData[state.currentUserEmail] && matchData[otherEmail]) {
    const userSnap = await getDoc(doc(db, "users", otherEmail));
    const otherNickname = userSnap.exists() ? userSnap.data().nickname || otherEmail : otherEmail;

    // ✅ matchedUsers에 새로 추가
    if (!state.matchedUsers.includes(otherEmail)) {
      state.matchedUsers.push(otherEmail);
    }

    // ✅ acceptOrMatched 재계산
    const matchedUsers = state.matchedUsers || [];
    const usersWhoAcceptedMe = state.newAcceptances || [];

    state.acceptOrMatched = [...matchedUsers, ...usersWhoAcceptedMe].filter(Boolean);

    // ✅ 디버깅 로그 (원하면 제거 가능)
    console.log("✅ 매칭 성공 - matchedUsers:", state.matchedUsers);
    console.log("✅ 매칭 성공 - acceptOrMatched:", state.acceptOrMatched);

    const content = document.getElementById("matchContent");
    content.innerHTML = `
      <h2>매칭 성공 🎉</h2>
      <p>${otherNickname}님과 매칭되었습니다!</p>
      <button id="goToChatBtn">채팅으로 가기</button>
    `;

    document.getElementById("goToChatBtn").onclick = () => {
      const chatId = [state.currentUserEmail, otherEmail].sort().join("-");

      // ✅ renderHome 이후 채팅 탭 렌더링 보장
      renderHome();
      setTimeout(() => {
        setActiveTab("chat", false, () => {
          renderChatTab(() => {
            renderChatRoom(chatId, otherEmail);
          });
        });
      }, 10);
    };

    return;
  }

  // ✅ 수락했지만 상대는 아직 응답하지 않은 경우
  alert("응답이 저장되었습니다. 상대방의 응답을 기다려주세요.");

  state.currentMatchIndex++;
  if (state.currentMatchIndex < state.currentMatchCandidates.length) {
    renderMatchCandidate();
  } else {
    const content = document.getElementById("matchContent");
    content.innerHTML = `
      <h2>매칭 완료</h2>
      <p>더 이상의 후보가 없습니다.</p>
      <button id="goHomeBtn">홈으로 돌아가기</button>
    `;
    document.getElementById("goHomeBtn").onclick = () => renderSimpleHomeView();
  }
}

function listenForIncomingCalls() {
  if (!state.currentUserEmail) return;
      const q = query(collection(db, "calls"), where("callee", "==", state.currentUserEmail), where("status", "==", "calling"));
      

      onSnapshot(q, async (snapshot) => {
        snapshot.docChanges().forEach(async change => {
          if (change.type === "added") {
            // ✅ 중복 수신 방지
            if (state.incomingCallHandled) return;
            state.incomingCallHandled = true;

            const data = change.doc.data();
            const callId = change.doc.id;
            renderIncomingCallUI(data, callId);

            console.log("📡 대기 시작", state.currentUserEmail);
          }
      });
  });
}

// --- 수신자 통화 수락/거절 화면 ---
function renderIncomingCallUI(data, callId) {
  const container = document.getElementById("app");
        container.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <h2>📞 ${data.caller}님이 전화 중입니다</h2>
            <button id="acceptCallBtn" style="margin-right:10px;">수락</button>
            <button id="rejectCallBtn">거부</button>
          </div>
        `;

        document.getElementById("acceptCallBtn").onclick = async () => {
          await answerCall(callId, data);
        };

        document.getElementById("rejectCallBtn").onclick = async () => {
          await setDoc(doc(db, "calls", callId), { status: "rejected" }, { merge: true });
          alert("통화를 거절했습니다.");
          state.incomingCallHandled = false;
          renderHome(); // 또는 이전 UI 복원
        };

        console.log("📞 수신 UI 렌더링:", data.caller);
      }

      async function answerCall(callId, data) {
        state.currentCallPartnerEmail = data.caller;
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        peerConnection = new RTCPeerConnection(servers);

        // 내 오디오 트랙 추가
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });

        // ✅ 통화 녹음 시작
        startRecording(localStream);

        const callDoc = doc(db, "calls", callId);
        const calleeCandidates = collection(callDoc, "calleeCandidates");

        peerConnection.onicecandidate = e => {
          if (e.candidate) {
            setDoc(doc(calleeCandidates), e.candidate.toJSON());
          }
        };

        // 상대 offer 설정
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

        // 내 answer 생성
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Firestore에 저장
        await setDoc(callDoc, {
          answer,
          status: "inCall"
        }, { merge: true });

        // 상대 트랙 수신 시 오디오 출력
        peerConnection.ontrack = (e) => {
          const audio = document.createElement("audio");
          audio.srcObject = e.streams[0];
          audio.autoplay = true;
          document.body.appendChild(audio); // 혹은 채팅 UI에 삽입

          // ✅ 타이머 시작
          startCallTimer();

          const callBtn = document.getElementById("callBtn");
          if (callBtn) {
            callBtn.textContent = "📴 통화 종료";
            callBtn.dataset.calling = "true";
          }
        };

        // answerCall 함수 안에서 통화 종료 버튼 추가 시
        const endBtn = document.createElement("button");
        endBtn.innerText = "📴 통화 종료";
        endBtn.id = "endCallBtn"; // ✅ 이 줄 추가
        endBtn.style.position = "fixed";
        endBtn.style.bottom = "20px";
        endBtn.style.right = "20px";
        endBtn.style.zIndex = "1000";
        endBtn.onclick = () => endCall(callId);
        document.body.appendChild(endBtn);

        state.incomingCallHandled = false;
      }

      async function endCall(callId) {
        // ✅ 타이머 멈추기
        stopCallTimer();

        // ✅ 녹음 멈추기
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }

        // 1. 피어 연결 종료
        if (peerConnection) {
          peerConnection.close();
          peerConnection = null;
        }

        // 2. 오디오 스트림 정지
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          localStream = null;
        }

        // 3. Firebase에서 통화 상태 업데이트
        await setDoc(doc(db, "calls", callId), { status: "ended" }, { merge: true });

        // 4. 통화 종료 버튼 제거
        const endBtn = document.getElementById("endCallBtn");
        if (endBtn) endBtn.remove();

        // 5. 오디오 엘리먼트 초기화
        const audio = document.querySelector("audio");
        if (audio) audio.remove(); // 또는 remoteAudio 엘리먼트 초기화:
        const remoteAudio = document.getElementById("remoteAudio");
        if (remoteAudio) remoteAudio.srcObject = null;

        // 6. 통화 상태 메시지 숨기기
        const statusEl = document.getElementById("callStatus");
        if (statusEl) statusEl.style.display = "none";

        // 7. 타이머 정지 (있는 경우)
        if (typeof stopCallTimer === "function") stopCallTimer();

        // 8. 알림
        alert("통화가 종료되었습니다.");

        // callBtn 상태 되돌리기
        const callBtn = document.getElementById("callBtn");
        if (callBtn) {
          callBtn.textContent = "📞 전화 걸기";
          callBtn.dataset.calling = "false";
        }
      }

    function startCallTimer() {
      callStartTime = Date.now();
      const callStatus = document.getElementById("callStatus");
      callTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        callStatus.textContent = `통화 중... (${minutes}:${seconds < 10 ? "0" : ""}${seconds})`;
      }, 1000);
    }

    function stopCallTimer() {
      clearInterval(callTimer);
      callTimer = null;
    }

    function startRecording(stream) {
      recordedChunks = [];

      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        const filePath = `recordings/${state.currentUserEmail}/${callId}.webm`;

        const storage = getStorage();
        const audioRef = ref(storage, filePath);

        await uploadBytes(audioRef, blob);
        const downloadURL = await getDownloadURL(audioRef);
        console.log("녹음 업로드 완료:", downloadURL);

        // ✅ Firestore에 저장
        const callLogRef = doc(db, "callLogs", callId);
        await setDoc(callLogRef, {
          caller: state.currentUserEmail,
          callee: state.currentCallPartnerEmail,  // 👉 이 값을 global 또는 startCall/answerCall에서 할당해줘야 해
          url: downloadURL,
          timestamp: serverTimestamp()
        });
      };

      mediaRecorder.start();
    }

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("toggle-intro-btn")) {
    const card = e.target.closest(".profile-card"); // 🔥 카드 범위 지정
    if (!card) return;

    const basicInfo = card.querySelector(".basic-info");
    const intro = card.querySelector(".introduction");
    const btn = e.target;

    const showingIntro = intro.style.display === "block";

    if (showingIntro) {
      intro.style.display = "none";
      basicInfo.style.display = "block";
      btn.textContent = "자기소개 보기";
    } else {
      intro.style.display = "block";
      basicInfo.style.display = "none";
      btn.textContent = "돌아가기";
    }
  }
});

export function renderExchangeTab() {
  const content = document.getElementById("tabContent");

  content.innerHTML = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button id="prevMonthBtn">&#x276E;</button>
        <span id="monthLabel"></span>
        <button id="nextMonthBtn">&#x276F;</button>
      </div>
      <table class="calendar">
        <thead>
          <tr>
            <th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th>
          </tr>
        </thead>
        <tbody id="calendarBody"></tbody>
      </table>
    </div>
  `;

  const monthLabel = document.getElementById("monthLabel");
  const calendarBody = document.getElementById("calendarBody");
  const prevBtn = document.getElementById("prevMonthBtn");
  const nextBtn = document.getElementById("nextMonthBtn");

  let currentDate = new Date();

  prevBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
  };

  nextBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
  };
}
