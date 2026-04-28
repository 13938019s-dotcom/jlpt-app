import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';

const app = express();
const PORT = 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  /\.vercel\.app$/,
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => typeof o === 'string' ? o === origin : o.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(express.json());

// ── JLPT article generation ──────────────────────────────
const jlptLevelDescriptions = {
  N5: 'beginner level, ~100 Japanese characters, very simple vocabulary and grammar, daily life topics',
  N4: 'elementary level, ~150 Japanese characters, basic vocabulary, daily life and familiar topics',
  N3: 'intermediate level, ~200 Japanese characters, varied grammar, general social topics',
  N2: 'upper-intermediate level, ~250 Japanese characters, advanced vocabulary, social and current affairs topics',
  N1: 'advanced level, ~300 Japanese characters, sophisticated grammar, academic and critical topics',
};

const VALID_JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

app.post('/api/generate-article', async (req, res) => {
  const { level } = req.body;

  if (!VALID_JLPT_LEVELS.includes(level)) {
    return res.status(400).json({ error: '無效的程度' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 GROQ_API_KEY，請在 server/.env 中填入。' });
  }

  const prompt = `You are a JLPT Japanese language teaching expert. Generate a complete Japanese reading article for ${level} level learners.

Level requirements: ${jlptLevelDescriptions[level]}

Return ONLY a valid JSON object with NO extra text, NO markdown, NO code fences. Follow this example format exactly, replacing all values with real ${level}-level content:

{
  "title": "私の家族",
  "content": "私の家族は四人です。父と母と妹と私です。父は会社員です。毎日電車で会社に行きます。母は小学校の先生です。子どもたちに国語を教えています。妹は十二歳で、中学生です。私は大学で日本語を勉強しています。週末は家族みんなで公園に散歩に行きます。小さい家ですが、とても楽しい毎日です。",
  "vocabulary": [
    { "kanji": "家族", "furigana": "かぞく", "meaning": "家人", "example": "私の家族は四人です。", "exampleTranslation": "我的家人有四個人。" },
    { "kanji": "父", "furigana": "ちち", "meaning": "父親", "example": "父は会社員です。", "exampleTranslation": "父親是上班族。" },
    { "kanji": "母", "furigana": "はは", "meaning": "母親", "example": "母は先生です。", "exampleTranslation": "母親是老師。" },
    { "kanji": "妹", "furigana": "いもうと", "meaning": "妹妹", "example": "妹は学生です。", "exampleTranslation": "妹妹是學生。" },
    { "kanji": "会社員", "furigana": "かいしゃいん", "meaning": "上班族", "example": "父は会社員です。", "exampleTranslation": "父親是上班族。" },
    { "kanji": "先生", "furigana": "せんせい", "meaning": "老師", "example": "母は先生です。", "exampleTranslation": "母親是老師。" },
    { "kanji": "学生", "furigana": "がくせい", "meaning": "學生", "example": "私は学生です。", "exampleTranslation": "我是學生。" },
    { "kanji": "住む", "furigana": "すむ", "meaning": "居住", "example": "東京に住んでいます。", "exampleTranslation": "住在東京。" },
    { "kanji": "毎日", "furigana": "まいにち", "meaning": "每天", "example": "毎日学校に行きます。", "exampleTranslation": "每天去學校。" },
    { "kanji": "好き", "furigana": "すき", "meaning": "喜歡", "example": "犬が好きです。", "exampleTranslation": "喜歡狗。" }
  ],
  "grammar": [
    { "pattern": "～は～です", "explanation": "表示「～是～」，用於說明主語的身份或狀態。", "example": "父は会社員です。", "exampleTranslation": "父親是上班族。" },
    { "pattern": "～と～", "explanation": "表示「～和～」，連接兩個名詞。", "example": "父と母がいます。", "exampleTranslation": "有父親和母親。" },
    { "pattern": "～ています", "explanation": "表示正在進行的狀態或習慣性動作。", "example": "東京に住んでいます。", "exampleTranslation": "住在東京。" },
    { "pattern": "～に行きます", "explanation": "表示前往某地，「去～」。", "example": "学校に行きます。", "exampleTranslation": "去學校。" }
  ],
  "questions": [
    { "question": "家族は何人ですか？", "options": ["二人", "三人", "四人", "五人"], "answerIndex": 2 },
    { "question": "お父さんの仕事は何ですか？", "options": ["先生", "会社員", "医者", "学生"], "answerIndex": 1 },
    { "question": "お母さんの仕事は何ですか？", "options": ["会社員", "主婦", "先生", "学生"], "answerIndex": 2 },
    { "question": "筆者は何ですか？", "options": ["先生", "会社員", "主婦", "学生"], "answerIndex": 3 }
  ]
}

Now generate a COMPLETELY NEW and DIFFERENT article for ${level} level in the exact same JSON format. Requirements:
- content must be at least 6 sentences long (like the example above)
- vocabulary array must have EXACTLY 10 items
- grammar array must have EXACTLY 4 items
- questions array must have EXACTLY 4 items
- The content must be original, not a copy of the example above.`;

  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0].message.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 回傳格式錯誤，請重試。');

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({
      id: `${level}-ai-${Date.now()}`,
      level,
      title: parsed.title,
      content: parsed.content,
      vocabulary: parsed.vocabulary,
      grammar: parsed.grammar,
      questions: parsed.questions,
      isAIGenerated: true,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'AI 生成失敗，請重試。' });
  }
});

// ── TOPIK article generation ─────────────────────────────
const topikLevelDescriptions = {
  '1-2': 'TOPIK I beginner level (Level 1-2), ~100-130 Korean characters, very simple vocabulary (daily life, family, numbers, food), basic sentence patterns like -입니다/-아요/어요, -고, -(으)로',
  '3-4': 'TOPIK II intermediate level (Level 3-4), ~180-230 Korean characters, varied vocabulary (culture, seasons, social topics), intermediate grammar like -(으)면, -아/어서, -기 좋다, -는 것',
  '5-6': 'TOPIK II advanced level (Level 5-6), ~280-350 Korean characters, sophisticated vocabulary (technology, environment, society), complex grammar like -(으)ㄹ수록, -음으로써, -를 둘러싼, -에 불구하고',
};

const VALID_TOPIK_LEVELS = ['1-2', '3-4', '5-6'];

app.post('/api/generate-topik-article', async (req, res) => {
  const { level } = req.body;

  if (!VALID_TOPIK_LEVELS.includes(level)) {
    return res.status(400).json({ error: '無效的程度' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 GROQ_API_KEY，請在 server/.env 中填入。' });
  }

  const prompt = `You are a TOPIK Korean language teaching expert. Generate a complete Korean reading article for TOPIK Level ${level} learners.

Level requirements: ${topikLevelDescriptions[level]}

CRITICAL RULES:
- The "title" and "content" fields must be written in HANGUL (한글) ONLY. Do NOT use any Chinese characters (漢字/Hanja) in these fields.
- The "korean" and "example" fields in vocabulary must also be Hangul only.
- The "example" field in grammar must also be Hangul only.
- Only the "meaning", "explanation", "exampleTranslation", and "romanization" fields may contain non-Korean text (Traditional Chinese or Latin).

Return ONLY a valid JSON object with NO extra text, NO markdown, NO code fences. Follow this example format exactly:

{
  "title": "우리 동네",
  "content": "우리 동네는 조용하고 깨끗합니다. 학교, 병원, 슈퍼마켓이 있습니다. 공원도 있어서 사람들이 산책을 합니다. 저는 우리 동네가 좋습니다. 주말에는 가족들과 공원에서 쉽니다. 앞으로도 이 동네에서 살고 싶습니다.",
  "contentTranslation": "我們的社區又安靜又乾淨。有學校、醫院和超市。也有公園，所以人們去散步。我喜歡我們的社區。週末和家人在公園裡休息。以後也想住在這個社區。",
  "vocabulary": [
    { "korean": "동네", "romanization": "dongne", "meaning": "社區/鄰里", "example": "우리 동네는 조용합니다.", "exampleTranslation": "我們的社區很安靜。" },
    { "korean": "조용하다", "romanization": "joyonghada", "meaning": "安靜", "example": "도서관이 조용합니다.", "exampleTranslation": "圖書館很安靜。" },
    { "korean": "깨끗하다", "romanization": "kkaekkeuthada", "meaning": "乾淨", "example": "방이 깨끗합니다.", "exampleTranslation": "房間很乾淨。" },
    { "korean": "병원", "romanization": "byeongwon", "meaning": "醫院", "example": "병원에 갑니다.", "exampleTranslation": "去醫院。" },
    { "korean": "슈퍼마켓", "romanization": "syupeomaket", "meaning": "超市", "example": "슈퍼마켓에서 삽니다.", "exampleTranslation": "在超市購買。" },
    { "korean": "공원", "romanization": "gongwon", "meaning": "公園", "example": "공원에서 쉽니다.", "exampleTranslation": "在公園休息。" },
    { "korean": "산책", "romanization": "sanchaek", "meaning": "散步", "example": "산책을 합니다.", "exampleTranslation": "去散步。" },
    { "korean": "사람들", "romanization": "saramdeur", "meaning": "人們", "example": "사람들이 많습니다.", "exampleTranslation": "人很多。" },
    { "korean": "좋다", "romanization": "jota", "meaning": "好/喜歡", "example": "한국이 좋습니다.", "exampleTranslation": "喜歡韓國。" },
    { "korean": "살다", "romanization": "salda", "meaning": "居住/生活", "example": "서울에서 삽니다.", "exampleTranslation": "住在首爾。" }
  ],
  "grammar": [
    { "pattern": "A-고 A", "explanation": "連結兩個形容詞，表示「又～又～」。", "example": "조용하고 깨끗합니다.", "exampleTranslation": "又安靜又乾淨。" },
    { "pattern": "N도", "explanation": "表示「也～」，添加額外的資訊。", "example": "공원도 있습니다.", "exampleTranslation": "也有公園。" },
    { "pattern": "V-아/어서", "explanation": "表示原因或順序，「因為～所以～」。", "example": "공원이 있어서 좋습니다.", "exampleTranslation": "因為有公園所以很好。" },
    { "pattern": "V-고 싶다", "explanation": "表示願望，「想要做～」。", "example": "이 동네에서 살고 싶습니다.", "exampleTranslation": "想住在這個社區。" }
  ],
  "questions": [
    { "question": "우리 동네에 없는 것은?", "options": ["학교", "병원", "영화관", "슈퍼마켓"], "answerIndex": 2 },
    { "question": "우리 동네 공원에서 사람들이 무엇을 합니까?", "options": ["공부", "산책", "요리", "운동"], "answerIndex": 1 },
    { "question": "우리 동네의 특징은?", "options": ["시끄럽고 더럽다", "조용하고 깨끗하다", "크고 복잡하다", "작고 불편하다"], "answerIndex": 1 },
    { "question": "이 사람은 앞으로 어떻게 하고 싶습니까?", "options": ["이사하고 싶다", "이 동네에서 살고 싶다", "여행하고 싶다", "공부하고 싶다"], "answerIndex": 1 }
  ]
}

Now generate a COMPLETELY NEW and DIFFERENT article for TOPIK Level ${level} in the exact same JSON format. Requirements:
- content must be at least 6 sentences long
- vocabulary array must have EXACTLY 10 items with romanization
- grammar array must have EXACTLY 4 items
- questions array must have EXACTLY 4 items with answerIndex as a number (0-3)
- All meanings, explanations, and translations must be in Traditional Chinese (繁體中文)
- The "title" and "content" MUST use Hangul (한글) only — absolutely NO Chinese characters (漢字) allowed in Korean text fields
- The "contentTranslation" must be a complete Traditional Chinese (繁體中文) translation of the "content" field
- The content must be original Korean text appropriate for TOPIK Level ${level}`;

  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0].message.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 回傳格式錯誤，請重試。');

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({
      id: `${level}-ai-${Date.now()}`,
      level,
      title: parsed.title,
      content: parsed.content,
      contentTranslation: parsed.contentTranslation,
      vocabulary: parsed.vocabulary,
      grammar: parsed.grammar,
      questions: parsed.questions,
      isAIGenerated: true,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'AI 生成失敗，請重試。' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (JLPT + TOPIK)`);
});
