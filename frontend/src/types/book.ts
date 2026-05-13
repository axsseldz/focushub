export type Book = {
  displayName: string | null;
  fileUrl: string;
  filename: string;
  id: string;
  pageCount: number | null;
  thumbnailUrl: string | null;
  uploadedAt: string;
};

export type StoredFile = {
  created_at: string;
  display_name: string | null;
  file_name: string;
  file_url: string;
  id: number;
  page_count: number | null;
  thumbnail_url: string | null;
};
