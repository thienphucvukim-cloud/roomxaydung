"use client";

import { useState, type FormEvent } from 'react';
import { ArrowUpRight, FileText, LoaderCircle, Upload } from 'lucide-react';
import { freelanceSpecialties, freelanceStatuses, type FreelanceFile, type FreelanceProfile, type FreelanceProject } from '@/lib/freelance-types';

export async function freelanceFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Không thể xử lý yêu cầu.');
  return body as T;
}
export const freelancePost = <T,>(url: string, body: Record<string, unknown>) => freelanceFetch<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export function FreelanceBadge({ status }: { status: FreelanceProject['status'] }) { return <span className={'fm-badge fm-badge-' + status}>{freelanceStatuses[status]}</span>; }
export function FreelanceProfileForm({ profile, onSaved }: { profile: FreelanceProfile | null; onSaved: (profile: FreelanceProfile) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const fields = new FormData(event.currentTarget);
    try {
      const portfolio = Array.from({ length: 6 }, (_, index) => ({ title: String(fields.get('work-title-' + index) || '').trim(), url: String(fields.get('work-url-' + index) || '').trim() })).filter(item => item.title || item.url);
      const result = await freelancePost<{ profile: FreelanceProfile }>('/api/freelance/profiles', {
        title: fields.get('title'), specialty: fields.get('specialty'), bio: fields.get('bio'), location: fields.get('location'), skills: fields.get('skills'), experience: Number(fields.get('experience') || 0), rate: Number(fields.get('rate') || 0), rateUnit: fields.get('rateUnit'), cover: fields.get('cover'), available: fields.get('available') === 'on', portfolio,
      });
      onSaved(result.profile);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="fm-form"><fieldset disabled={busy}>
    <label>Chức danh của bạn <span>*</span><input name="title" required maxLength={100} defaultValue={profile?.title} placeholder="Kiến trúc sư · Thiết kế nhà ở hiện đại"/></label>
    <div className="fm-form-row"><label>Chuyên môn chính <span>*</span><select name="specialty" defaultValue={profile?.specialty || freelanceSpecialties[0]}>{freelanceSpecialties.map(value => <option key={value}>{value}</option>)}</select></label><label>Địa điểm<input name="location" maxLength={150} defaultValue={profile?.location} placeholder="TP. Hồ Chí Minh"/></label></div>
    <label>Giới thiệu <span>*</span><textarea name="bio" required maxLength={3000} rows={4} defaultValue={profile?.bio} placeholder="Bạn có thể giúp khách hàng làm gì? Phong cách và thế mạnh của bạn là gì?"/></label>
    <label>Kỹ năng & công cụ <small>Phân cách bằng dấu phẩy · tối đa 8</small><input name="skills" maxLength={300} defaultValue={profile?.skills.join(', ')} placeholder="AutoCAD, SketchUp, Revit, Thiết kế nhà phố"/></label>
    <div className="fm-form-row"><label>Kinh nghiệm (năm)<input name="experience" type="number" min={0} max={60} step={1} defaultValue={profile?.experience || 0}/></label><label>Đơn giá tham khảo (VNĐ)<input name="rate" type="number" min={0} max={500000000} step={1} defaultValue={profile?.rate || ''} placeholder="Để trống nếu cần trao đổi"/></label></div>
    <label>Đơn vị báo giá<select name="rateUnit" defaultValue={profile?.rateUnit || 'project'}><option value="project">Theo dự án</option><option value="m2">Theo m²</option></select></label>
    <label>Liên kết ảnh công trình đại diện <small>Không bắt buộc</small><input name="cover" type="url" maxLength={1200} defaultValue={profile?.cover} placeholder="https://… (đường dẫn ảnh)"/></label>
    <details className="fm-portfolio-fields"><summary>Công trình tiêu biểu <span>Tối đa 6 liên kết</span></summary><p>Thêm liên kết đến công trình hoặc bộ hồ sơ của bạn.</p>{Array.from({ length: 6 }, (_, index) => <div className="fm-form-row" key={index}><label>Tên công trình {index + 1}<input name={'work-title-' + index} maxLength={140} defaultValue={profile?.portfolio[index]?.title} placeholder="Nhà phố An Phú"/></label><label>Liên kết công trình<input name={'work-url-' + index} type="url" maxLength={1200} defaultValue={profile?.portfolio[index]?.url} placeholder="https://…"/></label></div>)}</details>
    <label className="fm-check"><input type="checkbox" name="available" defaultChecked={profile?.available ?? true}/>Tôi đang nhận dự án mới</label>
    {error && <p className="fm-error" role="alert">{error}</p>}
    <button className="fm-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="animate-spin"/> : <ArrowUpRight size={17}/>} {profile ? 'Lưu hồ sơ freelancer' : 'Tạo hồ sơ freelancer'}</button>
  </fieldset></form>;
}

export function FreelanceFiles({ files }: { files: FreelanceFile[] }) {
  return <div className="fm-file-list">{files.map(file => <a key={file.id} href={'/api/freelance/files?id=' + file.id}><FileText size={21}/><div><b>{file.name}</b><small>{(file.size / 1048576).toFixed(2)} MB · {file.purpose === 'brief' ? 'Tài liệu yêu cầu' : 'Hồ sơ bàn giao'}</small></div><ArrowUpRight size={17}/></a>)}</div>;
}
export function FreelanceUpload({ projectId, purpose, onUploaded }: { projectId: string; purpose: 'brief' | 'delivery'; onUploaded: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; const form = event.currentTarget;
    setBusy(true); setError('');
    try {
      const data = new FormData(form); data.set('projectId', projectId); data.set('purpose', purpose);
      await freelanceFetch('/api/freelance/files', { method: 'POST', body: data });
      form.reset(); await onUploaded();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải tệp.'); }
    finally { setBusy(false); }
  }
  return <form className="fm-upload" onSubmit={upload}><label><Upload size={23}/><b>{purpose === 'brief' ? 'Thêm tài liệu cho freelancer' : 'Tải lên hồ sơ bàn giao'}</b><small>Bản vẽ, PDF, ảnh, tài liệu hoặc ZIP · tối đa 100 MB</small><input type="file" name="file" required disabled={busy} accept=".pdf,.dwg,.dxf,.skp,.rvt,.rfa,.pln,.zip,.rar,.7z,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.doc,.docx,.txt"/></label>{error && <p className="fm-error" role="alert">{error}</p>}<button className="fm-button fm-button-outline" disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Upload size={16}/>}Tải tài liệu lên</button></form>;
}
