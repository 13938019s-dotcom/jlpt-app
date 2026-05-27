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
