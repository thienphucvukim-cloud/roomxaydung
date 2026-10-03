import { env } from 'cloudflare:workers';
import { freelanceActor, freelanceBody, freelanceFailure, freelanceHeaders, freelanceId, freelanceNumber, freelanceSpecialty, freelanceText, freelanceWriter, FreelanceError, getFreelanceProfile, getFreelanceProject, projectParticipant } from '@/lib/freelance-server';
import type { FreelanceProposal, FreelanceMessage, FreelanceFile } from '@/lib/freelance-types';

export async function GET(request: Request) {
  try {
    const id = freelanceId(new URL(request.url).searchParams.get('id'));
    const [project, actor] = await Promise.all([getFreelanceProject(id), freelanceActor()]);
    const member = projectParticipant(project, actor);
    const owner = actor?.id === project.ownerId;
    // Requests remain readable after hiring, but proposals, discussion and deliveries remain private.
    const [proposals, messages, files, profile] = await Promise.all([
      actor ? env.DB!.prepare(`SELECT r.id,r.project_id AS projectId,r.freelancer_id AS freelancerId,f.display_name AS name,f.title,r.price,r.days,r.content,r.created_at AS createdAt FROM freelance_proposals r JOIN freelance_profiles f ON f.user_id = r.freelancer_id WHERE r.project_id = ? AND (? = 1 OR r.freelancer_id = ?) ORDER BY r.created_at DESC`).bind(id, owner ? 1 : 0, actor.id).all<FreelanceProposal>() : { results: [] },
      member ? env.DB!.prepare('SELECT id,author_id AS authorId,author_name AS authorName,content,created_at AS createdAt FROM freelance_messages WHERE project_id = ? ORDER BY created_at ASC,rowid ASC LIMIT 500').bind(id).all<FreelanceMessage>() : { results: [] },
      actor ? env.DB!.prepare("SELECT id,name,size,purpose,created_at AS createdAt FROM freelance_files WHERE project_id = ? AND (purpose = 'brief' OR ? = 1) ORDER BY created_at ASC").bind(id, member ? 1 : 0).all<FreelanceFile>() : { results: [] },
      actor ? getFreelanceProfile(actor.id) : null,
    ]);
    const visibleProject = member ? project : { ...project, freelancerId: null, agreedPrice: 0, agreedDays: 0 };
    return Response.json({ project: visibleProject, proposals: proposals.results, messages: messages.results, files: files.results, actor, profile }, { headers: freelanceHeaders });
  } catch (error) { return freelanceFailure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await freelanceWriter(request), body = await freelanceBody(request);
    if (body.action === 'create') {
      const id = freelanceId(body.requestId), title = freelanceText(body.title, 'Tên dự án', 140);
      const specialty = freelanceSpecialty(body.specialty), description = freelanceText(body.description, 'Mô tả', 6000, true), location = freelanceText(body.location, 'Địa điểm', 150, true);
      const budget = freelanceNumber(body.budget, 'Ngân sách', 0, 500000000), days = freelanceNumber(body.days, 'Thời gian dự kiến', 0, 365);
      const now = new Date().toISOString();
      await env.DB!.prepare('INSERT INTO freelance_projects(id,owner_id,owner_name,title,specialty,description,location,budget,days,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,actor.id,actor.name,title,specialty,description,location,budget,days,now,now).run();
      const project = await getFreelanceProject(id);
      if (project.ownerId !== actor.id) throw new FreelanceError('Mã yêu cầu đã được sử dụng.', 409);
      return Response.json({ project }, { headers: freelanceHeaders });
    }
    const id = freelanceId(body.id), project = await getFreelanceProject(id), now = new Date().toISOString();
    if (body.action === 'propose') {
      if (project.ownerId === actor.id || project.status !== 'open') throw new FreelanceError('Dự án không nhận đề xuất từ tài khoản này.', 409);
      const profile = await getFreelanceProfile(actor.id);
      if (!profile) throw new FreelanceError('Tạo hồ sơ freelancer trước khi gửi đề xuất.', 403);
      const proposalId = freelanceId(body.requestId), price = freelanceNumber(body.price, 'Báo giá', 1, 500000000), days = freelanceNumber(body.days, 'Thời gian thực hiện', 1, 365), content = freelanceText(body.content, 'Đề xuất', 4000);
      const result = await env.DB!.prepare(`INSERT INTO freelance_proposals(id,project_id,freelancer_id,price,days,content,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM freelance_projects WHERE id = ? AND status = 'open') ON CONFLICT(project_id,freelancer_id) DO UPDATE SET price=excluded.price,days=excluded.days,content=excluded.content WHERE EXISTS(SELECT 1 FROM freelance_projects WHERE id = excluded.project_id AND status = 'open')`).bind(proposalId,id,actor.id,price,days,content,now,id).run();
      if (!result.meta.changes) throw new FreelanceError('Dự án vừa ngừng nhận đề xuất. Hãy tải lại.', 409);
    } else if (body.action === 'hire') {
      if (project.ownerId !== actor.id) throw new FreelanceError('Chỉ người đăng dự án được chọn freelancer.', 403);
      const proposalId = freelanceId(body.proposalId);
      const result = await env.DB!.prepare(`UPDATE freelance_projects SET freelancer_id=(SELECT freelancer_id FROM freelance_proposals WHERE id = ? AND project_id = ?),agreed_price=(SELECT price FROM freelance_proposals WHERE id = ?),agreed_days=(SELECT days FROM freelance_proposals WHERE id = ?),status='working',updated_at=? WHERE id=? AND owner_id=? AND status='open' AND EXISTS(SELECT 1 FROM freelance_proposals r LEFT JOIN member_profiles m ON m.user_id = r.freelancer_id WHERE r.id=? AND r.project_id=? AND COALESCE(m.account_status,'active')='active')`).bind(proposalId,id,proposalId,proposalId,now,id,actor.id,proposalId,id).run();
      if (!result.meta.changes) throw new FreelanceError('Dự án đã thay đổi hoặc đề xuất không còn khả dụng. Hãy tải lại.', 409);
    } else if (body.action === 'message') {
      if (!projectParticipant(project,actor) || ['completed','cancelled'].includes(project.status)) throw new FreelanceError('Không thể gửi trao đổi vào dự án này.', 403);
      const messageId = freelanceId(body.requestId), content = freelanceText(body.content, 'Nội dung trao đổi', 4000);
      await env.DB!.prepare(`INSERT INTO freelance_messages(id,project_id,author_id,author_name,content,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM freelance_projects WHERE id=? AND status IN ('working','delivered') AND (owner_id=? OR freelancer_id=?)) ON CONFLICT(id) DO NOTHING`).bind(messageId,id,actor.id,actor.name,content,now,id,actor.id,actor.id).run();
    } else {
      const rules = {
        deliver: { role: project.freelancerId, from: 'working', to: 'delivered' },
        revise: { role: project.ownerId, from: 'delivered', to: 'working' },
        complete: { role: project.ownerId, from: 'delivered', to: 'completed' },
        cancel: { role: project.ownerId, from: 'open', to: 'cancelled' },
      } as const;
      const rule = rules[String(body.action) as keyof typeof rules];
      if (!rule) throw new FreelanceError('Thao tác không hợp lệ.');
      if (rule.role !== actor.id) throw new FreelanceError('Bạn không có quyền thực hiện thao tác này.', 403);
      if (body.action === 'deliver') {
        const file = await env.DB!.prepare("SELECT id FROM freelance_files WHERE project_id=? AND purpose='delivery' LIMIT 1").bind(id).first();
        if (!file) throw new FreelanceError('Tải lên hồ sơ bàn giao trước khi gửi xác nhận.');
      }
      const result = await env.DB!.prepare('UPDATE freelance_projects SET status=?,updated_at=? WHERE id=? AND status=?').bind(rule.to,now,id,rule.from).run();
      if (!result.meta.changes) throw new FreelanceError('Dự án vừa thay đổi. Hãy tải lại trước khi tiếp tục.', 409);
    }
    return Response.json({ project: await getFreelanceProject(id) }, { headers: freelanceHeaders });
  } catch (error) { return freelanceFailure(error); }
}
