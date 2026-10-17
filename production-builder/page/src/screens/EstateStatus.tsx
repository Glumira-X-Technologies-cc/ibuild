import React, { useState } from 'react';
import { fmtDateTime } from '../format';

type Warning = { code: string; note: string };
type SyncRow = { key: string; path: string; branch: string | null; dirtyCount: number | null; ahead: number | null; behind: number | null; worktreeCount: number | null; headCommit: string | null; originMainCommit: string | null; status: string; warnings: string[]; fetch: { status: string } };
type Counts = { documents: number | null; verified: number | null; sparred: number | null; unverified: number | null; notCarriedInto72: number | null; carryUnknown: number | null; pathReviewed?: number | null; pathSparred?: number | null; pathCouncil?: number | null; pathArena?: number | null; pathVerify?: number | null };
type RecordSet = { name: string; path: string; rows: number; reviewedRows: number; mappedRows: number; documentsCredited: number; verdicts: Record<string, number>; stampDate: string | null; summaryDate?: string | null; firstTs: string | null; lastTs: string | null };
type ListedSet = { name: string; repo?: string; dir: string; kind: string; files?: number; status: string; firstDate?: string | null; lastDate?: string | null };
type DocumentRow = { id: string; status: string; commit: string | null; counts: Counts };
type EstateData = {
  scan?: { runtime?: { commit: string; dirty: boolean; startedAt: string }; commit: string; scannedAt: string; fetchStatus: string; warnings: Warning[] };
  estateSync?: { status: string; checkedAt?: string; repos?: SyncRow[]; warnings?: string[] };
  documentCheckpoint?: { status: string; generatedAt?: string; sourceCommit?: string; path?: string; reason?: string; repositories?: DocumentRow[]; reviewRecordSets?: RecordSet[]; listedReviewRecordSets?: ListedSet[] };
};
const count = (value: number | null | undefined) => value == null ? 'Unknown' : String(value);
const time = (iso?: string) => iso ? fmtDateTime(new Date(iso)) : 'Unknown';
const day = (iso?: string | null) => iso ? iso.slice(0, 10) : null;
const span = (a?: string | null, b?: string | null) => a ? (b && b !== a ? a + ' to ' + b : a) : 'Unknown';
const setDate = (s: RecordSet) => s.firstTs ? span(day(s.firstTs), day(s.lastTs)) : s.stampDate || s.summaryDate || 'Unknown';
const headClass = 'text-left font-semibold py-1 pr-3 whitespace-nowrap';
const cellClass = 'py-1 pr-3 align-top';
export default function EstateStatus({ data }: { data: EstateData }) {
  const [view, setView] = useState<'sync' | 'documents' | 'records'>('sync');
  const scan = data.scan, sync = data.estateSync, checkpoint = data.documentCheckpoint;
  return <section className="text-xs space-y-2">
    <p className="text-[var(--shade-color)]" title={scan?.commit}>
      Main {scan?.commit?.slice(0, 12) || 'unavailable'} · {time(scan?.scannedAt)} · {scan?.fetchStatus === 'fresh' ? 'Fetch succeeded' : scan?.fetchStatus === 'stale' ? 'Fetch failed; cached main' : 'Cached main; press Scan to refresh'}
    </p>
    {scan?.runtime && <p className="text-[var(--shade-color)]" title={scan.runtime.commit}>Server started from {scan.runtime.commit.slice(0, 12)}{scan.runtime.dirty ? ' with local edits' : ''} · {time(scan.runtime.startedAt)}</p>}
    {(scan?.warnings || []).map(w => <p key={w.code}>{w.note}</p>)}
    <div className="flex gap-4">
      <button type="button" className={view === 'sync' ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)]'} onClick={() => setView('sync')}>Repository sync</button>
      <button type="button" className={view === 'documents' ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)]'} onClick={() => setView('documents')}>Document checkpoint</button>
      <button type="button" className={view === 'records' ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)]'} onClick={() => setView('records')}>Review records</button>
    </div>
    {view === 'sync' && <>
      <p className="text-[var(--shade-color)]">Checked {time(sync?.checkedAt)} · {sync?.status || 'unavailable'}</p>
      {!sync?.repos?.length ? <p>Estate sync is unavailable. Check the governance hub installation and scan again.</p> : <div className="overflow-x-auto">
        <table className="w-full"><thead><tr>{['Repository / branch', 'Edits', 'Ahead', 'Behind', 'Worktrees'].map(h => <th className={headClass} key={h}>{h}</th>)}</tr></thead>
          <tbody>{sync.repos.map(row => <React.Fragment key={row.key}>
            <tr className="border-t border-[var(--border-color)]">
              <td className={cellClass} title={row.path + '\nHEAD ' + row.headCommit + '\norigin/main ' + row.originMainCommit}>{row.key}<span className="block text-[var(--shade-color)]">{row.branch || 'Detached / unavailable'} · fetch {row.fetch?.status || 'unknown'}</span></td>
              <td className={cellClass}>{count(row.dirtyCount)}</td><td className={cellClass}>{count(row.ahead)}</td><td className={cellClass}>{count(row.behind)}</td><td className={cellClass}>{count(row.worktreeCount)}</td>
            </tr>
            {row.warnings?.length > 0 && <tr><td colSpan={5} className="pb-2 text-[var(--shade-color)]">{row.warnings.join(' · ')}</td></tr>}
          </React.Fragment>)}</tbody>
        </table>
      </div>}
    </>}
    {view === 'documents' && <>
      <p className="text-[var(--shade-color)]">Recorded audit: {time(checkpoint?.generatedAt)}. Scan reloads this saved checkpoint from main.</p>
      {checkpoint?.status !== 'available' ? <p>{checkpoint?.reason || 'Document checkpoint unavailable. Publish the audit and scan again.'}</p> : <>
        <p className="text-[var(--shade-color)]">Tracked Markdown. Verified and sparred count matching document evidence; zero does not prove no earlier review. Hover a repository for its audited commit.</p>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Repository', 'Docs', 'Verified', 'Sparred', 'Unverified', 'Not carried', 'Carry unknown'].map(h => <th className={headClass} key={h}>{h}</th>)}</tr></thead>
          <tbody>{checkpoint.repositories?.map(row => <tr key={row.id} className="border-t border-[var(--border-color)]">
            <td className={cellClass} title={row.commit || 'Source commit unavailable'}>{row.id}<span className="block text-[var(--shade-color)]">{row.status}</span></td>
            {(['documents', 'verified', 'sparred', 'unverified', 'notCarriedInto72', 'carryUnknown'] as const).map(key => <td key={key} className={cellClass}>{count(row.counts?.[key])}</td>)}
          </tr>)}</tbody>
        </table></div>
        <p className="text-[var(--shade-color)]">Reviewed at path, version not pinned: a saved spar, council, arena or verify record names the repository and path. It reviewed items taken from the document, not the whole document.</p>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Repository', 'Docs', 'Any review', 'Sparred', 'Council', 'Arena', 'Verify sampled'].map(h => <th className={headClass} key={h}>{h}</th>)}</tr></thead>
          <tbody>{checkpoint.repositories?.map(row => <tr key={row.id} className="border-t border-[var(--border-color)]">
            <td className={cellClass}>{row.id}</td>
            {(['documents', 'pathReviewed', 'pathSparred', 'pathCouncil', 'pathArena', 'pathVerify'] as const).map(key => <td key={key} className={cellClass}>{count(row.counts?.[key])}</td>)}
          </tr>)}</tbody>
        </table></div>
      </>}
    </>}
    {view === 'records' && <>
      <p className="text-[var(--shade-color)]">Recorded audit: {time(checkpoint?.generatedAt)}. Each record set, when it ran, and what it decided.</p>
      {!checkpoint?.reviewRecordSets?.length ? <p>No review record sets in this checkpoint. Publish the audit and scan again.</p> : <div className="overflow-x-auto">
        <table className="w-full"><thead><tr>{['Record set', 'Date', 'Rows', 'Mapped', 'Docs credited', 'Verdicts'].map(h => <th className={headClass} key={h}>{h}</th>)}</tr></thead>
          <tbody>{checkpoint.reviewRecordSets.map(s => <tr key={s.name} className="border-t border-[var(--border-color)]">
            <td className={cellClass} title={s.path}>{s.name}</td><td className={cellClass}>{setDate(s)}</td><td className={cellClass}>{s.rows}</td><td className={cellClass}>{s.mappedRows}</td><td className={cellClass}>{s.documentsCredited}</td>
            <td className={cellClass}>{Object.entries(s.verdicts).map(([k, v]) => k + ' ' + v).join(' · ')}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {!!checkpoint?.listedReviewRecordSets?.length && <div className="overflow-x-auto">
        <p className="text-[var(--shade-color)]">Listed only. These records name no document path.</p>
        <table className="w-full"><thead><tr>{['Record set', 'Repository', 'Kind', 'Files', 'Dates'].map(h => <th className={headClass} key={h}>{h}</th>)}</tr></thead>
          <tbody>{checkpoint.listedReviewRecordSets.map(s => <tr key={s.name} className="border-t border-[var(--border-color)]">
            <td className={cellClass} title={s.dir}>{s.name}</td><td className={cellClass}>{s.repo?.split('/').pop() || 'Unknown'}</td><td className={cellClass}>{s.kind}</td><td className={cellClass}>{s.files ?? s.status}</td><td className={cellClass}>{span(s.firstDate, s.lastDate)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </>}
  </section>;
}
