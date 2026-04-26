export type JaeasyResourceCategoryKey = 'learning-sites' | 'youtube' | 'articles' | 'other';

export type JaeasyResource = {
  title: string;
  url: string;
  description: string;
};

export type JaeasyResourceCategory = {
  key: JaeasyResourceCategoryKey;
  title: string;
  summary: string;
  resources: JaeasyResource[];
};

export const jaeasyResourceCategories: JaeasyResourceCategory[] = [
  {
    key: 'learning-sites',
    title: '日語學習資源與實用網站',
    summary: '適合放進自學中心首頁，當成學生每天可以直接使用的學習工具。',
    resources: [
      { title: '小明の日語生活', url: 'https://japanese123.com.tw/', description: '綜合型日語學習站，適合新手建立自學入口。' },
      { title: 'OJAD 線上日文聲調詞典', url: 'https://www.gavo.t.u-tokyo.ac.jp/ojad/', description: '日文聲調與發音練習工具。' },
      { title: '青空朗讀', url: 'https://aozoraroudoku.jp/', description: '文學作品有聲書，可做聽讀訓練。' },
      { title: '青空文庫', url: 'https://www.aozora.gr.jp/', description: '免費日文電子書，適合閱讀素材。' },
      { title: '風傳媒日文版', url: 'https://japan.storm.mg/', description: '時事新聞閱讀素材。' },
      { title: 'TSUNAHIRO', url: 'https://tsunagarujp.bunka.go.jp/?lang_id=TW', description: '生活化實用日語內容，適合情境學習。' },
      { title: '日本語的例文', url: 'https://j-nihongo.com/', description: '文法與例句查找資源。' },
      { title: '3秒敬語', url: 'https://3keigo.com/', description: '敬語轉換工具。' },
      { title: 'NEWS WEB EASY', url: 'https://www3.nhk.or.jp/news/easy/', description: 'NHK 簡易日語新聞，適合日常閱讀練習。' },
      { title: 'にほんごたどく', url: 'https://tadoku.org/japanese/free-books/#l0', description: '免費日文繪本與分級讀物。' },
      { title: 'NHK WORLD RADIO JAPAN', url: 'https://www.nhk.or.jp/lesson/zt/', description: '會話小劇場與聽力素材。' },
      { title: '井上老師的線上日語教室', url: 'http://inouesensei.com/', description: '線上日語教學網站。' },
      { title: '林老師方格子沙龍', url: 'https://vocus.cc/user/@linsensei', description: '老師型內容創作與學習文章。' },
    ],
  },
  {
    key: 'youtube',
    title: 'YouTube 頻道與教學影片',
    summary: '可拿來做影音學習區、每日推薦或搭配課程單元。',
    resources: [
      { title: 'ANNnewsCH', url: 'https://www.youtube.com/channel/UCGCZAYq5Xxojl_tSXcVJhiQ', description: '日本新聞直播與報導，適合時事聽力。' },
      { title: '何必日語 - 新版日文常漢字 19', url: 'https://www.youtube.com/watch?v=jd5fmvzHUAk', description: '常用漢字學習影片。' },
      { title: '何必日語 - 接續助詞と的完整用法', url: 'https://www.youtube.com/watch?v=ay0N4tkxbs8', description: '文法教學影片。' },
      { title: '何必日語 - 大家的日本語初級第一課單字講解', url: 'https://www.youtube.com/watch?v=wUbbI09qrl8', description: '初級教材搭配影片。' },
    ],
  },
  {
    key: 'articles',
    title: '日語學習相關文章與部落格',
    summary: '很適合整理成後台內容池，之後再拆成單字、文法、閱讀與每日文章。',
    resources: [
      { title: '12個免費日語學習網站', url: 'https://japanese123.tw/blog/feature/109', description: '免費學習網站整理。' },
      { title: '10個免費日語學習 APP 介紹', url: 'https://japanese123.tw/blog/feature/110', description: '日語學習工具與 App 整理。' },
      { title: '日檢 JLPT 該報哪一級？', url: 'https://japanese123.tw/blog/feature/115', description: 'JLPT 等級選擇指南。' },
      { title: 'JLPT 日檢怎麼準備？', url: 'https://japanese123.tw/blog/feature/116', description: '日檢備考總整理。' },
      { title: 'JLPT 日檢 N5 考什麼？', url: 'https://japanese123.tw/blog/feature/117', description: 'N5 範圍與準備方向。' },
      { title: '日語口說能力怎麼提升？', url: 'https://japanese123.tw/blog/feature/118', description: '口說訓練方法。' },
      { title: 'JLPT 日檢 N4 怎麼準備？', url: 'https://japanese123.tw/blog/feature/192', description: 'N4 備考整理。' },
      { title: 'JLPT 日檢 N3 怎麼準備？', url: 'https://japanese123.tw/blog/feature/193', description: 'N3 備考整理。' },
      { title: 'JLPT 日檢 N2 怎麼準備？', url: 'https://japanese123.tw/blog/feature/194', description: 'N2 備考整理。' },
      { title: '怎麼用日文自我介紹？', url: 'https://japanese123.tw/blog/feature/201', description: '自我介紹範例與句型。' },
      { title: '2024 年 8 大日文補習班比較', url: 'https://japanese123.tw/blog/feature/251', description: '市場型比較文章，可做招生參考。' },
      { title: 'N5 必備的 30 個文法', url: 'https://nabi.104.com.tw/posts/nabi_post_7715a710-d297-4e59-aced-65fd127eadec?utm_source=104nabi&utm_medium=share', description: 'N5 文法整理。' },
      { title: '好用的日語自學網站與教材整理', url: 'https://1on1.today/blog/%E6%97%A5%E8%AA%9E%E8%87%AA%E5%AD%B8-%E7%B6%B2%E7%AB%99-%E6%95%99%E6%9D%90/', description: '外部學習資源總整理。' },
      { title: '5 個免費又實用的日文學習網站', url: 'https://lifewith-nao.com/learn-japanese-5-useful-websites/', description: '自學工具文章。' },
      { title: '日語學習要學多久？', url: 'https://ourscool.net/blog/learning-japanese', description: '學習時程與目標設定指南。' },
      { title: '4 個推薦的日文學習網站', url: 'https://www.lemonstera.com/doc/0727178ff91e46edba6425850233c7ad', description: '學習網站推薦文。' },
      { title: '認識 Jack Halpern', url: 'https://ai.glossika.com/zh-tw/blog/2019-polyglot-conference-interview-jack-halpern', description: '人物專訪與語言學習觀點。' },
      { title: '看凪的新生活學日文', url: 'https://ai.glossika.com/zh-tw/blog/japanese-drama-nagi-no-oitoma', description: '結合日劇的學習文章。' },
    ],
  },
  {
    key: 'other',
    title: '其他類型資源',
    summary: '可作為延伸閱讀、教材查找或品牌外部內容來源。',
    resources: [
      { title: '全國新書資訊網', url: 'https://isbn.ncl.edu.tw', description: '查找書籍與出版資訊。' },
      { title: '國家圖書館每日預告書訊服務', url: 'http://tps.ncl.edu.tw', description: '圖書與出版情報。' },
      { title: '尼歐教練 IG', url: 'https://www.instagram.com/p/DW3vsgAkwmY/', description: '可作為講座與外部內容延伸連結。' },
    ],
  },
];

export function getJaeasyResourceSummary() {
  const resourceCount = jaeasyResourceCategories.reduce((total, category) => total + category.resources.length, 0);

  return {
    categoryCount: jaeasyResourceCategories.length,
    resourceCount,
  };
}
