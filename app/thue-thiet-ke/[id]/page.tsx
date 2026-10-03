import { FreelanceProjectPage } from '@/components/freelance-project';
export const metadata = { title: 'Dự án freelancer · NhàĐẹpChất' };
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <FreelanceProjectPage id={id}/>; }
