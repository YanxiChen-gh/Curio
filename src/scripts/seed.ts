import { ingestNotes } from "../ingestion/sync.js";
import { db } from "../lib/db.js";
import type { XhsNote } from "../types/xhs.js";

const sampleNotes: XhsNote[] = [
  {
    noteId: "sample-001",
    title: "东京涩谷超好吃的拉面店推荐！",
    content:
      "在涩谷逛街逛累了，无意中发现了这家拉面店「一蘭拉面」，就在涩谷站出来步行5分钟的地方。他们家的豚骨拉面真的绝了！汤底浓郁，面条劲道，叉烧入口即化。一碗拉面大概890日元，性价比很高。店里是单人隔间的设计，一个人来吃也完全不尴尬。营业时间是24小时的，半夜饿了也能来。推荐加一份半熟蛋，才多150日元。",
    author: "东京美食达人",
    tags: ["东京美食", "拉面", "涩谷", "日本旅行", "一蘭拉面"],
    location: "日本·东京·涩谷",
    imageUrls: ["https://example.com/ramen1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-001",
  },
  {
    noteId: "sample-002",
    title: "上海外滩附近的咖啡店合集 ☕",
    content:
      "整理了外滩附近我最爱的5家咖啡店：\n1. Manner Coffee 南京东路店 - 美式15元，性价比之王\n2. %Arabica 外滩店 - 拍照超好看，拿铁48元\n3. Seesaw Coffee 圆明园路店 - 创意特调很有意思，推荐桂花拿铁38元\n4. M on the Bund - 外滩景观位，适合约会，人均120\n5. 老麦咖啡馆 - 藏在弄堂里的老上海风格，手冲咖啡35元\n每家都各有特色，看你的需求选择！赶时间选Manner，约会选M on the Bund，拍照选%Arabica。",
    author: "上海咖啡地图",
    tags: ["上海咖啡", "外滩", "咖啡店推荐", "上海探店"],
    location: "中国·上海·黄浦区",
    imageUrls: ["https://example.com/coffee1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-002",
  },
  {
    noteId: "sample-003",
    title: "MacBook Pro M4 一个月使用体验",
    content:
      "入手M4 MacBook Pro一个月了，说说真实感受。配置是M4 Pro 24G+512G，价格14999。\n优点：1. 性能真的强，Xcode编译速度比M1快了将近2倍 2. 续航逆天，正常使用能到14小时 3. 屏幕素质一如既往的好 4. 新的纳米纹理屏幕在户外太好用了\n缺点：1. 512G还是不够用，建议直接上1T 2. 重量还是有点沉，1.6kg 3. 刘海屏还在\n总结：如果你是程序员或者视频创作者，强烈推荐升级。普通办公用户M4 Air可能更合适。",
    author: "科技宅小明",
    tags: ["MacBook", "M4", "数码测评", "程序员", "苹果"],
    location: "中国·北京",
    imageUrls: ["https://example.com/macbook1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-003",
  },
  {
    noteId: "sample-004",
    title: "京都和服体验一日游攻略",
    content:
      "京都和服体验全攻略！我选的是清水寺附近的「梦馆」，体验费用5500日元包含发型设计。早上9点到店选和服，大概1小时搞定。然后步行去清水寺（10分钟），二年坂三年坂拍照超美。中午在附近吃了抹茶甜品，推荐「茶寮都路里」的抹茶芭菲。下午去伏見稻荷大社，千本鸟居穿和服拍照绝美。Tips：1. 提前预约 2. 穿平底鞋去（店里换草履）3. 冬天店里有暖宝宝 4. 下午5点前还衣服。",
    author: "日本旅行笔记",
    tags: ["京都", "和服体验", "日本旅行", "清水寺", "攻略"],
    location: "日本·京都",
    imageUrls: ["https://example.com/kyoto1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-004",
  },
  {
    noteId: "sample-005",
    title: "居家健身｜零器材30分钟全身燃脂",
    content:
      "不想去健身房？在家也能高效燃脂！这套动作我坚持了3个月瘦了8斤。\n热身（5分钟）：开合跳+高抬腿+臀桥\n正式训练（20分钟）：\n1. 波比跳 x12 x3组\n2. 深蹲跳 x15 x3组\n3. 俯卧撑 x10 x3组\n4. 登山跑 x20 x3组\n5. 平板支撑 60秒 x3\n组间休息30秒。\n拉伸（5分钟）\n重点：坚持比强度更重要！一周3-4次就够了。配合饮食控制效果更好，我基本戒掉了奶茶和夜宵。",
    author: "健身小白变达人",
    tags: ["居家健身", "燃脂", "减肥", "健身打卡"],
    location: "中国·深圳",
    imageUrls: ["https://example.com/fitness1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-005",
  },
  {
    noteId: "sample-006",
    title: "曼谷考山路夜市美食地图🇹🇭",
    content:
      "曼谷考山路夜市必吃清单！价格都是2024年实测的。\n1. Pad Thai（泰式炒河粉）路边摊 - 60泰铢，料足味正\n2. 芒果糯米饭 - 80泰铢，芒果超甜\n3. 烤肉串 - 10泰铢一串，必试猪颈肉\n4. 冬阴功汤 - 推荐Tom Yum Kung Restaurant，一碗150泰铢\n5. 泰式奶茶 - 路边摊30泰铢，比国内的正宗太多\n6. 炸昆虫 - 勇者必试，蚱蜢其实还可以\nTips：现金为主，部分摊位可以扫码。晚上7点后最热闹，注意防扒手。",
    author: "东南亚吃喝玩乐",
    tags: ["曼谷", "考山路", "泰国美食", "夜市", "泰国旅行"],
    location: "泰国·曼谷",
    imageUrls: ["https://example.com/bangkok1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-006",
  },
  {
    noteId: "sample-007",
    title: "程序员必备VS Code插件推荐",
    content:
      "整理了我用了3年的VS Code插件清单，都是真正提效的：\n1. GitHub Copilot - AI代码补全，写代码效率翻倍\n2. GitLens - 看git blame和历史记录超方便\n3. Prettier - 代码格式化，团队协作必备\n4. Error Lens - 错误直接显示在代码行内\n5. Thunder Client - 轻量API测试，替代Postman\n6. Todo Tree - 高亮TODO注释\n7. Material Icon Theme - 文件图标更清晰\n8. REST Client - 直接在.http文件里测试API\n最近还在用Cursor，AI编程体验确实比Copilot更好。",
    author: "前端开发日记",
    tags: ["VS Code", "程序员", "开发工具", "效率工具"],
    location: "中国·杭州",
    imageUrls: ["https://example.com/vscode1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-007",
  },
  {
    noteId: "sample-008",
    title: "首尔明洞购物攻略+必买清单",
    content:
      "首尔明洞购物一日攻略！地铁4号线明洞站出来就是。\n必买清单：\n护肤：1. Innisfree绿茶籽精华 - 明洞店经常有买二送一 2. Sulwhasoo雪花秀套装 - 免税店比国内便宜30% 3. Dr.Jart+蝉丝面膜 - 一盒5片约60人民币\n美妆：1. 3CE唇釉 - 色号推荐#Going Right 2. Romand腮红 - 便宜大碗\n零食：1. 乐天百货地下超市的蜂蜜黄油薯片 2. 韩国草莓 - 又大又甜\n吃饭推荐明洞饺子（刀削面超好吃，8000韩元）和Isaac Toast早餐。",
    author: "韩国代购小姐姐",
    tags: ["首尔", "明洞", "韩国购物", "护肤品", "韩国旅行"],
    location: "韩国·首尔·明洞",
    imageUrls: ["https://example.com/seoul1.jpg"],
    sourceUrl: "https://www.xiaohongshu.com/explore/sample-008",
  },
];

async function main() {
  console.log("🌱 Seeding Curio with sample data...");

  const user = await db.user.upsert({
    where: { email: "demo@curio.app" },
    update: {},
    create: {
      email: "demo@curio.app",
      name: "Demo User",
    },
  });
  console.log(`👤 Demo user: demo@curio.app (use Google login in production)`);

  const count = await ingestNotes(sampleNotes, "xiaohongshu", user.id);
  console.log(`✅ Seeded ${count} notes (with embeddings)`);
}

main().catch(console.error).finally(() => process.exit());
