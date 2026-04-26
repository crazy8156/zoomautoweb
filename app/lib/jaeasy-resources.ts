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
    title: '學習網站',
    summary: '適合日常自學、發音練習與閱讀入門的網站。',
    resources: [
      { title: 'Japanese123', url: 'https://japanese123.com.tw/', description: '整理完整的日文學習文章、教材與考試重點。' },
      { title: 'OJAD', url: 'https://www.gavo.t.u-tokyo.ac.jp/ojad/', description: '東京大學提供的日語重音與發音工具。' },
      { title: 'NEWS WEB EASY', url: 'https://www3.nhk.or.jp/news/easy/', description: '用簡單日文閱讀新聞，適合培養閱讀習慣。' },
      { title: 'TSUNAHIRO', url: 'https://tsunagarujp.bunka.go.jp/?lang_id=TW', description: '日本文化廳的多語學習資源平台。' },
      { title: '青空文庫', url: 'https://www.aozora.gr.jp/', description: '適合進階閱讀者接觸日文原文作品。' },
      { title: '青空朗讀', url: 'https://aozoraroudoku.jp/', description: '結合朗讀與文本，適合練聽力與跟讀。' },
    ],
  },
  {
    key: 'youtube',
    title: '影音頻道',
    summary: '透過影片熟悉發音、語感與真實語速。',
    resources: [
      { title: 'ANNnewsCH', url: 'https://www.youtube.com/channel/UCGCZAYq5Xxojl_tSXcVJhiQ', description: '適合訓練新聞聽力與時事字彙。' },
      { title: 'NHK WORLD JAPAN', url: 'https://www.nhk.or.jp/lesson/zt/', description: '以節目與教材輔助日語學習。' },
      { title: '日文文法教學影片', url: 'https://www.youtube.com/watch?v=ay0N4tkxbs8', description: '用影片方式理解常見句型與文法。' },
      { title: '閱讀與句型練習', url: 'https://www.youtube.com/watch?v=wUbbI09qrl8', description: '結合閱讀材料與解題思路。' },
    ],
  },
  {
    key: 'articles',
    title: '文章與整理',
    summary: '快速補充自學方法、考試方向與工具推薦。',
    resources: [
      { title: '自學網站整理', url: 'https://1on1.today/blog/%E6%97%A5%E8%AA%9E%E8%87%AA%E5%AD%B8-%E7%B6%B2%E7%AB%99-%E6%95%99%E6%9D%90/', description: '彙整常見日文自學網站與教材。' },
      { title: 'JLPT 準備重點', url: 'https://japanese123.tw/blog/feature/115', description: '整理考試方向與準備方法。' },
      { title: 'N5 學習建議', url: 'https://nabi.104.com.tw/posts/nabi_post_7715a710-d297-4e59-aced-65fd127eadec?utm_source=104nabi&utm_medium=share', description: '給初學者的學習節奏與讀書方向。' },
      { title: 'Useful Japanese Learning Websites', url: 'https://lifewith-nao.com/learn-japanese-5-useful-websites/', description: '英文整理文，內容實用，適合延伸參考。' },
    ],
  },
  {
    key: 'other',
    title: '延伸工具',
    summary: '適合搭配課程與自學流程使用的輔助工具。',
    resources: [
      { title: '國家圖書館 ISBN', url: 'https://isbn.ncl.edu.tw', description: '查詢出版資料與延伸閱讀。' },
      { title: '臺灣博碩士論文知識加值系統', url: 'http://tps.ncl.edu.tw', description: '查找研究文章與正式資料。' },
      { title: '教學靈感 IG', url: 'https://www.instagram.com/p/DW3vsgAkwmY/', description: '看看教學內容設計與學習靈感。' },
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
