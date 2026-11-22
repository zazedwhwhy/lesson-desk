import React, {useState} from 'react';
import {BookOpen, FileUp, Search, Trash2} from 'lucide-react';
import type {Project} from '../core/model';

const subjects = {english: '英语', chinese: '语文', chemistry: '化学'};
type Subject = keyof typeof subjects;
export type LibraryItem = Pick<Project, 'id' | 'title' | 'example'> & {
  subject?: Subject;
  updatedAt?: string;
  error?: string;
};
type Props = {
  items: LibraryItem[];
  loading: boolean;
  loadError: string;
  reload: () => void;
  busy: boolean;
  create: (title: string, subject: Subject) => void;
  open: (id: string) => void;
  remove: (id: string) => void;
  importBundle: () => void;
  example: () => void;
};

export function ProjectLibrary(p: Props) {
  const [subject, setSubject] = useState<Subject>('english');
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const visible = p.items.filter(item => (item.title + (item.subject ? subjects[item.subject] : '')).includes(query.trim()));
  return <main className="library" data-screen-label="课件列表">
    <h1>我的课件</h1>
    <div className="library-grid paper-sheet">
      <section className="library-create">
        <h2>新建课件</h2>
        <form onSubmit={event => {event.preventDefault(); p.create(title.trim() || subjects[subject] + '试卷讲解', subject);}}>
          <label>学科<select value={subject} onChange={e => setSubject(e.target.value as Subject)}>
            {Object.entries(subjects).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>课件名称<input value={title} onChange={e => setTitle(e.target.value)} placeholder={subjects[subject] + '试卷讲解'} /></label>
          <button className="primary" disabled={p.busy}>新建并整理材料</button>
        </form>
        <div className="library-import"><button disabled={p.busy} onClick={p.importBundle}><FileUp size={16}/>导入课件包</button><button disabled={p.busy} onClick={p.example}><BookOpen size={16}/>打开教学示例</button></div>
      </section>
      <section className="library-recent">
        <div className="library-list-heading"><h2>最近课件</h2>
          {p.items.length > 0 && <label className="library-search"><Search size={16}/><input type="search" aria-label="搜索课件" placeholder="按名称或学科查找" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
        </div>
        {p.loadError && <p role="alert">{p.loadError} <button onClick={p.reload}>重新读取</button></p>}
        {visible.map(item => <div className="library-row" key={item.id}>
          <button className="library-open" disabled={p.busy} onClick={()=>p.open(item.id)}>
            <span><strong>{item.title}</strong><small>{[item.subject && subjects[item.subject], item.example && '预置教学示例', item.error ? '文件读取异常' : item.updatedAt && new Date(item.updatedAt).toLocaleString()].filter(Boolean).join(' · ')}</small></span>
          </button>
          <button className="library-delete" title="移到回收站" aria-label={'删除课件：'+item.title} disabled={p.busy||!window.desk} onClick={()=>p.remove(item.id)}><Trash2 size={16}/></button>
        </div>)}
        {!visible.length && !p.loadError && <p className="library-empty">{p.loading ? '正在读取课件…' : query.trim() ? '没有匹配的课件。' : '还没有课件。新建后即可添加试卷和参考答案。'}</p>}
      </section>
    </div>
  </main>;
}
