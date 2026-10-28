export type MemeStatus = "active" | "pending" | "hidden" | "removed" | "rejected";
export type MemeOrigin = "admin" | "import" | "seed";

/** Public, serializable shape sent to the browser. */
export type Meme = {
  id: string;
  slug: string;
  title: string;
  description: string;
  altText: string;
  ocrText: string;
  sourceUrl: string | null;
  sourceName: string | null;
  credit: string | null;
  license: string;
  origin: MemeOrigin;
  format: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  languages: string[];
  tags: string[];
  synonyms: string[];
  categories: string[];
  status: MemeStatus;
  statusReason: string | null;
  dominantColor: string | null;
  downloadCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  thumbUrl: string;
  pageUrl: string;
};

/** Editable metadata accepted by uploads and the admin editor. */
export type MemeInput = {
  title?: string;
  description?: string;
  altText?: string;
  ocrText?: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  credit?: string | null;
  license?: string;
  languages?: string[];
  tags?: string[];
  synonyms?: string[];
  categories?: string[];
  status?: MemeStatus;
  statusReason?: string | null;
  submitterNote?: string | null;
};
