type GuideItem = { title: string; text: string };

export type ProductGuideSection =
  | { kind: 'text'; heading: string; paragraphs: readonly string[] }
  | { kind: 'steps' | 'facts'; heading: string; items: readonly GuideItem[] }
  | { kind: 'prompt' | 'example'; heading: string; text: string }
  | { kind: 'note'; heading: string; text: string };

export type ProductFeatureDetail = {
  title: string;
  summary: string;
  intro: string;
  sections: readonly ProductGuideSection[];
  links: readonly { label: string; href: string }[];
};
