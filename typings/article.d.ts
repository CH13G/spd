
declare namespace Article {
  export type authors = {
    [index: number]: {
      href: string;
      name: string;
    }
  }
  export type chapter = {
    link: string; // 文章链接
    level: number; // 几级目录 start 1
    name: string;
    slug: string; // 短链接K
    isPlain: boolean; // 是否只是章节名，无具体文章链接
  };
  export type chapters = {
    [index: number]: chapter;
  }
}

export default Article;
