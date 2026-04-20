export interface XhsNote {
  noteId: string;
  title: string;
  content: string;
  author?: string;
  tags: string[];
  location?: string;
  imageUrls: string[];
  sourceUrl: string;
}

export interface XhsOpenCliNote {
  id?: string;
  note_id?: string;
  title?: string;
  desc?: string;
  content?: string;
  user?: { nickname?: string };
  tag_list?: Array<{ name?: string }>;
  ip_location?: string;
  image_list?: Array<{ url?: string; url_default?: string }>;
  share_info?: { link?: string };
}
