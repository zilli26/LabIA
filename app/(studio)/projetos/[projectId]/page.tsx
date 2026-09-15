import { ProjectWorkspace } from "@/components/projects/project-workspace";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <ProjectWorkspace projectId={projectId} />;
}
