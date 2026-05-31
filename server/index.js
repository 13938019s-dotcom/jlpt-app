import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTER_FILE = path.join(__dirname, 'article-counters.json');

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
  N5: 'JLPT N5 beginner. Topic: daily life (family, school, food, shopping). Sentence style: short, simple declarative sentences (5-15 chars each). Only basic Subject-は/が Predicate structure. All sentences end in ～です/ます. No subordinate clauses.',
  N4: 'JLPT N4 elementary. Topic: daily life with personal reflection (part-time work, seasons, hobbies, travel). Sentence style: COMPOUND sentences with connectors (てから、ので、が、ながら). Each sentence should be 20-40 chars. Must include expressions of ability/obligation/desire. NO single-clause short sentences allowed.',
  N3: 'JLPT N3 intermediate. Topic: social themes (environment, technology, culture, human relationships). Sentence style: COMPLEX sentences with embedded clauses (ことで、として、において). Each sentence 30-50 chars. Must include topic sentences, supporting details, and connective discourse.',
  N2: 'JLPT N2 upper-intermediate. Topic: social issues and current affairs (society, economy, urban-rural divide). Sentence style: formal written Japanese with abstract nouns, passive constructions, and multi-clause sentences (40-60 chars). Academic register.',
  N1: 'JLPT N1 advanced. Topic: academic and critical analysis (philosophy, linguistics, cognitive science). Sentence style: sophisticated multi-clause sentences with logical connectors, nominalization, and embedded propositions (50-80 chars). Dense, essay-like prose.',
};

// ── 各級別句型複雜度指引（含反例說明）──────────────────────
const jlptComplexityGuide = {
  N5: `Sentence style for N5:
✓ CORRECT: 私の家族は四人です。父は毎日電車で会社に行きます。
✗ WRONG for N5: complex compound sentences`,

  N4: `Sentence complexity REQUIRED for N4 — CRITICAL:
✗ TOO SIMPLE (N5 level — DO NOT WRITE LIKE THIS):
  私には友達がたくさんいます。友達は優しいです。友達と遊びます。
✓ CORRECT N4 complexity (compound clauses, ability/obligation/desire):
  先月からコンビニでアルバイトを始めたので、お金の大切さを学ぶことができました。
  日本語が上手になりたいので、毎日一時間以上練習することにしています。
  忙しいときは食事を忘れがちですが、健康のためになるべく三食食べるようにしています。
RULE: Every sentence must have AT LEAST one subordinate clause or compound structure.`,

  N3: `Sentence complexity REQUIRED for N3:
✗ TOO SIMPLE (N4 level — avoid):
  SNSを使う人が増えました。問題もあります。
✓ CORRECT N3 complexity (discourse connectors, complex structures):
  スマートフォンの普及とともにSNSを利用する人が急増した一方で、人間関係が複雑になるケースも増えている。
  このような状況を改善するためには、利用時間を管理し、オフラインでの関係も大切にすることが重要ではないでしょうか。
RULE: Use discourse connectors (一方で、ことで、として、において) between ideas.`,

  N2: `Sentence complexity REQUIRED for N2:
✓ CORRECT N2 complexity (formal written, abstract):
  少子高齢化が急速に進む中、労働力不足や社会保障費の増大といった経済的課題だけでなく、地方の過疎化や伝統文化の継承困難など、社会の様々な側面に深刻な影響を及ぼしている。
RULE: Use formal written register. Include abstract nouns (課題、影響、変革). No colloquial expressions.`,

  N1: `Sentence complexity REQUIRED for N1:
✓ CORRECT N1 complexity (academic, multi-clause):
  言語的相対論は人間の思考様式が話す言語によって規定されるという立場をとるが、認知言語学の観点からは思考が言語に先行して存在しうるという見解も提示されており、両者は相互に影響を与え合う複雑な関係にあると考えるのが現在の主流となっている。
RULE: Dense, essay-like prose. Logical progression with hedging (～とされている、～にもかかわらず).`,
};

// ── 各級別文法庫（AI 選用參考）────────────────────────────
const jlptGrammarPools = {
  N5: [
    { pattern: '～は～です', explanation: '表示「～是～」，用於說明主語的身份或狀態。', example: '父は会社員です。', exampleTranslation: '父親是上班族。' },
    { pattern: '～では/じゃありません', explanation: '「是～」的否定形，表示「不是～」。', example: '私は学生ではありません。', exampleTranslation: '我不是學生。' },
    { pattern: '～が あります/います', explanation: '表示存在，「有～（物/人）」，あります用於無生命，います用於有生命。', example: '公園に犬がいます。', exampleTranslation: '公園裡有狗。' },
    { pattern: '～に行く/来る', explanation: '表示「去/來～」，前接場所，說明移動的方向或目的地。', example: '週末は公園に行きます。', exampleTranslation: '週末去公園。' },
    { pattern: '～で（場所）', explanation: '表示動作發生的地點，「在～（地方）做」。', example: '図書館で勉強します。', exampleTranslation: '在圖書館讀書。' },
    { pattern: '～に（時間）', explanation: '表示動作發生的具體時間點，「在～時、～點時」。', example: '毎朝七時に起きます。', exampleTranslation: '每天早上七點起床。' },
    { pattern: '～と（列舉）', explanation: '用「と」連接名詞，完整列舉多個事物，「～和～」。', example: '日本語と英語を勉強しています。', exampleTranslation: '正在學習日語和英語。' },
    { pattern: '～て形（動作連接）', explanation: '用「て形」連接多個動作，表示依序進行，「先做～，再做…」。', example: '顔を洗って、朝ごはんを食べます。', exampleTranslation: '洗臉後吃早餐。' },
    { pattern: '～ています（狀態・習慣）', explanation: '表示正在進行的狀態，或反覆的習慣性動作。', example: '東京に住んでいます。', exampleTranslation: '（現在）住在東京。' },
    { pattern: '～てから', explanation: '表示「做完～之後，再做…」，強調動作的先後順序。', example: '宿題をしてから、テレビを見ます。', exampleTranslation: '做完作業後看電視。' },
    { pattern: '～ので', explanation: '表示原因或理由，語氣較客觀，「因為～所以…」。', example: '雨が降っているので、傘を持って行きます。', exampleTranslation: '因為在下雨，所以帶傘去。' },
    { pattern: '～が、～（逆接）', explanation: '逆接助詞，表示「雖然～但是～」，前後形成轉折關係。', example: '家は小さいですが、とても好きです。', exampleTranslation: '家雖然小，但是非常喜歡。' },
    { pattern: '～こと（名詞化）', explanation: '動詞後接「こと」，將動詞片語名詞化，「做～這件事」。', example: '音楽を聴くことが好きです。', exampleTranslation: '喜歡聽音樂這件事。' },
    { pattern: '～てみる', explanation: '表示嘗試做某件事，「試著做～、嘗試一下～」。', example: '新しい料理を作ってみました。', exampleTranslation: '試著做了新料理。' },
    { pattern: '～になりたい', explanation: '表示希望成為某種狀態或職業，「想成為～」。', example: '将来は先生になりたいです。', exampleTranslation: '將來想成為老師。' },
    { pattern: '～てもらう', explanation: '表示「讓（別人）為自己做～」，著重在接受他人的行為。', example: '友達に教えてもらいました。', exampleTranslation: '讓朋友教了我。' },
    { pattern: '～だけ', explanation: '表示「只有～、僅僅～」，限定範圍或數量。', example: '一つだけ買いました。', exampleTranslation: '只買了一個。' },
    { pattern: '～や～など', explanation: '用「や」部分列舉代表性事物，「など」表示還有其他。', example: '野菜や肉、魚などがあります。', exampleTranslation: '有蔬菜和肉、魚等等。' },
    { pattern: '～かかる', explanation: '表示「花費（時間或費用）」，描述所需的時間或金錢。', example: '駅まで三十分かかります。', exampleTranslation: '到車站要花三十分鐘。' },
    { pattern: '～が好きだ', explanation: '表示「喜歡～」，前接名詞或動詞「こと形」，說明喜好的對象。', example: '音楽を聴くことが好きです。', exampleTranslation: '喜歡聽音樂。' },
  ],
  N4: [
    { pattern: '～ことができる', explanation: '表示能力或可能性，「能夠做～、可以做～」。', example: '漢字を読むことができます。', exampleTranslation: '能夠讀漢字。' },
    { pattern: '～られる（受身）', explanation: '被動形式，表示「被～」或「受到～的動作」。', example: '先生に褒められました。', exampleTranslation: '被老師稱讚了。' },
    { pattern: '～させる（使役）', explanation: '使役形式，表示「讓～做、叫～做」，說話者命令或允許他人做某事。', example: '子どもに野菜を食べさせます。', exampleTranslation: '讓孩子吃蔬菜。' },
    { pattern: '～なければならない', explanation: '表示義務或必要，「必須～、不得不～」。', example: '明日までに宿題を出さなければなりません。', exampleTranslation: '必須在明天前交作業。' },
    { pattern: '～てはいけない', explanation: '表示禁止，「不可以做～、不能～」。', example: 'ここで写真を撮ってはいけません。', exampleTranslation: '不可以在這裡拍照。' },
    { pattern: '～ながら', explanation: '表示兩個動作同時進行，「一邊～一邊…」。', example: '音楽を聴きながら勉強します。', exampleTranslation: '一邊聽音樂一邊讀書。' },
    { pattern: '～と思います', explanation: '表示個人的想法或意見，「我認為～」。', example: 'この映画は面白いと思います。', exampleTranslation: '我認為這部電影很有趣。' },
    { pattern: '～ために', explanation: '表示目的，「為了～」。', example: '健康のために毎日運動します。', exampleTranslation: '為了健康每天運動。' },
    { pattern: '～ようになる', explanation: '表示「變得能～、漸漸開始～」，描述能力或狀態的轉變過程。', example: '日本語が話せるようになりました。', exampleTranslation: '變得能說日語了。' },
    { pattern: '～ことにする', explanation: '表示「決定做～」，說話者主動做出的決定。', example: '毎日日記を書くことにしました。', exampleTranslation: '決定每天寫日記。' },
    { pattern: '～始める', explanation: '接在動詞連用形後，表示「開始做～」，強調動作的開端。', example: '春になると桜が咲き始めます。', exampleTranslation: '一到春天，櫻花就開始盛開。' },
    { pattern: '～がちだ', explanation: '表示「容易～、往往～」，暗示某種不好的傾向經常發生。', example: '忙しいと食事を忘れがちです。', exampleTranslation: '一忙起來就容易忘記吃飯。' },
    { pattern: '～ようにする', explanation: '表示刻意努力做到某事，「盡量～、努力做到～」。', example: '野菜を多く食べるようにしています。', exampleTranslation: '盡量多吃蔬菜。' },
    { pattern: '～だけで', explanation: '表示「只要～就、僅僅～就」，強調條件很少或行動很簡單。', example: '少し練習するだけで上手になります。', exampleTranslation: '只要稍微練習就能進步。' },
    { pattern: '～から（起點）', explanation: '表示時間或場所的起點，「從～（開始）」。', example: '先月から新しい仕事を始めました。', exampleTranslation: '從上個月開始新工作。' },
    { pattern: '～てくる（変化）', explanation: '表示某狀態從過去到現在逐漸發生變化，「漸漸變得～、已經開始～」。', example: '最近、日本語が上手になってきました。', exampleTranslation: '最近日語漸漸變好了。' },
    { pattern: 'その中でも', explanation: '表示「其中（尤其是）」，在眾多事物中特別點出某一項來強調。', example: 'その中でも、夏祭りは特に人気があります。', exampleTranslation: '其中，夏祭尤其受歡迎。' },
    { pattern: '～を通じて', explanation: '表示「透過～、藉由～」，說明學習或獲得某事物的媒介或管道。', example: 'アルバイトを通じて、社会を学びました。', exampleTranslation: '透過打工，學習到了社會。' },
    { pattern: '～を楽しみにする', explanation: '表示「期待～、盼望～」，對某件即將發生的事充滿期待。', example: '毎年、花火大会を楽しみにしています。', exampleTranslation: '每年都期待煙火大會。' },
    { pattern: '～たり～たりする', explanation: '不完全列舉，表示「有時做～、有時做…（等行為）」。', example: '週末は映画を見たり、本を読んだりします。', exampleTranslation: '週末看電影或讀書等。' },
  ],
  N3: [
    { pattern: '～とともに', explanation: '表示「隨著～同時、伴隨著～」，描述兩件事同步發生或進展。', example: '技術の発展とともに、生活が便利になった。', exampleTranslation: '隨著技術的發展，生活變得更方便了。' },
    { pattern: '～一方で', explanation: '表示「另一方面」，呈現對比或相反的情況。', example: 'メリットがある一方で、問題もあります。', exampleTranslation: '有優點，另一方面也有問題。' },
    { pattern: '必ずしも～とは限らない', explanation: '表示「不一定就是～」，用於反駁過度的一般化陳述。', example: '高ければ必ずしも良いとは限りません。', exampleTranslation: '價格高不一定就是好的。' },
    { pattern: '～ではないでしょうか', explanation: '委婉的主張或建議，「不正是～嗎？」，帶有徵求同意的語氣。', example: '環境を守ることが大切ではないでしょうか。', exampleTranslation: '保護環境不正是很重要的嗎？' },
    { pattern: '～だけでなく', explanation: '表示「不只是～，還有…」，追加更多說明，擴大範圍。', example: '語彙力だけでなく、表現力も大切です。', exampleTranslation: '不只是詞彙能力，表達能力也很重要。' },
    { pattern: '～において', explanation: '表示「在～之中、在～方面」，標示特定的場所、時間或領域。', example: '現代社会において、情報は重要です。', exampleTranslation: '在現代社會中，資訊很重要。' },
    { pattern: '～ない手はない', explanation: '雙重否定慣用語，「沒有不～的理由、一定要～」，表示強烈的建議或肯定。', example: 'この機会を使わない手はありません。', exampleTranslation: '沒有不利用這個機會的理由。' },
    { pattern: '～として', explanation: '表示「作為～、以～身份」，說明某事物的性質、立場或用途。', example: '学生として、しっかり勉強すべきです。', exampleTranslation: '作為學生，應該好好讀書。' },
    { pattern: '～と呼ばれる', explanation: '表示「被稱為～、叫做～」，說明某事物的名稱或稱呼。', example: '東京は「世界の大都市」と呼ばれています。', exampleTranslation: '東京被稱為「世界大都市」。' },
    { pattern: '～ごとに', explanation: '表示「每個～、各個～」，表示分別的、逐個的。', example: '季節ごとに異なる料理が楽しめます。', exampleTranslation: '每個季節都能享用不同的料理。' },
    { pattern: '～つもりはない', explanation: '表示「沒打算～、不想～」，用於否定自己的意志或計劃。', example: '最初から行くつもりはありませんでした。', exampleTranslation: '從一開始就沒打算去。' },
    { pattern: '～たびに', explanation: '表示「每次～就…」，描述某動作每次發生時，另一件事也跟著發生。', example: '彼女に会うたびに、元気をもらいます。', exampleTranslation: '每次見到她，就得到力量。' },
    { pattern: 'たとえ～ても', explanation: '表示「即使～也…」，前面假設某不利情況，後面表示結果不受影響。', example: 'たとえ失敗しても、また挑戦します。', exampleTranslation: '即使失敗了，也會再挑戰。' },
    { pattern: '～せいで/せいか', explanation: '「せいで」表示負面原因；「せいか」帶有不確定語氣，「或許是因為～」。', example: '疲れのせいか、集中できませんでした。', exampleTranslation: '或許是因為疲勞，沒能集中。' },
    { pattern: '～ていただけませんか', explanation: '非常禮貌的請求，表示「可以請您幫我～嗎？」，比「てください」更正式。', example: 'もう一度説明していただけませんか。', exampleTranslation: '可以請您再解釋一次嗎？' },
    { pattern: '～ことで', explanation: '表示手段或方法，「透過做～（可以達到某結果）」。', example: '毎日練習することで、上手になります。', exampleTranslation: '透過每天練習，可以變好。' },
    { pattern: '～につながる', explanation: '表示「與～相連、導致～、有助於～」，常用於正面結果。', example: '努力は成功につながります。', exampleTranslation: '努力有助於成功。' },
    { pattern: '～ようになる', explanation: '表示「變得能～、漸漸開始～」，描述能力或狀態的轉變。', example: '練習して、ピアノが弾けるようになりました。', exampleTranslation: '練習後變得能彈鋼琴了。' },
    { pattern: '～ことがある', explanation: '表示「有時候會～、偶爾會～」，描述偶發性事件。', example: '忙しいとき、食事を忘れることがあります。', exampleTranslation: '忙的時候，有時候會忘記吃飯。' },
    { pattern: '～といった', explanation: '表示「像～這樣的、諸如此類的」，用於舉出代表性例子。', example: 'スマートフォンやパソコンといった機器が普及した。', exampleTranslation: '智慧型手機和電腦這樣的設備普及了。' },
  ],
  N2: [
    { pattern: '～つつある', explanation: '表示某動作或狀態正在持續進行中，「正在逐漸～」，強調過程的進行性。', example: '少子化が進みつつあります。', exampleTranslation: '少子化正在持續發展中。' },
    { pattern: '～によれば/によると', explanation: '表示資訊的來源，「根據～」，引述資料或說法。', example: '研究によれば、睡眠不足は健康に悪い。', exampleTranslation: '根據研究，睡眠不足對健康有害。' },
    { pattern: '～においては', explanation: '表示「在～方面、在～的情況下」，標示特定的領域或條件。', example: '現代社会においては、情報リテラシーが重要だ。', exampleTranslation: '在現代社會中，資訊素養很重要。' },
    { pattern: '～とされている', explanation: '表示「被認為是～、據說是～」，用於描述一般性的認識或評價。', example: '運動は健康に良いとされています。', exampleTranslation: '運動被認為對健康有益。' },
    { pattern: '～と言われている', explanation: '表示「據說～、一般認為～」，引述普遍流傳的說法。', example: '早起きは健康に良いと言われています。', exampleTranslation: '據說早起對健康有益。' },
    { pattern: '～と予測される/予想される', explanation: '表示「被預測/預想為～」，對未來狀況進行客觀的推測。', example: '人口は今後も減少すると予測されています。', exampleTranslation: '預測今後人口將持續減少。' },
    { pattern: '～ていく', explanation: '表示「持續往～方向進行、將會不斷～」，強調動作從現在延伸到未來。', example: '技術は今後もさらに発展していくでしょう。', exampleTranslation: '技術今後也將持續發展下去。' },
    { pattern: '～に左右される', explanation: '表示「受到～的影響、取決於～」，說明某事物的結果被外部因素所左右。', example: '農業は天候に左右されやすい。', exampleTranslation: '農業容易受到天氣的影響。' },
    { pattern: '～と並行して', explanation: '表示「與～並行、同步進行」，說明兩件事同時推進。', example: '研究と並行して、製品の開発も進めています。', exampleTranslation: '與研究並行，產品開發也在推進中。' },
    { pattern: '～が求められる', explanation: '表示「被要求～、需要～」，用於描述社會或情況對某事的需求。', example: '現代では高い専門性が求められています。', exampleTranslation: '現代被要求具備高度專業性。' },
    { pattern: 'しかしながら', explanation: '書面語的接續詞，「然而、不過」，比「しかし」更正式，前後形成轉折。', example: 'しかしながら、問題はそう簡単ではありません。', exampleTranslation: '然而，問題沒有那麼簡單。' },
    { pattern: '依然として', explanation: '副詞，表示「仍然、依然」，說明某問題或狀態持續存在、尚未改變。', example: '格差の問題は依然として解決されていません。', exampleTranslation: '差距問題仍然沒有解決。' },
    { pattern: '～も無視できない', explanation: '表示「也不能忽視～」，強調某個同樣重要、不可輕忽的因素。', example: '環境への影響も無視できません。', exampleTranslation: '對環境造成的影響也不能忽視。' },
    { pattern: '～にわたる', explanation: '表示「跨越～、涉及～範圍」，說明某事物的範疇廣泛。', example: '多岐にわたる問題を解決する必要があります。', exampleTranslation: '需要解決涉及多方面的問題。' },
    { pattern: '～に比べて', explanation: '表示「與～相比、比起～」，用於比較兩者之間的差異。', example: '昔に比べて、生活が豊かになりました。', exampleTranslation: '與以前相比，生活變得豐富了。' },
    { pattern: '言うまでもない', explanation: '慣用語，表示「不用說、不言而喻」，強調某事顯而易見。', example: '健康が大切なことは言うまでもありません。', exampleTranslation: '健康很重要，這是不言而喻的。' },
    { pattern: '～を抱える', explanation: '表示「懷有～、面臨著～（困境或問題）」，帶有負擔的含義。', example: '現代人は様々な悩みを抱えています。', exampleTranslation: '現代人面臨著各種煩惱。' },
    { pattern: '～を中心に', explanation: '表示「以～為中心、主要針對～」，說明某行動或現象的主要對象或焦點。', example: '若者を中心に、スマートフォンが普及しています。', exampleTranslation: '以年輕人為中心，智慧型手機正在普及。' },
    { pattern: '～に達する', explanation: '表示「達到～（某數量或程度）」，說明到達了一個特定的水準或界限。', example: '参加者は千人に達しました。', exampleTranslation: '參加者達到了一千人。' },
    { pattern: '類を見ない', explanation: '慣用語，表示「史無前例的、無與倫比的」，強調某事物的獨特性或極端程度。', example: '類を見ない速さで技術が進歩しています。', exampleTranslation: '技術以史無前例的速度在進步。' },
  ],
  N1: [
    { pattern: '～として知られる', explanation: '表示「以～而聞名、被稱為～」，用於說明某事物廣為人知的稱謂或身份。', example: '彼は世界的な科学者として知られています。', exampleTranslation: '他以世界級的科學家而聞名。' },
    { pattern: '～とさえ主張される', explanation: '「さえ」強調程度之極端，「甚至被主張為～」，用於呈現極端觀點。', example: '人工知能は人間を超えるとさえ主張される。', exampleTranslation: '甚至被主張為人工智慧將超越人類。' },
    { pattern: 'いずれにせよ', explanation: '副詞，表示「無論如何、不管怎樣」，用於作出最終結論或轉換觀點。', example: 'いずれにせよ、早急な対応が必要だ。', exampleTranslation: '無論如何，都需要盡快應對。' },
    { pattern: '～という立場をとる', explanation: '表示「採取～的立場、持有～的觀點」，用於學術討論中的立場說明。', example: 'この研究は環境を優先すべきという立場をとる。', exampleTranslation: '這個研究採取應優先考量環境的立場。' },
    { pattern: '～を可能にする', explanation: '表示「使～成為可能、讓～得以實現」，說明某行動或條件帶來的能力開放。', example: '技術の進歩が宇宙旅行を可能にした。', exampleTranslation: '技術的進步使太空旅行成為可能。' },
    { pattern: '～にとどまらず', explanation: '表示「不僅限於～」，說明範圍超越了某個界限，有更廣泛的涵蓋。', example: '問題は個人にとどまらず、社会全体に及んでいる。', exampleTranslation: '問題不僅限於個人，已擴及整個社會。' },
    { pattern: '～と同等の', explanation: '表示「與～同等的、和～一樣的（程度）」，用於程度的比較。', example: '慢性的なストレスは喫煙と同等の健康リスクをもたらす。', exampleTranslation: '慢性壓力帶來與吸菸同等的健康風險。' },
    { pattern: '～の背景には', explanation: '表示「在～的背後原因是、～的背景因素是」，用於分析深層原因。', example: 'この問題の背景には格差の拡大がある。', exampleTranslation: '這個問題的背後原因是差距的擴大。' },
    { pattern: '～ではあるが', explanation: '表示讓步，「雖然～、儘管～」，承認前提的同時提出相反或出乎意料的事實。', example: '困難ではあるが、挑戦する価値がある。', exampleTranslation: '雖然困難，但值得挑戰。' },
    { pattern: 'かつてない', explanation: '表示「前所未有的、史無前例的」，強調某現象達到了從未有過的極端程度。', example: 'かつてないほどの速さで変化が起きている。', exampleTranslation: '變化以前所未有的速度在發生。' },
    { pattern: '～が指摘される', explanation: '表示「被指出～、有研究指出～」，客觀引述觀察或研究所提出的問題。', example: '制度の欠陥が各方面から指摘されている。', exampleTranslation: '制度的缺陷從各方面被指出。' },
    { pattern: '～を凌ぐ', explanation: '表示「超越～、凌駕於～之上」，強調在能力或程度上的優越。', example: '集合知は時に専門家の判断を凌ぐことがある。', exampleTranslation: '集體智慧有時可以超越專家的判斷。' },
    { pattern: '～と見なす', explanation: '表示「視為～、認定為～」，說明主觀判斷或定義。', example: 'この行為は違反と見なされます。', exampleTranslation: '這個行為被視為違規。' },
    { pattern: '～かねない', explanation: '表示「有可能～、說不定會～」，帶有負面的可能性警告。', example: 'このままでは大きな問題になりかねない。', exampleTranslation: '照這樣下去，有可能會釀成大問題。' },
    { pattern: '～した場合', explanation: '表示「在～的情況下、假如～的話」，設定假設條件描述可能發生的結果。', example: '条件が満たされない場合、契約は無効となる。', exampleTranslation: '假如條件未被滿足，合約將無效。' },
    { pattern: '～を保つ', explanation: '表示「維持～、保持～（某狀態不變）」，強調守護現狀的努力。', example: '民主主義の健全性を保つことが重要だ。', exampleTranslation: '維持民主主義的健全性很重要。' },
    { pattern: '～にもかかわらず', explanation: '表示「儘管～、雖然～卻…」，強調前後兩件事之間的反差或矛盾。', example: '努力したにもかかわらず、結果は良くなかった。', exampleTranslation: '儘管努力了，結果卻不理想。' },
    { pattern: '～を浮き彫りにする', explanation: '慣用表達，表示「使～凸顯、清楚呈現～」，帶出隱藏的問題或事實。', example: 'この事件は社会の矛盾を浮き彫りにした。', exampleTranslation: '這個事件凸顯了社會的矛盾。' },
    { pattern: 'いかに～か', explanation: '表示「多麼～、究竟有多～」，強調程度或狀態，帶有感嘆或深入探究的語氣。', example: '言語がいかに思考に影響するかは興味深い問題だ。', exampleTranslation: '語言究竟如何影響思考，是個有趣的問題。' },
    { pattern: '～を示唆する', explanation: '表示「暗示～、啟示～」，隱約指向某個結論或可能性，而非直接斷言。', example: '研究結果は新たな治療法の可能性を示唆している。', exampleTranslation: '研究結果暗示著新療法的可能性。' },
  ],
};

// 各級別文章字數要求
const jlptContentLength = {
  N5: { sentences: 12, hint: 'about 150-180 Japanese characters' },
  N4: { sentences: 14, hint: 'about 200-250 Japanese characters' },
  N3: { sentences: 16, hint: 'about 280-340 Japanese characters' },
  N2: { sentences: 18, hint: 'about 360-420 Japanese characters' },
  N1: { sentences: 20, hint: 'about 420-500 Japanese characters' },
};

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 文法批次分配系統 ──────────────────────────────────────
// 每個級別的文法庫有 20 項，分成 4 批（每批 5 項）
// 第 1 篇：1-5，第 2 篇：6-10，第 3 篇：11-15，第 4 篇：16-20
// 第 5 篇以後：從全部 20 項中隨機選 5 項
const GRAMMAR_BATCH_SIZE = 5;
const GRAMMAR_POOL_SIZE  = 20;
const MAX_BATCHES = GRAMMAR_POOL_SIZE / GRAMMAR_BATCH_SIZE; // = 4

function loadCounters() {
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
    }
  } catch (_) {}
  return { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
}

function saveCounters(counters) {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(counters, null, 2), 'utf-8');
  } catch (_) {}
}

/**
 * 根據該級別目前已生成幾篇，選出本篇要用的 5 項文法
 * 同時把計數器 +1 並持久化
 */
function pickGrammarBatch(level) {
  const counters = loadCounters();
  const count = counters[level] ?? 0;
  const pool  = jlptGrammarPools[level];

  let selected;
  if (count < MAX_BATCHES) {
    // 還在 4 個固定批次內 → 依序取第 count 批
    const start = count * GRAMMAR_BATCH_SIZE;
    selected = pool.slice(start, start + GRAMMAR_BATCH_SIZE);
  } else {
    // 4 批全部用過 → 從全部 20 項隨機選 5
    selected = shuffleArray([...pool]).slice(0, GRAMMAR_BATCH_SIZE);
  }

  // 更新計數器（只在固定批次期間遞增；隨機模式不再計數）
  if (count < MAX_BATCHES) {
    counters[level] = count + 1;
    saveCounters(counters);
  }

  return { selected, batchIndex: count };
}

const VALID_JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

app.post('/api/generate-article', async (req, res) => {
  const { level } = req.body;

  if (!VALID_JLPT_LEVELS.includes(level)) {
    return res.status(400).json({ error: '無效的程度' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 GROQ_API_KEY，請在 server/.env 中填入。' });
  }

  // ✅ 依批次順序選文法（第1篇1-5，第2篇6-10，...，第5篇起隨機5項）
  const { selected: selectedGrammar, batchIndex } = pickGrammarBatch(level);
  const grammarPatterns = selectedGrammar.map(g => `「${g.pattern}」`).join('、');
  const { sentences, hint } = jlptContentLength[level];

  const complexityGuide = jlptComplexityGuide[level];

  const prompt = `You are a JLPT Japanese language teaching expert. Write a ${level}-level Japanese reading article.

━━━ LEVEL & COMPLEXITY ━━━
${jlptLevelDescriptions[level]}

${complexityGuide}

━━━ GRAMMAR PATTERNS TO USE ━━━
Your article content MUST actively demonstrate these ${level} grammar patterns (each must appear at least once in the content):
${selectedGrammar.map((g, i) => `  ${i + 1}. ${g.pattern} — ${g.explanation.split('，')[0]}`).join('\n')}

These are ${level}-level patterns. The sentences containing them should reflect the complexity level described above.

━━━ CONTENT REQUIREMENTS ━━━
• At least ${sentences} sentences. Target length: ${hint}.
• Topic: choose an engaging, specific topic appropriate for ${level}.
• Pure Japanese in "content" — NO English, NO Latin alphabet. Use katakana for loanwords (テレビ、スマートフォン etc).
• Sentence complexity: follow the CORRECT examples above — NOT the simple/wrong style.

━━━ VOCABULARY (10 items) ━━━
• Exactly 10 words/phrases directly from the article content.
• "meaning" → Traditional Chinese (繁體中文).
• "example" → pure Japanese sentence from or inspired by the article.
• "exampleTranslation" → Traditional Chinese (繁體中文).

━━━ QUESTIONS (4 items) ━━━
• 4 comprehension questions based on the article.
• Questions and all 4 options in Japanese.
• answerIndex: 0-3 (integer).

━━━ LANGUAGE RULES ━━━
• Traditional Chinese ONLY: 學(not学) 說(not说) 這(not这) 們(not们) 時(not时) 與(not与) 為(not为)
• No English/Roman letters inside Japanese sentences.

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "日本語タイトル",
  "content": "ここに${level}レベルの日本語の文章を書く。${sentences}文以上、${hint}。",
  "vocabulary": [
    { "kanji": "単語", "furigana": "よみかた", "meaning": "繁體中文", "example": "日本語例句。", "exampleTranslation": "繁體中文翻譯。" }
  ],
  "questions": [
    { "question": "日本語？", "options": ["A", "B", "C", "D"], "answerIndex": 0 }
  ]
}
IMPORTANT: Do NOT include a "grammar" field. Write content that genuinely reflects ${level}-level complexity.`;

  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 6000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0].message.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 回傳格式錯誤，請重試。');

    const parsed = JSON.parse(jsonMatch[0]);

    // ✅ 文法由伺服器直接注入，完全不依賴 AI 生成
    const isRandomMode = batchIndex >= MAX_BATCHES;
    res.json({
      id: `${level}-ai-${Date.now()}`,
      level,
      title: parsed.title,
      content: parsed.content,
      vocabulary: parsed.vocabulary,
      grammar: selectedGrammar,        // ← 伺服器批次分配的 5 項
      grammarBatch: isRandomMode       // 前端可用來顯示批次資訊
        ? `隨機（第 ${batchIndex + 1} 篇）`
        : `第 ${batchIndex + 1} 批（文法 ${batchIndex * 5 + 1}–${batchIndex * 5 + 5}）`,
      questions: parsed.questions,
      isAIGenerated: true,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'AI 生成失敗，請重試。' });
  }
});

// ── TOPIK article generation ─────────────────────────────

// Grammar pool: 80 items per app level (40 per TOPIK level × 2)
// pattern / topikLevel / explanation come from here — AI only generates examples
const topikGrammarPool = {
  '1-2': [
    // ── TOPIK 1급 (40) ──
    { pattern: 'N은/는', topikLevel: 'TOPIK 1급', explanation: '主題助詞，標示句子的主題。' },
    { pattern: 'N이/가', topikLevel: 'TOPIK 1급', explanation: '主語助詞，標示句子的主語。' },
    { pattern: 'N을/를', topikLevel: 'TOPIK 1급', explanation: '受格助詞，標示動作的對象。' },
    { pattern: 'N에', topikLevel: 'TOPIK 1급', explanation: '表示時間或存在場所「在～」。' },
    { pattern: 'N에서', topikLevel: 'TOPIK 1급', explanation: '表示動作發生的地點「在～（做）」。' },
    { pattern: 'N도', topikLevel: 'TOPIK 1급', explanation: '表示「也～」，添加相同資訊。' },
    { pattern: 'N과/와', topikLevel: 'TOPIK 1급', explanation: '表示「和～」，連接兩個名詞。' },
    { pattern: 'N하고', topikLevel: 'TOPIK 1급', explanation: '口語「和～、跟～」，比과/와 更隨意。' },
    { pattern: 'N(으)로', topikLevel: 'TOPIK 1급', explanation: '表示方向「往～」或工具手段「用～」。' },
    { pattern: 'N에게/한테', topikLevel: 'TOPIK 1급', explanation: '表示動作對象「給某人、向某人」。' },
    { pattern: 'N에게서/한테서', topikLevel: 'TOPIK 1급', explanation: '表示來源「從某人那裡」。' },
    { pattern: 'N부터 N까지', topikLevel: 'TOPIK 1급', explanation: '表示範圍「從～到～」。' },
    { pattern: 'N마다', topikLevel: 'TOPIK 1급', explanation: '表示「每一～、每個～」。' },
    { pattern: 'N만', topikLevel: 'TOPIK 1급', explanation: '表示限定「只有～」。' },
    { pattern: 'N(이)나', topikLevel: 'TOPIK 1급', explanation: '表示選擇「或是～」，連接兩個名詞。' },
    { pattern: 'N밖에 + 부정', topikLevel: 'TOPIK 1급', explanation: '表示「只有～」，後面接否定，帶有不滿或遺憾語氣。' },
    { pattern: 'N이에요/예요', topikLevel: 'TOPIK 1급', explanation: '口語「是～」，N 有收音接 이에요，無收音接 예요。' },
    { pattern: 'N이/가 아니에요', topikLevel: 'TOPIK 1급', explanation: '表示「不是～」否定。' },
    { pattern: 'N이/가 있다/없다', topikLevel: 'TOPIK 1급', explanation: '表示存在「有/沒有～」。' },
    { pattern: 'N이/가 되다', topikLevel: 'TOPIK 1급', explanation: '表示「成為～、變成～」。' },
    { pattern: 'V-고', topikLevel: 'TOPIK 1급', explanation: '連接兩個動作，表示「然後」或「又～又～」。' },
    { pattern: 'V-아/어서', topikLevel: 'TOPIK 1급', explanation: '表示原因或先後順序「因為～」「做了～然後」。' },
    { pattern: 'V-고 있다', topikLevel: 'TOPIK 1급', explanation: '表示動作正在進行「正在做～」。' },
    { pattern: 'V-(으)세요', topikLevel: 'TOPIK 1급', explanation: '敬語命令或請求「請～」。' },
    { pattern: 'V-(으)ㅂ시다', topikLevel: 'TOPIK 1급', explanation: '表示共同提議「一起～吧」。' },
    { pattern: 'V-(으)ㄹ까요?', topikLevel: 'TOPIK 1급', explanation: '表示提議或疑問「要不要～？」「～嗎？」。' },
    { pattern: 'V-(으)ㄹ게요', topikLevel: 'TOPIK 1급', explanation: '表示說話者的意志或承諾「我（會）～」。' },
    { pattern: 'V-고 싶다', topikLevel: 'TOPIK 1급', explanation: '表示願望「想要～」。' },
    { pattern: 'V-(으)ㄹ 거예요', topikLevel: 'TOPIK 1급', explanation: '表示未來計畫或推測「將要～」。' },
    { pattern: 'V-지 마세요', topikLevel: 'TOPIK 1급', explanation: '表示禁止「請不要～」。' },
    { pattern: 'V-지 않다', topikLevel: 'TOPIK 1급', explanation: '表示否定「不～」。' },
    { pattern: 'V-아/어도 되다', topikLevel: 'TOPIK 1급', explanation: '表示許可「可以～」。' },
    { pattern: 'V-(으)면 안 되다', topikLevel: 'TOPIK 1급', explanation: '表示禁止「不可以～」。' },
    { pattern: 'V-지 않아도 되다', topikLevel: 'TOPIK 1급', explanation: '表示不必要「不必～、不用～」。' },
    { pattern: 'V-아/어 주다', topikLevel: 'TOPIK 1급', explanation: '表示為他人做某件事「幫某人做～」。' },
    { pattern: 'V-아/어 드리다', topikLevel: 'TOPIK 1급', explanation: '為長輩或地位高者做某事（敬語版 주다）「為您做～」。' },
    { pattern: 'V-는 N', topikLevel: 'TOPIK 1급', explanation: '動詞現在式修飾名詞「正在做～的 N」。' },
    { pattern: 'A-(으)ㄴ N', topikLevel: 'TOPIK 1급', explanation: '形容詞修飾名詞「～的 N」。' },
    { pattern: 'N보다', topikLevel: 'TOPIK 1급', explanation: '表示比較基準「比～」。' },
    { pattern: 'V-지요?/죠?', topikLevel: 'TOPIK 1급', explanation: '表示確認或共鳴「不是～嗎？對吧？」。' },
    // ── TOPIK 2급 (40) ──
    { pattern: 'V-았/었-', topikLevel: 'TOPIK 2급', explanation: '過去式語尾，表示已完成的動作或狀態。' },
    { pattern: 'V-겠-', topikLevel: 'TOPIK 2급', explanation: '表示說話者的意志或對未來的推測「將～、應該～」。' },
    { pattern: 'V-(으)면', topikLevel: 'TOPIK 2급', explanation: '表示條件「如果～的話」。' },
    { pattern: 'V-(으)려고', topikLevel: 'TOPIK 2급', explanation: '表示意圖或目的「為了要～、打算～」。' },
    { pattern: 'V-(으)러 가다/오다', topikLevel: 'TOPIK 2급', explanation: '表示移動目的「去/來做～」。' },
    { pattern: 'V-(으)니까', topikLevel: 'TOPIK 2급', explanation: '表示主觀原因「因為～」，常用於命令・請求。' },
    { pattern: 'V-지만', topikLevel: 'TOPIK 2급', explanation: '表示對比「雖然～但是～」。' },
    { pattern: 'V-는데', topikLevel: 'TOPIK 2급', explanation: '表示背景說明或對比，「～，（但）…」。' },
    { pattern: 'V-(으)면서', topikLevel: 'TOPIK 2급', explanation: '表示兩個動作同時進行「一邊～一邊～」。' },
    { pattern: 'V-거나', topikLevel: 'TOPIK 2급', explanation: '表示選擇「或者～」。' },
    { pattern: 'V-아/어 보다', topikLevel: 'TOPIK 2급', explanation: '表示嘗試「試試看～」。' },
    { pattern: 'V-(으)ㄹ 수 있다/없다', topikLevel: 'TOPIK 2급', explanation: '表示能力或可能性「可以/不能～」。' },
    { pattern: 'V-아/어야 하다', topikLevel: 'TOPIK 2급', explanation: '表示義務或必要「必須～」。' },
    { pattern: 'V-아/어야겠다', topikLevel: 'TOPIK 2급', explanation: '表示說話者決心或必要感「我應該要～了」。' },
    { pattern: 'V-(으)ㄹ 때', topikLevel: 'TOPIK 2급', explanation: '表示時間點「～的時候」。' },
    { pattern: 'V-(으)ㄴ 후에', topikLevel: 'TOPIK 2급', explanation: '表示完成後「做～之後」。' },
    { pattern: 'V-기 전에', topikLevel: 'TOPIK 2급', explanation: '表示發生前「做～之前」。' },
    { pattern: 'V-는 동안', topikLevel: 'TOPIK 2급', explanation: '表示持續期間「在～的過程中/期間」。' },
    { pattern: 'V-기', topikLevel: 'TOPIK 2급', explanation: '將動詞名詞化「做～（這件事）」，較口語。' },
    { pattern: 'V-기로 하다', topikLevel: 'TOPIK 2급', explanation: '表示決定「決定要～」。' },
    { pattern: 'V-(으)면 되다', topikLevel: 'TOPIK 2급', explanation: '表示只需如此就好「只要～就行了」。' },
    { pattern: 'V-지 못하다', topikLevel: 'TOPIK 2급', explanation: '表示能力不足的否定「沒辦法～、不能～」。' },
    { pattern: 'A/V-아/어지다', topikLevel: 'TOPIK 2급', explanation: '表示狀態的自然變化「變得～」。' },
    { pattern: 'V-(으)ㄴ N', topikLevel: 'TOPIK 2급', explanation: '動詞過去式修飾名詞「做過～的 N」。' },
    { pattern: 'N에 대해(서)', topikLevel: 'TOPIK 2급', explanation: '表示話題「關於～、有關～」。' },
    { pattern: 'N에 관해(서)', topikLevel: 'TOPIK 2급', explanation: '表示「關於～」，比에 대해 更書面。' },
    { pattern: 'N처럼/같이', topikLevel: 'TOPIK 2급', explanation: '表示比喻「像～一樣」。' },
    { pattern: 'N만큼', topikLevel: 'TOPIK 2급', explanation: '表示程度「和～一樣多、達到～程度」。' },
    { pattern: 'N(으)로', topikLevel: 'TOPIK 2급', explanation: '表示手段・材料・原因「用～、因為～」。' },
    { pattern: 'V-기 쉽다/어렵다', topikLevel: 'TOPIK 2급', explanation: '表示做某事的難易度「容易/難以做～」。' },
    { pattern: 'V-아/어도', topikLevel: 'TOPIK 2급', explanation: '表示讓步「即使～、就算～也」。' },
    { pattern: 'V-자마자', topikLevel: 'TOPIK 2급', explanation: '表示立即緊接「一～就～、剛～就」。' },
    { pattern: 'V-게', topikLevel: 'TOPIK 2급', explanation: '將形容詞或動詞副詞化「以～方式、使得～」。' },
    { pattern: 'N뿐', topikLevel: 'TOPIK 2급', explanation: '表示限定「只有N、僅僅N」。' },
    { pattern: 'V-(으)ㄹ 것 같다', topikLevel: 'TOPIK 2급', explanation: '表示對未來的推測「好像會～、感覺要～」。' },
    { pattern: 'V-더라도', topikLevel: 'TOPIK 2급', explanation: '表示假設讓步「即使～也、就算～也」（假設情況）。' },
    { pattern: 'N에 따르면', topikLevel: 'TOPIK 2급', explanation: '表示資訊來源「根據～」。' },
    { pattern: 'V-아/어서인지', topikLevel: 'TOPIK 2급', explanation: '不確定推測原因「也許是因為～」。' },
    { pattern: 'V-네요', topikLevel: 'TOPIK 2급', explanation: '表示說話者的發現或感嘆「原來如此！、真是～呢」。' },
    { pattern: 'V-(으)ㄹ 줄 모르다', topikLevel: 'TOPIK 2급', explanation: '表示「不知道怎麼做～、不會～」（技能缺乏）。' },
  ],
  '3-4': [
    // ── TOPIK 3급 (40) ──
    { pattern: 'V-는 것', topikLevel: 'TOPIK 3급', explanation: '將動詞名詞化，表示「做～這件事」（書面）。' },
    { pattern: 'V-(으)ㄴ/는 것 같다', topikLevel: 'TOPIK 3급', explanation: '表示推測或不確定「好像～」。' },
    { pattern: 'V-아/어 있다', topikLevel: 'TOPIK 3급', explanation: '表示動作結果的持續狀態（靜態）。' },
    { pattern: 'V-게 되다', topikLevel: 'TOPIK 3급', explanation: '表示自然發生的變化「變得～、結果～了」。' },
    { pattern: 'V-(으)ㄹ 줄 알다', topikLevel: 'TOPIK 3급', explanation: '表示「會做～」（技能）。' },
    { pattern: 'V-기 때문에', topikLevel: 'TOPIK 3급', explanation: '書面語原因「因為～」，比니까更正式。' },
    { pattern: 'V-다가', topikLevel: 'TOPIK 3급', explanation: '表示動作中途轉換「正做著A，然後B」。' },
    { pattern: 'V-도록', topikLevel: 'TOPIK 3급', explanation: '表示目的或達到的程度「為了使～」「到～的程度」。' },
    { pattern: 'V-아/어 버리다', topikLevel: 'TOPIK 3급', explanation: '表示動作完結，帶遺憾或一了百了的語氣。' },
    { pattern: 'V-고 나서', topikLevel: 'TOPIK 3급', explanation: '強調完成後再進行下一步「做完～之後」。' },
    { pattern: 'V-(으)ㄴ 지', topikLevel: 'TOPIK 3급', explanation: '表示從動作完成至今的時間「做～有多久了」。' },
    { pattern: 'V-는 중이다', topikLevel: 'TOPIK 3급', explanation: '表示正在進行中「正在做～」。' },
    { pattern: 'V-(으)ㄹ지도 모르다', topikLevel: 'TOPIK 3급', explanation: '表示不確定推測「說不定～、也許～」。' },
    { pattern: 'V-던', topikLevel: 'TOPIK 3급', explanation: '表示過去的回想或未完成習慣「曾經～的」。' },
    { pattern: 'N에 따라', topikLevel: 'TOPIK 3급', explanation: '表示根據或隨著變化「根據～、隨著～」。' },
    { pattern: 'V-기 위해(서)', topikLevel: 'TOPIK 3급', explanation: '表示目的「為了做～」（書面・正式）。' },
    { pattern: 'V-(으)ㄹ 예정이다', topikLevel: 'TOPIK 3급', explanation: '表示已計畫好的未來事項「預定要～」。' },
    { pattern: 'V-아/어 놓다', topikLevel: 'TOPIK 3급', explanation: '表示動作完成後狀態保留「做好放著～」。' },
    { pattern: 'V-는데도', topikLevel: 'TOPIK 3급', explanation: '表示「雖然～但（還是）」，帶有意外或不滿語氣。' },
    { pattern: 'V-(으)ㄹ 때마다', topikLevel: 'TOPIK 3급', explanation: '表示「每次～的時候」。' },
    { pattern: 'V-아/어 보이다', topikLevel: 'TOPIK 3급', explanation: '表示外表上看起來「看起來～」。' },
    { pattern: 'V-는 대로', topikLevel: 'TOPIK 3급', explanation: '表示「一～就～」或「按照～」。' },
    { pattern: 'N(으)로 인해(서)', topikLevel: 'TOPIK 3급', explanation: '書面語「因為～、由於～」（原因）。' },
    { pattern: 'V-(으)려면', topikLevel: 'TOPIK 3급', explanation: '表示為了達成某目的所需條件「如果要～的話」。' },
    { pattern: 'V-는지', topikLevel: 'TOPIK 3급', explanation: '表示間接疑問「是否～、怎麼～」（嵌入疑問）。' },
    { pattern: 'V-아/어야 되다', topikLevel: 'TOPIK 3급', explanation: '表示義務「必須～、得～」（口語版 야 하다）。' },
    { pattern: 'V-고 싶어하다', topikLevel: 'TOPIK 3급', explanation: '表示第三人稱的願望「（他）想要～」。' },
    { pattern: 'V-기는 하다', topikLevel: 'TOPIK 3급', explanation: '表示承認某事「確實是～（但）」，帶讓步語氣。' },
    { pattern: 'V-다 보면', topikLevel: 'TOPIK 3급', explanation: '表示「如果持續做的話，就會～」。' },
    { pattern: 'V-다 보니', topikLevel: 'TOPIK 3급', explanation: '表示「做著做著，結果發現～」。' },
    { pattern: 'V-아/어 두다', topikLevel: 'TOPIK 3급', explanation: '表示事先做好準備「先做好～放著」。' },
    { pattern: 'N에 걸쳐', topikLevel: 'TOPIK 3급', explanation: '表示範圍延伸「跨越～、遍及～」。' },
    { pattern: 'V-(으)ㄹ 것이다', topikLevel: 'TOPIK 3급', explanation: '書面語未來或推測「將會～」（比거예요更正式）。' },
    { pattern: 'A/V-다고 하다', topikLevel: 'TOPIK 3급', explanation: '間接引用「（說）～」，轉述他人的話。' },
    { pattern: 'N을/를 위해(서)', topikLevel: 'TOPIK 3급', explanation: '表示受益對象或目的「為了N（利益）」。' },
    { pattern: 'V-(으)므로', topikLevel: 'TOPIK 3급', explanation: '書面語原因「因此～、由於～」（最正式）。' },
    { pattern: 'V-면서도', topikLevel: 'TOPIK 3급', explanation: '表示「雖然同時在做，但卻…」矛盾對比。' },
    { pattern: 'N을/를 통해(서)', topikLevel: 'TOPIK 3급', explanation: '表示手段或媒介「透過～、藉由～」。' },
    { pattern: 'V-(으)ㄴ/는 이상', topikLevel: 'TOPIK 3급', explanation: '表示「既然～、在～的前提下」。' },
    { pattern: 'V-자마자', topikLevel: 'TOPIK 3급', explanation: '表示立即緊接「一～就～」（強調即時性）。' },
    // ── TOPIK 4급 (40) ──
    { pattern: 'V-(으)ㄹ 텐데', topikLevel: 'TOPIK 4급', explanation: '表示推測帶出後續說明「應該會～，但…」。' },
    { pattern: 'V-고자', topikLevel: 'TOPIK 4급', explanation: '書面正式語，表示意圖目的「為了～、意圖～」。' },
    { pattern: 'V-(으)ㄴ/는 반면에', topikLevel: 'TOPIK 4급', explanation: '表示對比「反面，另一方面～」。' },
    { pattern: 'V-(으)ㄹ 뿐만 아니라', topikLevel: 'TOPIK 4급', explanation: '表示「不僅～而且～」，遞進關係。' },
    { pattern: 'V-(으)ㄴ/는 편이다', topikLevel: 'TOPIK 4급', explanation: '表示傾向「比較偏向～，算是～」。' },
    { pattern: 'V-게 하다', topikLevel: 'TOPIK 4급', explanation: '表示使役「讓/使某人做～」。' },
    { pattern: 'V-(으)ㄹ 만하다', topikLevel: 'TOPIK 4급', explanation: '表示「值得～、有必要～」。' },
    { pattern: 'V-더니', topikLevel: 'TOPIK 4급', explanation: '表示說話者過去觀察到的結果「之前看到～，結果～」。' },
    { pattern: 'V-는 한', topikLevel: 'TOPIK 4급', explanation: '表示條件「只要～（就）…」。' },
    { pattern: 'N에 비해(서)', topikLevel: 'TOPIK 4급', explanation: '表示比較「相比於～、與～相比」。' },
    { pattern: 'N을/를 비롯해(서)', topikLevel: 'TOPIK 4급', explanation: '表示「以～為首，包括～」。' },
    { pattern: 'N에 의하면', topikLevel: 'TOPIK 4급', explanation: '表示引用資訊來源「根據～（的說法）」。' },
    { pattern: 'V-아/어야만', topikLevel: 'TOPIK 4급', explanation: '表示強調條件「只有～才…」。' },
    { pattern: 'V-고 보니', topikLevel: 'TOPIK 4급', explanation: '表示「做了之後才發現/意識到」。' },
    { pattern: 'V-아/어 가다/오다', topikLevel: 'TOPIK 4급', explanation: '表示動作或狀態逐漸持續進行（方向性）。' },
    { pattern: 'V-(으)ㄹ 뻔하다', topikLevel: 'TOPIK 4급', explanation: '表示「差點就～了」（幸好沒發生）。' },
    { pattern: 'V-(으)ㄹ 정도로', topikLevel: 'TOPIK 4급', explanation: '表示程度「到了～的程度」。' },
    { pattern: 'N치고는', topikLevel: 'TOPIK 4급', explanation: '表示「對於N來說（出乎意料地）」。' },
    { pattern: 'N(으)로서', topikLevel: 'TOPIK 4급', explanation: '表示立場或身份「作為～、以～身份」。' },
    { pattern: 'V-아/어 봤자', topikLevel: 'TOPIK 4급', explanation: '表示「就算～也沒用、白費～」。' },
    { pattern: 'V-기 나름이다', topikLevel: 'TOPIK 4급', explanation: '表示「全看怎麼做、取決於～」。' },
    { pattern: 'N을/를 계기로', topikLevel: 'TOPIK 4급', explanation: '表示契機「以～為契機、藉此機會」。' },
    { pattern: 'N에 앞서', topikLevel: 'TOPIK 4급', explanation: '表示「在～之前、先於～」（書面語）。' },
    { pattern: 'V-(으)ㄹ 겸', topikLevel: 'TOPIK 4급', explanation: '表示一石二鳥「順便～、兼而～」。' },
    { pattern: 'V-는 한편', topikLevel: 'TOPIK 4급', explanation: '表示「一方面～，同時另一方面」。' },
    { pattern: 'V-다는 점에서', topikLevel: 'TOPIK 4급', explanation: '表示「從～這一點來看、在～方面」。' },
    { pattern: 'N을/를 막론하고', topikLevel: 'TOPIK 4급', explanation: '表示「不論～、無論～」。' },
    { pattern: 'V-(으)ㄹ 수도 있다', topikLevel: 'TOPIK 4급', explanation: '表示可能性「也有可能～、說不定會～」。' },
    { pattern: 'V-아/어서는 안 되다', topikLevel: 'TOPIK 4급', explanation: '強調禁止「絕不可以～」。' },
    { pattern: 'N에 비추어', topikLevel: 'TOPIK 4급', explanation: '表示依據「鑑於～、參照～」（書面語）。' },
    { pattern: 'N에 의해', topikLevel: 'TOPIK 4급', explanation: '表示被動作者或原因「被～、由～」（書面語）。' },
    { pattern: 'V-(으)ㄴ/는 나머지', topikLevel: 'TOPIK 4급', explanation: '表示過度導致後果「因為過於～而」。' },
    { pattern: 'V-다못해', topikLevel: 'TOPIK 4급', explanation: '表示到了極點「忍無可忍地、到最後」。' },
    { pattern: 'N에 힘입어', topikLevel: 'TOPIK 4급', explanation: '表示「藉助～、多虧了～」。' },
    { pattern: 'V-건대', topikLevel: 'TOPIK 4급', explanation: '書面語「依我之見、我認為」，引出主觀判斷。' },
    { pattern: 'V-고도', topikLevel: 'TOPIK 4급', explanation: '表示「做了～之後還～」，帶意外或強調語氣。' },
    { pattern: 'V-(으)ㄹ 바에야', topikLevel: 'TOPIK 4급', explanation: '表示「既然要～，不如…」（比較兩者）。' },
    { pattern: 'V-는가', topikLevel: 'TOPIK 4급', explanation: '正式書面疑問語尾「是否～、有沒有～」。' },
    { pattern: 'V-는가 하면', topikLevel: 'TOPIK 4급', explanation: '表示「有時～，有時也…」，描述對比共存。' },
    { pattern: 'V-(으)므로', topikLevel: 'TOPIK 4급', explanation: '書面語「因此～、由於～」（正式原因）。' },
    // ── TOPIK 3급 追加 (20) ──
    { pattern: 'V-는 척하다', topikLevel: 'TOPIK 3급', explanation: '裝作做～、假裝。' },
    { pattern: 'N답다', topikLevel: 'TOPIK 3급', explanation: '具有N應有的特質、像個N樣子的。' },
    { pattern: 'V-아/어 오다', topikLevel: 'TOPIK 3급', explanation: '一直～過來（表示持續到現在）。' },
    { pattern: 'V-았/었으면 좋겠다', topikLevel: 'TOPIK 3급', explanation: '要是～就好了（願望）。' },
    { pattern: 'V-다니', topikLevel: 'TOPIK 3급', explanation: '竟然～！表示對事實的驚訝或意外。' },
    { pattern: 'V-는 듯하다', topikLevel: 'TOPIK 3급', explanation: '似乎～、好像～（推測語氣）。' },
    { pattern: 'V-곤 하다', topikLevel: 'TOPIK 3급', explanation: '常常會～、習慣性地（過去或現在習慣）。' },
    { pattern: 'V-(으)ㄹ까 봐', topikLevel: 'TOPIK 3급', explanation: '擔心萬一～（擔憂某事發生）。' },
    { pattern: 'V-지 않으면 안 되다', topikLevel: 'TOPIK 3급', explanation: '不～不行（雙重否定表必要）。' },
    { pattern: 'N(이)라도', topikLevel: 'TOPIK 3급', explanation: '就算是N也好（退而求其次）。' },
    { pattern: 'N조차', topikLevel: 'TOPIK 3급', explanation: '就連N都～（強調極端情況）。' },
    { pattern: 'V-(으)려고 하다', topikLevel: 'TOPIK 3급', explanation: '快要～、正打算～（即將發生）。' },
    { pattern: 'V-(으)ㄹ 줄 알았다', topikLevel: 'TOPIK 3급', explanation: '以為會～（與事實不符的預期）。' },
    { pattern: 'N에 지나지 않다', topikLevel: 'TOPIK 3급', explanation: '不過是N而已（強調程度低）。' },
    { pattern: 'N만 해도', topikLevel: 'TOPIK 3급', explanation: '光是N就（以舉例說明程度）。' },
    { pattern: 'V-는 데다가', topikLevel: 'TOPIK 3급', explanation: '而且還～（在已有基礎上再加）。' },
    { pattern: 'V-(으)ㄹ 겨를도 없다', topikLevel: 'TOPIK 3급', explanation: '連～空都沒有（太忙了沒時間）。' },
    { pattern: 'V-기도 전에', topikLevel: 'TOPIK 3급', explanation: '還沒來得及～就（在完成之前就）。' },
    { pattern: 'V-기는커녕', topikLevel: 'TOPIK 3급', explanation: '別說～了（連更低標準都做不到）。' },
    { pattern: 'N에 따라서', topikLevel: 'TOPIK 3급', explanation: '根據N而不同（隨N變化）。' },
    // ── TOPIK 4급 追加 (20) ──
    { pattern: 'V-아/어 내다', topikLevel: 'TOPIK 4급', explanation: '成功做到、達成（克服困難後完成）。' },
    { pattern: 'V-기 십상이다', topikLevel: 'TOPIK 4급', explanation: '很容易就～、十之八九會（容易發生的傾向）。' },
    { pattern: 'V-(으)ㄹ 여지가 있다', topikLevel: 'TOPIK 4급', explanation: '有餘地/可能性～。' },
    { pattern: 'N에 의한', topikLevel: 'TOPIK 4급', explanation: '由～引起的、基於～的（書面語原因修飾）。' },
    { pattern: 'V-다가는', topikLevel: 'TOPIK 4급', explanation: '如果繼續這樣～就會（警告後果）。' },
    { pattern: 'V-기도 하다', topikLevel: 'TOPIK 4급', explanation: '有時也會～、既～也～（並列或強調）。' },
    { pattern: 'V-는 측면에서', topikLevel: 'TOPIK 4급', explanation: '從～的角度/方面看（書面說理）。' },
    { pattern: 'N에 관계없이', topikLevel: 'TOPIK 4급', explanation: '與N無關、不管N（無差別）。' },
    { pattern: 'V-(으)ㄹ 것으로 보인다', topikLevel: 'TOPIK 4급', explanation: '看起來會～（客觀判斷、書面語推測）。' },
    { pattern: 'V-(으)ㄴ/는 데 반해', topikLevel: 'TOPIK 4급', explanation: '相反地、另一方面（對比）。' },
    { pattern: 'V-더라고요', topikLevel: 'TOPIK 4급', explanation: '親眼所見的事實「我發現～呢」（親身體驗的感嘆）。' },
    { pattern: 'V-는 경향이 있다', topikLevel: 'TOPIK 4급', explanation: '有～的傾向（行為模式）。' },
    { pattern: 'V-는 것과 달리', topikLevel: 'TOPIK 4급', explanation: '與～不同（對比預期）。' },
    { pattern: 'V-는 것으로 나타났다', topikLevel: 'TOPIK 4급', explanation: '（調查/研究）顯示～（客觀報導）。' },
    { pattern: 'V-는 데 도움이 되다', topikLevel: 'TOPIK 4급', explanation: '對做～有幫助。' },
    { pattern: 'V-(으)면 그만이다', topikLevel: 'TOPIK 4급', explanation: '只要～就好了、做～就夠了。' },
    { pattern: 'N에 걸맞은', topikLevel: 'TOPIK 4급', explanation: '與N相稱的、配得上N的。' },
    { pattern: 'V-기가 쉽지 않다', topikLevel: 'TOPIK 4급', explanation: '～並不容易（委婉表達困難）。' },
    { pattern: 'V-는 줄도 모르고', topikLevel: 'TOPIK 4급', explanation: '不知不覺地（沒意識到）。' },
    { pattern: 'V-아/어 오고 있다', topikLevel: 'TOPIK 4급', explanation: '一直持續到現在（從過去到現在的連續）。' },
  ],
  '5-6': [
    // ── TOPIK 5급 (40) ──
    { pattern: 'V-(으)ㄹ수록', topikLevel: 'TOPIK 5급', explanation: '表示程度遞進「越～越～」。' },
    { pattern: 'V-음으로써', topikLevel: 'TOPIK 5급', explanation: '書面語「藉由做～（的方式）」。' },
    { pattern: 'V-는 바람에', topikLevel: 'TOPIK 5급', explanation: '表示突發負面原因「因為突然～而（導致不好的結果）」。' },
    { pattern: 'V-(으)ㄹ 수밖에 없다', topikLevel: 'TOPIK 5급', explanation: '表示「只能～、別無選擇」。' },
    { pattern: 'V-기 마련이다', topikLevel: 'TOPIK 5급', explanation: '表示理所當然的必然性「理所當然會～」。' },
    { pattern: 'V-고 말다', topikLevel: 'TOPIK 5급', explanation: '表示最終發生不好的結果（遺憾語氣）「最終還是～了」。' },
    { pattern: 'V-(으)ㄴ/는 탓에', topikLevel: 'TOPIK 5급', explanation: '表示責怪原因（負面）「都怪～，因此～」。' },
    { pattern: 'V-에도 불구하고', topikLevel: 'TOPIK 5급', explanation: '表示讓步「儘管～，仍然～」。' },
    { pattern: 'V-느라고', topikLevel: 'TOPIK 5급', explanation: '表示「因為忙著做A而（無法做B或導致B）」。' },
    { pattern: 'V-는 셈이다', topikLevel: 'TOPIK 5급', explanation: '表示「等於是～、算是～」。' },
    { pattern: 'V-다시피', topikLevel: 'TOPIK 5급', explanation: '表示「正如（你）所知/所見」，引用雙方共知事實。' },
    { pattern: 'V-(으)ㄹ 지경이다', topikLevel: 'TOPIK 5급', explanation: '表示「到了快要～的地步」（程度極端）。' },
    { pattern: 'N을/를 둘러싼', topikLevel: 'TOPIK 5급', explanation: '表示「圍繞著～的（議題、爭論）」。' },
    { pattern: 'V-는 한편', topikLevel: 'TOPIK 5급', explanation: '表示「一方面～，另一方面～」，同時具兩種面向。' },
    { pattern: 'V-(으)ㄹ 나위가 없다', topikLevel: 'TOPIK 5급', explanation: '表示「無需多說、自不待言」（程度最高）。' },
    { pattern: 'V-(으)ㄴ/는 가운데', topikLevel: 'TOPIK 5급', explanation: '書面語「在～的情況下、在～之中」。' },
    { pattern: 'V-고도 남다', topikLevel: 'TOPIK 5급', explanation: '表示「綽綽有餘、不只如此」。' },
    { pattern: 'V-노라면', topikLevel: 'TOPIK 5급', explanation: '表示「隨著持續做～，就會～」（過程必然性）。' },
    { pattern: 'N에 따른', topikLevel: 'TOPIK 5급', explanation: '書面語「隨著～的、根據～所產生的」（名詞修飾）。' },
    { pattern: 'V-건만', topikLevel: 'TOPIK 5급', explanation: '書面語「雖然～，但」（有遺憾的對比）。' },
    { pattern: 'V-는 마당에', topikLevel: 'TOPIK 5급', explanation: '表示「在這種情況下、事到如今」。' },
    { pattern: 'V-(으)ㄹ 뿐더러', topikLevel: 'TOPIK 5급', explanation: '「不僅～而且～」（比 뿐만 아니라 更書面強調）。' },
    { pattern: 'N(으)로 말미암아', topikLevel: 'TOPIK 5급', explanation: '書面語「由於～、因～而起」（原因，書面正式）。' },
    { pattern: 'V-는 한이 있어도', topikLevel: 'TOPIK 5급', explanation: '表示「就算～也」（最極端的讓步）。' },
    { pattern: 'V-아/어야 할', topikLevel: 'TOPIK 5급', explanation: '書面語「應該要做的～」（義務的名詞修飾）。' },
    { pattern: 'N을/를 두고', topikLevel: 'TOPIK 5급', explanation: '表示「關於～、針對～」（議論或競爭對象）。' },
    { pattern: 'V-고자 하다', topikLevel: 'TOPIK 5급', explanation: '書面語「意圖要～、打算～」（比 고자 更完整）。' },
    { pattern: 'V-(으)ㄹ 나름이다', topikLevel: 'TOPIK 5급', explanation: '表示「完全取決於、全看～」。' },
    { pattern: 'N을/를 위시하여', topikLevel: 'TOPIK 5급', explanation: '書面語「以～為首（包括）」（比 비롯하여 更正式）。' },
    { pattern: 'V-아/어서야', topikLevel: 'TOPIK 5급', explanation: '表示「在～之後才（終於）」（時間條件）。' },
    { pattern: 'V-(으)ㄴ/는 셈 치다', topikLevel: 'TOPIK 5급', explanation: '表示「就當作是～」（假設接受）。' },
    { pattern: 'V-다는 명목으로', topikLevel: 'TOPIK 5급', explanation: '表示「以～為由、打著～的名義」。' },
    { pattern: 'N에 즈음하여', topikLevel: 'TOPIK 5급', explanation: '書面語「在～之際、於～之時」（正式場合）。' },
    { pattern: 'V-자니', topikLevel: 'TOPIK 5급', explanation: '表示「要～的話又覺得難」（兩難處境）。' },
    { pattern: 'N에 걸맞게', topikLevel: 'TOPIK 5급', explanation: '表示「與～相稱地、配合～地」。' },
    { pattern: 'V-는 바', topikLevel: 'TOPIK 5급', explanation: '書面語「～之所在、～之處」（正式說明依據）。' },
    { pattern: 'V-고 말고', topikLevel: 'TOPIK 5급', explanation: '表示「當然、那還用說」（強烈肯定）。' },
    { pattern: 'V-(으)ㄹ진대', topikLevel: 'TOPIK 5급', explanation: '書面語「既然是～，就應當…」（邏輯推論）。' },
    { pattern: 'V-려야 V-(으)ㄹ 수 없다', topikLevel: 'TOPIK 5급', explanation: '表示「就算想～也不能～」（能力上無法）。' },
    { pattern: 'V-(으)ㄹ 것을 모르고', topikLevel: 'TOPIK 5급', explanation: '表示「不知道會～而（做了某事）」（無知導致）。' },
    // ── TOPIK 6급 (40) ──
    { pattern: 'V-(으)ㄹ 따름이다', topikLevel: 'TOPIK 6급', explanation: '書面語「只能～、僅此而已」（表達無奈或謙遜）。' },
    { pattern: 'V-기에', topikLevel: 'TOPIK 6급', explanation: '書面正式「因為～」，說明原因。' },
    { pattern: 'V-되', topikLevel: 'TOPIK 6급', explanation: '書面正式「但是～」，表示對比或限制。' },
    { pattern: 'V-거니와', topikLevel: 'TOPIK 6급', explanation: '書面語「不僅～而且～」，遞進關係（較正式）。' },
    { pattern: 'V-(으)ㄹ망정', topikLevel: 'TOPIK 6급', explanation: '表示讓步「雖然～但…」（承認前提，後接強烈對比）。' },
    { pattern: 'V-는가 하면', topikLevel: 'TOPIK 6급', explanation: '表示「有時～，有時也…」，描述對比共存情況。' },
    { pattern: 'V-(으)ㄹ 법하다', topikLevel: 'TOPIK 6급', explanation: '表示「按理說應該～、理應如此」。' },
    { pattern: 'V-(으)ㄹ 리(가) 없다', topikLevel: 'TOPIK 6급', explanation: '表示強烈否定推測「不可能會～」。' },
    { pattern: 'N에 의거하여', topikLevel: 'TOPIK 6급', explanation: '正式書面語「依據～、按照～」（法律、規定）。' },
    { pattern: 'V-아/어야 마땅하다', topikLevel: 'TOPIK 6급', explanation: '表示「理應～、應當～」（道義上）。' },
    { pattern: 'V-아/어 마지않다', topikLevel: 'TOPIK 6급', explanation: '書面語「由衷地～、不由得～」（強調內心真誠）。' },
    { pattern: 'V-(으)ㄹ 지언정', topikLevel: 'TOPIK 6급', explanation: '書面語讓步「就算～也」（正式版的 -아/어도）。' },
    { pattern: 'N을/를 불문하고', topikLevel: 'TOPIK 6급', explanation: '書面語「不問～、無論～」（比 막론하고 更正式）。' },
    { pattern: 'V-(으)련마는', topikLevel: 'TOPIK 6급', explanation: '書面語「本想～的，但…」（遺憾的反事實）。' },
    { pattern: 'V-자면', topikLevel: 'TOPIK 6급', explanation: '書面語「如果要～的話」（列出條件）。' },
    { pattern: 'V-노라고', topikLevel: 'TOPIK 6급', explanation: '書面語「雖然一直在做～，但」（強調努力卻未達預期）。' },
    { pattern: 'V-(으)ㄴ/는 즉', topikLevel: 'TOPIK 6급', explanation: '書面語「也就是說、換言之」（說明或下定義）。' },
    { pattern: 'V-다는 데 있다', topikLevel: 'TOPIK 6급', explanation: '書面語「重點在於～、問題在於～」（指出核心）。' },
    { pattern: 'N에 입각하여', topikLevel: 'TOPIK 6급', explanation: '書面語「立足於～、基於～」（邏輯立場）。' },
    { pattern: 'V-아/어서는', topikLevel: 'TOPIK 6급', explanation: '表示「如果是這樣做的話（就有問題）」（否定條件）。' },
    { pattern: 'V-(으)ㄹ새', topikLevel: 'TOPIK 6급', explanation: '書面語「在做某事的間隙、趁著～」。' },
    { pattern: 'N에 즈음한', topikLevel: 'TOPIK 6급', explanation: '書面語「在～之際」（名詞修飾形）。' },
    { pattern: 'V-는바', topikLevel: 'TOPIK 6급', explanation: '書面語「基於此、因此」（表明根據後引出結論）。' },
    { pattern: 'V-(으)ㄹ 수가 없다', topikLevel: 'TOPIK 6급', explanation: '比 수 없다 更強調的「根本不可能～、怎麼也不能～」。' },
    { pattern: 'V-고 보면', topikLevel: 'TOPIK 6급', explanation: '書面語「做過之後回頭看、仔細想想」。' },
    { pattern: 'N이/가 아닌 한', topikLevel: 'TOPIK 6급', explanation: '表示「除非是～，否則不…」（排除條件）。' },
    { pattern: 'V-는 둥 마는 둥', topikLevel: 'TOPIK 6급', explanation: '表示「做也不是，不做也不是的樣子；敷衍地」。' },
    { pattern: 'V-(으)ㄹ 줄이야', topikLevel: 'TOPIK 6급', explanation: '表示意外驚訝「沒想到竟然會～」。' },
    { pattern: 'V-기로서니', topikLevel: 'TOPIK 6급', explanation: '書面語「就算是～（也未免太…）」（讓步+批評）。' },
    { pattern: 'V-다 못해', topikLevel: 'TOPIK 6급', explanation: '表示程度到了極點「～到了受不了的地步」。' },
    { pattern: 'N이/가 어디 있겠는가', topikLevel: 'TOPIK 6급', explanation: '反問強調「哪裡會有～呢（根本沒有）」。' },
    { pattern: 'V-(으)ㄹ 만도 하다', topikLevel: 'TOPIK 6급', explanation: '表示「也難怪～、也情有可原」（理解對方行為）。' },
    { pattern: 'V-았/었더라면', topikLevel: 'TOPIK 6급', explanation: '表示反事實假設「要是當時～的話（就好了）」。' },
    { pattern: 'V-는 것도 아니고', topikLevel: 'TOPIK 6급', explanation: '表示「既不是～，又不是…」（模糊兩難狀態）。' },
    { pattern: 'N(이)야말로', topikLevel: 'TOPIK 6급', explanation: '表示強調「正是N才是真正的～」。' },
    { pattern: 'V-(으)ㄹ 터이다', topikLevel: 'TOPIK 6급', explanation: '書面語「想必～、應當會～」（推測意志）。' },
    { pattern: 'V-는 데다가', topikLevel: 'TOPIK 6급', explanation: '表示「在～的基礎上，加之～」（累加）。' },
    { pattern: 'V-지 않을 수 없다', topikLevel: 'TOPIK 6급', explanation: '雙重否定強調「不得不～、不能不～」。' },
    { pattern: 'N을/를 감안하면', topikLevel: 'TOPIK 6급', explanation: '書面語「考慮到～、鑑於～」。' },
    { pattern: 'V-고야 말겠다', topikLevel: 'TOPIK 6급', explanation: '表示強烈決心「一定要～、非～不可」。' },
    { pattern: 'N은/는 고사하고', topikLevel: 'TOPIK 6급', explanation: '書面語「別說N了、更不用說N了」（程度更甚）。' },
    // ── TOPIK 5급 追加 (20) ──
    { pattern: 'V-(으)ㄹ 도리가 없다', topikLevel: 'TOPIK 5급', explanation: '沒有辦法～、無計可施。' },
    { pattern: 'V-건 V-건 (간에)', topikLevel: 'TOPIK 5급', explanation: '不管是～還是～（書面語，強調無論哪種情況）。' },
    { pattern: 'V-(으)ㄴ들', topikLevel: 'TOPIK 5급', explanation: '就算～也（書面語讓步，難有改變）。' },
    { pattern: 'V-고서야', topikLevel: 'TOPIK 5급', explanation: '做了～之後才（終於）（結果後才成立）。' },
    { pattern: 'V-기 무섭게', topikLevel: 'TOPIK 5급', explanation: '一～就立刻（速度極快，幾乎同時）。' },
    { pattern: 'V-(으)ㄹ 터인데', topikLevel: 'TOPIK 5급', explanation: '應該是要～的，但是（推測後轉折）。' },
    { pattern: 'V-기에 앞서', topikLevel: 'TOPIK 5급', explanation: '在做～之前（書面語，強調順序）。' },
    { pattern: 'N에 상관없이', topikLevel: 'TOPIK 5급', explanation: '不論N、與N無關（強調不受影響）。' },
    { pattern: 'N이/가 아닌 이상', topikLevel: 'TOPIK 5급', explanation: '除非不是N（書面語條件排除）。' },
    { pattern: 'V-는 만큼', topikLevel: 'TOPIK 5급', explanation: '因為～，所以相應地（程度相稱）。' },
    { pattern: 'V-다는 것을 감안하면', topikLevel: 'TOPIK 5급', explanation: '考慮到～（書面語，條件考量）。' },
    { pattern: 'V-는 것이야말로', topikLevel: 'TOPIK 5급', explanation: '正是～才是（強調真正重要之處）。' },
    { pattern: 'N을/를 전제로', topikLevel: 'TOPIK 5급', explanation: '以N為前提（書面語條件）。' },
    { pattern: 'V-아/어야 비로소', topikLevel: 'TOPIK 5급', explanation: '必須～才（能）終於（後才可能實現）。' },
    { pattern: 'N에 상응하는', topikLevel: 'TOPIK 5급', explanation: '與N相應的、配合N的（書面語）。' },
    { pattern: 'V-고 있는 추세이다', topikLevel: 'TOPIK 5급', explanation: '正有～的趨勢（書面語描述趨向）。' },
    { pattern: 'N에 버금가다', topikLevel: 'TOPIK 5급', explanation: '接近N、幾乎與N相當（書面語）。' },
    { pattern: 'V-기를 주저하지 않다', topikLevel: 'TOPIK 5급', explanation: '毫不猶豫地～（果斷行動）。' },
    { pattern: 'V-는 실정이다', topikLevel: 'TOPIK 5급', explanation: '現況是～（書面語描述現狀）。' },
    { pattern: 'V-았/었음에도 불구하고', topikLevel: 'TOPIK 5급', explanation: '儘管已經～（書面語讓步，事與願違）。' },
    // ── TOPIK 6급 追加 (20) ──
    { pattern: 'V-는 체하다', topikLevel: 'TOPIK 6급', explanation: '假裝～（裝作有某狀態）。' },
    { pattern: 'N에 이르기까지', topikLevel: 'TOPIK 6급', explanation: '直到N為止、乃至於N（書面語，範圍廣泛）。' },
    { pattern: 'V-는가에 달려 있다', topikLevel: 'TOPIK 6급', explanation: '取決於是否～（書面語，核心條件）。' },
    { pattern: 'V-아/어 왔다', topikLevel: 'TOPIK 6급', explanation: '一直以來～（書面語，強調長期持續性）。' },
    { pattern: 'V-기를 촉구하다', topikLevel: 'TOPIK 6급', explanation: '促請做～、敦促（書面語，要求行動）。' },
    { pattern: 'V-아/어야 할 까닭이 없다', topikLevel: 'TOPIK 6급', explanation: '沒有理由必須～（書面語，否定義務）。' },
    { pattern: 'N을/를 전제로 하다', topikLevel: 'TOPIK 6급', explanation: '以N為前提（書面語，設定條件）。' },
    { pattern: 'N에 상응하여', topikLevel: 'TOPIK 6급', explanation: '相應於N地（書面語，對等關係）。' },
    { pattern: 'V-고 있는 추세에 있다', topikLevel: 'TOPIK 6급', explanation: '正處於～趨勢中（書面語，更正式的趨勢表達）。' },
    { pattern: 'N에 의거한', topikLevel: 'TOPIK 6급', explanation: '依據N的（書面語修飾，法律或規定）。' },
    { pattern: 'V-(으)ㄹ 수밖에 없는 처지이다', topikLevel: 'TOPIK 6급', explanation: '處於只能～的處境（書面語，強調無奈）。' },
    { pattern: 'V-기 위한 노력을 기울이다', topikLevel: 'TOPIK 6급', explanation: '為了做～而努力（書面語，積極姿態）。' },
    { pattern: 'V-는 양상을 띠다', topikLevel: 'TOPIK 6급', explanation: '呈現出～的樣態（書面語，比보이다更正式）。' },
    { pattern: 'V-는 것이 불가피한 상황이다', topikLevel: 'TOPIK 6급', explanation: '處於～是不可避免的情況（書面語，強調必然性）。' },
    { pattern: 'V-고야 하다', topikLevel: 'TOPIK 6급', explanation: '最終一定要～（書面語，強調必然完成）。' },
    { pattern: 'V-는 것을 당연시하다', topikLevel: 'TOPIK 6급', explanation: '將～視為理所當然（書面語）。' },
    { pattern: 'N에 비추어 볼 때', topikLevel: 'TOPIK 6급', explanation: '從N的角度看來（書面語，參照依據）。' },
    { pattern: 'V-는 데 앞장서다', topikLevel: 'TOPIK 6급', explanation: '帶頭做～、在～方面領先（書面語）。' },
    { pattern: 'V-는 것에 다름 아니다', topikLevel: 'TOPIK 6급', explanation: '無異於～、就等於是（書面語，強調等同）。' },
    { pattern: 'V-기에 족하다', topikLevel: 'TOPIK 6급', explanation: '足以～、夠用來～（書面語，充分性）。' },
  ],
};

// Select 5 grammar items from pool based on article count (batch cycling)
function selectTopikGrammarBatch(pool, articleCount) {
  const start = articleCount * 5;
  if (start >= pool.length) {
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  }
  return pool.slice(start, start + 5);
}

// Foreign-script validator for Korean sentence fields
function hasNonKorean(str) {
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp <= 0x20) continue;
    if (cp >= 0x21 && cp <= 0x40) continue;
    if (cp >= 0x5B && cp <= 0x60) continue;
    if (cp >= 0x7B && cp <= 0x7E) continue;
    if (cp >= 0x1100 && cp <= 0x11FF) continue;
    if (cp >= 0x3130 && cp <= 0x318F) continue;
    if (cp >= 0x4E00 && cp <= 0x9FFF) continue;
    if (cp >= 0xAC00 && cp <= 0xD7A3) continue;
    if (cp >= 0xFF01 && cp <= 0xFF60) continue;
    if (cp === 0x00B7 || cp === 0x2026) continue;
    if (cp >= 0x2018 && cp <= 0x201F) continue;
    if (cp >= 0x3001 && cp <= 0x3002) continue;
    return true;
  }
  return false;
}

const topikLevelDescriptions = {
  '1-2': 'TOPIK I beginner (Level 1-2), ~200-250 Korean characters, at least 8 sentences, simple daily-life vocabulary',
  '3-4': 'TOPIK II intermediate (Level 3-4), ~320-400 Korean characters, at least 10 sentences, culture/travel/social topics',
  '5-6': 'TOPIK II advanced (Level 5-6), ~480-580 Korean characters, at least 12 sentences, technology/society/environment topics',
};

const VALID_TOPIK_LEVELS = ['1-2', '3-4', '5-6'];

app.post('/api/generate-topik-article', async (req, res) => {
  const { level, articleCount = 0 } = req.body;

  if (!VALID_TOPIK_LEVELS.includes(level)) {
    return res.status(400).json({ error: '無效的程度' });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 GROQ_API_KEY，請在 server/.env 中填入。' });
  }

  // Select 5 grammar items for this article (batch cycling)
  const selectedGrammar = selectTopikGrammarBatch(topikGrammarPool[level], articleCount);
  const grammarList = selectedGrammar
    .map((g, i) => `${i + 1}. Pattern: "${g.pattern}" (${g.topikLevel}) — ${g.explanation}`)
    .join('\n');

  const prompt = `You are a TOPIK Korean language teaching expert. Generate a Korean reading article for TOPIK Level ${level} learners.

Level requirements: ${topikLevelDescriptions[level]}

YOU MUST USE ALL 5 of the following grammar patterns naturally in the article content:
${grammarList}

Return ONLY a valid JSON object with NO extra text, NO markdown, NO code fences:

{
  "title": "봄의 기쁨",
  "content": "봄이 오면 사람들은 기뻐합니다. ...(at least required length, uses all 5 grammar patterns)...",
  "vocabulary": [
    { "korean": "동네", "romanization": "dongne", "meaning": "社區", "example": "우리 동네는 조용합니다.", "exampleTranslation": "我們的社區很安靜。" }
  ],
  "grammarExamples": [
    { "example": "sentence using grammar pattern 1", "exampleTranslation": "Chinese translation" },
    { "example": "sentence using grammar pattern 2", "exampleTranslation": "Chinese translation" },
    { "example": "sentence using grammar pattern 3", "exampleTranslation": "Chinese translation" },
    { "example": "sentence using grammar pattern 4", "exampleTranslation": "Chinese translation" },
    { "example": "sentence using grammar pattern 5", "exampleTranslation": "Chinese translation" }
  ],
  "questions": [
    { "question": "...", "options": ["a", "b", "c", "d"], "answerIndex": 0 }
  ]
}

Requirements:
- content: at least the required length, must use all 5 grammar patterns
- vocabulary: EXACTLY 10 items with romanization
- grammarExamples: EXACTLY 5 items, same order as the 5 grammar patterns above
- questions: EXACTLY 4 items with answerIndex as a number (0-3)
- All meanings and translations must be in Traditional Chinese (繁體中文)
- CRITICAL: "content", "example" (vocabulary), and "example" (grammarExamples) must contain ONLY Korean (한글), numbers, spaces, and Korean punctuation. NO Latin, Arabic, Japanese, or any foreign language words.`;

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  async function attemptGenerate() {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = completion.choices[0].message.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw Object.assign(new Error('AI 回傳格式錯誤'), { retryable: true });

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate Korean-only fields
    const sentenceFields = [
      parsed.title,
      parsed.content,
      ...(parsed.vocabulary ?? []).map(v => v.example),
      ...(parsed.grammarExamples ?? []).map(g => g.example),
    ];
    if (sentenceFields.some(hasNonKorean)) {
      throw Object.assign(new Error('AI 生成內容含有非韓文字元'), { retryable: true });
    }

    // Merge server grammar metadata with AI examples
    const grammar = selectedGrammar.map((libItem, i) => ({
      pattern: libItem.pattern,
      topikLevel: libItem.topikLevel,
      explanation: libItem.explanation,
      example: parsed.grammarExamples?.[i]?.example ?? '',
      exampleTranslation: parsed.grammarExamples?.[i]?.exampleTranslation ?? '',
    }));

    return { parsed, grammar };
  }

  const MAX_RETRIES = 3;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { parsed, grammar } = await attemptGenerate();
      return res.json({
        id: `${level}-ai-${Date.now()}`,
        level,
        title: parsed.title,
        content: parsed.content,
        vocabulary: parsed.vocabulary,
        grammar,
        questions: parsed.questions,
        isAIGenerated: true,
      });
    } catch (e) {
      lastError = e;
      if (!e.retryable) break;
    }
  }

  res.status(500).json({ error: lastError?.message ?? 'AI 生成失敗，請重試。' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (JLPT + TOPIK)`);
});
