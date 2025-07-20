import { db, auth }            from './firebase.js';
import { collection, getDoc, getDocs, query, orderBy, doc, setDoc, onSnapshot, serverTimestamp, getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

export async function findMatchCandidates() {
  const usersSnap = await getDocs(collection(db, "users"));
  const matched = [];

  usersSnap.forEach(docSnap => {
    const user = docSnap.data();
    const email = docSnap.id;

    if (email === state.currentUserEmail) return;

    const isMatch = Object.entries(state.matchAnswers).every(([key, value]) => {
      const userValue = user[key];
      if (!userValue) {
        console.log("🔻 사용자에 없음:", key);
        return false;
      }

      // ✅ 학교는 무조건 일치해야 함
        if (key === "school") {
          const result = t(userValue) === t(value);
          console.log("🏫 학교 비교:", key, "| 사용자:", userValue, "| 나의 조건:", value, "| 결과:", result);
          return result;
        }

      const result = Array.isArray(userValue)
        ? (Array.isArray(value)
            ? value.every(v => userValue.some(u => t(u) === t(v)))
            : userValue.some(u => t(u) === t(value)))
        : t(userValue) === t(value);

      console.log("🔎 비교:", key, "| 사용자:", userValue, "| 나의 조건:", value, "| 결과:", result);
      return result;
    });

    if (isMatch) {
      matched.push({ ...user, id: email });
    }
  });

  state.currentMatchCandidates = matched;
}

function setLanguage(langCode) {
  state.currentLang = langCode;
  localStorage.setItem("lang", langCode);

  if (state.isLoggedIn) {
    renderHome();

    // ✅ DOM 렌더링 이후 nav 텍스트 업데이트
    setTimeout(() => {
      updateTopNavText();
      setActiveTab(state.currentTab || "home");
    }, 50);
  } else {
    renderLogin();
  }

  updateTexts();

  // ✅ 채팅방이면 재렌더링
  if (state.currentTab === "chat" && state.currentChatId && state.currentChatPartnerEmail) {
    setTimeout(() => {
      renderChatRoom(state.currentChatId, state.currentChatPartnerEmail);
    }, 100);
  }
}


function rerenderAll() {
  const activeTab = document.querySelector('.tab-btn.active')?.id;

  if (activeTab === "homeTab") renderHomeTab();
  else if (activeTab === "matchingTab") renderMatchingTab();
  else if (activeTab === "chatTab") renderChatTab();
  else if (activeTab === "profileTab") renderProfileTab();

  updateTopNavText();  // ✅ 반드시 포함

  // 상단 탭 버튼 텍스트도 갱신
  document.getElementById("homeTab").textContent = t("action.goHome");
  document.getElementById("matchingTab").textContent = t("match.candidate");
  document.getElementById("chatTab").textContent = t("chat.title").replace("{nickname}", "");
  document.getElementById("profileTab").textContent = t("action.backToProfile");
}

const firebaseConfig = {
  apiKey: "AIzaSyDBW_188kA6WEX73dw3Kk3tF3rZ9746UKM",
  authDomain: "unibridge-b06bd.firebaseapp.com",
  projectId: "unibridge-b06bd",
  storageBucket: "unibridge-b06bd.firebasestorage.app",
  messagingSenderId: "405623255959",
  appId: "1:405623255959:web:dbd82ea8512b39f9decad2",
  measurementId: "G-0HEQRN2K98"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// auth.js
export const state = {
  currentLang: localStorage.getItem("lang") || "en",
  currentUserEmail:      null,
  currentUserData:       null,
  signupStep:            0,
  signupAnswers:         {},
  matchStep:             0,
  matchAnswers:          {},
  currentMatchCandidates:[],
  currentMatchIndex:     0,
  waitingForDecision:    false,
  newAcceptances:       [],
  matchedUsers: [],
  acceptIndex: 0,
};

const i18n = {
  ko : {
    home: {
      title: "홈 화면",
      welcome: "환영해요! UniBridge에 오신 것을 환영합니다 💕",
      findFriend: "친구 찾기"
    },
    nav: {
      home: "홈",
      exchange: "프로그램",
      match: "매칭",
      chat: "채팅",
      profile: "나의정보",
      new: "NEW"
    },
    signup: {
      q0: "1. 닉네임을 입력해주세요",
      q1: "2. 나이를 알려주세요",
      q2: "3. 재학 중인 학교를 알려주세요",
      q3: "4. 현재 학과가 어떻게 되시나요?",
      q4: "5. 사는 지역이 어떻게 되시나요?",
      q5: "6. MBTI를 알려주세요",
      q6: "7. 성격을 알려주세요 (중복 선택 가능)",
      q7: "8. 연락 빈도는 어떻게 되시나요?",
      q8: "9. 관심사를 알려주세요 (중복 선택 가능)",
      finalTitle: "계정 생성 - 이메일과 비밀번호 입력",
      emailLabel: "학교 공식 이메일",
      emailPlaceholder: "이메일 입력",
      passwordLabel: "비밀번호",
      passwordPlaceholder: "비밀번호 입력",
      createAccount: "계정 생성하기"
    },
    signupError: "계정 생성 중 오류가 발생했습니다: {error}",
    loading: "로딩 중",
    match: {
      ageRange: "원하시는 나이대를 알려주세요",
      school: "찾으시는 학교를 알려주세요",
      personality: "선호하는 상대방의 성격이 무엇입니까?",
      purpose: "어떤 친구를 찾고 싶습니까?",
      fail: "매칭 실패",
      noCandidates: "조건에 맞는 친구가 없습니다.",
      candidate: "매칭 후보",
      candidateTitle: "매칭 후보",
      success: "축하합니다! 서로 수락하여 연결되었습니다.",
      successTitle: "매칭 성공 🎉",
      rejectResult: "아쉽게도 한쪽이 거부하여 연결되지 않았습니다. 다른 인연을 찾아보세요.",
      done: "매칭 완료",
      noMore: "더 이상의 후보가 없습니다.",
      accept: "수락",
      reject: "거부",
      goToChat: "채팅으로 가기",
      waiting: "응답이 저장되었습니다. 상대방의 응답을 기다려주세요."
    },
    school: {
      snu: "서울대학교",
      pku: "북경대학교",
      rikkyo: "릿쿄대학교",
      nus: "NUS"
    },
    mbti: {
      INTJ: "INTJ", INFJ: "INFJ", INTP: "INTP", INFP: "INFP",
      ENTJ: "ENTJ", ENFJ: "ENFJ", ENTP: "ENTP", ENFP: "ENFP",
      ISTJ: "ISTJ", ISFJ: "ISFJ", ISTP: "ISTP", ISFP: "ISFP",
      ESTJ: "ESTJ", ESFJ: "ESFJ", ESTP: "ESTP", ESFP: "ESFP"
    },
    personality: {
      extrovert: "외향적",
      introvert: "내향적",
      precise: "꼼꼼함",
      honest: "솔직함"
    },
    frequency: {
      never: "거의 안봐요",
      sometimes: "가끔씩 봐요",
      often: "종종 봐요",
      always: "자주 봐요"
    },
    purpose: {
      language: "언어 교환",
      friend: "친구 사귀기",
      info: "정보 찾기",
      languageFull: "언어 교환하고 싶어요!",
      friendFull: "마음이 맞는 친구를 사귀고 싶어요!",
      infoFull: "정보를 찾고 싶어요!"
    },
    call: {
      incoming: "{name}님이 전화 중입니다",
      accept: "수락",
      reject: "거부",
      rejected: "통화를 거절했습니다.",
      ended: "통화가 종료되었습니다.",
      inProgress: "통화 중...",
      end: "📴",
      start: "Call"
    },
    label: {
      age: "나이",
      school: "학교",
      major: "학과",
      mbti: "MBTI",
      personality: "성격",
      purpose: "관심사"
    },
    action: {
      accept: "수락",
      reject: "거부",
      showIntro: "자기소개 보기",
      backToProfile: "돌아가기",
      goToChat: "채팅으로 가기",
      goHome: "홈으로 돌아가기",
      lookIntroduction: "자기소개 보기"
    },
    common: {
      selectPlaceholder: "선택해주세요",
      next: "다음",
      back: "뒤로",
      previous: "이전",
      backToHome: "홈으로 돌아가기",
      backToProfile: "뒤로 가기",
      noBio: "자기소개가 아직 없습니다.",
      lookIntroduction: "자기소개 보기",
      noIntroduction: "자기소개가 아직 없습니다.",
      inputWarning: "답변을 입력하거나 선택해주세요.",
      matchingDone: "매칭 완료",
      noMoreCandidates: "더 이상의 후보가 없습니다.",
      matchedWith: "{name}님과 매칭되었습니다!",
      congratulations: "축하합니다! 서로 수락하여 연결되었습니다.",
      tryOthers: "아쉽게도 한쪽이 거부하여 연결되지 않았습니다. 다른 인연을 찾아보세요.",
      loginTitle: "로그인",
      email: "이메일을 입력해주세요",
      password: "비밀번호를 입력해주세요",
      login: "로그인",
      logout: "로그아웃",
      signup: "처음이신가요? 계정 생성하기",
      programschedule: "일정 안내",
      calendar: "달력",
      sun: "일",
      mon: "월",
      tue: "화",
      wed: "수",
      thu: "목",
      fri: "금",
      sat: "토"
    },
    calendar: {
      month1: "1월",
      month2: "2월",
      month3: "3월",
      month4: "4월",
      month5: "5월",
      month6: "6월",
      month7: "7월",
      month8: "8월",
      month9: "9월",
      month10: "10월",
      month11: "11월",
      month12: "12월"
    },
    chat: {
      chat: "채팅",
      title: "{nickname}님과의 채팅",
      call: "Call",
      endCall: "End Call",
      inCall: "통화 중...",
      inputPlaceholder: "메시지 입력",
      send: "보내기",
      back: "뒤로",
      chooseFile: "파일 선택",
      noFile: "선택된 파일 없음",
      nomatch: "아직 매칭된 친구가 없습니다."
    },
    profile: {
      anon: "익명",
      loadError: "사용자 정보를 불러올 수 없습니다.",
      email: "이메일",
      loginemail: "학교 공식 이메일",
      password: "비밀번호",
      age: "나이",
      school: "학교",
      major: "학과",
      region: "사는 곳",
      mbti: "MBTI",
      purpose: "관심사",
      personality: "성격",
      bioTitle: "자기소개",
      noBio: "아직 자기소개가 없습니다.",
      edit: "수정하기",
      editBioTitle: "자기소개 수정",
      save: "저장",
      cancel: "취소",
      changeLang: "언어 변경",
      chooseLang: "언어 선택"
    },
    alert: {
      notLoggedIn: "로그인 상태가 아닙니다.",
      enterEmail: "이메일을 입력해주세요.",
      enterPassword: "비밀번호를 입력해주세요.",
      invalidNumber: "유효한 숫자를 입력해주세요.",
      inputRequired: "답변을 입력하거나 선택해주세요.",
      accountExists: "이미 존재하는 이메일입니다. 덮어쓰시겠습니까?",
      domainError: "학교 공식 이메일만 사용할 수 있습니다.",
      signupSuccess: "계정 생성 완료! 환영합니다, {name}님!",
      loginSuccess: "로그인 성공! 환영합니다, {name}님!",
      loginError: "로그인 중 오류가 발생했습니다: {error}",
      noAccount: "등록된 계정이 없습니다. 계정을 생성해주세요.",
      wrongPassword: "비밀번호가 틀렸습니다.",
      signupError: "계정 생성 중 오류가 발생했습니다: {error}",
      wrongCredential: "이메일 또는 비밀번호가 올바르지 않습니다.",
      tooManyRequests: "잠시 후 다시 시도해주세요. 로그인 시도가 너무 많습니다."
    }
  },

  en: {
    home: {
      title: "Home",
      welcome: "Welcome to UniBridge 💕",
      findFriend: "Find a Friend"
    },
    nav: {
      home: "Home",
      exchange: "Event",
      match: "Matching",
      chat: "Chat",
      profile: "Profile",
      new: "NEW"
    },
    signup: {
      q0: "1. Please enter your nickname",
      q1: "2. How old are you?",
      q2: "3. What university are you attending?",
      q3: "4. What's your major?",
      q4: "5. Where do you live?",
      q5: "6. What's your MBTI?",
      q6: "7. How would you describe your personality? (You can choose more than one)",
      q7: "8. How often would you like to keep in touch?",
      q8: "9. What's your goal for matching? (You can choose more than one)",
      finalTitle: "Create Account - Enter Email & Password",
      emailLabel: "University Email",
      emailPlaceholder: "Enter your email",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter your password",
      createAccount: "Create Account"
    },
    signupError: "There was an error while creating your account: {error}",
    loading: "Loading...",
    match: {
      ageRange: "What age range are you looking for?",
      school: "Which university should your friend be from?",
      personality: "What kind of personality do you prefer?",
      purpose: "What kind of friend are you hoping to meet?",
      fail: "Match failed",
      noCandidates: "No matching friends found.",
      candidate: "Match Candidate",
      candidateTitle: "Match Candidate",
      success: "Congrats! You've both accepted and you're now connected.",
      successTitle: "Match Successful 🎉",
      rejectResult: "Unfortunately, one side declined. Try meeting someone else!",
      done: "Matching Complete",
      noMore: "No more candidates.",
      accept: "Accept",
      reject: "Decline",
      goToChat: "Go to Chat",
      waiting: "Response saved. Please wait for the other person to respond."
    },
    school: {
      snu: "Seoul National University",
      pku: "Peking University",
      rikkyo: "Rikkyo University",
      nus: "NUS"
    },
    mbti: {
      INTJ: "INTJ", INFJ: "INFJ", INTP: "INTP", INFP: "INFP",
      ENTJ: "ENTJ", ENFJ: "ENFJ", ENTP: "ENTP", ENFP: "ENFP",
      ISTJ: "ISTJ", ISFJ: "ISFJ", ISTP: "ISTP", ISFP: "ISFP",
      ESTJ: "ESTJ", ESFJ: "ESFJ", ESTP: "ESTP", ESFP: "ESFP"
    },
    personality: {
      extrovert: "Extroverted",
      introvert: "Introverted",
      precise: "Detail-Oriented",
      honest: "Honest"
    },
    frequency: {
      never: "Rarely talk",
      sometimes: "Occasionally",
      often: "Often",
      always: "Frequently"
    },
    purpose: {
      language: "Language Exchange",
      friend: "Making Friends",
      info: "Finding Information",
      languageFull: "I'd love to exchange languages!",
      friendFull: "I'd love to make a good friend!",
      infoFull: "I'm here to find useful information!"
    },
    call: {
      incoming: "{name} is calling",
      accept: "Accept",
      reject: "Decline",
      rejected: "Call was declined.",
      ended: "Call ended.",
      inProgress: "On a call...",
      end: "📴",
      start: "Call"
    },
    label: {
      age: "Age",
      school: "University",
      major: "Major",
      mbti: "MBTI",
      personality: "Personality",
      purpose: "Interests"
    },
    action: {
      accept: "Accept",
      reject: "Decline",
      showIntro: "View Bio",
      backToProfile: "Back to Info",
      goToChat: "Go to Chat",
      goHome: "Back to Home",
      lookIntroduction: "View Bio"
    },
    common: {
      selectPlaceholder: "Please select",
      next: "Next",
      back: "Back",
      previous: "Previous",
      backToHome: "Back to Home",
      backToProfile: "Back",
      noBio: "No bio provided.",
      lookIntroduction: "View Bio",
      noIntroduction: "No bio provided.",
      inputWarning: "Please enter or select a response.",
      matchingDone: "Matching Complete",
      noMoreCandidates: "No more candidates.",
      matchedWith: "You're matched with {name}!",
      congratulations: "Congrats! You've both accepted and you're now connected.",
      tryOthers: "Unfortunately, one side declined. Try meeting someone else!",
      loginTitle: "Login",
      email: "Please enter your email",
      password: "Please enter your password",
      login: "Log In",
      logout: "Log Out",
      signup: "New here? Create an account",
      programschedule: "Schedule Information",
      calendar: "Calendar",
      sun: "Sun",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat"
    },
    calendar: {
      month1: "January",
      month2: "February",
      month3: "March",
      month4: "April",
      month5: "May",
      month6: "June",
      month7: "July",
      month8: "August",
      month9: "September",
      month10: "October",
      month11: "November",
      month12: "December"
    },
    chat: {
      chat: "Chat",
      title: "Chat with {nickname}",
      call: "Call",
      endCall: "End Call",
      inCall: "On a call...",
      inputPlaceholder: "Type your message here",
      send: "Send",
      back: "Back",
      chooseFile: "Choose File",
      noFile: "No file selected",
      nomatch: "No friends matched yet."
    },
    profile: {
      anon: "Anonymous",
      loadError: "Unable to load user info.",
      email: "Email",
      loginemail: "University Email",
      password: "Password",
      age: "Age",
      school: "University",
      major: "Major",
      region: "Location",
      mbti: "MBTI",
      purpose: "Interests",
      personality: "Personality",
      bioTitle: "About Me",
      noBio: "No bio added yet.",
      edit: "Edit",
      editBioTitle: "Edit Bio",
      save: "Save",
      cancel: "Cancel",
      changeLang: "Change Language",
      chooseLang: "Choose a Language"
    },
    alert: {
      notLoggedIn: "You're not logged in.",
      enterEmail: "Please enter your email.",
      enterPassword: "Please enter your password.",
      invalidNumber: "Please enter a valid number.",
      inputRequired: "Please enter or select a response.",
      accountExists: "This email is already registered. Overwrite?",
      domainError: "Only university emails are allowed.",
      signupSuccess: "Account created! Welcome, {name}!",
      loginSuccess: "Login successful! Welcome, {name}!",
      loginError: "There was an error logging in: {error}",
      noAccount: "No account found. Please sign up.",
      wrongPassword: "Incorrect password.",
      signupError: "There was an error creating your account: {error}",
      wrongCredential: "Incorrect email or password.",
      tooManyRequests: "Too many login attempts. Please try again later."
    }
  },

  jp: {
    home: {
      title: "ホーム画面",
      welcome: "ようこそ！UniBridgeへようこそ 💕",
      findFriend: "友だちを探す"
    },
    nav: {
      home: "ホーム",
      exchange: "イベント",
      match: "マッチ",
      chat: "トーク",
      profile: "マイ",
      new: "NEW"
    },
    signup: {
      q0: "1. ニックネームを入力してください",
      q1: "2. 年齢を教えてください",
      q2: "3. 在学中の大学を教えてください",
      q3: "4. 現在の専攻は何ですか？",
      q4: "5. お住まいの地域はどこですか？",
      q5: "6. MBTIを教えてください",
      q6: "7. 性格を教えてください（複数選択可）",
      q7: "8. 連絡頻度はどのくらいですか？",
      q8: "9. マッチングの目的を教えてください（複数選択可）",
      finalTitle: "アカウント作成 - メールアドレスとパスワードを入力",
      emailLabel: "大学の公式メール",
      emailPlaceholder: "メールアドレスを入力",
      passwordLabel: "パスワード",
      passwordPlaceholder: "パスワードを入力",
      createAccount: "アカウントを作成する"
    },
    signupError: "アカウント作成中にエラーが発生しました: {error}",
    loading: "読み込み中",
    match: {
      ageRange: "希望する年齢層を教えてください",
      school: "探したい学校を教えてください",
      personality: "希望する相手の性格はどんなタイプですか？",
      purpose: "どんな友だちを見つけたいですか？",
      fail: "マッチング失敗",
      noCandidates: "条件に合うお友だちが見つかりませんでした。",
      candidate: "マッチング候補",
      candidateTitle: "マッチング候補",
      success: "おめでとうございます！お互いに承認してつながりました！",
      successTitle: "マッチング成功 🎉",
      rejectResult: "残念ながらどちらかが拒否したため、つながりませんでした。他のご縁を探してみましょう。",
      done: "マッチング完了",
      noMore: "これ以上の候補はありません。",
      accept: "承認",
      reject: "拒否",
      goToChat: "チャットへ",
      waiting: "回答を保存しました。相手の返事をお待ちください。"
    },
    school: {
      snu: "ソウル大学校",
      pku: "北京大学",
      rikkyo: "立教大学",
      nus: "NUS"
    },
    mbti: {
      INTJ: "INTJ", INFJ: "INFJ", INTP: "INTP", INFP: "INFP",
      ENTJ: "ENTJ", ENFJ: "ENFJ", ENTP: "ENTP", ENFP: "ENFP",
      ISTJ: "ISTJ", ISFJ: "ISFJ", ISTP: "ISTP", ISFP: "ISFP",
      ESTJ: "ESTJ", ESFJ: "ESFJ", ESTP: "ESTP", ESFP: "ESFP"
    },
    personality: {
      extrovert: "社交的",
      introvert: "内向的",
      precise: "几帳面",
      honest: "率直"
    },
    frequency: {
      never: "ほとんど会いません",
      sometimes: "たまに会います",
      often: "よく会います",
      always: "頻繁に会います"
    },
    purpose: {
      language: "言語交換",
      friend: "友だちを作る",
      info: "情報を探す",
      languageFull: "言語交換をしたいです！",
      friendFull: "気の合う友だちを作りたいです！",
      infoFull: "情報を集めたいです！"
    },
    call: {
      incoming: "{name}さんが通話中です",
      accept: "承認",
      reject: "拒否",
      rejected: "通話を拒否しました。",
      ended: "通話が終了しました。",
      inProgress: "通話中…",
      end: "📴",
      start: "Call"
    },
    label: {
      age: "年齢",
      school: "学校",
      major: "専攻",
      mbti: "MBTI",
      personality: "性格",
      purpose: "興味"
    },
    action: {
      accept: "承認",
      reject: "拒否",
      showIntro: "自己紹介を見る",
      backToProfile: "プロフィールに戻る",
      goToChat: "チャットへ",
      goHome: "ホームに戻る",
      lookIntroduction: "自己紹介を見る"
    },
    common: {
      selectPlaceholder: "選択してください",
      next: "次へ",
      back: "戻る",
      previous: "前へ",
      backToHome: "ホームに戻る",
      backToProfile: "戻る",
      noBio: "自己紹介がありません。",
      lookIntroduction: "自己紹介を見る",
      noIntroduction: "自己紹介がありません。",
      inputWarning: "回答を入力または選択してください。",
      matchingDone: "マッチング完了",
      noMoreCandidates: "これ以上の候補はありません。",
      matchedWith: "{name}さんとマッチしました！",
      congratulations: "おめでとうございます！お互いに承認してつながりました！",
      tryOthers: "残念ながらどちらかが拒否したため、つながりませんでした。他のご縁を探しましょう。",
      loginTitle: "ログイン",
      email: "メールアドレスを入力してください",
      password: "パスワードを入力してください",
      login: "ログイン",
      logout: "ログアウト",
      signup: "初めてですか？アカウントを作成する",
      programschedule: "日程案内",
      calendar: "カレンダー",
      sun: "日",
      mon: "月",
      tue: "火",
      wed: "水",
      thu: "木",
      fri: "金",
      sat: "土"
    },
    calendar: {
      month1: "1月",
      month2: "2月",
      month3: "3月",
      month4: "4月",
      month5: "5月",
      month6: "6月",
      month7: "7月",
      month8: "8月",
      month9: "9月",
      month10: "10月",
      month11: "11月",
      month12: "12月"
    },
    chat: {
      chat: "チャット",
      title: "{nickname}さんとのチャット",
      call: "Call",
      endCall: "End Call",
      inCall: "通話中…",
      inputPlaceholder: "メッセージを入力してください",
      send: "送信",
      back: "戻る",
      chooseFile: "ファイルを選択",
      noFile: "選択されたファイルがありません",
      nomatch: "まだマッチした友だちがいません。"
    },
    profile: {
      anon: "匿名",
      loadError: "ユーザー情報を取得できません。",
      email: "メールアドレス",
      loginemail: "大学の公式メール",
      password: "パスワード",
      age: "年齢",
      school: "学校",
      major: "専攻",
      region: "居住地",
      mbti: "MBTI",
      purpose: "興味",
      personality: "性格",
      bioTitle: "自己紹介",
      noBio: "まだ自己紹介がありません。",
      edit: "編集する",
      editBioTitle: "自己紹介を編集",
      save: "保存",
      cancel: "キャンセル",
      changeLang: "言語を変更",
      chooseLang: "言語選択"
    },
    alert: {
      notLoggedIn: "ログインしていません。",
      enterEmail: "メールアドレスを入力してください。",
      enterPassword: "パスワードを入力してください。",
      invalidNumber: "有効な数字を入力してください。",
      inputRequired: "回答を入力または選択してください。",
      accountExists: "すでに存在するメールアドレスです。上書きしますか？",
      domainError: "大学公式のメールアドレスのみご利用いただけます。",
      signupSuccess: "アカウント作成完了！ようこそ、{name}さん！",
      loginSuccess: "ログイン成功！ようこそ、{name}さん！",
      loginError: "ログイン中にエラーが発生しました: {error}",
      noAccount: "登録されたアカウントがありません。アカウントを作成してください。",
      wrongPassword: "パスワードが間違っています。",
      signupError: "アカウント作成中にエラーが発生しました: {error}",
      wrongCredential: "メールアドレスまたはパスワードが正しくありません。",
      tooManyRequests: "ログイン試行が多すぎます。しばらくしてからもう一度お試しください。"
    }
  },

  ch: {
    home: {
      title: "主页",
      welcome: "欢迎加入 UniBridge！很高兴见到你 💕",
      findFriend: "寻找朋友"
    },
    nav: {
      home: "首页",
      exchange: "活动",
      match: "配对",
      chat: "聊天",
      profile: "我的信息",
      new: "新"
    },
    signup: {
      q0: "1. 请输入昵称",
      q1: "2. 请告诉我们你的年龄",
      q2: "3. 请填写你就读的学校",
      q3: "4. 你的专业是什么呢？",
      q4: "5. 你现在住在哪个地区？",
      q5: "6. 你的MBTI类型是？",
      q6: "7. 你的性格是怎样的呢？（可多选）",
      q7: "8. 平时联系频率是？",
      q8: "9. 想通过配对达成什么目的？（可多选）",
      finalTitle: "创建账号 - 输入邮箱和密码",
      emailLabel: "学校官方邮箱",
      emailPlaceholder: "请输入邮箱地址",
      passwordLabel: "密码",
      passwordPlaceholder: "请输入密码",
      createAccount: "创建账号"
    },
    signupError: "创建账号时发生错误: {error}",
    loading: "加载中",
    match: {
      ageRange: "你希望对方的年龄范围是？",
      school: "你想认识哪个学校的朋友？",
      personality: "你希望对方的性格是什么样？",
      purpose: "你希望结交怎样的朋友？",
      fail: "配对失败",
      noCandidates: "暂时没有符合条件的朋友哦",
      candidate: "配对候选人",
      candidateTitle: "配对候选人",
      success: "恭喜！你们互相接受并成功配对啦！",
      successTitle: "配对成功 🎉",
      rejectResult: "很遗憾，对方未接受配对。请尝试寻找其他缘分～",
      done: "配对完成",
      noMore: "没有更多候选人了",
      accept: "接受",
      reject: "拒绝",
      goToChat: "前往聊天",
      waiting: "已保存你的回应，请耐心等待对方回复～"
    },
    school: {
      snu: "首尔大学",
      pku: "北京大学",
      rikkyo: "立教大学",
      nus: "新加坡国立大学"
    },
    mbti: {
      INTJ: "INTJ", INFJ: "INFJ", INTP: "INTP", INFP: "INFP",
      ENTJ: "ENTJ", ENFJ: "ENFJ", ENTP: "ENTP", ENFP: "ENFP",
      ISTJ: "ISTJ", ISFJ: "ISFJ", ISTP: "ISTP", ISFP: "ISFP",
      ESTJ: "ESTJ", ESFJ: "ESFJ", ESTP: "ESTP", ESFP: "ESFP"
    },
    personality: {
      extrovert: "外向",
      introvert: "内向",
      precise: "细心",
      honest: "坦率"
    },
    frequency: {
      never: "几乎不联系",
      sometimes: "偶尔联系",
      often: "经常联系",
      always: "非常频繁"
    },
    purpose: {
      language: "语言交换",
      friend: "交朋友",
      info: "获取信息",
      languageFull: "我想进行语言交换！",
      friendFull: "我想交一个聊得来的朋友！",
      infoFull: "我想找一些有用的信息！"
    },
    call: {
      incoming: "{name} 正在呼叫你",
      accept: "接受",
      reject: "拒绝",
      rejected: "你已拒绝通话",
      ended: "通话已结束",
      inProgress: "通话中…",
      end: "📴",
      start: "Call"
    },
    label: {
      age: "年龄",
      school: "学校",
      major: "专业",
      mbti: "MBTI",
      personality: "性格",
      purpose: "兴趣"
    },
    action: {
      accept: "接受",
      reject: "拒绝",
      showIntro: "查看自我介绍",
      backToProfile: "返回资料",
      goToChat: "进入聊天",
      goHome: "回到首页",
      lookIntroduction: "查看自我介绍"
    },
    common: {
      selectPlaceholder: "请选择",
      next: "下一步",
      back: "返回",
      previous: "上一步",
      backToHome: "回到首页",
      backToProfile: "返回",
      noBio: "暂无自我介绍",
      lookIntroduction: "查看自我介绍",
      noIntroduction: "暂无自我介绍",
      inputWarning: "请填写或选择答案",
      matchingDone: "配对完成",
      noMoreCandidates: "没有更多候选人了",
      matchedWith: "你与 {name} 已成功配对！",
      congratulations: "恭喜！你们互相接受并成功配对啦！",
      tryOthers: "对方未接受配对，请试试其他朋友吧～",
      loginTitle: "登录",
      email: "请输入邮箱地址",
      password: "请输入密码",
      login: "登录",
      logout: "登出",
      signup: "第一次使用？创建账号",
      programschedule: "日程指南",
      calendar: "日历",
      sun: "日",
      mon: "一",
      tue: "二",
      wed: "三",
      thu: "四",
      fri: "五",
      sat: "六"
    },
    calendar: {
      month1: "1月",
      month2: "2月",
      month3: "3月",
      month4: "4月",
      month5: "5月",
      month6: "6月",
      month7: "7月",
      month8: "8月",
      month9: "9月",
      month10: "10月",
      month11: "11月",
      month12: "12月"
    },
    chat: {
      chat: "聊天",
      title: "与你和 {nickname} 的聊天",
      call: "Call",
      endCall: "End Call",
      inCall: "通话中…",
      inputPlaceholder: "输入你的消息吧",
      send: "发送",
      back: "返回",
      chooseFile: "选择文件",
      noFile: "未选择文件",
      nomatch: "你还没有配对成功的朋友哦"
    },
    profile: {
      anon: "匿名",
      loadError: "无法加载用户信息",
      email: "邮箱",
      loginemail: "学校官方邮箱",
      password: "密码",
      age: "年龄",
      school: "学校",
      major: "专业",
      region: "所在地",
      mbti: "MBTI",
      purpose: "兴趣",
      personality: "性格",
      bioTitle: "自我介绍",
      noBio: "还没有自我介绍哦",
      edit: "编辑",
      editBioTitle: "编辑自我介绍",
      save: "保存",
      cancel: "取消",
      changeLang: "切换语言",
      chooseLang: "选择语言"
    },
    alert: {
      notLoggedIn: "你尚未登录",
      enterEmail: "请输入邮箱地址",
      enterPassword: "请输入密码",
      invalidNumber: "请输入有效的数字",
      inputRequired: "请填写或选择答案",
      accountExists: "此邮箱已注册。是否覆盖？",
      domainError: "只能使用学校官方邮箱哦",
      signupSuccess: "账号创建成功！欢迎你，{name}！",
      loginSuccess: "登录成功！欢迎你，{name}！",
      loginError: "登录时出现错误: {error}",
      noAccount: "没有找到账号，请先注册～",
      wrongPassword: "密码错误",
      signupError: "创建账号时发生错误: {error}",
      wrongCredential: "邮箱或密码不正确。",
      tooManyRequests: "登录尝试过多，请稍后再试。"
    }
  }
};

// 🌍 다국어 지원을 위한 텍스트 불러오기 함수
function t(key, vars = {}) {
  const keys = key.split(".");
  let value = i18n[state.currentLang];
  for (const k of keys) {
    value = value?.[k];
    if (!value) return key;
  }
  Object.entries(vars).forEach(([k, v]) => {
    value = value.replace(`{${k}}`, v);
  });
  return value;
}

// --- 다국어 배열 출력 포맷 함수 ---
function formatArray(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(v => t(v)).join(", ");
  return t(value);
}

// 회원가입 질문
const signupQuestions = [
  { id: 0, textKey: "signup.q0", type: "text" },
  { id: 1, textKey: "signup.q1", type: "number" },
  { id: 2, textKey: "signup.q2", type: "select", options: ["school.snu", "school.pku", "school.rikkyo", "school.nus"] },
  { id: 3, textKey: "signup.q3", type: "text" },
  { id: 4, textKey: "signup.q4", type: "text" },
  { id: 5, textKey: "signup.q5", type: "select", options: [
    "mbti.INTJ","mbti.INFJ","mbti.INTP","mbti.INFP",
    "mbti.ENTJ","mbti.ENFJ","mbti.ENTP","mbti.ENFP",
    "mbti.ISTJ","mbti.ISFJ","mbti.ISTP","mbti.ISFP",
    "mbti.ESTJ","mbti.ESFJ","mbti.ESTP","mbti.ESFP"
  ]},
  { id: 6, textKey: "signup.q6", type: "multi", options: ["personality.extrovert", "personality.introvert", "personality.precise", "personality.honest"] },
  { id: 7, textKey: "signup.q7", type: "single", options: ["frequency.never", "frequency.sometimes", "frequency.often", "frequency.always"] },
  { id: 8, textKey: "signup.q8", type: "multi", options: ["purpose.language", "purpose.friend", "purpose.info"] },
];

// 매칭 질문
export const matchQuestions = [
  {
    id: "ageRange",
    textKey: "match.ageRange",
    type: "range",
    options: ["20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80-89", "90-100"]
  },
  {
    id: "school",
    textKey: "match.school",
    type: "select",
    options: ["school.snu", "school.pku", "school.rikkyo", "school.nus"]
  },
  {
    id: "personality",
    textKey: "match.personality",
    type: "multi",  // ← 수정
    options: ["personality.extrovert", "personality.introvert", "personality.precise", "personality.honest"]
  },
  {
    id: "purpose",
    textKey: "match.purpose",
    type: "multi",  // ← 수정
    options: ["purpose.languageFull", "purpose.friendFull", "purpose.infoFull"]
  }
];

  function renderLogin() {
    const container = document.getElementById("app");

    // ❌ nav는 로그인 화면에서 아예 안 보이게
    container.innerHTML = `
      <div id="homeContent">
        <h2>${t("common.loginTitle")}</h2>
        <label for="loginEmail">${t("profile.loginemail")}</label>
        <input type="email" id="loginEmail" placeholder="${t("common.email")}" />
        
        <label for="loginPassword">${t("profile.password")}</label>
        <input type="password" id="loginPassword" placeholder="${t("common.password")}" />
        
        <button id="loginBtn">${t("common.login")}</button>
        <button class="link-btn" id="showSignupBtn">${t("common.signup")}</button>
      </div>
    `;

  // ✅ 이제 요소가 존재하므로 안전하게 이벤트 연결 가능
  document.getElementById("loginBtn").onclick = loginUser;
  document.getElementById("showSignupBtn").onclick = () => {
    state.signupStep = 0;
    state.signupAnswers = {};
    renderSignupQuestion();
  };

  const langSelector = document.getElementById("languageSelector");
  if (langSelector) {
    langSelector.value = state.currentLang;
    langSelector.onchange = (e) => {
      state.currentLang = e.target.value;
      renderLogin(); // 언어 바뀌면 다시 렌더링
    };
  }
}

// --- 회원가입 질문 화면 렌더링 ---
function renderSignupQuestion() {
  const container = document.getElementById("app");
  container.innerHTML = "";

  if (state.signupStep >= signupQuestions.length) {
    renderSignupFinal();
    return;
  }

  const q = signupQuestions[state.signupStep];
  const h2 = document.createElement("h2");
  h2.textContent = t(q.textKey);
  container.appendChild(h2);

  if (q.type === "number" || q.type === "text") {
    const input = document.createElement("input");
    input.type = q.type === "number" ? "number" : "text";
    input.value = state.signupAnswers[q.id] || "";
    input.oninput = () => {
      state.signupAnswers[q.id] = q.type === "number" ? Number(input.value) : input.value;
    };
    container.appendChild(input);
    } else if (q.type === "select") {
    // 특별히 학교 선택일 때만 버튼 방식으로 표시
    if (q.id === 2) {
      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "1fr 1fr";
      grid.style.gap = "12px";
      grid.style.marginBottom = "20px";

      q.options.forEach(opt => {
        const button = document.createElement("button");
        button.textContent = t(opt);
        button.style.width = "100%";
        button.style.padding = "12px";
        button.style.fontSize = "16px";
        button.style.background = "#ffffff";
        button.style.color = "#10b981";
        button.style.border = "2px solid #6ee7b7";
        button.style.borderRadius = "8px";
        button.style.cursor = "pointer";
        button.style.transition = "background-color 0.2s, color 0.2s";

        button.onmouseover = () => {
        button.style.backgroundColor = "#ecfdf5";  // 연한 초록 배경
      };
      button.onmouseout = () => {
        button.style.backgroundColor = "#ffffff";
        button.style.color = "#10b981";
      };

        button.onclick = () => {
          state.signupAnswers[q.id] = opt;
          state.signupStep++;
          renderSignupQuestion();
        };

        grid.appendChild(button);
      });

      container.appendChild(grid);
    } else {
      // 나머지 select 항목은 기존대로
      const select = document.createElement("select");
      select.innerHTML = `<option value="">${t("common.selectPlaceholder")}</option>` +
        q.options.map(opt => `<option value="${opt}">${t(opt)}</option>`).join("");
      select.value = state.signupAnswers[q.id] || "";
      select.onchange = () => {
        state.signupAnswers[q.id] = select.value;
      };

      select.style.width = "100%";
      select.style.padding = "12px";
      select.style.border = "2px solid #42c7bc";
      select.style.borderRadius = "12px";
      select.style.fontSize = "16px";
      select.style.fontFamily = "inherit";
      select.style.boxSizing = "border-box";
      select.style.backgroundColor = "#fff";
      select.style.lineHeight = "1.6";
      select.style.transition = "border-color 0.3s, box-shadow 0.3s";
      select.style.outline = "none";
      select.style.marginBottom = "20px";

      container.appendChild(select);
    }
  } else if (q.type === "multi") {
    const selected = state.signupAnswers[q.id] || [];

      if (q.id === 6) {
        // 성격 질문: 2x2 버튼 그리드
        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "1fr 1fr";
        grid.style.gap = "12px";
        grid.style.marginBottom = "20px";

        q.options.forEach(opt => {
          const button = document.createElement("button");
          button.textContent = t(opt);

          const isSelected = selected.includes(opt);
          const baseBg = isSelected ? "#ecfdf5" : "#ffffff";
          const baseColor = "#10b981";

          // 기본 스타일
          button.style.width = "100%";
          button.style.padding = "12px";
          button.style.fontSize = "16px";
          button.style.background = baseBg;
          button.style.color = baseColor;
          button.style.border = "2px solid #6ee7b7";
          button.style.borderRadius = "8px";
          button.style.cursor = "pointer";
          button.style.transition = "background-color 0.2s, color 0.2s";

          button.onmouseover = () => {
            button.style.backgroundColor = "#ecfdf5";
          };
          button.onmouseout = () => {
            button.style.backgroundColor = selected.includes(opt) ? "#ecfdf5" : "#ffffff";
            button.style.color = baseColor;
          };

          button.onclick = () => {
            const idx = selected.indexOf(opt);
            if (idx > -1) {
              selected.splice(idx, 1);
            } else {
              selected.push(opt);
            }
            state.signupAnswers[q.id] = [...selected];
            renderSignupQuestion(); // 다시 렌더링해서 선택 상태 반영
          };

          grid.appendChild(button);
        });

        container.appendChild(grid);
      } else {
      q.options.forEach(opt => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selected.includes(opt);
        checkbox.onclick = () => {
          if (checkbox.checked) {
            selected.push(opt);
          } else {
            const idx = selected.indexOf(opt);
            if (idx > -1) selected.splice(idx, 1);
          }
          state.signupAnswers[q.id] = selected;
        };
        label.appendChild(checkbox);
        label.append(" " + t(opt));
        container.appendChild(label);
      });
    }
  } else if (q.type === "single") {
    const selected = state.signupAnswers[q.id] || "";

    if (q.id === 7) {
      // 연락 빈도: 2x2 버튼 UI
      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "1fr 1fr";
      grid.style.gap = "12px";
      grid.style.marginBottom = "20px";

      q.options.forEach(opt => {
        const button = document.createElement("button");
        button.textContent = t(opt);

        const isSelected = selected === opt;
        const baseBg = isSelected ? "#ecfdf5" : "#ffffff";
        const baseColor = "#10b981"; // ✅ 고정된 글자색

        // 기본 스타일
        button.style.width = "100%";
        button.style.padding = "12px";
        button.style.fontSize = "16px";
        button.style.background = baseBg;
        button.style.color = baseColor;
        button.style.border = "2px solid #6ee7b7";
        button.style.borderRadius = "8px";
        button.style.cursor = "pointer";
        button.style.transition = "background-color 0.2s";

        // hover 배경만
        button.onmouseover = () => {
          button.style.backgroundColor = "#ecfdf5";
        };
        button.onmouseout = () => {
          button.style.backgroundColor = (state.signupAnswers[q.id] === opt) ? "#ecfdf5" : "#ffffff";
        };

        button.onclick = () => {
          state.signupAnswers[q.id] = opt;
          renderSignupQuestion(); // 다시 렌더링해서 반영
        };

        grid.appendChild(button);
      });

      container.appendChild(grid);
    } else {
      // 기본 라디오 버튼 방식
      q.options.forEach(opt => {
        const label = document.createElement("label");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "singleAnswer";
        radio.checked = selected === opt;
        radio.onclick = () => {
          state.signupAnswers[q.id] = opt;
        };
        label.appendChild(radio);
        label.append(" " + t(opt));
        container.appendChild(label);
      });
    }
  }

  const btnNext = document.createElement("button");
  btnNext.textContent = t("common.next");
  btnNext.onclick = () => {
    const answer = state.signupAnswers[q.id];
    if (
      answer === undefined ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0)
    ) {
      alert(t("common.inputWarning"));
      return;
    }
    if (q.type === "number" && (isNaN(answer) || answer <= 0)) {
      alert(t("alert.invalidNumber"));
      return;
    }
    state.signupStep++;
    renderSignupQuestion();
  };
  container.appendChild(btnNext);

  const btnBack = document.createElement("button");
  btnBack.textContent = t("common.back");

  btnBack.style.width = "100%";
  btnBack.style.padding = "12px";
  btnBack.style.fontSize = "16px";
  btnBack.style.background = "#ffffff";
  btnBack.style.color = "#10b981";
  btnBack.style.border = "2px solid #6ee7b7";
  btnBack.style.borderRadius = "8px";

  btnBack.onclick = () => {
    if (state.signupStep === 0) {
      // 첫 번째 질문에서 뒤로 가면 로그인 화면으로
      renderLogin();
    } else {
      state.signupStep--;
      renderSignupQuestion();
    }
  };

  container.appendChild(btnBack);
}



// --- 회원가입 최종 저장 ---
async function renderSignupFinal() {
  const container = document.getElementById("app");
  container.innerHTML = `
    <h2>${t("signup.finalTitle")}</h2>
    <label for="signupEmail">${t("signup.emailLabel")}</label>
    <input type="email" id="signupEmail" placeholder="${t("signup.emailPlaceholder")}" />
    <label for="signupPassword">${t("signup.passwordLabel")}</label>
    <input type="password" id="signupPassword" placeholder="${t("signup.passwordPlaceholder")}" />
    <button id="saveAccountBtn">${t("signup.createAccount")}</button>
    <button id="backToSignupBtn">${t("common.back")}</button>
  `;

  document.getElementById("saveAccountBtn").onclick = saveAccount;
  document.getElementById("backToSignupBtn").onclick = () => {
    state.signupStep = signupQuestions.length - 1;
    renderSignupQuestion();
  };

  const btnBack = document.getElementById("backToSignupBtn");
  btnBack.style.width = "100%";
  btnBack.style.padding = "12px";
  btnBack.style.fontSize = "16px";
  btnBack.style.background = "#ffffff";
  btnBack.style.color = "#10b981";
  btnBack.style.border = "2px solid #6ee7b7";
  btnBack.style.borderRadius = "8px";
}

async function saveAccount() {
  const emailInput = document.getElementById("signupEmail");
  const passwordInput = document.getElementById("signupPassword");

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email) {
    alert(t("alert.enterEmail"));
    return;
  }
  if (!password) {
    alert(t("alert.enterPassword"));
    return;
  }

  const allowedDomains = [
    "@snu.ac.kr",
    "@rikkyo.ac.jp",
    "@stu.pku.edu.cn",
    "@u.nus.edu"
  ];

  const isAllowed = allowedDomains.some(domain => email.endsWith(domain));

  if (!isAllowed) {
    alert(t("alert.domainError"));
    return;
  }

  try {
    const userRef = doc(db, "users", email);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      if (!confirm(t("alert.accountExists"))) return;
    }

    await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(userRef, {
      nickname: state.signupAnswers[0],
      age: state.signupAnswers[1],
      school: state.signupAnswers[2],
      major: state.signupAnswers[3],
      region: state.signupAnswers[4],
      mbti: state.signupAnswers[5],
      personality: state.signupAnswers[6],
      contactFrequency: state.signupAnswers[7],
      purpose: state.signupAnswers[8],
      password: password,
      bio: "" // 자기소개 필드 기본값 추가
    });
    const nickname = state.signupAnswers[0]; // 닉네임 위치에 따라 인덱스 조정 필요
    alert(t("alert.signupSuccess", { name: nickname }));
    state.currentUserEmail = email;
    state.currentUserData = {
      age: state.signupAnswers[1],
      school: state.signupAnswers[2],
      major: state.signupAnswers[3],
      region: state.signupAnswers[4],
      mbti: state.signupAnswers[5],
      personality: state.signupAnswers[6],
      contactFrequency: state.signupAnswers[7],
      purpose: state.signupAnswers[8],
    };
    window.renderHome();
  } catch (error) {
    alert(t("alert.signupError", { error: error.message }));
  }
}

// --- 로그인 처리 ---
async function loginUser() {
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email) {
    alert(t("alert.enterEmail"));
    return;
  }
  if (!password) {
    alert(t("alert.enterPassword"));
    return;
  }

  try {
    // ✅ 새로고침/탭 종료 후에도 로그인 유지
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, password);

    const userRef = doc(db, "users", email);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      alert(t("alert.noAccount"));
      return;
    }

    const data = docSnap.data();
    if (data.password !== password) {
      alert(t("alert.wrongPassword"));
      return;
    }

    alert(t("alert.loginSuccess", { name: data.nickname }));

    // 1) 로그인 정보 state에 저장
    state.currentUserEmail = email;
    state.currentUserData  = data;

    // 2) 나를 수락한 상대방 목록 불러오기
    const matchesSnap = await getDocs(collection(db, "matches"));
    const matched = [];

    matchesSnap.forEach(matchDoc => {
      const m = matchDoc.data();
      if (!(email in m)) return;

      const other = Object.keys(m).find(k => k !== email);
      if (!other) return;

      if (m[email] === true && m[other] === true) {
        matched.push(other);
      }
    });

    state.newAcceptances = matched;
    state.acceptOrMatched = matched;
    state.matchedUsers = matched;

    // 3) 홈 화면 렌더링
    renderHome();
    setTimeout(() => setActiveTab("home"), 0); // 홈 탭 활성화 보장

    // ✅ DOM 생성 후 탭 버튼 이벤트 연결
    setTimeout(() => {
      ["home", "exchange", "matching", "chat", "profile"].forEach(t => {
        const btn = document.getElementById(`nav${t.charAt(0).toUpperCase() + t.slice(1)}Btn`);
        if (btn) {
          btn.addEventListener("click", () => {
            setActiveTab(t);
          });
        }
      });
    }, 100);

  } catch (error) {
      if (error.code === "auth/invalid-credential") {
        alert(t("alert.wrongCredential"));
      } else if (error.code === "auth/user-not-found") {
        alert(t("alert.noAccount"));
      } else if (error.code === "auth/too-many-requests") {
        alert(t("alert.tooManyRequests"));
      } else {
        alert(t("alert.loginError", { error: error.message }));
      }
    }
}

export { renderLogin, renderSignupQuestion, renderSignupFinal, saveAccount, loginUser, t };
