import Groq from 'groq-sdk';

const levelDescriptions = {
  N5: 'beginner level, ~100 Japanese characters, very simple vocabulary and grammar, daily life topics',
  N4: 'elementary level, ~150 Japanese characters, basic vocabulary, daily life and familiar topics',
  N3: 'intermediate level, ~200 Japanese characters, varied grammar, general social topics',
  N2: 'upper-intermediate level, ~250 Japanese characters, advanced vocabulary, social and current affairs topics',
  N1: 'advanced level, ~300 Japanese characters, sophisticated grammar, academic and critical topics',
};

const VALID_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { level } = req.body;

  if (!VALID_LEVELS.includes(level)) {
    return res.status(400).json({ error: '無效的程度' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 GROQ_API_KEY。' });
  }

  const prompt = `You are a JLPT Japanese language teaching expert. Generate a complete Japanese reading article for ${level} level learners.

Level requirements: ${levelDescriptions[level]}

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
}
