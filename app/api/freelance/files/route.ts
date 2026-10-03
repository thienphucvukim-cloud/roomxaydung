import { env } from 'cloudflare:workers';
import { freelanceActor, freelanceFailure, freelanceHeaders, freelanceId, freelanceWriter, FreelanceError, getFreelanceProject, projectParticipant } from '@/lib/freelance-server';

export async function POST(request: Request) {
  let objectKey: string | undefined;
  try {
    const actor = await freelanceWriter(request), form = await request.formData();
    const projectId = freelanceId(form.get('projectId')), project = await getFreelanceProject(projectId);
    const purpose = form.get('purpose'), file = form.get('file');
    if (purpose !== 'brief' && purpose !== 'delivery') throw new FreelanceError('Loại tài liệu không hợp lệ.');
    if (purpose === 'brief' ? actor.id !== project.ownerId || project.status !== 'open' : actor.id !== project.freelancerId || project.status !== 'working') throw new FreelanceError('Bạn không thể tải tài liệu vào bước này.', 403);
    if (!(file instanceof File) || !file.size || file.size > 100 * 1024 * 1024) throw new FreelanceError('Chọn tệp từ 1 byte đến 100 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['pdf','dwg','dxf','skp','rvt','rfa','pln','zip','rar','7z','jpg','jpeg','png','webp','xlsx','xls','doc','docx','txt'].includes(extension)) throw new FreelanceError('Định dạng tệp không được hỗ trợ.');
    const count = await env.DB!.prepare('SELECT COUNT(*) AS total FROM freelance_files WHERE project_id=?').bind(projectId).first<{total:number}>();
    if ((count?.total || 0) >= 50) throw new FreelanceError('Mỗi dự án tối đa 50 tệp.');
    const id = crypto.randomUUID(); objectKey = `freelance/${projectId}/${id}.${extension}`;
    await env.BUCKET!.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: 'application/octet-stream' } });
    const result = await env.DB!.prepare(`INSERT INTO freelance_files(id,project_id,uploader_id,purpose,object_key,name,size,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM freelance_projects WHERE id=? AND status=?) AND (SELECT COUNT(*) FROM freelance_files WHERE project_id=?) < 50`).bind(id,projectId,actor.id,purpose,objectKey,file.name.slice(0,200),file.size,new Date().toISOString(),projectId,purpose === 'brief' ? 'open' : 'working',projectId).run();
    if (!result.meta.changes) throw new FreelanceError('Dự án vừa thay đổi hoặc đã đủ 50 tệp.',409);
    return Response.json({ ok: true, id }, { headers: freelanceHeaders });
  } catch (error) { if (objectKey) await env.BUCKET!.delete(objectKey).catch(() => {}); return freelanceFailure(error); }
}
export async function GET(request: Request) {
  try {
    const actor = await freelanceActor(); if (!actor) throw new FreelanceError('Đăng nhập để tải tài liệu.',401);
    const id = freelanceId(new URL(request.url).searchParams.get('id'));
    const file = await env.DB!.prepare('SELECT project_id AS projectId,object_key AS objectKey,name,purpose FROM freelance_files WHERE id=?').bind(id).first<{projectId:string;objectKey:string;name:string;purpose:string}>();
    if (!file) throw new FreelanceError('Không tìm thấy tài liệu.',404);
    const project = await getFreelanceProject(file.projectId);
    if (file.purpose !== 'brief' && !projectParticipant(project,actor)) throw new FreelanceError('Tài liệu chỉ dành cho người tham gia dự án.',403);
    const object = await env.BUCKET!.get(file.objectKey); if (!object) throw new FreelanceError('Tệp không còn trong kho lưu trữ.',404);
    return new Response(object.body, { headers: { ...freelanceHeaders, 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return freelanceFailure(error); }
}
