import React, { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

const PAGE_SIZE = 10; // 2 cols x 5 rows fits the usable area given the label sheet's margins

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// A wrapping, click-to-edit text block. Plain <input> can't wrap long location/title text onto
// a second line (it just clips), so this uses contentEditable instead — it behaves like a <div>
// (wraps, grows) but stays editable. Synced imperatively via ref rather than React children so
// typing doesn't fight React's reconciliation; the DOM is only touched when `value` changes from
// outside (e.g. switching tags), not as an echo of our own onBlur commit.
function EditableText({ value, onCommit, className, style, placeholder }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.textContent !== (value || '')) {
      ref.current.textContent = value || '';
    }
  }, [value]);
  return (
    <div
      ref={ref}
      className={`tag-editable ${className || ''}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e) => onCommit(e.currentTarget.textContent)}
    />
  );
}

// Standalone, chrome-less print page (declared outside AdminLayout in App.jsx) for 3"x2" bag
// tag labels. Tags are passed via router state from the Exports page's Bag Tags tab — this page
// doesn't fetch anything itself, so a direct nav/refresh with no state shows a fallback. Fields
// are editable in place so a last-minute typo or count correction doesn't require going back and
// regenerating the whole batch.
export default function BagTagsPrint() {
  const location = useLocation();
  const initialTags = location.state?.tags;
  const [tags, setTags] = useState(() =>
    (initialTags || []).map((t) => ({
      ...t,
      dateText: formatDate(t.date),
    }))
  );

  useEffect(() => {
    if (tags && tags.length > 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    // Only auto-print once, on the initial batch — not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTag = (index, field, value) => {
    setTags((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  if (!tags || tags.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <p>No bag tags to print — go back and select events.</p>
        <Link to="/admin/exports" style={{ color: '#3bb889' }}>← Back to Exports</Link>
      </div>
    );
  }

  const pages = chunk(tags, PAGE_SIZE);

  return (
    <div>
      <style>{`
        @page { size: letter; margin: 0.471in 0.2in 0.236in 0in; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media print {
          .no-print { display: none !important; }
        }
        .tag-page {
          display: grid;
          grid-template-columns: repeat(2, 3in);
          grid-auto-rows: 2in;
        }
        .tag-page:not(:last-child) {
          page-break-after: always;
          break-after: page;
        }
        .tag-cell {
          width: 3in;
          height: 2in;
          border: 1px solid #999;
          padding: 0.15in 0.18in;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          font-family: Arial, Helvetica, sans-serif;
          overflow: hidden;
        }
        .tag-title { font-weight: 700; font-size: 14pt; color: #38761d; line-height: 1.15; width: 100%; }
        .tag-bagcount { font-size: 9pt; font-weight: 600; color: #38761d; width: 100%; margin-top: 1px; }
        .tag-line { font-size: 12pt; color: #000; font-weight: 600; margin-top: 3px; width: 100%; }
        .tag-contents { font-size: 10pt; color: #000; margin-top: 14px; font-weight: 600; width: 100%; }
        .tag-datetime { font-size: 6pt; color: #000; margin-top: 2px; width: 100%; }

        .tag-editable {
          outline: none;
          width: 100%;
          padding: 1px 2px;
          border-radius: 3px;
          white-space: pre-wrap;
          overflow-wrap: break-word;
        }
        .tag-editable:empty::before { content: attr(data-placeholder); }
        .tag-editable:hover { background: rgba(59, 184, 137, 0.08); }
        .tag-editable:focus { background: rgba(59, 184, 137, 0.15); }

        .tag-input {
          border: none;
          outline: none;
          background: transparent;
          text-align: center;
          font-family: inherit;
          padding: 1px 2px;
          border-radius: 3px;
        }
        .tag-input:hover { background: rgba(59, 184, 137, 0.08); }
        .tag-input:focus { background: rgba(59, 184, 137, 0.15); }
        .tag-input.num-input { width: 2.4em; text-align: right; }
        .tag-input.num-input::-webkit-inner-spin-button,
        .tag-input.num-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        @media print {
          .tag-input, .tag-editable { background: transparent !important; }
        }
      `}</style>

      <div className="no-print" style={{ padding: '16px 20px', fontFamily: 'Arial, Helvetica, sans-serif', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
        <Link to="/admin/exports" style={{ color: '#3bb889', textDecoration: 'none', fontSize: 14 }}>← Back to Exports</Link>
        <button
          onClick={() => window.print()}
          style={{ background: '#A8E6CF', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          Print
        </button>
        <span style={{ fontSize: 13, color: '#666' }}>{tags.length} label{tags.length !== 1 ? 's' : ''} · {pages.length} page{pages.length !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>Click any field below to edit before printing</span>
      </div>

      {pages.map((page, pi) => (
        <div className="tag-page" key={pi}>
          {page.map((tag, ti) => {
            const idx = pi * PAGE_SIZE + ti;
            return (
              <div className="tag-cell" key={idx}>
                <EditableText
                  className="tag-title"
                  value={tag.title}
                  onCommit={(v) => updateTag(idx, 'title', v)}
                />
                {tag.bagCount > 1 && (
                  <div className="tag-bagcount">Bag {tag.bagIndex} of {tag.bagCount}</div>
                )}
                <EditableText
                  className="tag-line"
                  value={tag.pickupLocation || ''}
                  placeholder="No deliver-to location set"
                  style={tag.pickupLocation ? undefined : { color: '#b45309' }}
                  onCommit={(v) => updateTag(idx, 'pickupLocation', v)}
                />
                <div className="tag-contents" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '2px 4px' }}>
                  <input className="tag-input num-input" type="number" min="0" value={tag.meals || 0} onChange={(e) => updateTag(idx, 'meals', parseInt(e.target.value) || 0)} />
                  <span>entrees</span>
                  {(tag.breakfasts || 0) > 0 && (<><span>·</span><input className="tag-input num-input" type="number" min="0" value={tag.breakfasts || 0} onChange={(e) => updateTag(idx, 'breakfasts', parseInt(e.target.value) || 0)} /><span>breakfasts</span></>)}
                  {(tag.snackBites || 0) > 0 && (<><span>·</span><input className="tag-input num-input" type="number" min="0" value={tag.snackBites || 0} onChange={(e) => updateTag(idx, 'snackBites', parseInt(e.target.value) || 0)} /><span>snack bites</span></>)}
                </div>
                <div className="tag-datetime" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input className="tag-input" style={{ width: '5.5em' }} value={tag.dateText} onChange={(e) => updateTag(idx, 'dateText', e.target.value)} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
