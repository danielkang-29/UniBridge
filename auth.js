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
      welcome: "UniBridge에 오신 것을 환영합니다!",
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
    major : {
      snu_korean_lit:"국어국문학과",
      snu_chinese_lit:"중어중문학과",
      snu_english_lit:"영어영문학과",
      snu_french_lit:"불어불문학과",
      snu_german_lit:"독어독문학과",
      snu_russian_lit:"노어노문학과",
      snu_spanish_lit:"서어서문학과",
      snu_linguistics:"언어학과",
      snu_asian_lang_civ:"아시아언어문명학부",
      snu_history:"역사학부",
      snu_archaeology_art:"고고미술사학과",
      snu_philosophy:"철학과",
      snu_religious_studies:"종교학과",
      snu_aesthetics:"미학과",
      snu_political_science:"정치외교학부",
      snu_economics:"경제학부",
      snu_sociology:"사회학과",
      snu_anthropology:"인류학과",
      snu_psychology:"심리학과",
      snu_geography:"지리학과",
      snu_social_welfare:"사회복지학과",
      snu_communication:"언론정보학과",
      snu_math:"수리과학부",
      snu_statistics:"통계학과",
      snu_physics_astro:"물리천문학부",
      snu_chemistry:"화학부",
      snu_biology:"생명과학부",
      snu_earth_env:"지구환경과학부",
      snu_nursing:"간호학과",
      snu_business_admin:"경영학과",
      snu_civil_env_eng:"건설환경공학부",
      snu_mechanical_eng:"기계공학부",
      snu_materials_sci_eng:"재료공학부",
      snu_electrical_comp_eng:"전기·정보공학부",
      snu_computer_sci_eng:"컴퓨터공학부",
      snu_chem_bio_eng:"화학생물공학부",
      snu_architecture:"건축학과",
      snu_industrial_eng:"산업공학과",
      snu_energy_eng:"에너지자원공학과",
      snu_nuclear_eng:"원자핵공학과",
      snu_naval_arch_ocean_eng:"조선해양공학과",
      snu_aerospace_eng:"항공우주공학과",
      snu_cvl_envir_eng:"건설환경공학부",
      snu_plant_sci:"식물생산과학부",
      snu_forest_sci:"산림과학부",
      snu_food_animal_biotech:"식품·동물생명공학부",
      snu_applied_bio_chem:"응용생물화학부",
      snu_biosystems_biomaterials:"바이오시스템·소재학부",
      snu_landscape_arch_rural_eng:"조경·지역시스템공학부",
      snu_smart_systems:"스마트시스템학과",
      snu_agri_resource_econ:"농경제사회학부",
      snu_design:"디자인과",
      snu_crafts_design:"공예과",
      snu_oriental_painting:"동양화과",
      snu_painting:"서양화과",
      snu_sculpture:"조소과",
      snu_education:"교육학과",
      snu_korean_edu:"국어교육과",
      snu_english_edu:"영어교육과",
      snu_french_edu:"불어교육과",
      snu_german_edu:"독어교육과",
      snu_social_studies_edu:"사회교육과",
      snu_history_edu:"역사교육과",
      snu_geography_edu:"지리교육과",
      snu_ethics_edu:"윤리교육과",
      snu_math_edu:"수학교육과",
      snu_physics_edu:"물리교육과",
      snu_chemistry_edu:"화학교육과",
      snu_biology_edu:"생물교육과",
      snu_earth_sci_edu:"지구과학교육과",
      snu_physical_edu:"체육교육과",
      snu_consumer_child_studies:"소비자아동학부",
      snu_food_nutrition:"식품영양학과",
      snu_clothing_textiles:"의류학과",
      snu_pre_vet:"수의예과",
      snu_vet_med:"수의학과",
      snu_pharmacy:"약학과",
      snu_pharmaceutical_sci:"제약학과",
      snu_pre_med:"의예과",
      snu_medicine:"의학과",
      snu_vocal_music:"성악과",
      snu_composition:"작곡과",
      snu_musicology:"음악학과",
      snu_piano:"피아노과",
      snu_orchestral_instruments:"관현악과",
      snu_korean_music:"국악과",
      snu_digital_healthcare:"디지털헬스케어전공",
      snu_convergence_data_sci:"융합데이터과학전공",
      snu_sustainable_tech:"지속가능기술전공",
      snu_nextgen_semiconductor:"차세대지능형반도체전공",
      snu_innovative_drug_dev:"혁신신약전공",
      snu_liberal_studies:"자유전공학부",
      snu_student_designed_major:"학생설계전공",
      pku_math: "수학 및 응용 수학",
      pku_statistics: "통계",
      pku_ics: "정보 및 컴퓨팅 과학",
      pku_physics: "물리학",
      pku_applied_physics: "응용 물리학",
      pku_astronomy: "천문학",
      pku_atmospheric_science: "대기 과학",
      pku_nuclear_physics: "핵 물리학",
      pku_chemistry: "화학",
      pku_material_chemistry: "재료 화학",
      pku_chemical_biology: "화학 생물학",
      pku_applied_chemistry: "응용 화학",
      pku_biological_science: "생물 과학",
      pku_biotechnology: "생명공학",
      pku_ecology: "생태학",
      pku_bioinformatics: "생물정보학",
      pku_psychology: "심리학",
      pku_applied_psychology: "응용 심리학",
      pku_physical_geography: "자연 지리학",
      pku_human_geography: "인문지리학",
      pku_urban_planning: "도시 및 농촌 계획",
      pku_environmental_science: "환경 과학",
      pku_geology: "지질학",
      pku_geochemistry: "지구화학",
      pku_space_science: "우주 과학",
      pku_geographic_info_science: "지리 정보 과학",
      pku_geophysics: "지구물리학",
      pku_electronics: "전자 정보",
      pku_computer_science: "컴퓨터 과학",
      pku_software_engineering: "소프트웨어 공학",
      pku_ai_science: "지능형 과학",
      pku_integrated_circuits: "집적 회로",
      pku_environmental_nature: "환경과 자연",
      pku_environmental_management: "환경 관리",
      pku_environmental_engineering: "환경 공학",
      pku_mechanics: "역학",
      pku_energy: "에너지",
      pku_aerospace: "항공 우주",
      pku_robotics: "로봇",
      pku_material_science: "재료 과학",
      pku_biomedical_engineering: "의생명공학",
      pku_foreign_languages_literature: "외국어와 외국문학",
      pku_ppe: "정치, 경제 및 철학(PPE)",
      pku_agi: "일반 인공 지능",
      pku_data_science: "데이터 과학 및 빅 데이터 기술",
      pku_paleontology: "고생물학",
      pku_chiliterature:"중국언어문학",  
      pku_chi:"중국어",  
      pku_classic:"고전문헌학",  
      pku_applychi:"응용언어학",  
      pku_chihis:"중국사",  
      pku_worldhis:"세계사",  
      pku_ancientchi:"고전어문학",  
      pku_phi:"철학",  
      pku_re:"종교학",  
      pku_arthis:"미술사",  
      pku_tv:"방송·TV 연출",  
      pku_arch:"고고학",  
      pku_museum:"문화재·박물관학",  
      pku_protect:"문화재 보존 기술",  
      pku_eng:"영어",  
      pku_french:"프랑스어",  
      pku_port:"포르투갈어",  
      pku_asia:"동양어",  
      pku_eco:"경제학",  
      pku_trade:"국제경제무역",  
      pku_fin:"금융학",  
      pku_ins:"보험학",  
      pku_public:"재정학",  
      pku_account:"회계학",  
      pku_market:"마케팅",  
      pku_law:"법학",  
      pku_pol:"정치학·행정학",  
      pku_manage:"행정관리",  
      pku_citymanage:"도시관리",  
      pku_society:"사회학",  
      pku_human:"인류학",  
      pku_news:"저널리즘",  
      pku_ad:"광고학",  
      pku_international:"국제정치",  
      pku_diplomacy:"외교학",  
      pku_information:"정보관리정보시스템",  
      pku_library:"도서관학",  
      pku_data:"빅데이터 관리·응용",
      ru_christian_studies:"기독교학과",
      ru_english_american_lit:"영미문학전공",
      ru_german_lit:"독일문학전공",
      ru_french_lit:"프랑스문학전공",
      ru_japanese_lit:"일본문학전공",
      ru_creative_writing:"문예・사상전공",
      ru_education:"교육학과",
      ru_intercultural_comm:"이문화커뮤니케이션학과",
      ru_intercultural_comm_dual:"이문화커뮤니케이션학과 이중언어과정",
      ru_economics:"경제학과",
      ru_economic_policy:"경제정책학과",
      ru_accounting_finance:"회계파이낸스학과",
      ru_business_admin:"경영학과",
      ru_international_business:"국제경영학과",
      ru_mathematics:"수학과",
      ru_physics:"물리학과",
      ru_chemistry:"화학과",
      ru_biological_sciences:"생명과학과",
      ru_sociology:"사회학과",
      ru_contemporary_culture:"현대문화학과",
      ru_media_sociology:"미디어사회학과",
      ru_law:"법학과",
      ru_international_business_law:"국제비즈니스법학과",
      ru_political_science:"정치학과",
      ru_tourism:"관광학과",
      ru_cultural_exchange:"교류문화학과",
      ru_psychology:"심리학과",
      ru_body_expression_cinematic_arts:"영상신체학과",
      ru_sports_wellness:"스포츠웰니스학과",
      ru_glap:"글로벌 자유교양 프로그램 ",
      nus_Comp: "컴퓨터",
      nus_BMS: "생명의학",
      nus_Chem: "화학",
      nus_CE: "토목공학",
      nus_EE: "전기공학",
      nus_EngSci: "공학과학",
      nus_EnvSci: "환경과학",
      nus_SE: "시스템공학",
      nus_Infra: "인프라",
      nus_MatSci: "재료과학",
      nus_RIS: "로봇공학 및 인공지능",
      nus_DSE: "데이터과학 및 경제학",
      nus_EnvSt: "환경연구",
      nus_FST: "식품과학 및 기술",
      nus_Anthro: "인류학",
      nus_Chi: "중국어",
      nus_CS: "중국 연구",
      nus_NMC: "뉴미디어 커뮤니케이션",
      nus_Econ: "경제학",
      nus_Eng: "영어",
      nus_EngLit: "영문학",
      nus_Geo: "지리학",
      nus_GS: "글로벌스터디",
      nus_Hist: "역사학",
      nus_JS: "일본 연구",
      nus_MS: "말레이 연구",
      nus_Phil: "철학",
      nus_PolSci: "정치학",
      nus_Psych: "심리학",
      nus_SW: "사회복지학",
      nus_Soc: "사회학",
      nus_SAS: "남아시아 연구",
      nus_SEAS: "동남아시아 연구",
      nus_TS: "연극 연구",
      nus_DSA: "데이터과학 및 분석",
      nus_LifeSci: "생명과학",
      nus_Math: "수학",
      nus_Phys: "물리학",
      nus_QF: "계량금융",
      nus_Stat: "통계학",
      nus_BA: "경영 분석",
      nus_AIBS: "AI 경영 시스템",
      nus_AI: "인공지능",
      nus_InfoSec: "정보 보안",
      nus_Acc: "회계학",
      nus_ABA: "응용 경영 분석",
      nus_BusEcon: "경영경제학",
      nus_Fin: "금융학",
      nus_IE: "혁신과 창업",
      nus_LHCM: "리더십과 인적자본 관리",
      nus_Mktg: "마케팅",
      nus_OSCM: "운영 및 공급망 관리",
      nus_RE: "부동산",
      nus_Arch: "건축학",
      nus_ID: "산업 디자인",
      nus_LA: "조경 건축",
      nus_Pharm: "약학",
      nus_PPE: "철학 및 정치학 및 경제학",
      nus_Law: "법학",
      nus_Music: "음악"
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
      welcome: "Welcome to UniBridge",
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
      q2: "3. What university do you attend?",
      q3: "4. What's your major?",
      q4: "5. Which country are you staying in?",
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
      ageRange: "Which age range would you like to connect with?",
      school: "Which university would you like your new friend to be from?",
      personality: "What kind of personality do you prefer?",
      purpose: "What kind of friend are you hoping to meet?",
      fail: "Match failed",
      noCandidates: "No matches found.",
      candidate: "Match Candidate",
      candidateTitle: "Match Candidate",
      success: "Congrats! You've both accepted, have fun connecting!",
      successTitle: "Match Successful 🎉",
      rejectResult: "Unfortunately, one side declined. Let's explore other profiles!",
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
    major : {
      snu_korean_lit:"Department of Korean Language and Literature",
      snu_chinese_lit:"Department of Chinese Language and Literature",
      snu_english_lit:"Department of English Language and Literature",
      snu_french_lit:"Department of French Language and Literature",
      snu_german_lit:"Department of German Language and Literature",
      snu_russian_lit:"Department of Russian Language and Literature",
      snu_spanish_lit:"Department of Spanish Language and Literature",
      snu_linguistics:"Department of Linguistics",
      snu_asian_lang_civ:"Department of Asian Languages and Civilizations",
      snu_history:"Department of History",
      snu_archaeology_art:"Department of Archaeology and Art History",
      snu_philosophy:"Department of Philosophy",
      snu_religious_studies:"Department of Religious Studies",
      snu_aesthetics:"Department of Aesthetics",
      snu_political_science:"Department of Political Science and International Relations",
      snu_economics:"Department of Economics",
      snu_sociology:"Department of Sociology",
      snu_anthropology:"Department of Anthropology",
      snu_psychology:"Department of Psychology",
      snu_geography:"Department of Geography",
      snu_social_welfare:"Department of Social Welfare",
      snu_communication:"Department of Communication",
      snu_math:"Department of Mathematical Sciences",
      snu_statistics:"Department of Statistics",
      snu_physics_astro:"Department of Physics and Astronomy",
      snu_chemistry:"Department of Chemistry",
      snu_biology:"School of Biological Sciences",
      snu_earth_env:"School of Earth and Environmental Sciences",
      snu_nursing:"Department of Nursing",
      snu_business_admin:"Department of Business Administration",
      snu_civil_env_eng:"Department of Civil and Environmental Engineering",
      snu_mechanical_eng:"Department of Mechanical Engineering",
      snu_materials_sci_eng:"Department of Materials Science and Engineering",
      snu_electrical_comp_eng:"Department of Electrical and Computer Engineering",
      snu_computer_sci_eng:"Department of Computer Science and Engineering",
      snu_chem_bio_eng:"Department of Chemical and Biological Engineering",
      snu_architecture:"Department of Architecture",
      snu_industrial_eng:"Department of Industrial Engineering",
      snu_energy_eng:"Department of Energy Resources Engineering",
      snu_nuclear_eng:"Department of Nuclear Engineering",
      snu_naval_arch_ocean_eng:"Department of Naval Architecture and Ocean Engineering",
      snu_aerospace_eng:"Department of Aerospace Engineering",
      snu_cvl_envir_eng:"Department of Civil and Environmental Engineering",
      snu_plant_sci:"Department of Plant Science",
      snu_forest_sci:"Department of Forest Sciences",
      snu_food_animal_biotech:"Department of Food and Animal Biotechnology",
      snu_applied_bio_chem:"Department of Applied Biology and Chemistry",
      snu_biosystems_biomaterials:"Department of Biosystems and Biomaterials Science and Engineering",
      snu_landscape_arch_rural_eng:"Department of Landscape Architecture and Rural Systems Engineering",
      snu_smart_systems:"Department of Smart Systems",
      snu_agri_resource_econ:"Department of Agricultural and Resource Economics",
      snu_design:"Department of Design",
      snu_crafts_design:"Department of Crafts and Design",
      snu_oriental_painting:"Department of Oriental Painting",
      snu_painting:"Department of Painting",
      snu_sculpture:"Department of Sculpture",
      snu_education:"Department of Education",
      snu_korean_edu:"Department of Korean Language Education",
      snu_english_edu:"Department of English Language Education",
      snu_french_edu:"Department of French Language Education",
      snu_german_edu:"Department of German Language Education",
      snu_social_studies_edu:"Department of Social Studies Education",
      snu_history_edu:"Department of History Education",
      snu_geography_edu:"Department of Geography Education",
      snu_ethics_edu:"Department of Ethics Education",
      snu_math_edu:"Department of Mathematics Education",
      snu_physics_edu:"Department of Physics Education",
      snu_chemistry_edu:"Department of Chemistry Education",
      snu_biology_edu:"Department of Biology Education",
      snu_earth_sci_edu:"Department of Earth Science Education",
      snu_physical_edu:"Department of Physical Education",
      snu_consumer_child_studies:"Department of Consumer and Child Studies",
      snu_food_nutrition:"Department of Food and Nutrition",
      snu_clothing_textiles:"Department of Clothing and Textiles",
      snu_pre_vet:"Pre-Veterinary Medicine",
      snu_vet_med:"Veterinary Medicine",
      snu_pharmacy:"Pharmacy",
      snu_pharmaceutical_sci:"Pharmaceutical Sciences",
      snu_pre_med:"Pre-Medicine",
      snu_medicine:"Medicine",
      snu_vocal_music:"Department of Vocal Music",
      snu_composition:"Department of Composition",
      snu_musicology:"Department of Musicology",
      snu_piano:"Department of Piano",
      snu_orchestral_instruments:"Department of Orchestral Instruments",
      snu_korean_music:"Department of Korean Music",
      snu_digital_healthcare:"Digital Healthcare",
      snu_convergence_data_sci:"Convergence Data Science",
      snu_sustainable_tech:"Sustainable Technology",
      snu_nextgen_semiconductor:"Next-Gen Intelligent Semiconductor",
      snu_innovative_drug_dev:"Innovative Drug Development",
      snu_liberal_studies:"College of Liberal Studies",
      snu_student_designed_major:"Student-Designed Major",
      pku_math:"Mathematics and Applied Mathematics",
      pku_statistics:"Statistics",
      pku_ics:"Information and Computing Science",
      pku_physics:"Physics",
      pku_applied_physics:"Applied Physics",
      pku_astronomy:"Astronomy",
      pku_atmospheric_science:"Atmospheric Science",
      pku_nuclear_physics:"Nuclear Physics",
      pku_chemistry:"Chemistry",
      pku_material_chemistry:"Materials Chemistry",
      pku_chemical_biology:"Chemical Biology",
      pku_applied_chemistry:"Applied Chemistry",
      pku_biological_science:"Biological Science",
      pku_biotechnology:"Biotechnology",
      pku_ecology:"Ecology",
      pku_bioinformatics:"Bioinformatics",
      pku_psychology:"Psychology",
      pku_applied_psychology:"Applied Psychology",
      pku_physical_geography:"Physical Geography",
      pku_human_geography:"Human Geography",
      pku_urban_planning:"Urban and Rural Planning",
      pku_environmental_science:"Environmental Science",
      pku_geology:"Geology",
      pku_geochemistry:"Geochemistry",
      pku_space_science:"Space Science",
      pku_geographic_info_science:"Geographic Information Science",
      pku_geophysics:"Geophysics",
      pku_electronics:"Electronics and Information",
      pku_computer_science:"Computer Science",
      pku_software_engineering:"Software Engineering",
      pku_ai_science:"Artificial Intelligence Science",
      pku_integrated_circuits:"Integrated Circuits",
      pku_environmental_nature:"Environmental and Natural Sciences",
      pku_environmental_management:"Environmental Management",
      pku_environmental_engineering:"Environmental Engineering",
      pku_mechanics:"Mechanics",
      pku_energy:"Energy Science",
      pku_aerospace:"Aerospace Engineering",
      pku_robotics:"Robotics",
      pku_material_science:"Materials Science",
      pku_biomedical_engineering:"Biomedical Engineering",
      pku_foreign_languages_literature:"Foreign Languages and Literature",
      pku_ppe:"Politics, Economics, and Philosophy (PPE)",
      pku_agi:"General Artificial Intelligence",
      pku_data_science:"Data Science and Big Data Technology",
      pku_paleontology:"Paleontology",
      pku_chi: "Chinese Language",
      pku_classic: "Classical Philology",
      pku_applychi: "Applied Linguistics",
      pku_chihis: "Chinese History",
      pku_worldhis: "World History",
      pku_ancientchi: "Classical Literature",
      pku_phi: "Philosophy",
      pku_re: "Religious Studies",
      pku_arthis: "Art History",
      pku_tv: "Broadcasting and TV Production",
      pku_arch: "Archaeology",
      pku_museum: "Cultural Heritage and Museology",
      pku_protect: "Cultural Heritage Conservation Technology",
      pku_eng: "English",
      pku_french: "French",
      pku_port: "Portuguese",
      pku_asia: "Asian Languages",
      pku_eco: "Economics",
      pku_trade: "International Economics and Trade",
      pku_fin: "Finance",
      pku_ins: "Insurance",
      pku_public: "Public Finance",
      pku_account: "Accounting",
      pku_market: "Marketing",
      pku_law: "Law",
      pku_pol: "Political Science and Public Administration",
      pku_manage: "Administrative Management",
      pku_citymanage: "Urban Management",
      pku_society: "Sociology",
      pku_human: "Anthropology",
      pku_news: "Journalism",
      pku_ad: "Advertising",
      pku_international: "International Politics",
      pku_diplomacy: "Diplomacy",
      pku_information: "Information Management and Information Systems",
      pku_library: "Library Science",
      pku_data: "Big Data Management and Applications",
      ru_christian_studies:"Department of Christian Studies",
      ru_english_american_lit:"English and American Literature",
      ru_german_lit:"German Literature",
      ru_french_lit:"French Literature",
      ru_japanese_lit:"Japanese Literature",
      ru_creative_writing:"Creative Writing and Thought",
      ru_education:"Department of Education",
      ru_intercultural_comm:"Intercultural Communication",
      ru_intercultural_comm_dual:"Intercultural Communication - Dual Language Pathway",
      ru_economics:"Department of Economics",
      ru_economic_policy:"Department of Economic Policy",
      ru_accounting_finance:"Department of Accounting and Finance",
      ru_business_admin:"Department of Business Administration",
      ru_international_business:"Department of International Business",
      ru_mathematics:"Department of Mathematics",
      ru_physics:"Department of Physics",
      ru_chemistry:"Department of Chemistry",
      ru_biological_sciences:"Department of Biological Sciences",
      ru_sociology:"Department of Sociology",
      ru_contemporary_culture:"Department of Contemporary Culture",
      ru_media_sociology:"Department of Media Sociology",
      ru_law:"Department of Law",
      ru_international_business_law:"Department of International Business Law",
      ru_political_science:"Department of Political Science",
      ru_tourism:"Department of Tourism",
      ru_cultural_exchange:"Department of Cultural Exchange",
      ru_psychology:"Department of Psychology",
      ru_body_expression_cinematic_arts:"Department of Body Expression and Cinematic Arts",
      ru_sports_wellness:"Department of Sports and Wellness",
      ru_glap:"Global Liberal Arts Program",
      nus_Comp: "Computer",
      nus_BMS: "Biomedical Science",
      nus_Chem: "Chemistry",
      nus_CE: "Civil Engineering",
      nus_EE: "Electrical Engineering",
      nus_EngSci: "Engineering Science",
      nus_EnvSci: "Environmental Science",
      nus_SE: "Systems Engineering",
      nus_Infra: "Infrastructure",
      nus_MatSci: "Materials Science",
      nus_RIS: "Robotics and Intelligent Systems",
      nus_DSE: "Data Science and Economics",
      nus_EnvSt: "Environmental Studeies",
      nus_FST: "Food Science and Technology",
      nus_Anthro: "Anthropology",
      nus_Chi: "Chinese",
      nus_CS: "Chinese Studies",
      nus_NMC: "New Media Communication",
      nus_Econ: "Economics",
      nus_Eng: "English",
      nus_EngLit: "English Literature",
      nus_Geo: "Geography",
      nus_GS: "Global Studies",
      nus_Hist: "History",
      nus_JS: "Japanese Studies",
      nus_MS: "Malay Studies",
      nus_Phil: "Philosophy",
      nus_PolSci: "Political Science",
      nus_Psych: "Psychology",
      nus_SW: "Social Work",
      nus_Soc: "Sociology",
      nus_SAS: "South Asian Studies",
      nus_SEAS: "Southeast Asian Studies",
      nus_TS: "Theatre Studies",
      nus_DSA: "Data Science and Analytics",
      nus_LifeSci: "Life Sciences",
      nus_Math: "Mathematics",
      nus_Phys: "Physics",
      nus_QF: "Quantitative Finance",
      nus_Stat: "Statistics",
      nus_BA: "Business Analytics",
      nus_AIBS: "AI in Business Systems",
      nus_AI: "Artificial Intelligence",
      nus_InfoSec: "Information Security",
      nus_Acc: "Accountancy",
      nus_ABA: "Applied Business Analytics",
      nus_BusEcon: "Business Economics",
      nus_Fin: "Finance",
      nus_IE: "Innovation and Entrepreneurship",
      nus_LHCM: "Leadership and Human Capital Management",
      nus_Mktg: "Marketing",
      nus_OSCM: "Operations and Supply Chain Management",
      nus_RE: "Real Estate",
      nus_Arch: "Architecture",
      nus_ID: "Industrial Design",
      nus_LA: "Landscape Architecture",
      nus_Pharm: "Pharmacy",
      nus_PPE: "PPE",
      nus_Law: "Law",
      nus_Music: "Music"
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
      noMoreCandidates: "There are no candidates who match your preferences.",
      matchedWith: "You've matched with {name}!",
      congratulations: "Congrats! You've both accepted and you're now connected.",
      tryOthers: "Unfortunately, one side declined. Feel free to explore other profiles!",
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
      accountExists: "This email is already registered. Override?",
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
      welcome: "UniBridgeへようこそ！",
      findFriend: "友だちを探す"
    },
    nav: {
      home: "ホーム",
      exchange: "交換",
      match: "マッチ",
      chat: "トーク",
      profile: "マイ",
      new: "NEW"
    },
    signup: {
      q0: "1. ニックネームを入力してください",
      q1: "2. 年齢を教えてください",
      q2: "3. 在学中の大学を教えてください",
      q3: "4. 現在の学部学科は何ですか？",
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
      school: "相手の希望の学校を教えてください",
      personality: "希望する相手の性格を教えてください？",
      purpose: "何の目的で友だちを見つけたいですか？",
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
      snu: "ソウル大学",
      pku: "北京大学",
      rikkyo: "立教大学",
      nus: "シンガポール大学"
    },
    major : {
      snu_korean_lit:"国語国文学科",
      snu_chinese_lit:"中国語中国文学科",
      snu_english_lit:"英語英文学科",
      snu_french_lit:"フランス語フランス文学科",
      snu_german_lit:"ドイツ語ドイツ文学科",
      snu_russian_lit:"ロシア語ロシア文学科",
      snu_spanish_lit:"スペイン語スペイン文学科",
      snu_linguistics:"言語学科",
      snu_asian_lang_civ:"アジア言語文明学部",
      snu_history:"歴史学部",
      snu_archaeology_art:"考古・美術史学科",
      snu_philosophy:"哲学科",
      snu_religious_studies:"宗教学科",
      snu_aesthetics:"美学科",
      snu_political_science:"政治外交学部",
      snu_economics:"経済学部",
      snu_sociology:"社会学科",
      snu_anthropology:"人類学科",
      snu_psychology:"心理学科",
      snu_geography:"地理学科",
      snu_social_welfare:"社会福祉学科",
      snu_communication:"言論情報学科",
      snu_math:"数理科学部",
      snu_statistics:"統計学科",
      snu_physics_astro:"物理天文学部",
      snu_chemistry:"化学部",
      snu_biology:"生命科学部",
      snu_earth_env:"地球環境科学部",
      snu_nursing:"看護学科",
      snu_business_admin:"経営学科",
      snu_civil_env_eng:"建設環境工学部",
      snu_mechanical_eng:"機械工学部",
      snu_materials_sci_eng:"材料工学部",
      snu_electrical_comp_eng:"電気情報工学部",
      snu_computer_sci_eng:"コンピュータ工学部",
      snu_chem_bio_eng:"化学生物工学部",
      snu_architecture:"建築学科",
      snu_industrial_eng:"産業工学科",
      snu_energy_eng:"エネルギー資源工学科",
      snu_nuclear_eng:"原子核工学科",
      snu_naval_arch_ocean_eng:"造船海洋工学科",
      snu_aerospace_eng:"航空宇宙工学科",
      snu_cvl_envir_eng:"建設環境工学部",
      snu_plant_sci:"植物生産科学部",
      snu_forest_sci:"森林科学部",
      snu_food_animal_biotech:"食品・動物生命工学部",
      snu_applied_bio_chem:"応用生物化学部",
      snu_biosystems_biomaterials:"バイオシステム・素材学部",
      snu_landscape_arch_rural_eng:"造景・地域システム工学部",
      snu_smart_systems:"スマートシステム学科",
      snu_agri_resource_econ:"農業経済社会学部",
      snu_design:"デザイン科",
      snu_crafts_design:"工芸科",
      snu_oriental_painting:"東洋画科",
      snu_painting:"西洋画科",
      snu_sculpture:"彫塑科",
      snu_education:"教育学科",
      snu_korean_edu:"国語教育科",
      snu_english_edu:"英語教育科",
      snu_french_edu:"フランス語教育科",
      snu_german_edu:"ドイツ語教育科",
      snu_social_studies_edu:"社会教育科",
      snu_history_edu:"歴史教育科",
      snu_geography_edu:"地理教育科",
      snu_ethics_edu:"倫理教育科",
      snu_math_edu:"数学教育科",
      snu_physics_edu:"物理教育科",
      snu_chemistry_edu:"化学教育科",
      snu_biology_edu:"生物教育科",
      snu_earth_sci_edu:"地球科学教育科",
      snu_physical_edu:"体育教育科",
      snu_consumer_child_studies:"消費者児童学部",
      snu_food_nutrition:"食品栄養学科",
      snu_clothing_textiles:"衣類学科",
      snu_pre_vet:"獣医予科",
      snu_vet_med:"獣医学科",
      snu_pharmacy:"薬学科",
      snu_pharmaceutical_sci:"製薬学科",
      snu_pre_med:"医学予科",
      snu_medicine:"医学科",
      snu_vocal_music:"声楽科",
      snu_composition:"作曲科",
      snu_musicology:"音楽学科",
      snu_piano:"ピアノ科",
      snu_orchestral_instruments:"管弦楽科",
      snu_korean_music:"国楽科",
      snu_digital_healthcare:"デジタルヘルスケア専攻",
      snu_convergence_data_sci:"融合データ科学専攻",
      snu_sustainable_tech:"持続可能技術専攻",
      snu_nextgen_semiconductor:"次世代知能型半導体専攻",
      snu_innovative_drug_dev:"革新新薬専攻",
      snu_liberal_studies:"自由専攻学部",
      snu_student_designed_major:"学生設計専攻",
      pku_math:"数学・応用数学",
      pku_statistics:"統計学",
      pku_ics:"情報計算科学",
      pku_physics:"物理学",
      pku_applied_physics:"応用物理学",
      pku_astronomy:"天文学",
      pku_atmospheric_science:"大気科学",
      pku_nuclear_physics:"原子核物理学",
      pku_chemistry:"化学",
      pku_material_chemistry:"材料化学",
      pku_chemical_biology:"化学生物学",
      pku_applied_chemistry:"応用化学",
      pku_biological_science:"生物科学",
      pku_biotechnology:"バイオテクノロジー",
      pku_ecology:"生態学",
      pku_bioinformatics:"バイオインフォマティクス",
      pku_psychology:"心理学",
      pku_applied_psychology:"応用心理学",
      pku_physical_geography:"自然地理学",
      pku_human_geography:"人文地理学",
      pku_urban_planning:"都市・農村計画",
      pku_environmental_science:"環境科学",
      pku_geology:"地質学",
      pku_geochemistry:"地球化学",
      pku_space_science:"宇宙科学",
      pku_geographic_info_science:"地理情報科学",
      pku_geophysics:"地球物理学",
      pku_electronics:"電子情報",
      pku_computer_science:"コンピュータ科学",
      pku_software_engineering:"ソフトウェア工学",
      pku_ai_science:"知能科学",
      pku_integrated_circuits:"集積回路",
      pku_environmental_nature:"環境自然科学",
      pku_environmental_management:"環境管理",
      pku_environmental_engineering:"環境工学",
      pku_mechanics:"力学",
      pku_energy:"エネルギー科学",
      pku_aerospace:"航空宇宙工学",
      pku_robotics:"ロボティクス",
      pku_material_science:"材料科学",
      pku_biomedical_engineering:"生体医工学",
      pku_foreign_languages_literature:"外国語・外国文学",
      pku_ppe:"政治・経済・哲学（PPE）",
      pku_agi:"汎用人工知能",
      pku_data_science:"データ科学・ビッグデータ技術",
      pku_paleontology:"古生物学",
      pku_chiliterature:"中国言語文学",  
      pku_chi:"中国言語",  
      pku_classic:"古典文献学",  
      pku_applychi:"応用言語学",  
      pku_chihis:"中国史",  
      pku_worldhis:"世界史",  
      pku_ancientchi:"古典語文学",  
      pku_phi:"哲学",  
      pku_re:"宗教学",  
      pku_arthis:"美術史",  
      pku_tv:"放送・テレビディレクション",  
      pku_arch:"考古学",  
      pku_museum:"文化財・博物館学",  
      pku_protect:"文化財保存技術",  
      pku_eng:"英語",  
      pku_french:"フランス語",  
      pku_port:"ポルトガル語",  
      pku_asia:"東洋言語",  
      pku_eco:"経済学",  
      pku_trade:"国際経済貿易",  
      pku_fin:"金融学",  
      pku_ins:"保険学",  
      pku_public:"財政学",  
      pku_account:"会計学",  
      pku_market:"マーケティング",  
      pku_law:"法学",  
      pku_pol:"政治学・行政学",  
      pku_manage:"行政管理",  
      pku_citymanage:"都市管理",  
      pku_society:"社会学",  
      pku_human:"人類学",  
      pku_news:"ジャーナリズム",  
      pku_ad:"広告学",  
      pku_international:"国際政治",  
      pku_diplomacy:"外交学",  
      pku_information:"情報管理情報システム",  
      pku_library:"図書館学",  
      pku_data:"ビッグデータ管理・応用",
      ru_christian_studies:"キリスト教学科",
      ru_english_american_lit:"英米文学専修",
      ru_german_lit:"ドイツ文学専修",
      ru_french_lit:"フランス文学専修",
      ru_japanese_lit:"日本文学専修",
      ru_creative_writing:"文芸・思想専修",
      ru_education:"教育学科",
      ru_intercultural_comm:"異文化コミュニケーション学科",
      ru_intercultural_comm_dual:"異文化コミュニケーション学科 Dual Language Pathway",
      ru_economics:"経済学科",
      ru_economic_policy:"経済施策学科",
      ru_accounting_finance:"会計ファイナンス学科",
      ru_business_admin:"経営学科",
      ru_international_business:"国際経営学科",
      ru_mathematics:"数学科",
      ru_physics:"物理学科",
      ru_chemistry:"化学科",
      ru_biological_sciences:"生命理学科",
      ru_sociology:"社会学科",
      ru_contemporary_culture:"現代文化学科",
      ru_media_sociology:"メディア社会学科",
      ru_law:"法学科",
      ru_international_business_law:"国際ビジネス法学科",
      ru_political_science:"政治学科",
      ru_tourism:"観光学科",
      ru_cultural_exchange:"交流文化学科",
      ru_psychology:"心理学科",
      ru_body_expression_cinematic_arts:"映像身体学科",
      ru_sports_wellness:"スポーツウェルネス学科",
      ru_glap:"グローバルリベラルアーツプログラム",
      nus_Comp:"コンピュータ",
      nus_BMS:"バイオメディカル",
      nus_Chem:"化学",
      nus_CE:"土木工学",
      nus_EE:"電気工学",
      nus_EngSci:"工学科学",
      nus_EnvSci:"環境科学",
      nus_SE:"システム工学",
      nus_Infra:"インフラストラクチャー",
      nus_MatSci:"材料科学",
      nus_RIS:"ロボティクス＆インテリジェントシステム",
      nus_DSE:"データサイエンス＆経済学",
      nus_EnvSt:"環境研究",
      nus_FST:"食品科学技術",
      nus_Anthro:"人類学",
      nus_Chi:"中国語",
      nus_CS:"中国研究",
      nus_NMC:"ニューメディア・コミュニケーション",
      nus_Econ:"経済学",
      nus_Eng:"英語",
      nus_EngLit:"英文学",
      nus_Geo:"地理学",
      nus_GS:"グローバルスタディーズ",
      nus_Hist:"歴史学",
      nus_JS:"日本研究",
      nus_MS:"マレー研究",
      nus_Phil:"哲学",
      nus_PolSci:"政治学",
      nus_Psych:"心理学",
      nus_SW:"ソーシャルワーク",
      nus_Soc:"社会学",
      nus_SAS:"南アジア研究",
      nus_SEAS:"東南アジア研究",
      nus_TS:"演劇研究",
      nus_DSA:"データサイエンス＆分析",
      nus_LifeSci:"生命科学",
      nus_Math:"数学",
      nus_Phys:"物理学",
      nus_QF:"定量金融",
      nus_Stat:"統計学",
      nus_BA:"ビジネスアナリティクス",
      nus_AIBS:"ビジネスAIシステム",
      nus_AI:"人工知能",
      nus_InfoSec:"情報セキュリティ",
      nus_Acc:"会計学",
      nus_ABA:"応用ビジネスアナリティクス",
      nus_BusEcon:"ビジネス経済学",
      nus_Fin:"金融学",
      nus_IE:"イノベーション＆起業",
      nus_LHCM:"リーダーシップ＆人的資本管理",
      nus_Mktg:"マーケティング",
      nus_OSCM:"オペレーション＆サプライチェーン管理",
      nus_RE:"不動産",
      nus_Arch:"建築学",
      nus_ID:"インダストリアルデザイン",
      nus_LA:"ランドスケープアーキテクチャ",
      nus_Pharm:"薬学",
      nus_PPE:"哲学・政治学・経済学（PPE）",
      nus_Law:"法学",
      nus_Music:"音楽"
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
      honest: "素直"
    },
    frequency: {
      never: "ほとんど会いません",
      sometimes: "たまに会います",
      often: "よく会います",
      always: "かなり頻繁に会います"
    },
    purpose: {
      language: "言語学習",
      friend: "友だちを作る",
      info: "情報を探す",
      languageFull: "言語学習をしたいです！",
      friendFull: "気の合う友だちを作りたいです！",
      infoFull: "情報を集めたいです！"
    },
    call: {
      incoming: "{name}さんが通話を開始しました",
      accept: "承認",
      reject: "拒否",
      rejected: "通話を拒否しました。",
      ended: "通話が終了しました。",
      inProgress: "通話中…",
      end: "終了",
      start: "開始"
    },
    label: {
      age: "年齢",
      school: "学校",
      major: "学部学科",
      mbti: "MBTI",
      personality: "性格",
      purpose: "目的"
    },
    action: {
      accept: "承認",
      reject: "拒否",
      showIntro: "プロフィールを見る",
      backToProfile: "プロフィールに戻る",
      goToChat: "チャットへ",
      goHome: "ホームに戻る",
      lookIntroduction:"プロフィールを見る"
    },
    common: {
      selectPlaceholder: "選択してください",
      next: "次へ",
      back: "戻る",
      previous: "前へ",
      backToHome: "ホームに戻る",
      backToProfile: "戻る",
      noBio: "プロフィールがありません。",
      lookIntroduction: "プロフィールを見る",
      noIntroduction: "プロフィールがありません。",
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
      signup: "初めてですか？新規登録する",
      programschedule: "日程調整",
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
      call: "通話を開始する",
      endCall: "通話を終える",
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
      major: "学部学科",
      region: "居住地",
      mbti: "MBTI",
      purpose: "目的",
      personality: "性格",
      bioTitle: "プロフィール",
      noBio: "まだプロフィールがありません。",
      edit: "編集する",
      editBioTitle: "プロフィールを編集",
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
     welcome: "欢迎加入 UniBridge！很高兴见到你",
     findFriend: "匹配同伴"
   },
    nav: {
      home: "首页",
      exchange: "活动",
      match: "匹配",
      chat: "聊天",
      profile: "我的信息",
      new: "开始新的"
    },
    signup: {
      q0: "1. 请输入昵称",
      q1: "2. 请告诉我们你的年龄",
      q2: "3. 请填写你就读的学校",
      q3: "4. 你的专业是什么？",
      q4: "5. 你现在住在哪个地区？",
      q5: "6. 你的MBTI类型是？",
      q6: "7. 你的性格是怎样的？（可多选）",
      q7: "8. 希望使用此软件联系其他同学的频率是？",
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
      personality: "你希望对方的性格是什么样的？",
      purpose: "你希望结交怎样的朋友？",
      fail: "配对失败",
      noCandidates: "暂时没有符合条件的朋友",
      candidate: "配对候选人",
      candidateTitle: "配对候选人",
      success: "恭喜！你们互相接受并成功配对啦！",
      successTitle: "配对成功🎉",
      rejectResult: "很遗憾，对方未接受配对。请尝试寻找其他同伴",
      done: "配对完成",
      noMore: "没有更多配对候选人了",
      accept: "接受",
      reject: "拒绝",
      goToChat: "去聊天",
      waiting: "已保存你的请求，请耐心等待对方回复"
    },
    school: {
      snu: "首尔大学",
      pku: "北京大学",
      rikkyo: "立教大学",
      nus: "新加坡国立大学"
    },
    major : {
      snu_korean_lit:"国语国文学系",
      snu_chinese_lit:"中文系",
      snu_english_lit:"英语英文学系",
      snu_french_lit:"法语法文学系",
      snu_german_lit:"德语德文学系",
      snu_russian_lit:"俄语俄文学系",
      snu_spanish_lit:"西班牙语西文学系",
      snu_linguistics:"语言学系",
      snu_asian_lang_civ:"亚洲语言文明学部",
      snu_history:"历史学部",
      snu_archaeology_art:"考古美术史学系",
      snu_philosophy:"哲学系",
      snu_religious_studies:"宗教学系",
      snu_aesthetics:"美学系",
      snu_political_science:"政治外交学部",
      snu_economics:"经济学部",
      snu_sociology:"社会学系",
      snu_anthropology:"人类学系",
      snu_psychology:"心理学系",
      snu_geography:"地理学系",
      snu_social_welfare:"社会福利学系",
      snu_communication:"传媒信息学系",
      snu_math:"数学科学部",
      snu_statistics:"统计学系",
      snu_physics_astro:"物理与天文学部",
      snu_chemistry:"化学部",
      snu_biology:"生命科学部",
      snu_earth_env:"地球环境科学部",
      snu_nursing:"护理学系",
      snu_business_admin:"经营学系",
      snu_civil_env_eng:"建设环境工学部",
      snu_mechanical_eng:"机械工学部",
      snu_materials_sci_eng:"材料工学部",
      snu_electrical_comp_eng:"电气信息工学部",
      snu_computer_sci_eng:"计算机工学部",
      snu_chem_bio_eng:"化学生物工学部",
      snu_architecture:"建筑学系",
      snu_industrial_eng:"产业工学系",
      snu_energy_eng:"能源资源工学系",
      snu_nuclear_eng:"原子核工学系",
      snu_naval_arch_ocean_eng:"造船海洋工学系",
      snu_aerospace_eng:"航空宇宙工学系",
      snu_cvl_envir_eng:"建设环境工学部",
      snu_plant_sci:"植物生产科学部",
      snu_forest_sci:"森林科学部",
      snu_food_animal_biotech:"食品与动物生命工学部",
      snu_applied_bio_chem:"应用生物化学部",
      snu_biosystems_biomaterials:"生物系统与材料学部",
      snu_landscape_arch_rural_eng:"园林与地域系统工学部",
      snu_smart_systems:"智能系统学系",
      snu_agri_resource_econ:"农业经济社会学部",
      snu_design:"设计系",
      snu_crafts_design:"工艺系",
      snu_oriental_painting:"东方画系",
      snu_painting:"西洋画系",
      snu_sculpture:"雕塑系",
      snu_education:"教育学系",
      snu_korean_edu:"国语教育系",
      snu_english_edu:"英语教育系",
      snu_french_edu:"法语教育系",
      snu_german_edu:"德语教育系",
      snu_social_studies_edu:"社会教育系",
      snu_history_edu:"历史教育系",
      snu_geography_edu:"地理教育系",
      snu_ethics_edu:"伦理教育系",
      snu_math_edu:"数学教育系",
      snu_physics_edu:"物理教育系",
      snu_chemistry_edu:"化学教育系",
      snu_biology_edu:"生物教育系",
      snu_earth_sci_edu:"地球科学教育系",
      snu_physical_edu:"体育教育系",
      snu_consumer_child_studies:"消费者与儿童学部",
      snu_food_nutrition:"食品营养学系",
      snu_clothing_textiles:"服装学系",
      snu_pre_vet:"预科兽医学",
      snu_vet_med:"兽医学",
      snu_pharmacy:"药学",
      snu_pharmaceutical_sci:"制药学",
      snu_pre_med:"预科医学",
      snu_medicine:"医学",
      snu_vocal_music:"声乐系",
      snu_composition:"作曲系",
      snu_musicology:"音乐学系",
      snu_piano:"钢琴系",
      snu_orchestral_instruments:"管弦乐系",
      snu_korean_music:"韩国传统音乐系",
      snu_digital_healthcare:"数字健康护理",
      snu_convergence_data_sci:"融合数据科学",
      snu_sustainable_tech:"可持续技术",
      snu_nextgen_semiconductor:"次世代智能半导体",
      snu_innovative_drug_dev:"创新新药",
      snu_liberal_studies:"自由专业学部",
      snu_student_designed_major:"学生设计专业",
      pku_math:"数学与应用数学",
      pku_statistics:"统计学",
      pku_ics:"信息与计算科学",
      pku_physics:"物理学",
      pku_applied_physics:"应用物理学",
      pku_astronomy:"天文学",
      pku_atmospheric_science:"大气科学",
      pku_nuclear_physics:"核物理",
      pku_chemistry:"化学",
      pku_material_chemistry:"材料化学",
      pku_chemical_biology:"化学生物学",
      pku_applied_chemistry:"应用化学",
      pku_biological_science:"生物科学",
      pku_biotechnology:"生物技术",
      pku_ecology:"生态学",
      pku_bioinformatics:"生物信息",
      pku_psychology:"心理学",
      pku_applied_psychology:"应用心理学",
      pku_physical_geography:"自然地理",
      pku_human_geography:"人文地理",
      pku_urban_planning:"城乡规划",
      pku_environmental_science:"环境科学",
      pku_geology:"地质学",
      pku_geochemistry:"地球化学",
      pku_space_science:"空间科学",
      pku_geographic_info_science:"地理信息科学",
      pku_geophysics:"地球物理学",
      pku_electronics:"电子信息",
      pku_computer_science:"计算机科学",
      pku_software_engineering:"软件工程",
      pku_ai_science:"智能科学",
      pku_integrated_circuits:"集成电路",
      pku_environmental_nature:"环境自然",
      pku_environmental_management:"环境管理",
      pku_environmental_engineering:"环境工程",
      pku_mechanics:"力学",
      pku_energy:"能源",
      pku_aerospace:"航空航天",
      pku_robotics:"机器人",
      pku_material_science:"材料科学",
      pku_biomedical_engineering:"生物医学工程",
      pku_foreign_languages_literature:"外国语言与外国文学",
      pku_ppe:"政治、经济与哲学（PPE）",
      pku_agi:"通用人工智能",
      pku_data_science:"数据科学与大数据技术",
      pku_paleontology:"古生物学",
      pku_chiliterature: "汉语言文学",
      pku_chi: "汉语言",
      pku_classic: "古典文献",
      pku_applychi: "应用语言学",
      pku_chihis: "中国史",
      pku_worldhis: "世界史",
      pku_ancientchi: "古典语文学",
      pku_phi: "哲学",
      pku_re: "宗教学",
      pku_arthis: "艺术史",
      pku_tv: "广播电视编导",
      pku_arch: "考古学",
      pku_museum: "文物与博物馆",
      pku_protect: "文物保护技术",
      pku_eng: "英语",
      pku_french: "法语",
      pku_port: "葡萄牙语",
      pku_asia: "东语",
      pku_eco: "经济学",
      pku_trade: "国际经济与贸易",
      pku_fin: "金融学",
      pku_ins: "保险学",
      pku_public: "财政学",
      pku_account: "会计学",
      pku_market: "市场营销学",
      pku_law: "法学",
      pku_pol: "政治学与行政学",
      pku_manage: "行政管理",
      pku_citymanage: "城市管理",
      pku_society: "社会学",
      pku_human: "人类学",
      pku_news: "新闻学",
      pku_ad: "广告学",
      pku_international: "国际政治",
      pku_diplomacy: "外交学",
      pku_information: "信息管理与信息系统",
      pku_library: "图书馆学",
      pku_data: "大数据管理与应用",
      ru_christian_studies:"基督教学系",
      ru_english_american_lit:"英美文学专业",
      ru_german_lit:"德语文学专业",
      ru_french_lit:"法语文学专业",
      ru_japanese_lit:"日本文学专业",
      ru_creative_writing:"文艺与思想专业",
      ru_education:"教育学系",
      ru_intercultural_comm:"跨文化交流学系",
      ru_intercultural_comm_dual:"跨文化交流学系 双语路径",
      ru_economics:"经济学系",
      ru_economic_policy:"经济政策学系",
      ru_accounting_finance:"会计与金融学系",
      ru_business_admin:"经营学系",
      ru_international_business:"国际经营学系",
      ru_mathematics:"数学系",
      ru_physics:"物理学系",
      ru_chemistry:"化学系",
      ru_biological_sciences:"生命理学系",
      ru_sociology:"社会学系",
      ru_contemporary_culture:"现代文化学系",
      ru_media_sociology:"媒体社会学系",
      ru_law:"法学系",
      ru_international_business_law:"国际商务法学系",
      ru_political_science:"政治学系",
      ru_tourism:"旅游学系",
      ru_cultural_exchange:"交流文化学系",
      ru_psychology:"心理学系",
      ru_body_expression_cinematic_arts:"影像与身体表现学系",
      ru_sports_wellness:"体育健康学系",
      ru_glap:"全球自由艺术项目",
      nus_Comp: "计算机",
      nus_BMS: "生物医学",
      nus_Chem: "化学",
      nus_CE: "土木",
      nus_EE: "电气",
      nus_EngSci: "工程科学",
      nus_EnvSci: "环境科学",
      nus_SE: "系统工程",
      nus_Infra: "基础设施",
      nus_MatSci: "木材科学",
      nus_RIS: "机器人与智能",
      nus_DSE: "数据科学与经济学",
      nus_EnvSt: "环境研究",
      nus_FST: "食品科学与技术",
      nus_Anthro: "人类学",
      nus_Chi: "中文",
      nus_CS: "中国研究",
      nus_NMC: "新媒体传播",
      nus_Econ: "经济学",
      nus_Eng: "英文",
      nus_EngLit: "英语文学",
      nus_Geo: "地理学",
      nus_GS: "全球研究",
      nus_Hist: "历史学",
      nus_JS: "日本研究",
      nus_MS: "马来研究",
      nus_Phil: "哲学",
      nus_PolSci: "政治学",
      nus_Psych: "心理学",
      nus_SW: "社会工作",
      nus_Soc: "社会学",
      nus_SAS: "南亚研究",
      nus_SEAS: "东南亚研究",
      nus_TS: "戏剧研究",
      nus_DSA: "数据科学与分析",
      nus_LifeSci: "生命科学",
      nus_Math: "数学",
      nus_Phys: "物理学",
      nus_QF: "量化金融",
      nus_Stat: "统计学",
      nus_BA: "商业分析",
      nus_AIBS: "商业人工智能系统",
      nus_AI: "人工智能",
      nus_InfoSec: "信息安全",
      nus_Acc: "会计学",
      nus_ABA: "应用商业分析",
      nus_BusEcon: "商业经济学",
      nus_Fin: "金融学",
      nus_IE: "创新与创业",
      nus_LHCM: "领导力与人力资本管理",
      nus_Mktg: "市场营销",
      nus_OSCM: "运营与供应链管理",
      nus_RE: "房地产",
      nus_Arch: "建筑学",
      nus_ID: "工业设计",
      nus_LA: "景观建筑",
      nus_Pharm: "药学",
      nus_PPE: "哲学与政治学与经济学",
      nus_Law: "法律",
      nus_Music: "音乐"
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
     language: "语言交流",
     friend: "交朋友",
     info: "获取信息",
     languageFull: "我想进行不同语言的交流！",
     friendFull: "我想交一个聊得来的朋友！",
     infoFull: "我想获取一些有用的信息！"
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
     backToProfile: "返回个人主页",
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
     tryOthers: "对方未接受配对，请试试其他朋友吧",
     loginTitle: "登录",
     email: "请输入邮箱地址",
     password: "请输入密码",
     login: "登录",
     logout: "退出登录",
     signup: "第一次使用？点击这里创建账号！",
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
  { id: 3, textKey: "signup.q3", type: "select",
    options: [
              "major.snu_korean_lit",
              "major.snu_chinese_lit",
              "major.snu_english_lit",
              "major.snu_french_lit",
              "major.snu_german_lit",
              "major.snu_russian_lit",
              "major.snu_spanish_lit",
              "major.snu_linguistics",
              "major.snu_asian_lang_civ",
              "major.snu_history",
              "major.snu_archaeology_art",
              "major.snu_philosophy",
              "major.snu_religious_studies",
              "major.snu_aesthetics",
              "major.snu_political_science",
              "major.snu_economics",
              "major.snu_sociology",
              "major.snu_anthropology",
              "major.snu_psychology",
              "major.snu_geography",
              "major.snu_social_welfare",
              "major.snu_communication",
              "major.snu_math",
              "major.snu_statistics",
              "major.snu_physics_astro",
              "major.snu_chemistry",
              "major.snu_biology",
              "major.snu_earth_env",
              "major.snu_nursing",
              "major.snu_business_admin",
              "major.snu_civil_env_eng",
              "major.snu_mechanical_eng",
              "major.snu_materials_sci_eng",
              "major.snu_electrical_comp_eng",
              "major.snu_computer_sci_eng",
              "major.snu_chem_bio_eng",
              "major.snu_architecture",
              "major.snu_industrial_eng",
              "major.snu_energy_eng",
              "major.snu_nuclear_eng",
              "major.snu_naval_arch_ocean_eng",
              "major.snu_aerospace_eng",
              "major.snu_cvl_envir_eng",
              "major.snu_plant_sci",
              "major.snu_forest_sci",
              "major.snu_food_animal_biotech",
              "major.snu_applied_bio_chem",
              "major.snu_biosystems_biomaterials",
              "major.snu_landscape_arch_rural_eng",
              "major.snu_smart_systems",
              "major.snu_agri_resource_econ",
              "major.snu_design",
              "major.snu_crafts_design",
              "major.snu_oriental_painting",
              "major.snu_painting",
              "major.snu_sculpture",
              "major.snu_education",
              "major.snu_korean_edu",
              "major.snu_english_edu",
              "major.snu_french_edu",
              "major.snu_german_edu",
              "major.snu_social_studies_edu",
              "major.snu_history_edu",
              "major.snu_geography_edu",
              "major.snu_ethics_edu",
              "major.snu_math_edu",
              "major.snu_physics_edu",
              "major.snu_chemistry_edu",
              "major.snu_biology_edu",
              "major.snu_earth_sci_edu",
              "major.snu_physical_edu",
              "major.snu_consumer_child_studies",
              "major.snu_food_nutrition",
              "major.snu_clothing_textiles",
              "major.snu_pre_vet",
              "major.snu_vet_med",
              "major.snu_pharmacy",
              "major.snu_pharmaceutical_sci",
              "major.snu_pre_med",
              "major.snu_medicine",
              "major.snu_vocal_music",
              "major.snu_composition",
              "major.snu_musicology",
              "major.snu_piano",
              "major.snu_orchestral_instruments",
              "major.snu_korean_music",
              "major.snu_digital_healthcare",
              "major.snu_convergence_data_sci",
              "major.snu_sustainable_tech",
              "major.snu_nextgen_semiconductor",
              "major.snu_innovative_drug_dev",
              "major.snu_liberal_studies",
              "major.snu_student_designed_major",
              "major.pku_math",
              "major.pku_statistics",
              "major.pku_ics",
              "major.pku_physics",
              "major.pku_applied_physics",
              "major.pku_astronomy",
              "major.pku_atmospheric_science",
              "major.pku_nuclear_physics",
              "major.pku_chemistry",
              "major.pku_material_chemistry",
              "major.pku_chemical_biology",
              "major.pku_applied_chemistry",
              "major.pku_biological_science",
              "major.pku_biotechnology",
              "major.pku_ecology",
              "major.pku_bioinformatics",
              "major.pku_psychology",
              "major.pku_applied_psychology",
              "major.pku_physical_geography",
              "major.pku_human_geography",
              "major.pku_urban_planning",
              "major.pku_environmental_science",
              "major.pku_geology",
              "major.pku_geochemistry",
              "major.pku_space_science",
              "major.pku_geographic_info_science",
              "major.pku_geophysics",
              "major.pku_electronics",
              "major.pku_computer_science",
              "major.pku_software_engineering",
              "major.pku_ai_science",
              "major.pku_integrated_circuits",
              "major.pku_environmental_nature",
              "major.pku_environmental_management",
              "major.pku_environmental_engineering",
              "major.pku_mechanics",
              "major.pku_energy",
              "major.pku_aerospace",
              "major.pku_robotics",
              "major.pku_material_science",
              "major.pku_biomedical_engineering",
              "major.pku_foreign_languages_literature",
              "major.pku_ppe",
              "major.pku_agi",
              "major.pku_data_science",
              "major.pku_paleontology",
              "major.pku_chiliterature",
              "major.pku_chi",
              "major.pku_classic",
              "major.pku_applychi",
              "major.pku_chihis",
              "major.pku_worldhis",
              "major.pku_ancientchi",
              "major.pku_phi",
              "major.pku_re",
              "major.pku_arthis",
              "major.pku_tv",
              "major.pku_arch",
              "major.pku_museum",
              "major.pku_protect",
              "major.pku_eng",
              "major.pku_french",
              "major.pku_port",
              "major.pku_asia",
              "major.pku_eco",
              "major.pku_trade",
              "major.pku_fin",
              "major.pku_ins",
              "major.pku_public",
              "major.pku_account",
              "major.pku_market",
              "major.pku_law",
              "major.pku_pol",
              "major.pku_manage",
              "major.pku_citymanage",
              "major.pku_society",
              "major.pku_human",
              "major.pku_news",
              "major.pku_ad",
              "major.pku_international",
              "major.pku_diplomacy",
              "major.pku_information",
              "major.pku_library",
              "major.pku_data",
              "major.ru_christian_studies",
              "major.ru_english_american_lit",
              "major.ru_german_lit",
              "major.ru_french_lit",
              "major.ru_japanese_lit",
              "major.ru_creative_writing",
              "major.ru_education",
              "major.ru_intercultural_comm",
              "major.ru_intercultural_comm_dual",
              "major.ru_economics",
              "major.ru_economic_policy",
              "major.ru_accounting_finance",
              "major.ru_business_admin",
              "major.ru_international_business",
              "major.ru_mathematics",
              "major.ru_physics",
              "major.ru_chemistry",
              "major.ru_biological_sciences",
              "major.ru_sociology",
              "major.ru_contemporary_culture",
              "major.ru_media_sociology",
              "major.ru_law",
              "major.ru_international_business_law",
              "major.ru_political_science",
              "major.ru_tourism",
              "major.ru_cultural_exchange",
              "major.ru_psychology",
              "major.ru_body_expression_cinematic_arts",
              "major.ru_sports_wellness",
              "major.ru_glap",
              "major.nus_Comp",
              "major.nus_BMS",
              "major.nus_Chem",
              "major.nus_CE",
              "major.nus_EE",
              "major.nus_EngSci",
              "major.nus_EnvSci",
              "major.nus_SE",
              "major.nus_Infra",
              "major.nus_MatSci",
              "major.nus_RIS",
              "major.nus_DSE",
              "major.nus_EnvSt",
              "major.nus_FST",
              "major.nus_Anthro",
              "major.nus_Chi",
              "major.nus_CS",
              "major.nus_NMC",
              "major.nus_Econ",
              "major.nus_Eng",
              "major.nus_EngLit",
              "major.nus_Geo",
              "major.nus_GS",
              "major.nus_Hist",
              "major.nus_JS",
              "major.nus_MS",
              "major.nus_Phil",
              "major.nus_PolSci",
              "major.nus_Psych",
              "major.nus_SW",
              "major.nus_Soc",
              "major.nus_SAS",
              "major.nus_SEAS",
              "major.nus_TS",
              "major.nus_DSA",
              "major.nus_LifeSci",
              "major.nus_Math",
              "major.nus_Phys",
              "major.nus_QF",
              "major.nus_Stat",
              "major.nus_BA",
              "major.nus_AIBS",
              "major.nus_AI",
              "major.nus_InfoSec",
              "major.nus_Acc",
              "major.nus_ABA",
              "major.nus_BusEcon",
              "major.nus_Fin",
              "major.nus_IE",
              "major.nus_LHCM",
              "major.nus_Mktg",
              "major.nus_OSCM",
              "major.nus_RE",
              "major.nus_Arch",
              "major.nus_ID",
              "major.nus_LA",
              "major.nus_Pharm",
              "major.nus_PPE",
              "major.nus_Law",
              "major.nus_Music"
] },
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
    } else if (q.id === 3) {
      // ✅ 전공 선택일 경우: 학교 기반으로 전공 필터링해서 보여줌
      const selectedSchool = state.signupAnswers[2]; // 예: "school.pku"
      const majorPrefix = selectedSchool === "school.pku" ? "major.pku_" :
                          selectedSchool === "school.snu" ? "major.snu_" :
                          selectedSchool === "school.rikkyo" ? "major.ru_" :
                          selectedSchool === "school.nus" ? "major.nus_" : "";

      const filteredOptions = q.options.filter(opt => opt.startsWith(majorPrefix));

      const select = document.createElement("select");
      select.innerHTML = `<option value="">${t("common.selectPlaceholder")}</option>` +
        filteredOptions.map(opt => `<option value="${opt}">${t(opt)}</option>`).join("");

      select.value = state.signupAnswers[q.id] || "";
      select.onchange = () => {
        state.signupAnswers[q.id] = select.value;
      };

      // select 스타일 (그대로 유지)
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
