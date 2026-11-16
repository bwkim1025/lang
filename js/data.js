function ja(id, meaning, tip, parts) {
  return {
    id,
    meaning,
    tip,
    tokens: parts.map((part) => {
      if (typeof part === "string") return { t: part, r: part };
      const token = { t: part[0], r: part[1] };
      if (part[2]) token.note = part[2];
      return token;
    }),
  };
}

function en(id, text, meaning, tip, hints) {
  return { id, text, meaning, tip, hints };
}

const JAPANESE = {
  id: "ja",
  lang: "ja-JP",
  title: "일본어",
  summary: "기본 인사 다음. 자기소개, 주문, 병원 일상, 소리 길이.",
  lessons: [
    {
      id: "ja-1",
      level: 1,
      title: "자기소개",
      summary: "직업과 출신을 짧게 말합니다.",
      sentences: [
        ja("ja-1-01", "저는 의사입니다.", "医者는 ‘이샤’에 가깝습니다. しゃ를 한 소리로 붙이세요.", [
          ["私", "わたし"], "は", ["医者", "いしゃ", "医者는 ‘이샤’에 가깝게, しゃ를 한 소리로 말하세요."], "です。",
        ]),
        ja("ja-1-02", "한국에서 왔습니다.", "きました의 き는 짧게, ました는 끝을 흐리지 말고 또박또박.", [
          ["韓国", "かんこく"], "から", ["来", "き", "きました의 き는 짧게 시작하세요."], "ました。",
        ]),
        ja("ja-1-03", "병원에서 일하고 있습니다.", "病院의 ょう는 길게, 働いて는 ‘하타라이테’로 이어 주세요.", [
          ["病院", "びょういん", "びょう의 ょう를 길게 이어 주세요."], "で", ["働", "はたら"], "いています。",
        ]),
        ja("ja-1-04", "도쿄는 처음입니다.", "東京의 장모음을 짧게 끊지 마세요. 初めて는 ‘하지메테’입니다.", [
          ["東京", "とうきょう", "とうきょう의 おう는 오를 길게 한 소리로."], "は", ["初", "はじ"], "めてです。",
        ]),
        ja("ja-1-05", "잘 부탁드립니다.", "よろしく는 서두르지 말고, お願いします의 끝을 분명히 닫으세요.", [
          "どうぞ", "よろしく", "お", ["願", "ねが"], "いします。",
        ]),
        ja("ja-1-06", "취미는 산책입니다.", "散歩의 ん을 빼먹으면 ‘사포’처럼 들립니다.", [
          ["趣味", "しゅみ"], "は", ["散歩", "さんぽ", "さんぽ의 ん을 코로 한 박자 울리세요."], "です。",
        ]),
        ja("ja-1-07", "일본어는 아직 서툽니다.", "日本語의 ん, 苦手의 が를 목에서 울리세요.", [
          ["日本語", "にほんご", "にほんご의 ん을 남기세요."], "は", "まだ", ["苦手", "にがて"], "です。",
        ]),
        ja("ja-1-08", "천천히 말해 주세요.", "ゆっくり의 작은 っ으로 잠깐 끊었다가 くり를 말하세요.", [
          ["ゆっくり", "ゆっくり", "작은 っ 뒤에서 くり를 조금 세게 말하세요."], ["話", "はな"], "してください。",
        ]),
      ],
    },
    {
      id: "ja-2",
      level: 2,
      title: "주문하기",
      summary: "카페와 식당에서 쓰는 짧은 말.",
      sentences: [
        ja("ja-2-01", "이것을 주세요.", "を는 ‘오’에 가깝게 약하게 냅니다. ください의 さい를 끝까지 말하세요.", [
          "これ", "を", "ください。",
        ]),
        ja("ja-2-02", "커피 한 잔 주세요.", "コーヒー의 장음과 一杯의 작은 っ을 둘 다 살려 주세요.", [
          ["コーヒー", "こーひー", "ー를 한 박자씩 길게 끄세요."], "を", ["一杯", "いっぱい", "いっぱい의 작은 っ 뒤, ぱ를 조금 세게."], "ください。",
        ]),
        ja("ja-2-03", "이것은 얼마인가요?", "いくらの い를 또렷하게. ですか로 부드럽게 맺으세요.", [
          "これ", "は", "いくらですか。",
        ]),
        ja("ja-2-04", "물을 주세요.", "みず의 ず는 ‘스’가 아니라 목을 울려 ‘즈’에 가깝게.", [
          "お", ["水", "みず"], "を", "ください。",
        ]),
        ja("ja-2-05", "추천 메뉴가 있나요?", "おすすめ의 お는 작게, すすめ를 또박또박 말하세요.", [
          "おすすめ", "は", "ありますか。",
        ]),
        ja("ja-2-06", "너무 맵지 않게 해 주세요.", "からく의 か를 분명히. しないでください를 서두르지 마세요.", [
          "あまり", ["辛", "から"], "くしないでください。",
        ]),
        ja("ja-2-07", "계산해 주세요.", "会計는 ‘가이케이’. えい까지 빼먹지 마세요.", [
          "お", ["会計", "かいけい", "かいけ이의 え이까지 말하세요."], "を", "お", ["願", "ねが"], "いします。",
        ]),
        ja("ja-2-08", "잘 먹었습니다.", "ごちそう의 ちょう를 길게, 뒤는 부드럽게 맺으세요.", [
          "ごちそうさまでした。",
        ]),
      ],
    },
    {
      id: "ja-3",
      level: 3,
      title: "병원 일상",
      summary: "진료실에서 묻고 답하는 말.",
      sentences: [
        ja("ja-3-01", "어디가 아프세요?", "いたい의 い를 두 번 자연스럽게. ですか로 물으세요.", [
          "どこ", "が", ["痛", "いた"], "いですか。",
        ]),
        ja("ja-3-02", "열은 있나요?", "熱は ‘네츠와’. つ를 ‘스’로 바꾸지 마세요.", [
          ["熱", "ねつ", "つ는 작게 터뜨리듯 ‘츠’로 말하세요."], "は", "ありますか。",
        ]),
        ja("ja-3-03", "언제부터 아팠나요?", "いつから를 한 호흡으로. ら행은 혀를 한 번만 가볍게.", [
          "いつから", ["痛", "いた"], "いですか。",
        ]),
        ja("ja-3-04", "약을 처방하겠습니다.", "処方는 ‘쇼호’. しょ를 갈라 말하지 말고 ほう를 길게.", [
          ["薬", "くすり"], "を", ["処方", "しょほう", "しょ를 한 소리로, ほう를 길게."], "します。",
        ]),
        ja("ja-3-05", "이것은 처방전입니다.", "処方箋의 せん에서 ん을 코로 마무리하세요.", [
          "これ", "は", ["処方箋", "しょほうせん", "せん 끝의 ん을 분명히 닫으세요."], "です。",
        ]),
        ja("ja-3-06", "오늘은 푹 쉬세요.", "安静는 ‘안세이’. ん 뒤에 せい을 또박또박.", [
          ["今日", "きょう", "きょう의 ょう를 길게."], "は", ["安静", "あんせい", "あん의 ん을 남기세요."], "にしてください。",
        ]),
        ja("ja-3-07", "알레르기가 있나요?", "アレルギー의 ー를 빼면 다른 말처럼 들립니다.", [
          ["アレルギー", "あれるぎー", "ー를 한 박자 길게 끄세요."], "は", "ありますか。",
        ]),
        ja("ja-3-08", "큰 문제는 없습니다.", "大きな의 おお는 장모음입니다. 問題의 ん도 살리세요.", [
          ["大", "おお", "おお를 길게 이어 주세요."], "きな", ["問題", "もんだい", "もんだい의 ん을 남기세요."], "は", "ありません。",
        ]),
      ],
    },
    {
      id: "ja-4",
      level: 4,
      title: "소리 길이",
      summary: "장모음, 작은 っ, ん을 또박또박.",
      sentences: [
        ja("ja-4-01", "학교는 저쪽입니다.", "がっこう의 っ과 장음, あっち의 っ을 각각 살려 주세요.", [
          ["学校", "がっこう", "작은 っ으로 끊고, おう는 길게."], "は", ["あっち", "あっち", "あっち의 작은 っ도 빼지 마세요."], "です。",
        ]),
        ja("ja-4-02", "우표 세 장 주세요.", "きって의 っ, さんまい의 ん. 두 소리를 빠뜨리기 쉽습니다.", [
          ["切手", "きって", "きって의 작은 っ을 빼지 마세요."], "を", ["三枚", "さんまい", "さんまい의 ん을 코로 울리세요."], "ください。",
        ]),
        ja("ja-4-03", "어머니, 건강하세요?", "お母さんの ああ 장음과 さん·げん의 ん을 분명히.", [
          "お", ["母", "かあ", "かあ의 아 소리를 길게 이으세요."], "さん", "、", "お", ["元気", "げんき"], "ですか。",
        ]),
        ja("ja-4-04", "잠깐만 기다려 주세요.", "ちょっと와 待って, 작은 っ이 두 번입니다.", [
          ["ちょっと", "ちょっと", "ちょっと의 작은 っ으로 잠깐 멈추세요."], ["待", "ま"], "っ", "てください。",
        ]),
        ja("ja-4-05", "도쿄역까지 걸어갑니다.", "東京은 길게, 駅의 え는 짧게. 길이를 바꿔 보세요.", [
          ["東京", "とうきょう", "おう와 よう을 각각 길게."], ["駅", "えき", "えき는 짧게, 장음으로 끌지 마세요."], "まで", ["歩", "ある"], "きます。",
        ]),
        ja("ja-4-06", "길을 건너 주세요.", "通り의 장모음, 渡って의 작은 っ. 둘 다 지키세요.", [
          ["通", "とお", "とお의 오 소리를 길게 이으세요."], "りを", ["渡", "わた"], "っ", "てください。",
        ]),
        ja("ja-4-07", "오늘 밤 신문을 읽습니다.", "ん이 여러 번 나옵니다. 빠뜨리지 말고 코로 울리세요.", [
          ["今晩", "こんばん", "こんばん의 ん을 두 번 살리세요."], "、", ["新聞", "しんぶん", "しんぶん도 ん이 두 번입니다."], "を", ["読", "よ"], "みます。",
        ]),
        ja("ja-4-08", "새 커피 한 잔 주세요.", "新しい는 차근차근, 장음과 작은 っ을 이어서.", [
          ["新", "あたら"], "しい", ["コーヒー", "こーひー", "ー를 길게 끄세요."], "を", ["一杯", "いっぱい", "작은 っ 뒤의 ぱ를 조금 세게."], "ください。",
        ]),
      ],
    },
    {
      id: "ja-5",
      level: 5,
      title: "이어서 말하기",
      summary: "조금 더 긴 문장으로 앞의 소리를 이어서.",
      sentences: [
        ja("ja-5-01", "저는 한국에서 온 의사입니다.", "자기소개를 한 호흡으로 이어 보세요. きた의 き는 짧게.", [
          ["私", "わたし"], "は", ["韓国", "かんこく"], "から", ["来", "き", "きた의 き는 짧게 시작하세요."], "た", ["医者", "いしゃ"], "です。",
        ]),
        ja("ja-5-02", "오늘 오후에 예약이 있습니다.", "午後는 ‘고고’. ご를 흐리지 말고 두 번 말하세요.", [
          ["今日", "きょう"], "の", ["午後", "ごご", "ご를 두 번 분명하게 말하세요."], "、", ["予約", "よやく"], "が", "あります。",
        ]),
        ja("ja-5-03", "처방전을 약국에 내 주세요.", "薬局의 작은 っ, 出してください의 だ를 분명히.", [
          ["処方箋", "しょほうせん"], "を", ["薬局", "やっきょく", "やっきょく의 작은 っ을 빼지 마세요."], "に", ["出", "だ"], "してください。",
        ]),
        ja("ja-5-04", "식후에 이 약을 드세요.", "食後는 ‘쇼쿠고’. く를 삼키지 말고, 飲んで는 ‘논데’.", [
          ["食後", "しょくご", "しょく의 く를 빼먹지 마세요."], "にこの", ["薬", "くすり"], "を", ["飲", "の"], "んでください。",
        ]),
        ja("ja-5-05", "증상을 알려 주세요.", "症状의 しょう와 じょう, 장음을 둘 다 길게.", [
          ["症状", "しょうじょう", "しょうじょう는 장음이 두 번입니다."], "を", ["教", "おし"], "えてください。",
        ]),
        ja("ja-5-06", "알레르기는 없습니다.", "ー를 길게 한 뒤, はありません을 이어서 말하세요.", [
          ["アレルギー", "あれるぎー", "ー를 한 박자 길게 끄세요."], "は", "ありません。",
        ]),
        ja("ja-5-07", "다음 주에 다시 오세요.", "来週는 ‘라이슈’. 来てください의 き를 흘리지 마세요.", [
          "また", ["来週", "らいしゅう"], "、", ["来", "き", "きてください의 き는 짧게 시작하세요."], "てください。",
        ]),
        ja("ja-5-08", "알겠습니다. 한 번 더 부탁드립니다.", "두 문장 사이를 살짝 쉬세요. 一度의 ‘치’를 분명히.", [
          ["分", "わ"], "かりました。", "もう", ["一度", "いちど", "いち도의 ‘치’를 분명하게 말하세요."], "お", ["願", "ねが"], "いします。",
        ]),
      ],
    },
  ],
};

const ENGLISH = {
  id: "en",
  lang: "en-US",
  title: "영어",
  summary: "R·L, TH, F·V, 모음 길이, 강세와 진료실 인사.",
  lessons: [
    {
      id: "en-1",
      level: 1,
      title: "R과 L",
      summary: "혀가 잇몸에 닿는 L과, 닿지 않는 R을 나눕니다.",
      sentences: [
        en("en-1-01", "Right, the light is red.", "맞아요, 불이 빨강입니다.", "right·red는 R, light는 L입니다. R은 혀가 잇몸에 닿지 않고, L은 혀끝이 윗잇몸에 닿습니다.", {
          right: "right는 R로 시작합니다. 혀끝을 윗잇몸에 붙이지 마세요.",
          light: "light는 L로 시작합니다. 혀끝을 윗니 뒤 잇몸에 붙이세요.",
          red: "red의 R도 혀가 잇몸에 닿지 않습니다.",
        }),
        en("en-1-02", "Please read the label aloud.", "라벨을 소리 내어 읽어 주세요.", "read는 R, label은 L입니다. aloud의 L도 분명하게.", {
          read: "read는 R로 시작합니다. 혀를 굴려 떨지 말고, 잇몸에 닿지 않게 목을 울리세요.",
          label: "label은 L로 시작합니다. 혀끝을 윗잇몸에 붙이세요.",
          aloud: "aloud의 L은 혀끝을 잇몸에 붙인 뒤 이어서 말하세요.",
        }),
        en("en-1-03", "I like really light rice.", "저는 아주 가벼운 밥을 좋아합니다.", "like·light는 L, really·rice는 R입니다. 네 단어를 천천히 나누세요.", {
          like: "like는 L입니다. 혀끝을 윗잇몸에 붙이세요.",
          really: "really는 R입니다. 혀가 잇몸에 닿지 않게 하세요.",
          light: "light는 L입니다. really의 R과 혀 자리를 바꿔 보세요.",
          rice: "rice는 R로 시작합니다. L처럼 혀를 붙이지 마세요.",
        }),
        en("en-1-04", "Larry will arrive a little late.", "래리는 조금 늦게 도착합니다.", "Larry·little·late는 L, arrive는 R입니다.", {
          larry: "Larry는 L로 시작합니다. 혀끝을 잇몸에 붙이세요.",
          arrive: "arrive는 R로 시작합니다. 혀가 잇몸에 닿지 않습니다.",
          little: "little의 L을 두 번 모두 혀끝으로 만드세요.",
          late: "late는 L입니다. arrive의 R 바로 뒤에서 자리가 바뀝니다.",
        }),
        en("en-1-05", "The correct letter is right here.", "맞는 글자는 바로 여기 있습니다.", "correct·right는 R, letter는 L입니다.", {
          correct: "correct는 R로 시작합니다. 혀를 잇몸에 대지 마세요.",
          letter: "letter는 L로 시작하고 L로 끝납니다. 혀끝을 잇몸에 두 번 붙이세요.",
          right: "right는 R입니다. letter의 L과 바로 비교해 보세요.",
        }),
        en("en-1-06", "Please collect the written report.", "작성된 보고서를 모아 주세요.", "collect는 L, written·report는 R입니다.", {
          collect: "collect는 L로 시작합니다. 혀끝을 윗잇몸에 붙이세요.",
          written: "written은 R로 시작합니다. 혀가 잇몸에 닿지 않습니다.",
          report: "report는 R이 두 번입니다. 둘 다 혀를 붙이지 마세요.",
        }),
        en("en-1-07", "I already left the library.", "저는 이미 도서관을 나왔습니다.", "already·left·library는 L로 시작합니다. library 끝의 R은 약하게 남습니다.", {
          already: "already는 L입니다. 혀끝을 잇몸에 붙이세요.",
          left: "left는 L로 시작합니다.",
          library: "library는 L로 시작하고, 끝의 R은 혀를 대지 않은 채 약하게 남기세요.",
        }),
        en("en-1-08", "Her role is clearly relevant.", "그 역할은 분명히 관련이 있습니다.", "role·relevant는 R, clearly는 L과 R이 함께 있습니다.", {
          role: "role은 R로 시작합니다. 혀를 잇몸에 붙이지 마세요.",
          clearly: "clearly는 L 다음에 R이 옵니다. L에서 혀를 붙이고, R에서 떼세요.",
          relevant: "relevant는 R로 시작합니다.",
        }),
      ],
    },
    {
      id: "en-2",
      level: 2,
      title: "TH 소리",
      summary: "혀끝을 앞니 사이에 두는 무성 th와 유성 th.",
      sentences: [
        en("en-2-01", "I think this is thick.", "저는 이것이 두껍다고 생각합니다.", "think·thick는 무성 th, this는 유성 th입니다. 혀끝을 앞니 사이에 두세요.", {
          think: "think의 th는 무성입니다. 혀끝을 앞니 사이에 두고 바람만 내보내세요. ‘싱크’가 되지 않게.",
          this: "this의 th는 유성입니다. 혀는 같은 자리이고 목을 울리세요. ‘디스’가 되지 않게.",
          thick: "thick도 무성 th입니다. 모음은 짧게.",
        }),
        en("en-2-02", "Thank you for this Thursday.", "이번 목요일에 고맙습니다.", "Thank·Thursday는 무성 th, this는 유성 th입니다.", {
          thank: "Thank는 무성 th로 시작합니다. 혀끝을 앞니 사이에 두세요.",
          this: "this는 유성 th입니다. 목을 울리세요.",
          thursday: "Thursday는 무성 th로 시작하고, 첫 음절을 세게 말하세요.",
        }),
        en("en-2-03", "Both authors are healthy.", "두 사람 모두 건강합니다.", "Both·healthy의 th는 무성입니다. 끝에서 혀를 이 사이에 남겨 두세요.", {
          both: "Both 끝의 th는 무성입니다. ‘보쓰’로 끝내지 마세요.",
          healthy: "healthy의 th는 무성입니다. ‘헬시’처럼 s로 바꾸지 마세요.",
        }),
        en("en-2-04", "I thought the path was north.", "저는 그 길이 북쪽인 줄 알았습니다.", "thought·path·north는 무성 th, the는 유성 th입니다.", {
          thought: "thought는 무성 th입니다. ‘소트’가 되지 않게 혀를 내미세요.",
          the: "the는 유성 th입니다. ‘더’가 되지 않게 목을 울리며 혀를 이 사이에 두세요.",
          path: "path 끝의 th는 무성입니다.",
          north: "north 끝의 th도 무성입니다. 혀를 넣고 바람을 남기세요.",
        }),
        en("en-2-05", "They gathered on Thursday.", "그들은 목요일에 모였습니다.", "They는 유성 th, Thursday는 무성 th입니다.", {
          they: "They는 유성 th로 시작합니다. ‘데이’가 되지 않게 목을 울리세요.",
          thursday: "Thursday는 무성 th입니다. 바람만 내보내고 첫 음절을 세게.",
        }),
        en("en-2-06", "Something is worth thinking through.", "무언가 끝까지 생각해 볼 가치가 있습니다.", "something·worth·thinking·through의 th는 모두 무성입니다.", {
          something: "Something 한가운데 th는 무성입니다. ‘섬싱’으로 건너뛰지 마세요.",
          worth: "worth 끝의 th는 무성입니다.",
          thinking: "thinking은 무성 th로 시작합니다.",
          through: "through는 무성 th로 시작합니다. ‘스루’가 되지 않게.",
        }),
        en("en-2-07", "Can you breathe through your mouth?", "입으로 숨을 쉴 수 있나요?", "breathe는 유성 th, through·mouth는 무성 th입니다.", {
          breathe: "breathe의 th는 유성입니다. 혀를 이 사이에 두고 목을 울리세요.",
          through: "through는 무성 th입니다. breathe 바로 뒤에서 울림을 끄세요.",
          mouth: "mouth 끝의 th는 무성입니다.",
        }),
        en("en-2-08", "I need both the method and the results.", "방법과 결과, 둘 다 필요합니다.", "both·method는 무성 th, the는 유성 th입니다.", {
          both: "both 끝은 무성 th입니다.",
          the: "the는 유성 th입니다. 문장 안에 두 번 나옵니다.",
          method: "method의 th는 무성입니다. ‘메소드’가 되지 않게.",
        }),
      ],
    },
    {
      id: "en-3",
      level: 3,
      title: "F와 V",
      summary: "윗니를 아랫입술에 댑니다. V만 목을 울립니다.",
      sentences: [
        en("en-3-01", "I feel fine after coffee.", "커피를 마신 뒤라 컨디션이 괜찮습니다.", "feel·fine·coffee의 F는 윗니를 아랫입술에 대고 내는 바람입니다.", {
          feel: "feel의 F는 윗니를 아랫입술에 대고 바람을 내보내세요. 입을 다문 소리가 되지 않게.",
          fine: "fine도 F로 시작합니다. 입술과 이의 마찰을 남기세요.",
          coffee: "coffee의 F를 빠뜨리지 마세요. 아랫입술을 윗니에 댑니다.",
        }),
        en("en-3-02", "Five visitors left the office.", "방문객 다섯 명이 사무실을 나갔습니다.", "Five·office는 F, visitors는 V입니다. 자리는 같고 V만 목을 울립니다.", {
          five: "Five는 F입니다. 윗니와 아랫입술 사이로 바람을 내보내세요.",
          visitors: "visitors는 V로 시작합니다. F와 같은 자리에서 목을 울리세요.",
          office: "office의 F를 분명히. 입술을 그냥 다물지 마세요.",
        }),
        en("en-3-03", "Please forgive the very first failure.", "처음의 실수는 너그럽게 봐 주세요.", "forgive·very·failure에 V와 F가 섞입니다. V에서만 목을 울리세요.", {
          forgive: "forgive는 F로 시작해 V로 끝납니다. 끝에서 목을 울리세요.",
          very: "very는 V입니다. 윗니와 아랫입술을 대고 목을 울리세요.",
          first: "first는 F입니다. very 뒤에서 울림을 끄고 바람만 내세요.",
          failure: "failure는 F로 시작합니다.",
        }),
        en("en-3-04", "We have a few available files.", "쓸 수 있는 파일이 몇 개 있습니다.", "few·files는 F, available은 V입니다.", {
          few: "few는 F로 시작합니다. 아랫입술을 윗니에 대세요.",
          available: "available 안의 V를 목을 울려 말하세요.",
          files: "files는 F입니다. 자리는 같게 하되 울림만 끄세요.",
        }),
        en("en-3-05", "The office coffee is very fresh.", "사무실 커피가 아주 신선합니다.", "office·coffee·fresh는 F, very는 V입니다.", {
          office: "office의 F는 무성입니다. 입술과 이로 바람을 내세요.",
          coffee: "coffee의 F도 같은 마찰음입니다.",
          very: "very는 V입니다. 같은 자리에서 목을 울리세요.",
          fresh: "fresh는 F로 시작합니다.",
        }),
        en("en-3-06", "Save the file before you leave.", "떠나기 전에 파일을 저장하세요.", "Save·before·leave는 V, file은 F입니다.", {
          save: "Save의 V는 유성입니다. 바람만 내지 말고 목을 울리세요.",
          file: "file은 F입니다. 울림 없이 바람만 내세요.",
          before: "before의 V를 울리세요.",
          leave: "leave는 V로 끝납니다. 끝을 ㅂ으로 닫지 마세요.",
        }),
        en("en-3-07", "I've never felt a fever.", "열이 난 적은 없습니다.", "I've·never·fever의 V는 울리고, felt·fever의 F는 바람만 내세요.", {
          "i've": "I've의 V를 빠뜨리지 말고 목을 울리세요.",
          never: "never의 V를 울리세요.",
          felt: "felt는 F로 시작합니다.",
          fever: "fever는 F로 시작해 V로 이어집니다. V에서 목을 울리세요.",
        }),
        en("en-3-08", "A brief review will follow.", "짧은 검토가 이어집니다.", "brief·follow는 F, review는 V입니다.", {
          brief: "brief 끝의 F는 무성입니다. 윗니와 아랫입술을 대세요.",
          review: "review 중간의 V를 목을 울려 말하세요.",
          follow: "follow는 F로 시작합니다.",
        }),
      ],
    },
    {
      id: "en-4",
      level: 4,
      title: "모음 길이",
      summary: "짧은 모음과 긴 모음을 길이로 구분합니다.",
      sentences: [
        en("en-4-01", "Please sit in this seat.", "이 자리에 앉아 주세요.", "sit의 i는 짧고, seat의 ea는 깁니다. 길게 말할 때 입꼬리를 조금 더 당기세요.", {
          sit: "sit의 i는 짧습니다. 입을 조금만 벌리고 바로 닫으세요.",
          seat: "seat의 ea는 길게 끄세요. sit보다 한 박자 깁니다.",
        }),
        en("en-4-02", "That ship is not a sheep.", "저것은 양이 아니라 배입니다.", "ship은 짧은 i, sheep은 긴 ee입니다. 길이로 뜻이 바뀝니다.", {
          ship: "ship의 i는 짧게. 끌면 sheep이 됩니다.",
          sheep: "sheep의 ee는 길게 끄세요. 입꼬리를 옆으로.",
        }),
        en("en-4-03", "Please pull the pool ladder.", "수영장 사다리를 당겨 주세요.", "pull의 u는 짧고, pool의 oo는 깁니다. 둘 다 입술을 둥글게.", {
          pull: "pull의 u는 짧습니다. 입술을 둥글게 하되 바로 끊으세요.",
          pool: "pool의 oo는 길게 끄세요. pull보다 입술을 더 유지합니다.",
        }),
        en("en-4-04", "I live here, but I will leave soon.", "저는 여기 살지만 곧 떠납니다.", "live의 i는 짧고, leave의 ea는 깁니다.", {
          live: "live의 i는 짧게 말하세요.",
          leave: "leave의 ea는 길게. live와 길이만 다릅니다.",
        }),
        en("en-4-05", "The full cup fooled me.", "가득 찬 컵인 줄 잘못 보았습니다.", "full의 u는 짧고, fooled의 oo는 깁니다.", {
          full: "full의 u는 짧고 둥글게.",
          fooled: "fooled의 oo는 길게 끄세요.",
        }),
        en("en-4-06", "Please check this cheap list.", "이 저렴한 목록을 확인해 주세요.", "check·list는 짧고, cheap의 ea는 깁니다.", {
          check: "check의 e는 짧습니다.",
          cheap: "cheap의 ea는 길게. check와 모음 길이가 다릅니다.",
          list: "list의 i는 짧게 끊으세요.",
        }),
        en("en-4-07", "He put the food on the book.", "그는 음식을 책 위에 두었습니다.", "put·book의 모음은 짧고, food의 oo는 깁니다.", {
          put: "put의 u는 짧습니다.",
          food: "food의 oo는 길게 끄세요.",
          book: "book의 oo는 짧게. food와 길이가 다릅니다.",
        }),
        en("en-4-08", "I slept, but I still feel sleepy.", "잤는데도 여전히 졸립니다.", "slept의 e는 짧고, sleepy의 ee는 깁니다.", {
          slept: "slept의 e는 짧고 또박또박.",
          feel: "feel의 ee는 길게.",
          sleepy: "sleepy의 ee도 길게 끄세요.",
        }),
      ],
    },
    {
      id: "en-5",
      level: 5,
      title: "강세와 진료 인사",
      summary: "세게 읽을 음절과, 진료실에서 쓰는 짧은 말.",
      note: "강세(세게 읽는 음절)는 점수로 계산하지 않습니다. 들을 때 표시된 음절을 확인해 주세요.",
      sentences: [
        en("en-5-01", "I have an appointment at three.", "세 시에 예약이 있습니다.", "appointment은 둘째 음절을 세게, 길게: ap-POINT-ment.", {
          appointment: "appointment은 ap-POINT-ment. ‘포인트’ 음절을 더 높고 길게 말하세요.",
          three: "three의 th는 무성입니다. 혀끝을 앞니 사이에 두세요.",
        }),
        en("en-5-02", "Please describe your symptoms.", "증상을 말씀해 주세요.", "describe는 뒤를 세게(de-SCRIBE), symptoms는 앞을 세게(SYMP-toms).", {
          describe: "describe는 de-SCRIBE. 뒤 음절을 더 세게 말하세요.",
          symptoms: "symptoms는 SYMP-toms. 첫 음절을 세게, 뒤는 약하게.",
        }),
        en("en-5-03", "Do you have a fever today?", "오늘 열이 있으신가요?", "fever는 첫 음절(FE-ver), today는 뒤 음절(to-DAY)을 세게.", {
          fever: "fever는 FE-ver. 첫 음절을 세게. F는 입술과 이, V는 목을 울리세요.",
          today: "today는 to-DAY. 뒤 음절을 세게 말하세요.",
        }),
        en("en-5-04", "Take this medicine after meals.", "식후에 이 약을 드세요.", "medicine은 첫 음절(MED-i-cine), after도 첫 음절(AF-ter)을 세게.", {
          this: "this의 th는 유성입니다. 혀를 이 사이에 두고 목을 울리세요.",
          medicine: "medicine은 MED-i-cine. 첫 음절을 세게, 고르게 누르지 마세요.",
          after: "after는 AF-ter. 첫 음절을 세게.",
        }),
        en("en-5-05", "Are you allergic to any medicine?", "드시는 약 중에 알레르기가 있나요?", "allergic은 가운데를 세게(al-LER-gic), medicine은 앞을 세게.", {
          allergic: "allergic은 al-LER-gic. 가운데 음절을 세게 말하세요.",
          medicine: "medicine은 MED-i-cine. 첫 음절을 세게.",
        }),
        en("en-5-06", "I will record your blood pressure.", "혈압을 기록하겠습니다.", "동사 record는 뒤를 세게(re-CORD). pressure는 앞을 세게(PRES-sure).", {
          record: "record는 여기서 동사라 뒤 음절을 세게: re-CORD.",
          pressure: "pressure는 PRES-sure. 첫 음절을 세게.",
        }),
        en("en-5-07", "Please come back in two weeks.", "2주 후에 다시 오세요.", "come BACK에서 back을 조금 더 세게. weeks의 ee는 길게.", {
          back: "back을 come보다 조금 세게 말하세요.",
          weeks: "weeks의 ee는 길게 끄세요. two와 붙어 삼키지 마세요.",
        }),
        en("en-5-08", "Thank you for visiting the clinic.", "병원에 와 주셔서 감사합니다.", "visiting과 clinic은 모두 첫 음절을 세게: VIS-it-ing, CLI-nic.", {
          thank: "Thank는 무성 th로 시작합니다. 혀끝을 앞니 사이에 두세요.",
          visiting: "visiting은 VIS-it-ing. 첫 음절을 세게.",
          clinic: "clinic은 CLI-nic. 첫 음절을 세게, 뒤는 약하게.",
        }),
      ],
    },
  ],
};

export const TRACKS = [JAPANESE, ENGLISH];

export function findSentence(id) {
  for (const track of TRACKS) {
    for (const lesson of track.lessons) {
      const index = lesson.sentences.findIndex((sentence) => sentence.id === id);
      if (index >= 0) return { track, lesson, sentence: lesson.sentences[index], index };
    }
  }
  return null;
}

export function getTrack(id) {
  return TRACKS.find((track) => track.id === id) || null;
}

export function getLesson(track, lessonId) {
  return track?.lessons.find((lesson) => lesson.id === lessonId) || null;
}

export function listSentenceIds(track) {
  return track.lessons.flatMap((lesson) => lesson.sentences.map((sentence) => sentence.id));
}

export function surfaceText(sentence) {
  if (!sentence) return "";
  if (sentence.text) return sentence.text;
  return (sentence.tokens || []).map((token) => token.t).join("");
}

export function neighborSentence(track, lessonId, index, direction) {
  const lessonIndex = track.lessons.findIndex((lesson) => lesson.id === lessonId);
  if (lessonIndex < 0) return null;
  const lesson = track.lessons[lessonIndex];
  const nextIndex = index + direction;
  if (nextIndex >= 0 && nextIndex < lesson.sentences.length) {
    return { lessonId: lesson.id, index: nextIndex };
  }
  const neighborLesson = track.lessons[lessonIndex + direction];
  if (!neighborLesson) return null;
  return {
    lessonId: neighborLesson.id,
    index: direction > 0 ? 0 : neighborLesson.sentences.length - 1,
  };
}
