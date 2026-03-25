export type Book = {
  fileUrl: string;
  filename: string;
  id: string;
  thumbnailUrl: string | null;
  uploadedAt: string;
};

export type StoredFile = {
  created_at: string;
  file_name: string;
  file_url: string;
  id: number;
  thumbnail_url: string | null;
};
