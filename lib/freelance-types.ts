export const freelanceSpecialties = ['Thiết kế kiến trúc', 'Thiết kế kết cấu', 'Thiết kế nội thất', 'Điện nước (MEP)', 'Dự toán & bóc tách', 'Triển khai bản vẽ'] as const;
export type FreelanceSpecialty = typeof freelanceSpecialties[number];
export type FreelanceActor = { id: string; name: string };
export type FreelancePortfolio = { title: string; url: string };
export type FreelanceProfile = {
  id: string; name: string; title: string; specialty: FreelanceSpecialty; location: string; bio: string;
  skills: string[]; experience: number; rate: number; rateUnit: 'project' | 'm2'; available: boolean;
  cover: string; portfolio: FreelancePortfolio[]; completedCount: number; updatedAt: string;
};
export type FreelanceProject = {
  id: string; ownerId: string; ownerName: string; freelancerId: string | null; title: string;
  specialty: FreelanceSpecialty; description: string; location: string; budget: number;
  days: number; status: 'open' | 'working' | 'delivered' | 'completed' | 'cancelled';
  agreedPrice: number; agreedDays: number; proposalCount: number; createdAt: string; updatedAt: string;
};
export type FreelanceProposal = { id: string; projectId: string; freelancerId: string; name: string; title: string; price: number; days: number; content: string; createdAt: string };
export type FreelanceMessage = { id: string; authorId: string; authorName: string; content: string; createdAt: string };
export type FreelanceFile = { id: string; name: string; size: number; purpose: 'brief' | 'delivery'; createdAt: string };
export type FreelanceRoom = { project: FreelanceProject; proposals: FreelanceProposal[]; messages: FreelanceMessage[]; files: FreelanceFile[]; actor: FreelanceActor | null; profile: FreelanceProfile | null };
export type FreelanceListing = { profiles: FreelanceProfile[]; projects: FreelanceProject[]; total: number; page: number; actor: FreelanceActor | null; profile: FreelanceProfile | null };
export const freelanceStatuses: Record<FreelanceProject['status'], string> = { open: 'Đang nhận đề xuất', working: 'Đang thực hiện', delivered: 'Chờ xác nhận bàn giao', completed: 'Đã hoàn thành', cancelled: 'Đã đóng' };
export const freelanceMoney = (amount: number) => amount.toLocaleString('vi-VN') + 'đ';
export const freelanceDate = (date: string) => new Date(date).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
