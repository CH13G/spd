
declare namespace Article {
  export type authors = {
    [index: number]: {
      href: string;
      name: string;
    }
  }
  export type chapter = {
    link: string;
    level: number;
    name: string;
    slug: string;
    isPlain: boolean;
  };
  export type chapters = {
    [index: number]: chapter;
  }
}

export default Article;
