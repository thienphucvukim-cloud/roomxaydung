import { env } from 'cloudflare:workers';
import { freelanceActor, freelanceBody, freelanceFailure, freelanceHeaders, freelanceNumber, freelanceSpecialty, freelanceText, freelanceUrl, freelanceWriter, FreelanceError, getFreelanceProfile } from '@/lib/freelance-server';
import type { FreelancePortfolio } from '@/lib/freelance-types';

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id || id.length > 180) throw new FreelanceError('Hồ sơ không hợp lệ.');
    const profile = await getFreelanceProfile(id);
    if (!profile) throw new FreelanceError('Freelancer chưa tạo hồ sơ trên nền tảng mới.', 404);
    return Response.json({ profile, actor: await freelanceActor() }, { headers: freelanceHeaders });
  } catch (error) { return freelanceFailure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await freelanceWriter(request), body = await freelanceBody(request);
    const title = freelanceText(body.title, 'Chức danh', 100), specialty = freelanceSpecialty(body.specialty);
    const bio = freelanceText(body.bio, 'Giới thiệu', 3000), location = freelanceText(body.location, 'Địa điểm', 150, true);
    const skills = [...new Set(freelanceText(body.skills, 'Kỹ năng', 300, true).split(',').map(s => s.trim()).filter(Boolean))].slice(0, 8);
    const experience = freelanceNumber(body.experience, 'Kinh nghiệm', 0, 60), rate = freelanceNumber(body.rate, 'Đơn giá', 0, 500000000);
    if (!['project', 'm2'].includes(String(body.rateUnit))) throw new FreelanceError('Đơn vị báo giá không hợp lệ.');
    if (typeof body.available !== 'boolean') throw new FreelanceError('Trạng thái nhận việc không hợp lệ.');
    const cover = freelanceUrl(body.cover);
    if (!Array.isArray(body.portfolio) || body.portfolio.length > 6) throw new FreelanceError('Tối đa 6 công trình trong hồ sơ.');
    const portfolio: FreelancePortfolio[] = body.portfolio.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new FreelanceError('Công trình không hợp lệ.');
      return { title: freelanceText(item.title, 'Tên công trình', 140), url: freelanceUrl(item.url, false) };
    });
    await env.DB!.prepare(`INSERT INTO freelance_profiles(user_id,display_name,title,specialty,location,bio,skills,experience,rate,rate_unit,available,cover,portfolio,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,title=excluded.title,specialty=excluded.specialty,location=excluded.location,bio=excluded.bio,skills=excluded.skills,experience=excluded.experience,rate=excluded.rate,rate_unit=excluded.rate_unit,available=excluded.available,cover=excluded.cover,portfolio=excluded.portfolio,updated_at=excluded.updated_at`).bind(actor.id,actor.name,title,specialty,location,bio,JSON.stringify(skills),experience,rate,body.rateUnit,body.available ? 1 : 0,cover,JSON.stringify(portfolio),new Date().toISOString()).run();
    return Response.json({ profile: await getFreelanceProfile(actor.id) }, { headers: freelanceHeaders });
  } catch (error) { return freelanceFailure(error); }
}
