export type WorkspaceMode = "plan" | "execute";

export type WorkspaceAsset = {
  id: number;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  created_at: string;
};

export type WorkspaceMessage = {
  id: number;
  role: "user" | "assistant";
  mode: WorkspaceMode;
  content: string;
  created_at: string;
};

export type WorkspaceProject = {
  id: number;
  title: string;
  latex_source: string;
  last_exported_file_id: number | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceProjectDetail = WorkspaceProject & {
  assets: WorkspaceAsset[];
  messages: WorkspaceMessage[];
};

export type ChatResponse = {
  assistant_message: WorkspaceMessage;
  latex_source: string | null;
};

export type SyncResponse = {
  file_id: number;
  file_url: string;
  file_name: string;
};

// Phases emitted by the backend over SSE while an Execute run is in
// flight. The chat uses this to swap its streaming indicator copy
// instead of leaving the user staring at a generic spinner.
export type WorkspacePhase = "thinking" | "writing-latex" | "finalizing";
