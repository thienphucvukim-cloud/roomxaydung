import { FreelanceProfilePage } from '@/components/freelance-profile';
export const metadata = { title: 'Hồ sơ freelancer thiết kế · NhàĐẹpChất' };
export default async function FreelancerPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <FreelanceProfilePage id={id}/>; }
