import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";

export default async function WorkspaceProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // ``key={id}`` forces React to mount a fresh ``WorkspaceClient`` when
  // the user navigates between projects, so chat / asset / pdf state
  // from a previous project never bleeds into a newly opened one.
  return <WorkspaceClient key={id} projectId={id} />;
}
