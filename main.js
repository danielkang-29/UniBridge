document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const splash = document.getElementById("splash");
    const app = document.getElementById("app");
    if (splash) splash.style.display = "none";
    if (app) app.style.display = "block";
  }, 1500);
});

import { db, auth, storage }            from './firebase.js';
import { doc, setDoc, getDoc, getDocs, addDoc, onSnapshot, query, orderBy, serverTimestamp, collection, where, documentId } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
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

function setRealVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setRealVH);
window.addEventListener('load', setRealVH);

function initKeyboardGuardForBackNav() {
  const nav = document.getElementById("homeMenu") || document.querySelector("nav");
  if (!nav) return;

  const updateNavPosition = () => {
    const isKeyboardOpen = window.innerHeight < screen.height * 0.75; // 감지 기준 (기기 따라 조정)
    if (isKeyboardOpen) {
      nav.style.position = "fixed";
      nav.style.top = "0";
      nav.style.zIndex = "999";
    } else {
      nav.style.position = "sticky"; // 원래 상태로
    }
  };

  window.addEventListener("resize", updateNavPosition);
  window.addEventListener("load", updateNavPosition);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.currentUserEmail = user.email;

    // 유저 정보 가져오기
    const userSnap = await getDoc(doc(db, "users", user.email));
    if (userSnap.exists()) {
      state.currentUserData = userSnap.data();

      // DOM 준비 후 renderHome 호출
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          renderHome();
        });
      } else {
        renderHome();
      }

      // ✅ [여기에 삽입!] 수신 감지용 onSnapshot
      onSnapshot(
        query(collection(db, "calls"), where("callee", "==", state.currentUserEmail)),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const callData = change.doc.data();
              const callId = change.doc.id;

              console.log("📞 통화 수신 감지됨:", callData);
              renderIncomingCallUI(callId, callData); // ✅ 순서: callId 먼저, data 나중
            }
          });
        }
      );

    } else {
      // 유저 정보 없을 경우 로그인 화면으로
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          renderLogin();
        });
      } else {
        renderLogin();
      }
    }

  } else {
    // 로그인되지 않은 상태 → 로그인 화면
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        renderLogin();
      });
    } else {
      renderLogin();
    }
  }
});

async function handleLogin() {
  await loginUser();                // 로그인만 수행
  function renderTopNav() {
    if (document.getElementById("topNav")) return;

    const nav = document.createElement("nav");
    nav.id = "topNav";
    nav.innerHTML = `
      <button class="tab-btn" data-tab="home">${t("nav.home")}</button>
      <button class="tab-btn" data-tab="exchange">${t("nav.exchange")}</button>
      <button class="tab-btn" data-tab="match">${t("nav.match")}</button>
      <button class="tab-btn" data-tab="chat">${t("nav.chat")}</button>
      <button class="tab-btn" data-tab="profile">${t("nav.profile")}</button>
      <div id="tabIndicator"></div>
    `;

    document.body.prepend(nav); // 원하는 위치에 prepend 또는 append
    initTabNavigation();        // 아래에 정의
  }
  listenForIncomingCalls();         // 통화 수신 대기 시작
}

function updateTopNavText() {
  const homeMenu = document.getElementById("homeMenu");
  if (!homeMenu) return;

  const map = {
    navHomeBtn: "nav.home",
    navExchangeBtn: "nav.exchange",
    navMatchingBtn: "nav.match",
    navChatBtn: "nav.chat",
    navProfileBtn: "nav.profile",
  };

  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) {
      if (id === "navMatchingBtn" && el.childNodes.length > 0) {
        el.childNodes[0].textContent = t(key); // 🔥 childNodes[0] 사용 중이면 유지
      } else {
        el.textContent = t(key);
      }
    }
  }

  const newBadge = document.getElementById("newBadge");
  if (newBadge) {
    newBadge.textContent = t("nav.new");
    newBadge.style.display = (state.newAcceptances?.length ?? 0) > 0 ? "inline-block" : "none";
  }
}

function renderSimpleNavBackButton() {
  const nav = document.createElement("nav");
  nav.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; justify-content: center;">
      <button id="backToHomeBtn" class="active" style="position: relative;">
        ← ${t("common.backToHome") || "홈으로 돌아가기"}
        <div id="tabIndicator" style="
          display: none; /* ✅ 바 숨기기 */
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          width: 100%;
          background-color: #10b981;
          transition: all 0.3s ease;"></div>
      </button>
    </div>
  `;

  nav.style.display = "flex";
  nav.style.backgroundColor = "#f5f5f5";
  nav.style.borderBottom = "1px solid #ccc";
  nav.style.position = "sticky";
  nav.style.top = "0";
  nav.style.zIndex = "100";

  const btn = nav.querySelector("#backToHomeBtn");
  btn.style.flex = "0 1 auto";
  btn.style.padding = "15px 0";
  btn.style.border = "none";
  btn.style.background = "#fcfcfc";
  btn.style.fontSize = "16px";
  btn.style.fontWeight = "700";

  btn.onclick = () => renderHome();

  return nav;
}

function renderChatBackButton() {
  const nav = document.createElement("nav");
  nav.id = "backNav"; // 혹시 중복 제거 용이하도록 ID 부여
  nav.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ccc;
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100%;
    height: 41px;
    padding: 0;
    position: relative;
    box-sizing: border-box;
  `;

  const btn = document.createElement("button");
  btn.id = "backToChatListBtn";
  btn.textContent = "<";

const indicator = document.createElement("div");
indicator.id = "tabIndicator";
indicator.style.cssText = `
  display: none;
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  width: 100%;
  background-color: #10b981;
  transition: all 0.3s ease;
`;

btn.appendChild(indicator);

  btn.className = "active";
  btn.style.cssText = `
    border: none;
    background: none;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    padding: 0 8px;
    color: #3fcfa4;
    margin: 0;
    height: 100%;
    width: 2em;
    text-align: left;
    transform: translateY(-6px);
  `;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position: relative;
    width: 2em;
    display: flex;
    justify-content: flex-start;
  `;

  // ✅ 버튼 클릭 시 채팅 탭으로 이동 + 상단바 복원
  btn.onclick = () => renderHome("chat");

  wrapper.appendChild(btn);
  nav.appendChild(wrapper);
  return nav;
}

function initTabNavigation() {
  const buttons = document.querySelectorAll(".tab-btn");
  const indicator = document.getElementById("tabIndicator");

  buttons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      // 탭에 따른 화면 전환 로직은 여기에 추가
      moveTabIndicator(index);
    });
  });

  // 초기 위치 설정 (예: 0번)
  moveTabIndicator(0);
}

function moveTabIndicator(index) {
  const indicator = document.getElementById("tabIndicator");
  if (!indicator) return;
  indicator.style.transform = `translateX(${index * 100}%)`;
}

function renderSimpleHomeView() {
  const container = document.getElementById("app");
  container.innerHTML = "";

  const nav = renderSimpleNavBackButton(); // ✅ 똑같이 추가
  container.appendChild(nav);

  const box = document.createElement("div");
  box.style.padding = "40px 20px";
  box.style.background = "#fcfcfc";
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
function renderHome(defaultTab = "home") {
  enableScrollBack(); // ✅ 홈 화면 등에서는 스크롤 복구
  const container = document.getElementById("app");
  container.innerHTML = `
    <div id="appLayout" style="display:flex; flex-direction:column; height:100vh; overflow:hidden;">

      <!-- 상단바 -->
      <nav id="homeMenu">
        <button data-tab="home" id="navHomeBtn" class="active"></button>
        <button data-tab="exchange" id="navExchangeBtn"></button>
        <button data-tab="matching" id="navMatchingBtn" class="nav-btn">
          ${t("nav.match")}
          <span id="matchNewBadge" class="new-badge" style="display: none;">
            ${t("nav.new")}
          </span>
        </button>
        <button data-tab="chat" id="navChatBtn"></button>
        <button data-tab="profile" id="navProfileBtn"></button>
        <div id="tabIndicator"></div>
      </nav>

      <!-- 가운데 콘텐츠 영역 (스크롤 가능) -->
      <div id="homeContentWrapper" style="flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch;">
        <div id="homeContent" style="padding: 16px 10px; box-sizing: border-box;"></div>
      </div>

      <!-- 하단 고정 버튼 영역 -->
      <div id="bottomBar" style="padding: 10px; background: #f5f5f5; border-top: none solid #ccc;">
        <!-- 여기에 하단 버튼들을 나중에 삽입 -->
      </div>
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

  setActiveTab(defaultTab);
  updateTopNavText();

  const homeMenu = document.getElementById("homeMenu");
  const buttons = homeMenu.querySelectorAll("button");

  function renderHomeTab() {
    const homeContent = document.getElementById("homeContent");
    homeContent.innerHTML = `

      <!-- 첫 번째 카드 캐러셀 -->
      <div id="homeCardCarousel1" class="card-carousel">
        <div class="cc-viewport">
          <div class="cc-track">
            <a class="cc-slide" href="https://www.notion.so/CAMPUS-ASIA-The-ACE-Summer-Intensive-Program-2025-2345a232986a8097a089cf661ed90216" target="_blank" rel="noopener">
              <img src="poster.jpg" alt="poster">
            </a>
          </div>
        </div>
      </div>
    `;

    const bottomBar = document.getElementById("bottomBar");
    bottomBar.innerHTML = `
      <button id="matchBtn" style="
        width: 100%;
        padding: 12px;
        font-size: 16px;
        background: #10b981;
        color: #f5f5f5;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;"
        onmouseover="this.style.backgroundColor='#0f9f77'"
        onmouseout="this.style.backgroundColor='#10b981'">
        ${t("home.findFriend")}
      </button>
    `;
    document.getElementById("matchBtn").onclick = () => {
      state.matchStep = 0;
      state.matchAnswers = {};
      state.currentMatchCandidates = [];
      state.currentMatchIndex = 0;
      state.waitingForDecision = false;
      renderMatchingFlowLayout();
    };

    // (여러 캐러셀 초기화 시) 필요하면 여기서 init 함수 호출
    // initHomeCardCarousel("homeCardCarousel1");
    // initHomeCardCarousel("homeCardCarousel2");
  }

  function renderCalendarTab() {
    // ===== 타입별 색상 (종류별로 색상 고정) =====
    const TYPE_COLORS = {
      exchange: '#6ee7b7',   // 교환학생 (연한 민트/에메랄드)
      intensive: '#93c5fd',  // Intensive (연한 파랑)
      online: '#fcd34d',     // Online (연한 주황/노랑)
    };

    // ===== 대학 선택 버튼 정의 =====
    const UNIVERSITIES = [
      { id: 'snu',    label: '서울대' },
      { id: 'pku',    label: '북경대' },
      { id: 'rikkyo', label: '릿쿄대' },
      { id: 'nus',    label: 'NUS' },
    ];
    let selectedUniv = 'snu'; // 기본값 서울대

    // ===== 예시 데이터 (대학별) =====
    // type: 'exchange' | 'intensive' | 'online'
    const SCHEDULES = {
      snu: [
        { title:'NUS 파견 교환학생 선발', type:'exchange', start:'2025-08-01', end:'2025-08-29' },
        { title:'CAMPUS Asia Winter Intensive Program 모집', type:'intensive', start:'2025-11-03', end:'2025-11-28' },
        { title:'Online Course 수강생 모집(릿교대)', type:'online', start:'2025-09-02', end:'2025-09-15' },
      ],
      pku: [
        { title:'교환학생 선발', type:'exchange', start:'2025-09-05', end:'2025-10-10' },
        { title:'CAMPUS Asia Winter Intensive Program 모집', type:'intensive', start:'2025-11-03', end:'2025-11-28' },
      ],
      rikkyo: [
        { title:'교환학생 선발', type:'exchange', start:'2025-08-25', end:'2025-09-10' },
        { title:'CAMPUS Asia Winter Intensive Program 모집', type:'intensive', start:'2025-11-03', end:'2025-11-28' },
      ],
      nus: [
        { title:'교환학생 선발', type:'exchange', start:'2025-08-29', end:'2025-09-16' },
        { title:'CAMPUS Asia Winter Intensive Program 모집', type:'intensive', start:'2025-11-03', end:'2025-11-28' },
      ],
    };

    // ===== 레이아웃 파라미터 =====
    const CELL_MIN_HEIGHT = 60;
    const DATE_LABEL_H    = 16;
    const BAR_H           = 18;
    const BAR_GAP         = 4;
    const CELL_SIDE_PAD   = 4;
    const DATE_TO_BAR_GAP = 12;

    // ===== 유틸 =====
    const monthNames = [
      t("calendar.month1"), t("calendar.month2"), t("calendar.month3"), t("calendar.month4"),
      t("calendar.month5"), t("calendar.month6"), t("calendar.month7"), t("calendar.month8"),
      t("calendar.month9"), t("calendar.month10"), t("calendar.month11"), t("calendar.month12")
    ];
    let calendarYear = new Date().getFullYear();
    let calendarMonth = new Date().getMonth();

    function parseDate(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }

    // ===== 기존 달력 뼈대 + 대학 버튼 렌더 =====
    const homeContent = document.getElementById("homeContent");
    homeContent.innerHTML = `

    <!-- 대학 선택 버튼 -->
    <div id="univTabs" style="
      display:flex;
      justify-content:space-between;
      margin-bottom:0px;
      gap:6px;
    ">
      ${UNIVERSITIES.map(u=>`
        <button data-univ="${u.id}" class="univ-btn" style="
          /* 하드 리셋 */
          all: unset;                         /* 기본 스타일 전부 제거 */
          display: inline-flex !important;    /* 텍스트 중앙 정렬 용이 */
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;

          /* 모바일 브라우저 기본 버튼 모양 제거 */
          appearance: none !important;
          -webkit-appearance: none !important;

          /* 크기 강제 */
          width: 50px !important;
          height: 25px !important;
          min-height: 0 !important;           /* 일부 리셋/프레임워크의 min-height 무력화 */
          padding: 0 !important;              /* 내부 여백 제거 */
          line-height: 20px !important;       /* 한 줄 텍스트 수직 가운데 */

          /* 모양 */
          border: 1px solid #d1d5db !important;
          border-radius: 999px !important;    /* 동글동글 */
          background: #fff !important;
          cursor: pointer !important;
          font-size: 12px !important;         /* 글자 크기는 유지 */
          white-space: nowrap !important;
          text-align: center !important;
          overflow: hidden !important;         /* 내용 넘침 방지 */
          margin-right: 6px;
        ">
          ${u.label}
        </button>
      `).join('')}
    </div>

      <div class="calendar-wrapper" id="calendarWrapper" style="position:relative;">
        <div style="text-align:center; font-size:18px; font-weight:500; margin-bottom:4px; color:#10b981;" id="yearLabel">${calendarYear}</div>
        <div class="calendar-header">
          <button id="prevMonthBtn">&lt;</button>
          <span id="monthLabel">${monthNames[calendarMonth]}</span>
          <button id="nextMonthBtn">&gt;</button>
        </div>
        <table class="calendar" id="programCalendar">
          <thead>
            <tr>
              <th>${t("common.sun")}</th><th>${t("common.mon")}</th><th>${t("common.tue")}</th><th>${t("common.wed")}</th>
              <th>${t("common.thu")}</th><th>${t("common.fri")}</th><th>${t("common.sat")}</th>
            </tr>
          </thead>
          <tbody id="calendarBody"></tbody>
        </table>
        <div id="barsOverlay" style="position:absolute; left:0; right:0; pointer-events:none;"></div>
      </div>
    `;

    const monthLabel   = document.getElementById("monthLabel");
    const calendarBody = document.getElementById("calendarBody");
    const prevBtn      = document.getElementById("prevMonthBtn");
    const nextBtn      = document.getElementById("nextMonthBtn");
    const yearLabel    = document.getElementById("yearLabel");

    // 버튼 active 스타일 적용
    function updateUnivTabStyles(){
      document.querySelectorAll('#univTabs .univ-btn').forEach(btn=>{
        const on = btn.dataset.univ === selectedUniv;
        btn.style.background = on ? '#10b981' : '#fff';
        btn.style.color = on ? '#fff' : '#111827';
        btn.style.borderColor = on ? '#10b981' : '#e5e7eb';
        btn.style.fontWeight = on ? '600' : '400';
      });
    }

    document.querySelectorAll('#univTabs .univ-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        selectedUniv = btn.dataset.univ;
        updateUnivTabStyles();
        updateCalendar(); // 대학 변경 시 달력/막대 갱신
      });
    });
    updateUnivTabStyles();

    function generateCalendar(year, month) {
      const firstDay = new Date(year, month, 1).getDay();
      const totalDays = new Date(year, month + 1, 0).getDate();
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push("");
      for (let i = 1; i <= totalDays; i++) days.push(i);
      return days;
    }

    function getWeekRows(year, month) {
      const totalDays = new Date(year, month+1, 0).getDate();
      const weeks = [];
      let cursor = 1, row = 0;

      let start = new Date(year, month, cursor);
      let end = new Date(year, month, Math.min(cursor + (6 - start.getDay()), totalDays));
      weeks.push({ startDate: start, endDate: end, rowIndex: row++ });
      cursor = end.getDate() + 1;

      while (cursor <= totalDays) {
        start = new Date(year, month, cursor);
        end = new Date(year, month, Math.min(cursor + 6, totalDays));
        weeks.push({ startDate: start, endDate: end, rowIndex: row++ });
        cursor = end.getDate() + 1;
      }
      return weeks;
    }

    // 달력 내부(셀 위)에 막대 그리기 — 선택된 대학만 표시, 날짜 아래 '위에서부터' 스택
    function drawBarsInsideCalendar(year, month) {
      const wrapper = document.getElementById('calendarWrapper');
      const table   = document.getElementById('programCalendar');
      const overlay = document.getElementById('barsOverlay');

      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');

      // 오버레이를 tbody와 정확히 겹치게
      const wrapperRect = wrapper.getBoundingClientRect();
      const theadRect   = thead.getBoundingClientRect();
      const tbodyRect   = tbody.getBoundingClientRect();
      overlay.style.top    = `${theadRect.bottom - wrapperRect.top}px`;
      overlay.style.bottom = `${wrapperRect.bottom - tbodyRect.bottom}px`;
      overlay.innerHTML = '';

      // === 핵심: overlay 좌표계로 모두 재계산 ===
      const overlayRect = overlay.getBoundingClientRect();

      // 주(row) 위치/높이 (overlay 기준)
      const trs        = Array.from(tbody.querySelectorAll('tr'));
      const weekRects  = trs.map(tr => tr.getBoundingClientRect());
      let rowTops      = weekRects.map(r => r.top - overlayRect.top);
      let rowHeights   = weekRects.map(r => r.height);

      // 요일별 x/width (첫 데이터 행 기준, overlay 기준)
      const firstRow = trs[0];
      if (!firstRow) return;
      const colRects   = Array.from(firstRow.children).map(td => td.getBoundingClientRect());
      const colLefts   = colRects.map(r => r.left  - overlayRect.left);
      const colRights  = colRects.map(r => r.right - overlayRect.left);
      const colWidths  = colRects.map(r => r.width);

      // 월 범위 & 주 정의
      const monthStart = new Date(year, month, 1);
      const monthEnd   = new Date(year, month+1, 0);
      const weeks = getWeekRows(year, month);

      // 선택된 대학 일정만 사용
      const programs = (SCHEDULES[selectedUniv] || []).slice();

      // 1) 트랙 배치(겹침 방지) 1차 패스
      const tracksPerWeek = weeks.map(() => []); // 각 주의 트랙: 마지막 xRight(px)
      const segs1 = []; // 1차 패스 결과 (xLeft, width, rowIndex, trackIdx, style 정보)

      programs.forEach(p => {
        const s = parseDate(p.start), e = parseDate(p.end);
        if (!s || !e) return;
        if (e < monthStart || s > monthEnd) return;

        weeks.forEach(week => {
          // 주(행)와 기간 교집합 확인
          const intersects = !(e < week.startDate || s > week.endDate);
          if (!intersects) return;

          // 이 주 안에서 실제 그릴 구간
          const segStart = s < week.startDate ? week.startDate : s;
          const segEnd   = e > week.endDate   ? week.endDate   : e;

          const leftCol  = segStart.getDay();
          const rightCol = segEnd.getDay();

          // x 범위 (overlay 기준)
          const xLeft  = colLefts[leftCol] + CELL_SIDE_PAD;
          const xRight = colRights[rightCol] - CELL_SIDE_PAD;
          const width  = Math.max(xRight - xLeft, 8);

          // 트랙 할당(겹치면 다음 줄)
          const tracks = tracksPerWeek[week.rowIndex];
          let trackIdx = 0;
          for (; trackIdx < tracks.length; trackIdx++) {
            if (xLeft >= tracks[trackIdx] + 2) break; // 작은 여유
          }
          tracks[trackIdx] = xLeft + width;

          segs1.push({
            rowIndex: week.rowIndex,
            xLeft, width, trackIdx,
            kind: p.kind, // 'apply' | 'period'
            color: TYPE_COLORS[p.type] || '#9ca3af',
            label: p.title
          });
        });
      });

      // 2) 주별 요구 높이 → 셀 높이 갱신 (날짜 위/작게, 막대는 아래에서 '위→아래' 스택)
      const requiredHeights = tracksPerWeek.map(tracks => {
        const n = tracks.length;
        const needed = DATE_LABEL_H + DATE_TO_BAR_GAP + n * (BAR_H + BAR_GAP) + BAR_GAP;
        return Math.max(CELL_MIN_HEIGHT, needed);
      });
      trs.forEach((tr, i) => {
        Array.from(tr.children).forEach(td => {
          td.style.height = `${requiredHeights[i]}px`;
          td.style.minHeight = `${requiredHeights[i]}px`;
          td.style.verticalAlign = 'top';
          td.style.padding = '6px';
        });
      });

      // 높이 바꾸었으니 overlay 기준으로 다시 측정 (좌표 오차 방지)
      const overlayRect2 = overlay.getBoundingClientRect();
      const weekRects2   = trs.map(tr => tr.getBoundingClientRect());
      rowTops    = weekRects2.map(r => r.top - overlayRect2.top);
      rowHeights = weekRects2.map(r => r.height);

      // 3) 실제 막대 DOM 생성 (위에서부터 날짜 아랫줄로 정렬)
      segs1.forEach(seg => {
        const y = rowTops[seg.rowIndex] + DATE_LABEL_H + DATE_TO_BAR_GAP + seg.trackIdx * (BAR_H + BAR_GAP);

        const bar = document.createElement('div');
        bar.style.position = 'absolute';
        bar.style.left = `${seg.xLeft}px`;
        bar.style.top = `${y}px`;
        bar.style.width = `${seg.width}px`;
        bar.style.height = `${BAR_H}px`;
        bar.style.borderRadius = '999px';
        bar.style.display = 'flex';
        bar.style.alignItems = 'center';
        bar.style.padding = '0 10px';
        bar.style.boxSizing = 'border-box';
        bar.style.fontSize = '12px';
        bar.style.whiteSpace = 'nowrap';
        bar.style.overflow = 'hidden';
        bar.style.textOverflow = 'ellipsis';
        bar.style.pointerEvents = 'none';

        bar.style.background = seg.color;
        bar.style.color = '#fff';
        bar.style.border = `1px solid ${seg.color}`;

        bar.textContent = seg.label;
        overlay.appendChild(bar);
      });
    }

    function updateCalendar() {
      yearLabel.textContent = calendarYear;
      monthLabel.textContent = `${monthNames[calendarMonth]}`;

      const days = generateCalendar(calendarYear, calendarMonth);
      let html = "";
      for (let i = 0; i < days.length; i++) {
        if (i % 7 === 0) html += "<tr>";
        if (!days[i]) {
          html += `<td></td>`;
        } else {
          const d = Number(days[i]);
          // 날짜는 위쪽 작은 글씨로, 막대가 가리지 않도록 고정
          html += `<td><div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${d}</div></td>`;
        }
        if (i % 7 === 6) html += "</tr>";
      }
      if (days.length % 7 !== 0) {
        html += "<td></td>".repeat(7 - (days.length % 7)) + "</tr>";
      }
      calendarBody.innerHTML = html;

      drawBarsInsideCalendar(calendarYear, calendarMonth);
    }

    prevBtn.onclick = () => {
      calendarMonth--;
      if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
      updateCalendar();
    };
    nextBtn.onclick = () => {
      calendarMonth++;
      if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
      updateCalendar();
    };

    updateCalendar();

    window.addEventListener('resize', () => drawBarsInsideCalendar(calendarYear, calendarMonth), { passive: true });
  }

  async function renderMatchingTab() {
    const homeContent = document.getElementById("homeContent");
    if (!homeContent) return;

    // 🔧 먼저 로딩 화면 보여줌
    homeContent.innerHTML = `
      <div style="text-align:center; padding:30px;">
        <p style="font-size:18px; margin-bottom:15px;">${t("loading")}</p>
        <div class="loader" style="
          border: 8px solid #f3f3f3;
          border-top: 8px solid #10b981;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        "></div>
      </div>

      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

    if (!state.currentUserEmail) return;

    // ✅ 매칭 데이터 수집
    const snapshot = await getDocs(collection(db, "matches"));
    const matchedUsers = [];

    snapshot.forEach(docSnap => {
      const matchId = docSnap.id;
      const match = docSnap.data();

      if (!matchId.includes(state.currentUserEmail)) return;

      const [email1, email2] = matchId.split("-");
      const other = email1 === state.currentUserEmail ? email2 : email1;

      if (match[email1] === true && match[email2] === true) {
        matchedUsers.push(other);
      }
    });

    // ✅ 사용자 필터링
    const acceptSet = new Set([
      ...(state.newAcceptances || []),
      ...(matchedUsers || [])
    ].filter(id => typeof id === 'string' && id.trim() !== ''));

    const filtered = [];
    for (const email of acceptSet) {
      const userSnap = await getDoc(doc(db, "users", email));
      const u = userSnap.exists() ? userSnap.data() : {};
      if (u.nickname && u.nickname.trim() !== "") {
        filtered.push(email);
      }
    }

    // ✅ 상태 세팅
    state.matchedUsers = matchedUsers;
    state.acceptOrMatched = filtered;
    state.acceptIndex = 0;

    // ✅ 준비가 다 된 후 렌더링
    renderAcceptedCandidate();

    // ✅ NEW 배지 처리 (setTimeout 제거)
    const matchNewBadge = document.getElementById("matchNewBadge");
    if (matchNewBadge) {
      matchNewBadge.style.display = filtered.length > 0 ? "inline-block" : "none";
    }
    
    const badge = document.getElementById("matchNewBadge");
    if (badge) {
      badge.style.display = (state.newAcceptances?.length ?? 0) > 0 ? "inline-block" : "none";
    }
  }

  async function renderAcceptedCandidate() {
    const homeContent = document.getElementById("homeContent");
    homeContent.innerHTML = "";

    const candidates = state.acceptOrMatched;

    if (!candidates.length) {
      homeContent.innerHTML = `
        <h2></h2>
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
          <h2></h2>
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
        <p><strong>${t("label.gender")}</strong>: ${u.gender ? (t(u.gender) || t(`gender.${u.gender}`)) : '-'}</p>
        <p><strong>${t("profile.school")}</strong>: ${t(u.school ?? '-')}</p>
        <p><strong>${t("profile.major")}</strong>: ${t(u.major ?? '-')}</p>
        <p><strong>${t("profile.mbti")}</strong>: ${u.mbti ? t(`mbti.${u.mbti.replace(/^mbti\./, '')}`) : '-'}</p>
        <p><strong>${t("profile.personality")}</strong>: ${(u.personality || []).map(p => t(p)).join(', ')}</p>
        <p><strong>${t("profile.purpose")}</strong>: ${(u.purpose || []).map(p => t(p)).join(', ')}</p>
      </div>

      <div class="introduction" style="display:none;">
        <p>${u.bio && u.bio.trim() ? u.bio : t("common.noIntroduction")}</p>
      </div>
    `;

    homeContent.innerHTML = html;

    const bottomBar = document.getElementById("bottomBar");
    if (bottomBar) {
      bottomBar.innerHTML = `
        <div style="margin-bottom: 20px;">
          <button id="toggleIntroBtn" data-email="${email}" class="toggleIntroBtn">
            ${t("common.lookIntroduction")}
          </button>
        </div>
        <div class="navigation-buttons" style="display:flex; gap:10px; margin-top: 10px;">
          <button id="prevAccept" ${state.acceptIndex === 0 ? 'disabled' : ''}>${t("common.previous")}</button>
          <button id="nextAccept" ${state.acceptIndex === candidates.length - 1 ? 'disabled' : ''}>${t("common.next")}</button>
        </div>
      `;
    }

    const toggleBtn = document.getElementById("toggleIntroBtn");
    const basicInfo = document.querySelector(".basic-info");
    const intro = document.querySelector(".introduction");

    toggleBtn.addEventListener("click", () => {
      const wasIntroShowing = intro.style.display === "block";

      // 프로필 ↔ 자기소개 전환
      intro.style.display = wasIntroShowing ? "none" : "block";
      basicInfo.style.display = wasIntroShowing ? "block" : "none";
      toggleBtn.textContent = wasIntroShowing ? t("common.lookIntroduction") : t("action.backToProfile");

      const navButtonsDiv = document.querySelector(".navigation-buttons");

      if (wasIntroShowing) {
        // 돌아가기: 이전/다음 버튼 복원
        navButtonsDiv.innerHTML = `
          <button id="prevAccept">${t("common.previous")}</button>
          <button id="nextAccept">${t("common.next")}</button>
        `;

        const prevBtn = document.getElementById("prevAccept");
        const nextBtn = document.getElementById("nextAccept");

        const isFirst = state.acceptIndex === 0;
        const isLast = state.acceptIndex === state.acceptOrMatched.length - 1;

        if (prevBtn) {
          if (isFirst) {
            prevBtn.disabled = true;
            prevBtn.style.opacity = "0.4";
            prevBtn.style.pointerEvents = "none";
          }
          prevBtn.onclick = () => {
            prevBtn.blur();
            if (!isFirst) {
              state.acceptIndex--;
              renderAcceptedCandidate();
            }
          };
        }

        if (nextBtn) {
          if (isLast) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = "0.4";
            nextBtn.style.pointerEvents = "none";
          }
          nextBtn.onclick = () => {
            nextBtn.blur();
            if (!isLast) {
              state.acceptIndex++;
              renderAcceptedCandidate();
            }
          };
        }
      } else {
        // 자기소개 보기: 이전/다음 제거, 채팅 버튼 추가
        navButtonsDiv.innerHTML = `
          <button id="goToChatBtn">${t("action.goToChat")}</button>
        `;

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
      }
    });

    document.getElementById("prevAccept").onclick = () => {
      if (state.acceptIndex > 0) {
        state.acceptIndex--;
        renderAcceptedCandidate();
      }
    };

    document.getElementById("nextAccept").onclick = () => {
      if (state.acceptIndex < candidates.length - 1) {
        state.acceptIndex++;
        renderAcceptedCandidate();
      }
    };

    const prevBtn = document.getElementById("prevAccept");
    const nextBtn = document.getElementById("nextAccept");

    const isFirst = state.acceptIndex === 0;
    const isLast = state.acceptIndex === candidates.length - 1;

    if (prevBtn) {
      prevBtn.style.opacity = isFirst ? "0.4" : "";
      prevBtn.style.pointerEvents = isFirst ? "none" : "";
      prevBtn.onclick = () => {
        prevBtn.blur(); // ✅
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
        nextBtn.blur(); // ✅
        if (!isLast) {
          state.acceptIndex++;
          renderAcceptedCandidate();
        }
      };
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
    // ✅ 하단 버튼 초기화 먼저!
    const bottomBar = document.getElementById("bottomBar");
    if (bottomBar) bottomBar.innerHTML = "";

    // ✅ 탭 active 상태 정리
    const tabs = ["home", "exchange", "matching", "chat", "profile"];
    const index = tabs.indexOf(tabName);
    if (index !== -1) moveTabIndicator(index);
    tabs.forEach(t => {
      const btn = document.getElementById(`nav${capitalize(t)}Btn`);
      if (btn) btn.classList.remove("active");
    });
    const activeBtn = document.getElementById(`nav${capitalize(tabName)}Btn`);
    if (activeBtn) activeBtn.classList.add("active");

    // ✅ 탭별 렌더링
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
        renderChatTab(callbackFn);
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
    const oldBackNav = document.getElementById("backToChatListBtn")?.closest("nav");
    if (oldBackNav) oldBackNav.remove();

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

      const isMatched = state.matchedUsers.includes(email); // 서로 수락했는지 확인

      summaries.push({
        chatId,
        email,
        nickname: user.nickname || email,
        photoUrl: isMatched && user.photoUrl ? user.photoUrl : './defaultprofile.png',
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
            <div class="chat-last-message" style="color: #808080; font-size: 0.9em;">${summary.lastText}</div>
          </div>
          <div class="chat-meta">
            <span class="chat-time" style="color: #808080;">${summary.lastTimeStr}</span>
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

  window.renderChatTab = renderChatTab; // ✅ 이 줄 추가

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

    // ✅ 기존 상단바 제거
    const oldNav = document.getElementById("homeMenu");
    if (oldNav) oldNav.remove();

    // ✅ 하단바 초기화
    const bottomBar = document.getElementById("bottomBar");
    if (bottomBar) bottomBar.innerHTML = "";

    // ✅ "← 홈으로 돌아가기" 버튼 삽입
    const userSnap = await getDoc(doc(db, "users", partnerEmail));
    const partnerData = userSnap.exists() ? userSnap.data() : {};
    const nickname = partnerData.nickname || partnerEmail;  // ✅ 먼저 선언

    const backNav = renderChatBackButton();
    const container = document.getElementById("app");
    container.prepend(backNav);

    // 📌 키보드에 상단바 밀림 방지
    initKeyboardGuardForBackNav();

    // ✅ 이제 안전하게 사용 가능
    const name = document.createElement("span");
    name.textContent = nickname;
    name.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%) translateY(-7px); 
      font-size: 22px;
      color: #10b981;
      font-weight: 600;
      white-space: nowrap;
    `;

    backNav.appendChild(name);



    homeContent.innerHTML = `
    <div id="chatRoom" style="display: flex; flex-direction: column; height: 100dvh; padding-top: 41px;">
      <div id="callStatus" style="display:none; color:green; font-weight:bold;">
        ${t("chat.inCall")}
      </div>
      <audio id="remoteAudio" autoplay></audio>

      <div id="chatBox" style="height: 100vh; min-height: 0; overflow-y: scroll; padding: 10px;"></div>
      <input type="file" id="imageInput" accept="image/*" style="display:none;" />

      <div id="imagePreview" style="display: none; margin-top: 8px; position: relative;">
        <img id="previewImg" src="" alt="Image preview" style="max-width: 100%; max-height: 200px; object-fit: cover;
        border-radius: 8px; display: block; margin-left: auto; margin-right: 0;" />
        <!-- 삭제 버튼(X) -->
       <button id="removeImage" style="
        position: absolute;
        top: 0px;
        right: 15px;
        background: transparent; /* 배경을 투명으로 설정 */
        color: #e5e7eb;
        border: none; /* 테두리 없애기 */
        width: 20px; /* 크기를 적당히 설정 */
        height: 20px; /* 가로, 세로 길이를 동일하게 */
        font-size: 24px; /* X 크기 키우기 */
        text-align: center;
        line-height: 20px; /* X 중앙에 위치하도록 설정 */
        cursor: pointer;
        font-weight: bold;
        border-radius: 50%; /* 동그란 모양 */
      ">x</button>
      </div>

      <div id="chatInputRow" style="
        position: fixed;
        display: flex;
        align-items: center;
        gap: 8px;
      ">

        <label for="imageInput" id="fileLabel" class="custom-file-label">
          <span class="plus-icon">+</span>
        </label>

        <input type="text" id="chatInput" placeholder="${t("chat.inputPlaceholder")}" 
          style="flex: 1; padding: 10px; font-size: 16px; border-radius: 999px; border: 1px solid #ccc;" />

        <button id="sendBtn" style="
          width: 60px; /* ✅ 고정 가로 너비 */
          padding: 8px 0;
          background-color: #34d399;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          cursor: pointer;
        ">
          ${t("chat.send")}
        </button>
      </div>
    `;

      // ✅ 이 아래에 붙이면 됨 (DOM이 이미 생성된 상태)
      const sendBtn = document.getElementById("sendBtn");
      const input = document.getElementById("chatInput");

      if (sendBtn && input) {
        sendBtn.addEventListener("click", (e) => {
          e.preventDefault();
          if (document.activeElement !== input) {
            input.focus();
          }
          sendMessage(); // 네가 정의한 전송 함수
        });
      }

    // 이미지 미리보기 기능
    document.getElementById('imageInput').addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const previewImg = document.getElementById('previewImg');
          previewImg.src = e.target.result;
          document.getElementById('imagePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });

    // 미리보기에서 이미지를 제거하는 버튼
    document.getElementById('removeImage').addEventListener('click', function() {
      document.getElementById('imageInput').value = ''; // 파일 input 리셋
      document.getElementById('imagePreview').style.display = 'none'; // 미리보기 영역 숨김
    });

    const backBtn = document.getElementById("backBtn");
    if (backBtn) backBtn.onclick = () => renderChatTab();

    const chatBox = document.getElementById("chatBox");
    chatBox.style.marginTop = "41px"; // ✅ 상단 고정바에 가려지지 않게 여백 확보
      chatBox.style.cssText = `
        height: 400px;
        overflow-y: scroll;
        padding: 10px;
        margin-bottom: 0;
        border: none;
        background-color: #f5f5f5;

        scrollbar-width: none;       /* Firefox용 */
        -ms-overflow-style: none;    /* IE/Edge용 */
      `;

    chatBox.style.overflowY = "scroll";

    // ✅ Webkit 계열(Chrome, Safari 등)에선 따로 ::-webkit-scrollbar 숨기기 필요
    chatBox.classList.add("hide-scroll");

    chatBox.style.padding = "10px 12px"; // 상하 10px, 좌우 12px

    const chatInputRow = document.getElementById("chatInputRow");
    chatInputRow.style.margin = "0";  // 좌우 여백 제거

    const chatInput = document.getElementById("chatInput");
    const imageInput = document.getElementById("imageInput");

    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      console.log("선택된 파일:", file); // 디버깅용
    });

    sendBtn.onclick = async () => {
      const text = chatInput.value.trim();
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

      document.getElementById("imagePreview").style.display = 'none'; // 미리보기 이미지 숨기기
    };

    document.getElementById("imageInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
    });

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp"));

    function scrollToBottom() {
      const chatBox = document.getElementById("chatBox");
      if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }

    onSnapshot(q, (snapshot) => {
      chatBox.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();
        const formattedTime = formatTime(msg.timestamp);

        const msgElem = document.createElement("div");
        msgElem.className = `chat-bubble ${msg.sender === state.currentUserEmail ? 'sent' : 'received'}`;

        const bubbleContent = document.createElement("div");
        bubbleContent.className = "bubble-content";
        bubbleContent.textContent = msg.text || "";

        msgElem.appendChild(bubbleContent);

        if (msg.imageUrl) {
          const img = document.createElement("img");
          img.src = msg.imageUrl;
          img.style.maxWidth = "150px";
          img.style.marginTop = "5px";
          img.onload = scrollToBottom;  // ✅ 이미지 로드 후 스크롤

          msgElem.appendChild(img);
        }

        const timeElem = document.createElement("div");
        timeElem.className = "bubble-time";
        timeElem.textContent = formattedTime;

        msgElem.appendChild(timeElem);

        chatBox.appendChild(msgElem); // ✅ 딱 한 번만!
      });

      // 텍스트 메시지만 있는 경우도 아래로 스크롤
      scrollToBottom();

      // 읽음 처리
      snapshot.docs.forEach(docSnap => {
        const m = docSnap.data();
        if (m.sender !== state.currentUserEmail && !m.read) {
          setDoc(doc(db, "chats", chatId, "messages", docSnap.id), { read: true }, { merge: true });
        }
      });
    });

    if (backBtn) backBtn.onclick = () => renderChatTab();

    function enableSwipeBackOnChat() {
      let startX = 0;
      let startY = 0;
      let endX = 0;
      let endY = 0;
      const threshold = 80;
      const verticalThreshold = 60;

      const chatElement = document.getElementById("chatRoom");
      if (!chatElement) return;

      chatElement.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      });

      chatElement.addEventListener("touchmove", (e) => {
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = Math.abs(e.touches[0].clientY - startY);

        if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
          e.preventDefault();
        }
      }, { passive: false });

      chatElement.addEventListener("touchend", (e) => {
        endX = e.changedTouches[0].clientX;
        endY = e.changedTouches[0].clientY;

        const deltaX = endX - startX;
        const deltaY = Math.abs(endY - startY);

        if (deltaX > threshold && deltaY < verticalThreshold) {
          console.log("← 스와이프로 채팅 목록으로 이동");

          // ✅ 기존 뒤로가기 버튼을 모방해 renderHome("chat") 호출
          renderHome("chat");
        }
      });
    }

    enableSwipeBackOnChat();
    disableScrollForChat(); // ✅ 채팅 진입 시 스크롤 막기
  }

  window.renderChatRoom = renderChatRoom;

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
            color: #fcfcfc;
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

          updateTopNavText(); // ✅ 상단바 텍스트 즉시 갱신

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
      exitEditMode();

      const u = data;
      const container = document.getElementById("homeContent");

      if (container) {
        container.style.backgroundColor = "#f5f5f5";
        container.style.maxHeight = "calc(100vh - 160px)";
        container.style.minHeight = "300px";
        container.style.overflowY = "auto";
        container.style.scrollbarWidth = "none"; // Firefox
        container.style.msOverflowStyle = "none"; // IE/Edge
        container.style.overflow = "hidden auto"; // Chrome, Safari
      }

      let bioText = () => {
        let rawBio = typeof u.bio === "string" ? u.bio.trim() : "";
        return rawBio ? rawBio : t("common.noBio");
      };

      container.style.padding = "12px 10px";

      container.innerHTML = `
        <h2>${u.nickname || t("profile.anon")}</h2>
        <div style="display: flex; gap: 20px; align-items: flex-start; margin: 10px 0;">
          <div id="profileImageWrapper" style="width: 135px; flex-shrink: 0;"></div>
          <div style="flex: 1; min-width: 0;">
            <div class="my-info" style="margin-top: 21px;">
              <p><strong>${t("profile.age")}</strong> ${u.age ?? '-'}</p>
              <p><strong>${t("label.gender")}</strong> ${u.gender ? (t(u.gender) || t(`gender.${u.gender}`)) : '-'}</p>
              <p><strong>${t("profile.school")}</strong> ${t(u.school ?? '-')}</p>
              <p><strong>${t("profile.major")}</strong> ${t(u.major ?? '-')}</p>
              <p><strong>${t("profile.mbti")}</strong> ${u.mbti ? t(`mbti.${u.mbti.replace(/^mbti\./, '').replace(/^:/, '')}`) : '-'}</p>
              <p><strong>${t("profile.personality")}</strong> ${(u.personality || []).map(p => t(p)).join(', ')}</p>
              <p><strong>${t("profile.purpose")}</strong> ${(u.purpose || []).map(p => t(p)).join(', ')}</p>
            </div>
          </div>
        </div>

        <h3>${t("profile.bioTitle")}</h3>
        <div id="bioText" style="white-space:pre-line;">${bioText()}</div>

        <div style="text-align: center; margin: 20px 0;">
          <button id="editBioBtn" style="
            width: 100%;
            padding: 12px;
            font-size: 16px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#0f9f77'"
            onmouseout="this.style.backgroundColor='#10b981'">
            ✏ ${t("profile.edit")}
          </button>
        </div>
      `;

      setTimeout(() => {}, 0);

      // 프로필 이미지 표시
      const wrapper = document.getElementById("profileImageWrapper");
      wrapper.innerHTML = `
        <img id="previewProfileImage" src="${u.photoUrl || './defaultprofile.png'}"
          alt="Preview"
          style="width: 135px; height: 180px; object-fit: cover; border-radius: 10px; border: 2px solid #6ee7b7; margin-top: 21px;" />
      `;

      // 수정 버튼 동작 연결
      document.getElementById("editBioBtn").onclick = () => {
          isEditing = true;
          enableBioEditMode();
      };
    }


    function enableBioEditMode() {
        enterEditMode();

        const bioView = document.getElementById("bioText");
        const editBtn = document.getElementById("editBioBtn");

        if (!bioView || !editBtn) return;

        const wrapper = document.getElementById("profileImageWrapper");
        wrapper.innerHTML = `
            <div style="position: relative; width: 135px; height: 180px; margin-top: 21px;">
              <label for="profileImageInput" style="display: block; cursor: pointer; width: 100%; height: 100%;">
                <img id="previewProfileImage" src="${data.photoUrl || './defaultprofile.png'}"
                  alt="Preview"
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;
                        border: 2px solid #6ee7b7;" />
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  border-radius: 10px;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  font-size: 56px;
                  font-weight: 900;
                  color: rgba(107, 114, 128, 0.6); 
                  text-shadow: 1px 1px 2px white;
                  pointer-events: none;
                ">＋</div>
              </label>
              <input type="file" id="profileImageInput" accept="image/*" style="display: none;" />
            </div>
        `;

        // bioView 영역을 textarea로 교체
        const currentBio = bioView.textContent.trim();
          bioView.outerHTML = `
            <textarea id="bioInput"
            style="
              width: 100%;
              min-height: 140px; /* 최소 높이 설정 */
              padding: 12px; /* 내부 여백 */
              border: 2px solid #42c7bc; /* 테두리 색상 */
              border-radius: 12px; /* 둥근 모서리 */
              font-size: 16px; /* 글자 크기 */
              font-family: inherit; /* 기본 글꼴 사용 */
              box-sizing: border-box; /* 패딩과 테두리를 포함하여 크기 조정 */
              resize: vertical; /* 세로 방향으로만 크기 조정 가능 */
              background-color: #fff; /* 배경 색상 */
              line-height: 1.6; /* 줄 간격 */
              transition: border-color 0.3s, box-shadow 0.3s; /* 스타일 전환 애니메이션 */
              outline: none; /* 포커스 시 외곽선 제거 */
              ">${currentBio}
            </textarea>

            <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 10px;">
              <button id="saveBioBtn" style="
                flex: 1;
                padding: 12px 16px;
                font-size: 16px;
                border-radius: 8px;
                background-color: #10b981;
                color: white;
                border: none;
                cursor: pointer;
              ">${t("profile.save")}</button>
            </div>
        `;

        const input = document.getElementById("profileImageInput");
        if (input) {
            input.addEventListener("change", async () => {
                const file = input.files[0];
                if (!file) return;

                const storageRef = ref(storage, `profileImages/${state.currentUserEmail}`);
                await uploadBytes(storageRef, file);

                try {
                    const url = await getDownloadURL(storageRef);
                    const randomUrl = `${url}?v=${Date.now()}`; // 캐시 무력화용 쿼리

                    const img = new Image();
                    img.onload = () => {
                        const preview = document.getElementById("previewProfileImage");
                        if (preview) preview.src = randomUrl;
                    };
                    img.onerror = () => {
                        const preview = document.getElementById("previewProfileImage");
                        if (preview) preview.src = "./defaultprofile.png";
                    };
                    img.src = randomUrl;

                    // Firestore에 저장할 때는 순수 URL만 사용
                    state.currentUserData.photoUrl = url;
                } catch (err) {
                    console.error("프로필 이미지 로딩 실패:", err);
                    const preview = document.getElementById("previewProfileImage");
                    if (preview) preview.src = "./defaultprofile.png";
                }
            });
        }

        // 버튼 숨기기
        editBtn.style.display = "none";

        // 언어 설정 버튼과 로그아웃 버튼 숨기기
        const langBtn = document.getElementById("langToggleBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        if (langBtn) langBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";

        // 수정하기 버튼 밑에 언어 변경 및 로그아웃 버튼 추가
        const languageLogoutWrapper = document.createElement("div");
        languageLogoutWrapper.style = "text-align: center; margin-top: 20px;";
        languageLogoutWrapper.innerHTML = `
            <button id="langToggleBtn" style="width: 100%; padding: 12px; font-size: 16px; background: #ffffff; color: #10b981; border: 2px solid #6ee7b7; border-radius: 8px;">
              🌐 ${t("profile.changeLang")}
            </button>
            <button id="logoutBtn" style="width: 100%; padding: 12px; font-size: 16px; background: #ffffff; color: #10b981; border: 2px solid #6ee7b7; border-radius: 8px; margin-top: 10px;">
              ${t("common.logout")}
            </button>
        `;

        // 버튼들을 기존 컨테이너에 추가
        const container = document.getElementById("homeContent");
        container.appendChild(languageLogoutWrapper);

        // 언어 설정 버튼 클릭 이벤트
        document.getElementById("langToggleBtn").onclick = () => renderLanguageSettingView();

        // 로그아웃 버튼 클릭 이벤트
        document.getElementById("logoutBtn").onclick = async () => {
            const { auth } = await import('./firebase.js');
            const { signOut } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
            await signOut(auth);
            state.currentUserEmail = null;
            state.currentUserData = null;
            renderLogin();
        };

        // 저장 버튼 클릭 시
        document.getElementById("saveBioBtn").onclick = async () => {
            const newBio = document.getElementById("bioInput").value.trim();
            const defaultBios = [
                "자기소개가 없습니다.",
                "No introduction.",
                "自己紹介がありません。",
                "暂无自我介绍。"
            ];
            state.currentUserData.bio = defaultBios.includes(newBio) ? "" : newBio;

            // 프로필 이미지 업로드
            const file = document.getElementById("profileImageInput")?.files?.[0];
            if (file) {
                const imageRef = ref(storage, `profileImages/${state.currentUserEmail}`);
                await uploadBytes(imageRef, file); // 안정적 업로드
                const url = await getDownloadURL(imageRef); // 업로드 후 URL 얻기
                state.currentUserData.photoUrl = url;
            }

            const docRef = doc(db, "users", state.currentUserEmail);
            await setDoc(docRef, state.currentUserData);
            
            renderProfileTab(); // 다시 보기 모드로
        };

        // 취소 버튼 클릭 시
        document.getElementById("cancelBioBtn").onclick = () => {
            renderProfileTab(); // 다시 보기 모드로
        };
    }


    renderViewMode();
  }
}

// 전역에 바로 할당
window.renderHome = renderHome;

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
    content.innerHTML = "";

    const title = document.createElement("h2");
    const q = matchQuestions[state.matchStep];
    title.textContent = t(q.textKey);
    content.appendChild(title);

    const opts = document.createElement("div");
    opts.className = "match-options";
    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.textContent = t(opt);
      btn.classList.add("match-question-btn");
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

    <!-- 프로필 & 소개를 감싸는 영역 -->
    <div id="profileArea" style="min-height: 300px;">
      <div class="basic-info">
        <p><strong>${t("profile.email")}: </strong> ${candidate.id}</p>
        <p><strong>${t("profile.age")}: </strong> ${candidate.age}</p>
        <p><strong>${t("label.gender")}: </strong> ${candidate.gender ? (t(candidate.gender) || t(`gender.${candidate.gender}`)) : '-'}</p>
        <p><strong>${t("profile.school")}: </strong> ${t(candidate.school)}</p>
        <p><strong>${t("profile.major")}: </strong> ${t(candidate.major)}</p>
        <p><strong>${t("profile.mbti")}: </strong> ${t(candidate.mbti)}</p>
        <p><strong>${t("profile.personality")}: </strong> ${Array.isArray(candidate.personality) ? candidate.personality.map(p => t(p)).join(", ") : t(candidate.personality)}</p>
        <p><strong>${t("profile.purpose")}: </strong> ${Array.isArray(candidate.purpose) ? candidate.purpose.map(p => t(p)).join(", ") : t(candidate.purpose)}</p>
      </div>

      <div class="introduction" style="display:none;">
        <p>${candidate.bio?.trim() || t("common.noBio")}</p>
      </div>
    </div>

    <!-- 버튼은 프로필 영역 바깥에 두고 고정 -->
    <button class="toggle-intro-btn" data-email="${candidate.id}">${t("action.showIntro") || "자기소개 보기"}</button>

    <div class="decision-buttons">
      <button class="accept-btn" id="acceptBtn" style="
        background-color: #4ade80;
        color: white;
        border: none;
        padding: 12px 20px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      ">
        ${t("match.accept") || "수락"}
      </button>

      <button class="reject-btn" id="rejectBtn" style="
        background-color: #f87171;
        color: white;
        border: none;
        padding: 12px 20px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      ">
        ${t("match.reject") || "거부"}
      </button>
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

          // 레이아웃이 없을 때만 최소한으로 복구하되, 기본 탭을 "chat"으로
          if (!document.getElementById("homeContent") || !document.getElementById("homeMenu")) {
            await renderHome("chat");                     // ✅ 기본 탭을 chat로
            await new Promise(r => requestAnimationFrame(r)); // 한 프레임 대기(안정화)
          }

          // ✅ 탭 전환 호출 없이 곧바로 방 진입
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
  const q = matchQuestions[matchStep];

  const opts = document.createElement("div");
  opts.className = "match-options";
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = t(opt);
    btn.classList.add("match-question-btn");
    if (state.matchAnswers[q.id] === opt) btn.classList.add("selected");
    btn.onclick = () => {
      state.matchAnswers[q.id] = opt;
      state.matchStep++;
      renderCurrentMatchStep();
    };
    opts.appendChild(btn);
  });
  document.querySelector("#homeContent")?.appendChild(opts);

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

  const html = `
    <h2>${t("match.candidateTitle")}</h2>

    <!-- 프로필 & 소개를 감싸는 영역 -->
    <div id="profileArea" style="min-height: 300px;padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 96px);">
      <div class="basic-info">
        <p><strong>${t("profile.email")}: </strong> ${candidate.id}</p>
        <p><strong>${t("profile.age")}: </strong> ${candidate.age}</p>
        <p><strong>${t("label.gender")}: </strong> ${candidate.gender ? (t(candidate.gender) || t(`gender.${candidate.gender}`)) : '-'}</p>
        <p><strong>${t("profile.school")}: </strong> ${t(candidate.school)}</p>
        <p><strong>${t("profile.major")}: </strong> ${t(candidate.major)}</p>
        <p><strong>${t("profile.mbti")}: </strong> ${t(candidate.mbti)}</p>
        <p><strong>${t("profile.personality")}: </strong> ${Array.isArray(candidate.personality) ? candidate.personality.map(p => t(p)).join(", ") : t(candidate.personality)}</p>
        <p><strong>${t("profile.purpose")}: </strong> ${Array.isArray(candidate.purpose) ? candidate.purpose.map(p => t(p)).join(", ") : t(candidate.purpose)}</p>
      </div>

      <div class="introduction" style="display:none;">
        <p>${candidate.bio?.trim() || t("common.noBio")}</p>
      </div>
    </div>

    <!-- 버튼은 프로필 영역 바깥에 두고 고정 -->
    <button class="toggle-intro-btn" data-email="${candidate.id}">${t("action.showIntro") || "자기소개 보기"}</button>

    <div class="decision-buttons">
      <button class="accept-btn" id="acceptBtn" style="
        background-color: #4ade80;
        color: white;
        border: none;
        padding: 12px 20px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      ">
        ${t("match.accept") || "수락"}
      </button>

      <button class="reject-btn" id="rejectBtn" style="
        background-color: #f87171;
        color: white;
        border: none;
        padding: 12px 20px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      ">
        ${t("match.reject") || "거부"}
      </button>
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

function openOverlayView(htmlContent) {
  const overlay = document.getElementById("overlayPage");
  overlay.innerHTML = htmlContent;
  overlay.style.display = "block";
}

function closeOverlayView() {
  const overlay = document.getElementById("overlayPage");
  overlay.style.display = "none";
  overlay.innerHTML = "";
}

// 화면 스크롤 제어 함수
function enterEditMode() {
  document.body.style.overflow = 'auto'; // ✅ 스크롤 허용
}

function exitEditMode() {
  document.body.style.overflow = 'hidden'; // ✅ 스크롤 막기
}

function disableScrollForChat() {
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  const app = document.getElementById("app");
  if (app) {
    app.style.overflow = "hidden";
    app.style.maxHeight = "100dvh";
  }
}

function enableScrollBack() {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";

  const app = document.getElementById("app");
  if (app) {
    app.style.overflow = "";
    app.style.maxHeight = "";
  }
}

document.addEventListener('DOMContentLoaded', () => {});

function updateViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', updateViewportHeight);
window.addEventListener('load', updateViewportHeight);

document.addEventListener("DOMContentLoaded", () => {
  const carousel = document.querySelector(".carousel-images");
  if (!carousel) return; // 홈탭이 아직 안 뜬 경우 방지
  const images = document.querySelectorAll(".carousel-images a");
  let index = 0;

  document.querySelector(".nextBtn").addEventListener("click", () => {
    index = (index + 1) % images.length;
    carousel.style.transform = `translateX(${-index * 100}%)`;
  });

  document.querySelector(".prevBtn").addEventListener("click", () => {
    index = (index - 1 + images.length) % images.length;
    carousel.style.transform = `translateX(${-index * 100}%)`;
  });
});
