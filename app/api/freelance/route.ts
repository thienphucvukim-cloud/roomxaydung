import { env } from 'cloudflare:workers';
import { freelanceActor, freelanceFailure, freelanceHeaders, FreelanceError, getFreelanceProfile, parseFreelanceProfile, profileColumns, projectColumns, type ProfileRow } from '@/lib/freelance-server';
import { freelanceSpecialties, type FreelanceProject } from '@/lib/freelance-types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url), actor = await freelanceActor();
    const view = url.searchParams.get('view') || 'freelancers';
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const specialty = url.searchParams.get('specialty') || '';
    const budget = url.searchParams.get('budget') || '';
    const sort = url.searchParams.get('sort') || 'recent';
    const page = Math.floor(Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1)));
    if (!['freelancers', 'projects', 'mine'].includes(view)) throw new FreelanceError('Danh sách không hợp lệ.');
    if (specialty && !(freelanceSpecialties as readonly string[]).includes(specialty)) throw new FreelanceError('Chuyên môn không hợp lệ.');
    if (view === 'mine' && !actor) throw new FreelanceError('Đăng nhập để xem dự án của bạn.', 401);
    const profile = actor ? await getFreelanceProfile(actor.id) : null;
    const where: string[] = [], values: (string | number)[] = [];
    if (view === 'freelancers') {
      if (!['recent', 'experience', 'rate'].includes(sort)) throw new FreelanceError('Cách sắp xếp không hợp lệ.');
      where.push("COALESCE(m.account_status,'active') = 'active'");
      if (specialty) { where.push('f.specialty = ?'); values.push(specialty); }
      if (url.searchParams.get('available') === '1') where.push('f.available = 1');
      if (q) { where.push('(f.display_name LIKE ? OR f.title LIKE ? OR f.bio LIKE ? OR f.location LIKE ? OR f.skills LIKE ?)'); values.push(...Array<string>(5).fill('%' + q + '%')); }
      const order = sort === 'experience' ? 'f.experience DESC,' : sort === 'rate' ? 'CASE WHEN f.rate = 0 THEN 1 ELSE 0 END,f.rate ASC,' : '';
      const predicate = where.join(' AND ');
      const [rows, count] = await Promise.all([
        env.DB!.prepare(`SELECT ${profileColumns} FROM freelance_profiles f LEFT JOIN member_profiles m ON m.user_id = f.user_id WHERE ${predicate} ORDER BY ${order} f.updated_at DESC,f.user_id ASC LIMIT 6 OFFSET ?`).bind(...values, (page - 1) * 6).all<ProfileRow>(),
        env.DB!.prepare(`SELECT COUNT(*) AS total FROM freelance_profiles f LEFT JOIN member_profiles m ON m.user_id = f.user_id WHERE ${predicate}`).bind(...values).first<{ total: number }>(),
      ]);
      return Response.json({ profiles: rows.results.map(parseFreelanceProfile), projects: [], total: count?.total || 0, page, actor, profile }, { headers: freelanceHeaders });
    }
    if (!['recent', 'budget-desc', 'budget-asc'].includes(sort)) throw new FreelanceError('Cách sắp xếp không hợp lệ.');
    if (!['', 'under-5', '5-20', 'over-20', 'discuss'].includes(budget)) throw new FreelanceError('Ngân sách không hợp lệ.');
    if (view === 'projects') where.push("p.status = 'open'");
    else { where.push('(p.owner_id = ? OR p.freelancer_id = ? OR EXISTS(SELECT 1 FROM freelance_proposals r WHERE r.project_id = p.id AND r.freelancer_id = ?))'); values.push(actor!.id, actor!.id, actor!.id); }
    if (specialty) { where.push('p.specialty = ?'); values.push(specialty); }
    if (q) { where.push('(p.title LIKE ? OR p.description LIKE ? OR p.location LIKE ?)'); values.push(...Array<string>(3).fill('%' + q + '%')); }
    if (budget === 'under-5') where.push('p.budget > 0 AND p.budget < 5000000');
    if (budget === '5-20') where.push('p.budget BETWEEN 5000000 AND 20000000');
    if (budget === 'over-20') where.push('p.budget > 20000000');
    if (budget === 'discuss') where.push('p.budget = 0');
    const predicate = where.join(' AND ');
    const order = sort === 'budget-desc' ? 'p.budget DESC,' : sort === 'budget-asc' ? 'CASE WHEN p.budget = 0 THEN 1 ELSE 0 END,p.budget ASC,' : '';
    const [rows, count] = await Promise.all([
      env.DB!.prepare(`SELECT ${projectColumns} FROM freelance_projects p WHERE ${predicate} ORDER BY ${order} p.updated_at DESC,p.id ASC LIMIT 6 OFFSET ?`).bind(...values, (page - 1) * 6).all<FreelanceProject>(),
      env.DB!.prepare(`SELECT COUNT(*) AS total FROM freelance_projects p WHERE ${predicate}`).bind(...values).first<{ total: number }>(),
    ]);
    return Response.json({ profiles: [], projects: rows.results, total: count?.total || 0, page, actor, profile }, { headers: freelanceHeaders });
  } catch (error) { return freelanceFailure(error); }
}
