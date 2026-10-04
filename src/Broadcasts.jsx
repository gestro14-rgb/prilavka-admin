import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

export default function Broadcasts() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [allUsers, setAllUsers] = useState(true);
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.getUsers().then(setUsers).catch((e) => setError(e.message)); }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((u) => !needle || `${u.firstName || ''} ${u.username || ''} ${u.telegramId}`.toLowerCase().includes(needle));
  }, [users, query]);
  const all = allUsers;
  const chooseAll = () => { setAllUsers(true); setSelected(new Set()); };
  const clearAll = () => { setAllUsers(false); setSelected(new Set()); };
  const toggle = (id) => { setAllUsers(false); setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(String(id))) next.delete(String(id)); else next.add(String(id));
    return next;
  }); };
  const send = async () => {
    setSending(true); setError('');
    try {
      const response = await api.sendBroadcast({ text, telegramIds: all ? undefined : [...selected], confirm: true });
      setResult(response); setPreview(false);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };
  return <section className="page">
    <div className="page-header"><div><h2>Р Р°СЃСЃС‹Р»РєРё</h2><p className="muted">РЎРѕРѕР±С‰РµРЅРёСЏ С‚РѕР»СЊРєРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј, РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ РІР·Р°РёРјРѕРґРµР№СЃС‚РІРѕРІР°Р»Рё СЃ Р±РѕС‚РѕРј.</p></div></div>
    {error && <div className="error">{error}</div>}
    <div className="form-card">
      <label>РўРµРєСЃС‚ СЃРѕРѕР±С‰РµРЅРёСЏ<textarea rows="6" value={text} onChange={(e) => setText(e.target.value)} maxLength={4096} placeholder="РќР°РїРёС€РёС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ РєР»РёРµРЅС‚Р°РјвЂ¦" /></label>
      <div className="muted">{text.length}/4096 В· РїРѕР»СѓС‡Р°С‚РµР»РµР№: {all ? users.length : selected.size}</div>
      <div className="broadcast-selection-actions"><button type="button" onClick={chooseAll}>Выбрать всех</button><button type="button" onClick={clearAll}>Снять выбор со всех</button><strong>Выбрано: {all ? users.length : selected.size}</strong></div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="РџРѕРёСЃРє РєР»РёРµРЅС‚Р° РїРѕ РёРјРµРЅРё, username РёР»Рё ID" />
      <div className="broadcast-users">
        {filtered.map((u) => <label key={u.telegramId} className="broadcast-user"><input type="checkbox" checked={selected.has(String(u.telegramId))} onChange={() => toggle(u.telegramId)} /><span>{u.firstName || 'Р‘РµР· РёРјРµРЅРё'} {u.username ? `@${u.username}` : ''}<small>{u.telegramId}</small></span></label>)}
      </div>
      <div className="form-actions"><button className="primary" disabled={!text.trim() || sending} onClick={() => setPreview(true)}>РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ Рё РѕС‚РїСЂР°РІРєР°</button></div>
    </div>
    {preview && <div className="modal-backdrop"><div className="modal"><h3>РџРѕРґС‚РІРµСЂРґРёС‚СЊ СЂР°СЃСЃС‹Р»РєСѓ?</h3><p>{all ? `РЎРѕРѕР±С‰РµРЅРёРµ РїРѕР»СѓС‡Р°С‚ РІСЃРµ ${users.length} РєР»РёРµРЅС‚РѕРІ.` : `РЎРѕРѕР±С‰РµРЅРёРµ РїРѕР»СѓС‡Р°С‚ ${selected.size} РєР»РёРµРЅС‚РѕРІ.`}</p><div className="broadcast-preview">{text}</div><div className="form-actions"><button onClick={() => setPreview(false)}>РћС‚РјРµРЅР°</button><button className="primary" onClick={send} disabled={sending}>{sending ? 'РћС‚РїСЂР°РІР»СЏСЋвЂ¦' : 'РџРѕРґС‚РІРµСЂРґРёС‚СЊ'}</button></div></div></div>}
    {result && <div className="success">РћС‚РїСЂР°РІР»РµРЅРѕ: {result.sent}. РћС€РёР±РѕРє: {result.failed}. Р’СЃРµРіРѕ: {result.total}.</div>}
  </section>;
}
